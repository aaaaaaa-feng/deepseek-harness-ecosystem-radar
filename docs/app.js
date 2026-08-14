const $ = selector => document.querySelector(selector);
const format = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '—';
};
const formatScore = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', {maximumFractionDigits: 2}) : '—';
};
const shortDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '时间无效'
    : date.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false});
};
const signed = value => {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return '—';
  return number > 0 ? `+${number}` : String(number);
};
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

function showFatalError(error) {
  $('#freshness').textContent = '数据加载失败，请稍后刷新或查看仓库状态页';
  $('.status-dot').classList.add('error');
  $('#ranking-status').textContent = '排名数据暂时不可用';
  $('#ranking-body').innerHTML = '<tr><td class="empty-state" colspan="9"><span>无法读取最新快照。已发布的历史数据不会因此被改写。</span></td></tr>';
  $('#movers').innerHTML = '<li><span class="index">!</span><span>暂时无法读取趋势</span><small>请稍后重试</small></li>';
  $('#category-bars').textContent = '分类数据暂时不可用';
  console.error('Radar initialization failed', error);
}

async function init() {
  const response = await fetch('./data/latest.json', {cache: 'no-store'});
  if (!response.ok) throw new Error(`无法读取数据：${response.status}`);
  const data = await response.json();
  if (!data?.rankings?.current || !data?.summary) throw new Error('数据结构不完整');

  $('#project-count').textContent = format(data.summary.confirmed_projects);
  $('#candidate-count').textContent = format(data.summary.candidate_projects);
  $('#snapshot-count').textContent = format(data.summary.snapshots);
  $('#snapshot-date').textContent = shortDate(data.generated_at);
  const developerRegions = data.summary.developer_regions || {};
  $('#region-counts').textContent = `${format(developerRegions.mainland_china || 0)} / ${format(developerRegions.overseas || 0)}`;
  $('#region-unknown').textContent = `国内 / 海外 · 港澳台 ${format(developerRegions.greater_china || 0)} · 未知 ${format(developerRegions.unknown || 0)}`;
  $('#cutoff').textContent = data.release_cutoff_label;
  $('#schedule').textContent = data.schedule_label;
  $('#footer-time').textContent = `Snapshot: ${data.generated_at}`;

  if (data.repository_url) {
    const repositoryLink = $('#repository-link');
    const repositoryUrl = safeGithubUrl(data.repository_url);
    if (repositoryUrl !== '#') {
      repositoryLink.href = repositoryUrl;
      repositoryLink.hidden = false;
    }
  }

  const generatedAt = new Date(data.generated_at).getTime();
  const ageHours = (Date.now() - generatedAt) / 3_600_000;
  if (!Number.isFinite(ageHours)) throw new Error('快照时间无效');
  const freshness = $('#freshness');
  freshness.textContent = ageHours > 36
    ? `最新快照已超过 36 小时：${shortDate(data.generated_at)}`
    : `最新快照：${shortDate(data.generated_at)}`;
  if (ageHours > 36) $('.status-dot').classList.add('stale');

  const windowHours = data.rankings.observation_window_hours;
  $('#ranking-window').textContent = windowHours == null
    ? '由 Stars 与 Forks 的对数分数计算；当前只有一个快照，变化列暂不生成。'
    : `由 Stars 与 Forks 的对数分数计算；变化列使用真实 ${windowHours} 小时快照窗口。`;
  $('#window-header').textContent = windowHours == null ? '窗口 Stars Δ' : `${windowHours}h Stars Δ`;

  const categorySelect = $('#category');
  for (const item of data.rankings.categories) {
    const option = document.createElement('option');
    option.value = item.category;
    option.textContent = `${item.category}（${item.count}）`;
    categorySelect.append(option);
  }
  const regionSelect = $('#region');
  const regionOptions = [
    ['mainland_china', '国内'],
    ['greater_china', '中国港澳台'],
    ['overseas', '海外'],
    ['unknown', '未知']
  ];
  for (const [value, label] of regionOptions) {
    const count = Number(developerRegions[value] || 0);
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${label}（${format(count)} 位维护者）`;
    regionSelect.append(option);
  }

  function renderRanking() {
    const query = $('#search').value.trim().toLowerCase();
    const category = categorySelect.value;
    const region = regionSelect.value;
    const items = data.rankings.current.filter(item => {
      const developer = item.developer || {};
      const haystack = `${item.repo} ${item.description_zh || ''} ${item.description || ''} ${item.category} ${developer.location || ''} ${developer.region_label || ''}`.toLowerCase();
      return (!query || haystack.includes(query)) &&
        (!category || item.category === category) &&
        (!region || developer.region === region);
    });
    const status = $('#ranking-status');
    status.textContent = items.length
      ? `显示 ${items.length} / ${data.rankings.current.length} 个项目`
      : '没有匹配项目，请调整搜索词或分类';
    $('#ranking-body').innerHTML = items.length ? items.map(item => {
      const developer = item.developer || {};
      const translated = item.translation_status === 'translated' && item.description_zh && item.description_zh !== item.description;
      const original = translated
        ? `<details class="original-desc"><summary>查看英文原文</summary><p>${escapeHtml(item.description)}</p></details>`
        : '';
      const description = item.description_zh || item.description || '暂无简短说明';
      return `
      <tr>
        <td class="numeric">${format(item.rank)}</td>
        <td><a class="repo-link" href="${safeGithubUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a><div class="repo-desc">${escapeHtml(description)}</div>${original}</td>
        <td><a class="region-badge region-${escapeHtml(developer.region || 'unknown')}" href="${safeGithubUrl(developer.profile_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(developer.region_label || '未知')}</a><div class="region-location">${escapeHtml(developer.location || '未公开')}</div></td>
        <td>${escapeHtml(item.category)}</td>
        <td class="numeric">${format(item.stars)}</td>
        <td class="numeric">${format(item.forks)}</td>
        <td class="numeric">${formatScore(item.attention_score)}</td>
        <td class="numeric ${deltaClass(item.stars_delta)}">${signed(item.stars_delta)}</td>
        <td class="numeric ${deltaClass(item.rank_change)}">${signed(item.rank_change)}</td>
      </tr>`;
    }).join('') : '<tr><td class="empty-state" colspan="9"><span>没有匹配项目。清空搜索词或重置筛选后可恢复完整排名。</span></td></tr>';
  }
  $('#search').addEventListener('input', renderRanking);
  categorySelect.addEventListener('change', renderRanking);
  regionSelect.addEventListener('change', renderRanking);
  renderRanking();

  const movers = data.rankings.momentum.slice(0, 8);
  if (!movers.length) {
    $('#movers').innerHTML = '<li><span class="index">—</span><span>等待第二个观察点</span><small>尚无可比较窗口</small></li>';
  } else {
    $('#momentum-note').textContent = `真实快照间隔：${windowHours} 小时`;
    $('#movers').innerHTML = movers.map((item, index) => `
      <li><span class="index">${String(index + 1).padStart(2, '0')}</span><a class="repo-link" href="${safeGithubUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a><small>${signed(item.stars_delta)} stars</small></li>`).join('');
  }

  const maxCategory = Math.max(...data.rankings.categories.map(item => item.count), 1);
  $('#category-bars').innerHTML = data.rankings.categories.map(item => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(item.category)}</span><strong>${format(item.count)}</strong></div>
      <progress class="bar-progress" max="${maxCategory}" value="${Number(item.count)}">${format(item.count)}</progress>
    </div>`).join('');
}

init().catch(showFatalError);
