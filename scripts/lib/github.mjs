const DEFAULT_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const defaultSleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function retryAfterMilliseconds(response, attempt, maximum) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const fromHeader = Number.isFinite(seconds)
      ? seconds * 1_000
      : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(fromHeader) && fromHeader > 0) {
      return Math.min(fromHeader, maximum);
    }
  }
  return Math.min(1_000 * (2 ** attempt), maximum);
}

function shouldRetry(response, body) {
  if (DEFAULT_RETRYABLE_STATUS.has(response.status)) return true;
  if (response.status !== 403) return false;
  return response.headers.get('x-ratelimit-remaining') === '0' ||
    response.headers.has('retry-after') ||
    /secondary rate limit|temporarily unavailable|abuse detection/i.test(body);
}

export function createGitHubClient({
  token = '',
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
  maxAttempts = 3,
  maxRetryDelayMs = 5_000,
  baseUrl = 'https://api.github.com'
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }
  const defaultHeaders = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'deepseek-harness-ecosystem-radar'
  };
  if (token) defaultHeaders.Authorization = `Bearer ${token}`;

  return async function github(pathname, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(`${baseUrl}${pathname}`, {
          headers: {...defaultHeaders, ...(options.headers || {})}
        });
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= maxAttempts) break;
        await sleepImpl(Math.min(1_000 * (2 ** attempt), maxRetryDelayMs));
        continue;
      }

      if (response.status === 404 && options.allow404) return null;
      const body = await response.text();
      if (response.ok) {
        if (options.raw) return body;
        return body ? JSON.parse(body) : null;
      }

      const remaining = response.headers.get('x-ratelimit-remaining');
      lastError = new Error(
        `GitHub API ${response.status} for ${pathname}; remaining=${remaining ?? 'unknown'}; ${body.slice(0, 500)}`,
      );
      if (!shouldRetry(response, body) || attempt + 1 >= maxAttempts) throw lastError;
      await sleepImpl(retryAfterMilliseconds(response, attempt, maxRetryDelayMs));
    }
    throw new Error(`GitHub API request failed for ${pathname}: ${lastError?.message || 'network error'}`);
  };
}

export async function mapLimit(items, limit, worker) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run));
  return output;
}
