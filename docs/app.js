const data = await fetch('./data/latest.json', {cache: 'no-store'}).then(response => {
  if (!response.ok) throw new Error(`无法读取数据：${response.status}`);
  return response.json();
});

const $ = selector => document.querySelector(selector);
const format = value => Number(value || 0).toLocaleString('zh-CN');
const shortDate = value => new Date(value).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false});
const signed = value => value == null ? '—' : value > 0 ? `+${value}` : String(value);
const deltaClass = value => value > 0 ? 'delta-up' : value < 0 ? 'delta-down' : '';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const safeGithubUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : '#';
  } catch {
    return '#';
  }
};

$('#project-count').textContent = format(data.summary.confirmed_projects);
$('#candidate-count').textContent = format(data.summary.candidate_projects);
$('#snapshot-count').textContent = format(data.summary.snapshots);
$('#snapshot-date').textContent = shortDate(data.generated_at);
$('#cutoff').textContent = data.release_cutoff_label;
$('#schedule').textContent = data.schedule_label;
$('#footer-time').textContent = `Snapshot: ${data.generated_at}`;

const ageHours = (Date.now() - new Date(data.generated_at).getTime()) / 3_600_000;
const freshness = $('#freshness');
freshness.textContent = ageHours > 36
  ? `最新快照已超过 36 小时：${shortDate(data.generated_at)}`
  : `最新快照：${shortDate(data.generated_at)}`;
if (ageHours > 36) $('.status-dot').classList.add('stale');

const categorySelect = $('#category');
for (const item of data.rankings.categories) {
  const option = document.createElement('option');
  option.value = item.category;
  option.textContent = `${item.category}（${item.count}）`;
  categorySelect.append(option);
}

function renderRanking() {
  const query = $('#search').value.trim().toLowerCase();
  const category = categorySelect.value;
  const items = data.rankings.current.filter(item => {
    const haystack = `${item.repo} ${item.description}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!category || item.category === category);
  });
  $('#ranking-body').innerHTML = items.map(item => `
    <tr>
      <td>${item.rank}</td>
      <td><a class="repo-link" href="${safeGithubUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a><div class="repo-desc">${escapeHtml(item.description || '暂无简短说明')}</div></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${format(item.stars)}</td>
      <td class="${deltaClass(item.stars_delta)}">${signed(item.stars_delta)}</td>
      <td class="${deltaClass(item.rank_change)}">${signed(item.rank_change)}</td>
    </tr>`).join('');
}
$('#search').addEventListener('input', renderRanking);
categorySelect.addEventListener('change', renderRanking);
renderRanking();

const movers = data.rankings.momentum.slice(0, 8);
if (!movers.length) {
  $('#movers').innerHTML = '<li><span class="index">—</span><span>等待第二个每日快照</span><small>尚无可比较窗口</small></li>';
} else {
  $('#momentum-note').textContent = `真实快照间隔：${data.rankings.observation_window_hours} 小时`;
  $('#movers').innerHTML = movers.map((item, index) => `
    <li><span class="index">${String(index + 1).padStart(2, '0')}</span><a class="repo-link" href="${safeGithubUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a><small>${signed(item.stars_delta)} stars</small></li>`).join('');
}

const maxCategory = Math.max(...data.rankings.categories.map(item => item.count), 1);
$('#category-bars').innerHTML = data.rankings.categories.map(item => `
  <div class="bar-row">
    <div class="bar-label"><span>${escapeHtml(item.category)}</span><strong>${format(item.count)}</strong></div>
    <div class="bar-track"><div class="bar-fill" style="width:${item.count / maxCategory * 100}%"></div></div>
  </div>`).join('');
