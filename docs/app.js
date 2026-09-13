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
const githubLoginFor = item => {
  const login = String(item?.developer?.login || item?.repo?.split('/')[0] || '').trim();
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login) ? login : '';
};
const githubAvatarUrl = login => login
  ? `https://github.com/${encodeURIComponent(login)}.png?size=240`
  : '';
const avatarInitials = login => {
  const letters = String(login || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  return letters || 'GH';
};
const repositoryName = repo => String(repo || '').split('/').filter(Boolean).at(-1) || 'project';
const planetAccentClass = category => {
  const hash = [...String(category || '')].reduce((total, character) => (total * 31 + character.codePointAt(0)) >>> 0, 0);
  return `planet-accent-${hash % 6}`;
};

function showFatalError(error) {
  $('#freshness').textContent = '数据加载失败，请稍后刷新或查看仓库状态页';
  $('.status-dot').classList.add('error');
  $('#ranking-status').textContent = '排名数据暂时不可用';
  $('#ranking-range').textContent = '排名视窗暂时不可用';
  $('#ranking-progress-bar').style.width = '0%';
  $('#ranking-scroll-next').disabled = true;
  $('#ranking-body').innerHTML = '<tr><td class="empty-state" colspan="9"><span>无法读取最新快照。已发布的历史数据不会因此被改写。</span></td></tr>';
  $('#category-podium').textContent = '分类榜暂时不可用';
  $('#category-ranking-body').innerHTML = '<tr><td class="empty-state" colspan="7"><span>无法读取分类数据。</span></td></tr>';
  $('#planet-leaders').textContent = '';
  $('#planet-field').textContent = '';
  $('#planet-detail').innerHTML = '<p class="planet-detail-loading">头像星球暂时无法读取，请稍后刷新。</p>';
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

  const planetItems = data.rankings.current.slice(0, 20);
  const planetStage = $('#planet-stage');
  const planetDetail = $('#planet-detail');
  const planetLeaders = $('#planet-leaders');
  const planetField = $('#planet-field');

  const renderPlanetOrb = (item, index) => {
    const rank = Number(item.rank) || index + 1;
    const login = githubLoginFor(item);
    const avatarUrl = githubAvatarUrl(login);
    const avatarImage = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-github-avatar>`
      : '';
    const label = `第 ${rank} 名，${item.repo}，${format(item.stars)} Stars，查看项目详情`;
    return `
      <div class="planet-item orb-rank-${rank} ${planetAccentClass(item.category)}" role="listitem" data-orbit-rank="${rank}">
        <button class="project-orb${avatarUrl ? '' : ' avatar-missing'}" type="button" data-planet-index="${index}" aria-pressed="false" aria-label="${escapeHtml(label)}">
          <span class="orb-avatar" aria-hidden="true">
            <span class="orb-fallback">${escapeHtml(avatarInitials(login))}</span>
            ${avatarImage}
            <span class="orb-rank">#${String(rank).padStart(2, '0')}</span>
          </span>
          <span class="orb-repo">${escapeHtml(repositoryName(item.repo))}</span>
          <span class="orb-author">@${escapeHtml(login || 'unknown')}</span>
        </button>
      </div>`;
  };

  const rankChangeText = value => {
    const number = Number(value);
    if (value == null || !Number.isFinite(number)) return '首次进入可比窗口，暂无排名变化';
    if (number > 0) return `较上一可比快照上升 ${number} 位`;
    if (number < 0) return `较上一可比快照下降 ${Math.abs(number)} 位`;
    return '较上一可比快照名次不变';
  };

  function renderPlanetDetail(item) {
    const rank = Number(item.rank) || 0;
    const developer = item.developer || {};
    const login = githubLoginFor(item);
    const avatarUrl = githubAvatarUrl(login);
    const repositoryUrl = safeGithubUrl(item.url);
    const profileUrl = safeGithubUrl(developer.profile_url || (login ? `https://github.com/${login}` : ''));
    const windowLabel = windowHours == null ? '窗口 Stars Δ' : `${windowHours}h Stars Δ`;
    const description = item.description_zh || item.description || '暂无简短说明。';
    const avatarImage = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-github-avatar>`
      : '';
    planetDetail.className = `planet-detail ${planetAccentClass(item.category)}${avatarUrl ? '' : ' avatar-missing'}`;
    planetDetail.innerHTML = `
      <div class="planet-detail-header">
        <div class="planet-detail-avatar" aria-hidden="true">
          <span class="orb-fallback">${escapeHtml(avatarInitials(login))}</span>
          ${avatarImage}
        </div>
        <div>
          <p class="planet-detail-kicker">CURRENT ATTENTION · #${String(rank).padStart(2, '0')}</p>
          <h3>${escapeHtml(item.repo)}</h3>
          <p class="planet-maintainer">维护者 ${profileUrl === '#' ? `@${escapeHtml(login || 'unknown')}` : `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${escapeHtml(login)}</a>`}</p>
        </div>
      </div>
      <div class="planet-tags">
        <span>${escapeHtml(item.category || '未分类')}</span>
        <span>${escapeHtml(developer.region_label || '所在地未知')}</span>
      </div>
      <p class="planet-description">${escapeHtml(description)}</p>
      <dl class="planet-stats">
        <div><dt>Stars</dt><dd>${format(item.stars)}</dd></div>
        <div><dt>Forks</dt><dd>${format(item.forks)}</dd></div>
        <div><dt>关注分</dt><dd>${formatScore(item.attention_score)}</dd></div>
        <div><dt>${escapeHtml(windowLabel)}</dt><dd class="${deltaClass(item.stars_delta)}">${signed(item.stars_delta)}</dd></div>
      </dl>
      <p class="planet-rank-change">${escapeHtml(rankChangeText(item.rank_change))}</p>
      ${repositoryUrl === '#' ? '' : `<a class="planet-repo-cta" href="${repositoryUrl}" target="_blank" rel="noopener noreferrer">打开 GitHub 仓库 <span aria-hidden="true">↗</span></a>`}`;
  }

  function activatePlanetItem(index, {focus = false} = {}) {
    const item = planetItems[index];
    if (!item) return;
    planetStage.querySelectorAll('.project-orb').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.planetIndex) === index));
    });
    renderPlanetDetail(item);
    if (focus) planetStage.querySelector(`[data-planet-index="${index}"]`)?.focus();
  }

  if (planetItems.length) {
    planetLeaders.innerHTML = planetItems.slice(0, 3).map(renderPlanetOrb).join('');
    planetField.innerHTML = planetItems.slice(3).map((item, fieldIndex) => renderPlanetOrb(item, fieldIndex + 3)).join('');
    activatePlanetItem(0);
  } else {
    planetDetail.innerHTML = '<p class="planet-detail-loading">当前快照还没有可展示的项目。</p>';
  }

  planetStage.addEventListener('click', event => {
    const button = event.target.closest('[data-planet-index]');
    if (button) activatePlanetItem(Number(button.dataset.planetIndex));
  });
  planetStage.addEventListener('focusin', event => {
    const button = event.target.closest('[data-planet-index]');
    if (button) activatePlanetItem(Number(button.dataset.planetIndex));
  });
  planetStage.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const button = event.target.closest('[data-planet-index]');
    if (!button) return;
    const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    const nextIndex = (Number(button.dataset.planetIndex) + step + planetItems.length) % planetItems.length;
    event.preventDefault();
    activatePlanetItem(nextIndex, {focus: true});
  });
  planetStage.addEventListener('error', event => {
    if (!event.target.matches('img[data-github-avatar]')) return;
    event.target.closest('.project-orb, .planet-detail')?.classList.add('avatar-missing');
  }, true);
  planetDetail.addEventListener('error', event => {
    if (!event.target.matches('img[data-github-avatar]')) return;
    planetDetail.classList.add('avatar-missing');
  }, true);

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

  const rankingFrame = $('#ranking-frame');
  const rankingViewport = $('#ranking-viewport');
  const rankingRange = $('#ranking-range');
  const rankingProgressBar = $('#ranking-progress-bar');
  const rankingScrollNext = $('#ranking-scroll-next');
  const rankingScrollTop = $('#ranking-scroll-top');
  rankingViewport.setAttribute('aria-label', `${data.rankings.current.length} 个项目的完整关注度排名`);
  let rankingViewportFrame = 0;

  function updateRankingViewport() {
    rankingViewportFrame = 0;
    const rows = [...document.querySelectorAll('#ranking-body tr[data-rank]')];
    const maxScroll = Math.max(0, rankingViewport.scrollHeight - rankingViewport.clientHeight);
    const progress = maxScroll ? rankingViewport.scrollTop / maxScroll : 0;
    const atStart = rankingViewport.scrollTop <= 2;
    const atEnd = maxScroll === 0 || rankingViewport.scrollTop >= maxScroll - 2;
    rankingProgressBar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    rankingScrollNext.disabled = atEnd;
    rankingScrollTop.disabled = atStart;
    rankingFrame.classList.toggle('is-at-start', atStart);
    rankingFrame.classList.toggle('is-at-end', atEnd);

    if (!rows.length) {
      rankingRange.textContent = '当前无匹配结果';
      return;
    }
    const viewportRect = rankingViewport.getBoundingClientRect();
    const headerHeight = $('#ranking-table thead')?.getBoundingClientRect().height || 0;
    const visibleRows = rows.filter(row => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewportRect.top + headerHeight && rect.top < viewportRect.bottom;
    });
    const first = visibleRows[0] || rows[0];
    const last = visibleRows.at(-1) || first;
    const firstRank = first.dataset.rank;
    const lastRank = last.dataset.rank;
    const range = firstRank === lastRank ? `#${firstRank}` : `#${firstRank}–#${lastRank}`;
    rankingRange.textContent = `当前可见 ${range} · ${rows.length} 个结果`;
  }

  function scheduleRankingViewportUpdate() {
    if (rankingViewportFrame) return;
    rankingViewportFrame = requestAnimationFrame(updateRankingViewport);
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
      <tr data-rank="${Number(item.rank)}">
        <td class="numeric" data-label="排名">${format(item.rank)}</td>
        <td data-label="项目"><a class="repo-link" href="${safeGithubUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a><div class="repo-desc">${escapeHtml(description)}</div>${original}</td>
        <td data-label="维护者公开所在地"><a class="region-badge region-${escapeHtml(developer.region || 'unknown')}" href="${safeGithubUrl(developer.profile_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(developer.region_label || '未知')}</a><div class="region-location">${escapeHtml(developer.location || '未公开')}</div></td>
        <td data-label="分类">${escapeHtml(item.category)}</td>
        <td class="numeric" data-label="Stars">${format(item.stars)}</td>
        <td class="numeric" data-label="Forks">${format(item.forks)}</td>
        <td class="numeric" data-label="关注分">${formatScore(item.attention_score)}</td>
        <td class="numeric ${deltaClass(item.stars_delta)}" data-label="窗口 Stars Δ">${signed(item.stars_delta)}</td>
        <td class="numeric ${deltaClass(item.rank_change)}" data-label="排名变化">${signed(item.rank_change)}</td>
      </tr>`;
    }).join('') : '<tr><td class="empty-state" colspan="9"><span>没有匹配项目。清空搜索词或重置筛选后可恢复完整排名。</span></td></tr>';
    rankingViewport.scrollTop = 0;
    scheduleRankingViewportUpdate();
  }
  rankingViewport.addEventListener('scroll', scheduleRankingViewportUpdate, {passive: true});
  rankingViewport.addEventListener('toggle', scheduleRankingViewportUpdate, true);
  rankingViewport.addEventListener('keydown', event => {
    const maxScroll = Math.max(0, rankingViewport.scrollHeight - rankingViewport.clientHeight);
    const atStart = rankingViewport.scrollTop <= 2;
    const atEnd = maxScroll === 0 || rankingViewport.scrollTop >= maxScroll - 2;
    const pageStep = Math.max(160, Math.round(rankingViewport.clientHeight * .82));
    const keyActions = {
      ArrowDown: {blocked: atEnd, top: rankingViewport.scrollTop + 72},
      ArrowUp: {blocked: atStart, top: rankingViewport.scrollTop - 72},
      PageDown: {blocked: atEnd, top: rankingViewport.scrollTop + pageStep},
      PageUp: {blocked: atStart, top: rankingViewport.scrollTop - pageStep},
      End: {blocked: atEnd, top: maxScroll},
      Home: {blocked: atStart, top: 0}
    };
    const action = keyActions[event.key];
    if (!action) return;
    if (action.blocked) {
      const outerSteps = {
        ArrowDown: 72,
        ArrowUp: -72,
        PageDown: pageStep,
        PageUp: -pageStep
      };
      if (outerSteps[event.key]) {
        event.preventDefault();
        window.scrollBy({top: outerSteps[event.key], behavior: 'auto'});
      }
      return;
    }
    event.preventDefault();
    rankingViewport.scrollTo({top: action.top, behavior: 'auto'});
  });
  window.addEventListener('resize', scheduleRankingViewportUpdate, {passive: true});
  rankingScrollNext.addEventListener('click', () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const pageStep = Math.max(160, Math.round(rankingViewport.clientHeight * .82));
    rankingViewport.scrollBy({top: pageStep, behavior});
  });
  rankingScrollTop.addEventListener('click', () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    rankingViewport.scrollTo({top: 0, behavior});
  });
  $('#search').addEventListener('input', renderRanking);
  categorySelect.addEventListener('change', renderRanking);
  regionSelect.addEventListener('change', renderRanking);
  renderRanking();

  const categoryRankingItems = Array.isArray(data.rankings.category_rankings)
    ? data.rankings.category_rankings
    : [];
  const categorySortMeta = {
    stars: {
      key: 'total_stars',
      label: 'Stars 总量',
      note: '按分类内项目的 Stars 总量排序；头部项目可能显著影响结果。'
    },
    projects: {
      key: 'project_count',
      label: '项目数量',
      note: '按已确认项目数量排序；用于观察哪个方向更拥挤或更多样。'
    },
    momentum: {
      key: 'stars_delta',
      label: windowHours == null ? '窗口 Stars 增长' : `${windowHours}h Stars 增长`,
      note: windowHours == null
        ? '至少有两个真实快照后，才会生成分类窗口增长榜。'
        : `按真实 ${windowHours} 小时窗口内的分类 Stars 增量排序；暂无可比项目的新分类不参与。`
    }
  };
  const momentumAvailable = windowHours != null && categoryRankingItems.some(item => item.stars_delta != null);
  const momentumButton = $('[data-category-sort="momentum"]');
  momentumButton.disabled = !momentumAvailable;
  if (!momentumAvailable) {
    momentumButton.textContent = '窗口增长（等待快照）';
    momentumButton.title = '第二个真实快照出现后自动启用';
  }

  const orderedCategories = mode => {
    const key = categorySortMeta[mode].key;
    return categoryRankingItems
      .filter(item => mode !== 'momentum' || item.stars_delta != null)
      .sort((a, b) =>
      Number(b[key] ?? Number.NEGATIVE_INFINITY) - Number(a[key] ?? Number.NEGATIVE_INFINITY) ||
      Number(b.total_stars) - Number(a.total_stars) ||
      a.category.localeCompare(b.category),
      );
  };

  function renderCategoryRanking(mode = 'stars') {
    const meta = categorySortMeta[mode] || categorySortMeta.stars;
    const items = orderedCategories(mode);
    document.querySelectorAll('[data-category-sort]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.categorySort === mode));
    });
    $('#category-ranking-note').textContent = meta.note;
    $('#category-podium').innerHTML = items.slice(0, 3).map((item, index) => `
      <article class="category-card">
        <span class="category-card-rank">${String(index + 1).padStart(2, '0')}</span>
        <p>${escapeHtml(item.category)}</p>
        <strong>${mode === 'momentum' ? signed(item[meta.key]) : format(item[meta.key])}</strong>
        <small>${escapeHtml(meta.label)}</small>
        <ol>${item.top_projects.map(project => `<li><a href="${safeGithubUrl(project.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(project.repo)}</a><span>${format(project.stars)} ★</span></li>`).join('')}</ol>
        <button class="category-jump" type="button" data-category-filter="${escapeHtml(item.category)}">查看该类 ${format(item.project_count)} 个项目</button>
      </article>`).join('');
    $('#category-ranking-body').innerHTML = items.map((item, index) => `
      <tr>
        <td class="numeric" data-label="分类排名">${format(index + 1)}</td>
        <td data-label="功能分类"><button class="category-name-button" type="button" data-category-filter="${escapeHtml(item.category)}">${escapeHtml(item.category)}</button></td>
        <td class="numeric" data-label="项目数">${format(item.project_count)}</td>
        <td class="numeric" data-label="Stars 总量">${format(item.total_stars)}</td>
        <td class="numeric" data-label="Stars 占比">${formatScore(item.stars_share)}%</td>
        <td class="numeric ${deltaClass(item.stars_delta)}" data-label="窗口 Stars Δ">${signed(item.stars_delta)}</td>
        <td data-label="头部项目">${item.leader ? `<a class="repo-link" href="${safeGithubUrl(item.leader.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.leader.repo)}</a><div class="region-location">${format(item.leader.stars)} Stars</div>` : '—'}</td>
      </tr>`).join('');
  }

  $('#category-ranking').addEventListener('click', event => {
    const sortButton = event.target.closest('[data-category-sort]');
    if (sortButton && !sortButton.disabled) {
      renderCategoryRanking(sortButton.dataset.categorySort);
      return;
    }
    const categoryButton = event.target.closest('[data-category-filter]');
    if (!categoryButton) return;
    $('#search').value = '';
    regionSelect.value = '';
    categorySelect.value = categoryButton.dataset.categoryFilter;
    renderRanking();
    $('#ranking').scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  renderCategoryRanking();

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
