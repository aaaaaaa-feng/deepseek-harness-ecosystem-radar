const EXACT_PROJECT_PATTERN = /deepseek[-\s]?harness/i;
const DSH_TOPIC_PATTERN = /^(?:deepseek-harness|dsh-plugin)$/i;
const DSH_NAME_PATTERN = /(?:^|\/)(?:[^/]*deepseek[-_]?harness[^/]*|dsh[-_][^/]+|[^/]+[-_]dsh)$/i;
const DSH_TEXT_PATTERN = /\bDSH\b/i;
const IMPLEMENTATION_PATTERN = /plugin|extension|desktop|launcher|client|tui|terminal|cli|vision|ocr|image|browser|playwright|tool|skin|theme|ui|web|bridge|bot|gateway|router|provider|market|store|workshop|installer|docker|android|termux|memory|context|usage|cost|balance|automation|skill|bundle|patch|插件|桌面|启动器|终端|视觉|浏览器|工具|皮肤|主题|桥接|机器人|市场|安装|记忆|上下文|用量|费用|自动化/i;
const DOC_ONLY_PATTERN = /tutorial|guide|handbook|whitepaper|paper|research notes|awesome[-_ ]|curated list|教程|指南|手册|白皮书|论文|研究笔记|精选列表/i;
const DIRECT_RELATIONSHIP_PATTERN = /(?:deepseek[-\s]?harness)[\s\S]{0,140}(?:plugin|extension|desktop|client|tool|skin|theme|bridge|gateway|market|插件|桌面|客户端|工具|皮肤|主题|桥接|网关|市场)|(?:plugin|extension|desktop|client|tool|skin|theme|bridge|gateway|market|插件|桌面|客户端|工具|皮肤|主题|桥接|网关|市场)[\s\S]{0,100}(?:for|inside|with|to|面向|适配|用于)[\s\S]{0,30}(?:deepseek[-\s]?harness)/i;

export function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function validateRadarConfig(config) {
  const errors = [];
  const boundedInteger = (key, minimum, maximum) => {
    if (!Number.isInteger(config?.[key]) || config[key] < minimum || config[key] > maximum) {
      errors.push(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
  };
  if (Number.isNaN(Date.parse(config?.release_cutoff_utc))) errors.push('release_cutoff_utc must be a valid timestamp');
  boundedInteger('discovery_lookback_days', 1, 365);
  boundedInteger('search_pages_per_query', 1, 10);
  boundedInteger('max_readmes_per_run', 1, 1_000);
  boundedInteger('api_max_attempts', 1, 5);
  boundedInteger('api_max_retry_delay_ms', 0, 30_000);
  boundedInteger('hourly_snapshot_retention_days', 1, 90);
  boundedInteger('developer_profile_refresh_days', 1, 365);
  boundedInteger('translation_batch_size', 1, 50);
  boundedInteger('translation_max_attempts', 1, 3);
  if (!/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(config?.translation_model || '')) {
    errors.push('translation_model must use publisher/model format');
  }
  if (!Array.isArray(config?.queries) || !config.queries.length || config.queries.some(query => typeof query !== 'string' || !query.includes('{since_date}'))) {
    errors.push('Every discovery query must contain {since_date}');
  } else if (new Set(config.queries).size !== config.queries.length) {
    errors.push('Discovery queries must be unique');
  }
  if (config?.public_repository_url && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(config.public_repository_url)) {
    errors.push('public_repository_url must be an empty string or a GitHub repository URL');
  }
  return errors;
}

export function attentionScore(project) {
  return round(
    70 * Math.log10(toNumber(project.stars) + 1) +
      30 * Math.log10(toNumber(project.forks) + 1),
  );
}

export function categoryFor(input) {
  const repositoryName = String(input?.repo || '').split('/').at(-1) || '';
  const text = typeof input === 'string'
    ? input
    : `${repositoryName} ${input?.description || ''} ${(input?.topics || []).join(' ')}`;
  const rules = [
    ['插件管理与生态工具', /market|marketplace|store|workshop|plugin manager|installed[- ]plugins|find[- ]?plugin|plugin template|template.*plugin|plugin.*template|plugin ecosystem|oh[-_ ]my[-_ ]dsh|suite|toolbox|scaffold|商店|市场|插件管理|插件搜索|插件生态|脚手架/i],
    ['桌面端与启动器', /desktop(?![- ]?(?:pet|companion))|launcher|electron|tauri|webview|windows|macos|桌面(?!宠物|萌宠)|启动器|客户端/i],
    ['视觉与浏览器', /vision|ocr|image|screenshot|browser|playwright|computer[- ]use|visualiz|chart|plot|mermaid|视觉|识图|截图|浏览器|可视化/i],
    ['渠道与模型接入', /bridge|channel|\bbot\b|qqbot|chatbot|im[- ]?bot|messaging bot|gateway|router|provider|lark|feishu|wechat|\bqq\b|model[- ]?(gateway|router|provider|switch|adapter)|桥接|渠道|聊天机器人|网关|路由|飞书|微信|模型(接入|网关|路由|切换|供应商|提供商)/i],
    ['终端与部署', /\btui\b|terminal|termux|docker|kubernetes|helm|server|deploy|终端|部署|容器/i],
    ['记忆、上下文与成本', /memory|context|usage|cost|balance|token|compaction|chat[- ]?import|migration|transcript|session import|记忆|上下文|用量|费用|余额|压缩|导入|迁移|历史消息/i],
    ['界面与体验扩展', /skin|theme|pet|background|composer|status|progress|\bui\b|webui|web ui|minigame|user experience|皮肤|主题|桌宠|壁纸|输入框|状态|进度|小游戏|用户体验/i],
    ['开发与质量工具', /doctor|diagnostic|sandbox|worktree|spec|test|safe|security|automation|subagent|code[- ]review|\bux\b|preset|standard tools|\btdd\b|debugging|planning|collaboration skills|simulation|research tools?|experiment bundles?|诊断|沙箱|工作树|规格|测试|安全|自动化|子代理|代码审查|模拟|实验/i]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || '其他实现型扩展';
}

export function relevanceEvidence(repo, readme = '') {
  const topics = Array.isArray(repo?.topics) ? repo.topics : [];
  const identity = `${repo?.full_name || repo?.repo || ''} ${repo?.description || ''} ${topics.join(' ')}`;
  const metadata = `${identity} ${repo?.language || ''}`;
  const allText = `${metadata}\n${readme}`;
  const exactIdentity = EXACT_PROJECT_PATTERN.test(identity);
  const exactReadme = EXACT_PROJECT_PATTERN.test(readme);
  const topicMatch = topics.some(topic => DSH_TOPIC_PATTERN.test(topic));
  const dshName = DSH_NAME_PATTERN.test(repo?.full_name || repo?.repo || '');
  const dshText = DSH_TEXT_PATTERN.test(allText);
  const implementation = IMPLEMENTATION_PATTERN.test(allText) || Boolean(repo?.language);
  const docsOnly = DOC_ONLY_PATTERN.test(`${repo?.full_name || repo?.repo || ''} ${repo?.description || ''}`) && !IMPLEMENTATION_PATTERN.test(repo?.description || '');

  if (docsOnly) {
    return {level: 'excluded', reason: '资料型、教程型或纯清单仓库'};
  }
  if ((exactIdentity || topicMatch) && implementation) {
    return {
      level: 'confirmed',
      reason: topicMatch ? 'GitHub Topic 与实现信号同时命中' : 'README/仓库信息明确提及 DeepSeek Harness 且存在实现信号'
    };
  }
  if (exactReadme && DIRECT_RELATIONSHIP_PATTERN.test(readme) && implementation) {
    return {level: 'confirmed', reason: 'README 明确说明这是面向 DeepSeek Harness 的实现'};
  }
  if (exactReadme && implementation) {
    return {level: 'candidate', reason: 'README 提及 DeepSeek Harness，但直接实现关系仍需复核'};
  }
  if (dshName && dshText && implementation) {
    return {level: 'candidate', reason: 'DSH 名称与实现信号命中，但缺少完整名称或官方 Topic 证据'};
  }
  return {level: 'excluded', reason: '相关性证据不足，可能是 DSH 缩写误命中'};
}

export function reconcileCatalogs({
  projects = [],
  candidates = [],
  exclusions = [],
  evaluated = [],
  denylist = [],
  observedAt = new Date().toISOString()
}) {
  const projectMap = new Map(projects.map(project => [project.repo.toLowerCase(), project]));
  const candidateMap = new Map(candidates.map(project => [project.repo.toLowerCase(), project]));
  const exclusionMap = new Map(exclusions.map(project => [project.repo.toLowerCase(), project]));
  const denied = new Set(denylist.map(repo => repo.toLowerCase()));

  for (const repository of denylist) {
    const key = repository.toLowerCase();
    const previous = exclusionMap.get(key) || candidateMap.get(key) || projectMap.get(key) || {};
    projectMap.delete(key);
    candidateMap.delete(key);
    exclusionMap.set(key, {
      repo: previous.repo || repository,
      url: previous.url || `https://github.com/${repository}`,
      reason: '维护者 denylist：已确认误收或不属于观察范围',
      discovered_at: previous.discovered_at || previous.first_seen_at || observedAt,
      discovery_queries: [...new Set([...(previous.discovery_queries || []), 'manual-denylist'])]
    });
  }

  for (const {project, discovery_queries = []} of evaluated) {
    const key = project.repo.toLowerCase();
    if (denied.has(key)) continue;
    if (project.evidence_level === 'confirmed') {
      const previous = projectMap.get(key) || candidateMap.get(key) || exclusionMap.get(key);
      projectMap.set(key, {
        ...project,
        discovery_queries: [...new Set([...(previous?.discovery_queries || []), ...discovery_queries])],
        first_seen_at: previous?.first_seen_at || previous?.discovered_at || project.first_seen_at || observedAt,
        last_seen_at: observedAt
      });
      candidateMap.delete(key);
      exclusionMap.delete(key);
    } else if (project.evidence_level === 'candidate') {
      const previous = candidateMap.get(key) || exclusionMap.get(key) || projectMap.get(key);
      projectMap.delete(key);
      exclusionMap.delete(key);
      candidateMap.set(key, {
        ...previous,
        ...project,
        discovery_queries: [...new Set([...(previous?.discovery_queries || []), ...discovery_queries])],
        first_seen_at: previous?.first_seen_at || previous?.discovered_at || project.first_seen_at || observedAt,
        last_seen_at: observedAt
      });
    } else {
      const previous = exclusionMap.get(key) || candidateMap.get(key) || projectMap.get(key);
      projectMap.delete(key);
      candidateMap.delete(key);
      exclusionMap.set(key, {
        repo: project.repo,
        url: project.url,
        reason: project.evidence_reason,
        discovered_at: previous?.discovered_at || previous?.first_seen_at || observedAt,
        discovery_queries: [...new Set([...(previous?.discovery_queries || []), ...discovery_queries])]
      });
    }
  }

  return {
    projects: [...projectMap.values()].sort((a, b) => toNumber(b.stars) - toNumber(a.stars) || a.repo.localeCompare(b.repo)),
    candidates: [...candidateMap.values()].sort((a, b) => toNumber(b.stars) - toNumber(a.stars) || a.repo.localeCompare(b.repo)),
    exclusions: [...exclusionMap.values()].sort((a, b) => a.repo.localeCompare(b.repo))
  };
}

export function normalizeApiProject(api, previous = {}, evidence = {}, observedAt = new Date().toISOString()) {
  const fullName = api.full_name || previous.repo;
  const topics = Array.isArray(api.topics) ? api.topics : (previous.topics || []);
  const description = api.description || previous.description || '';
  return {
    repo: fullName,
    name: api.name || previous.name || fullName?.split('/')[1] || '',
    owner: api.owner?.login || previous.owner || fullName?.split('/')[0] || '',
    url: api.html_url || previous.url || `https://github.com/${fullName}`,
    description,
    created_at: api.created_at || previous.created_at || '',
    updated_at: api.updated_at || previous.updated_at || '',
    pushed_at: api.pushed_at || previous.pushed_at || '',
    stars: toNumber(api.stargazers_count ?? previous.stars),
    forks: toNumber(api.forks_count ?? previous.forks),
    subscribers: api.subscribers_count == null ? (previous.subscribers ?? null) : toNumber(api.subscribers_count),
    open_issues: toNumber(api.open_issues_count ?? previous.open_issues),
    language: api.language || previous.language || '',
    license: api.license?.spdx_id || previous.license || 'NOASSERTION',
    topics,
    fork: Boolean(api.fork ?? previous.fork),
    archived: Boolean(api.archived ?? previous.archived),
    status: api.archived ? 'archived' : 'active',
    category: categoryFor({repo: fullName, description, topics}),
    first_seen_at: previous.first_seen_at || observedAt,
    last_seen_at: observedAt,
    verification: evidence.verification || previous.verification || 'metadata-only',
    evidence_level: evidence.level || previous.evidence_level || 'candidate',
    evidence_reason: evidence.reason || previous.evidence_reason || '',
    evidence_url: evidence.url || previous.evidence_url || `https://github.com/${fullName}#readme`
  };
}

export function snapshotFromProjects(projects, snapshotAt, source = 'github-api') {
  return {
    schema_version: 1,
    snapshot_at: snapshotAt,
    source,
    projects: projects
      .filter(project => project.status === 'active' && project.evidence_level === 'confirmed')
      .map(project => ({
        repo: project.repo,
        stars: toNumber(project.stars),
        forks: toNumber(project.forks),
        open_issues: toNumber(project.open_issues),
        pushed_at: project.pushed_at || '',
        updated_at: project.updated_at || ''
      }))
      .sort((a, b) => a.repo.localeCompare(b.repo))
  };
}

function rankMetrics(items) {
  return [...items]
    .map(item => ({...item, attention_score: attentionScore(item)}))
    .sort((a, b) => b.attention_score - a.attention_score || b.stars - a.stars || a.repo.localeCompare(b.repo))
    .map((item, index) => ({...item, rank: index + 1}));
}

export function buildCategoryRankings(items) {
  const groups = new Map();
  for (const item of items) {
    const category = item.category || '其他实现型扩展';
    const group = groups.get(category) || [];
    group.push(item);
    groups.set(category, group);
  }
  const ecosystemStars = items.reduce((sum, item) => sum + toNumber(item.stars), 0);
  const categories = [...groups].map(([category, projects]) => {
    const ordered = [...projects].sort((a, b) =>
      toNumber(b.attention_score) - toNumber(a.attention_score) ||
      toNumber(b.stars) - toNumber(a.stars) ||
      a.repo.localeCompare(b.repo),
    );
    const comparable = projects.filter(project => project.stars_delta != null);
    const totalStars = projects.reduce((sum, project) => sum + toNumber(project.stars), 0);
    const totalForks = projects.reduce((sum, project) => sum + toNumber(project.forks), 0);
    return {
      category,
      project_count: projects.length,
      project_share: round(100 * projects.length / Math.max(items.length, 1), 1),
      total_stars: totalStars,
      stars_share: round(100 * totalStars / Math.max(ecosystemStars, 1), 1),
      total_forks: totalForks,
      stars_delta: comparable.length
        ? comparable.reduce((sum, project) => sum + toNumber(project.stars_delta), 0)
        : null,
      forks_delta: comparable.length
        ? comparable.reduce((sum, project) => sum + toNumber(project.forks_delta), 0)
        : null,
      comparable_projects: comparable.length,
      leader: ordered[0] ? {
        repo: ordered[0].repo,
        url: ordered[0].url,
        stars: toNumber(ordered[0].stars),
        attention_score: toNumber(ordered[0].attention_score)
      } : null,
      top_projects: ordered.slice(0, 3).map((project, index) => ({
        category_rank: index + 1,
        repo: project.repo,
        url: project.url,
        stars: toNumber(project.stars),
        forks: toNumber(project.forks),
        attention_score: toNumber(project.attention_score),
        stars_delta: project.stars_delta
      }))
    };
  });

  const rankBy = (compare, key, values = categories) => new Map(
    [...values].sort(compare).map((category, index) => [category.category, {[key]: index + 1}]),
  );
  const byStars = rankBy(
    (a, b) => b.total_stars - a.total_stars || b.project_count - a.project_count || a.category.localeCompare(b.category),
    'rank_by_stars',
  );
  const byProjects = rankBy(
    (a, b) => b.project_count - a.project_count || b.total_stars - a.total_stars || a.category.localeCompare(b.category),
    'rank_by_projects',
  );
  const comparableCategories = categories.filter(category => category.stars_delta != null);
  const byMomentum = comparableCategories.length ? rankBy(
    (a, b) => toNumber(b.stars_delta) - toNumber(a.stars_delta) || b.total_stars - a.total_stars || a.category.localeCompare(b.category),
    'rank_by_momentum',
    comparableCategories,
  ) : new Map();

  return categories
    .map(category => ({
      ...category,
      ...byStars.get(category.category),
      ...byProjects.get(category.category),
      rank_by_momentum: byMomentum.get(category.category)?.rank_by_momentum ?? null
    }))
    .sort((a, b) => a.rank_by_stars - b.rank_by_stars);
}

export function buildRankings(projects, snapshots) {
  const orderedSnapshots = snapshots
    .map(snapshot => {
      const timestamp = Date.parse(snapshot?.snapshot_at);
      if (Number.isNaN(timestamp)) throw new Error(`Invalid snapshot timestamp: ${snapshot?.snapshot_at || '(empty)'}`);
      if (!Array.isArray(snapshot.projects)) throw new Error(`Invalid snapshot projects at ${snapshot.snapshot_at}`);
      return {snapshot, timestamp};
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  const latestRecord = orderedSnapshots.at(-1);
  if (!latestRecord) throw new Error('At least one snapshot is required');
  const previousRecord = orderedSnapshots.at(-2) || null;
  if (previousRecord && previousRecord.timestamp >= latestRecord.timestamp) {
    throw new Error('Snapshot timestamps must be unique and increasing');
  }
  const latest = latestRecord.snapshot;
  const previous = previousRecord?.snapshot || null;
  const projectByRepo = new Map(projects.map(project => [project.repo.toLowerCase(), project]));
  const currentRanked = rankMetrics(latest.projects);
  const previousRanked = previous ? rankMetrics(previous.projects) : [];
  const previousByRepo = new Map(previousRanked.map(item => [item.repo.toLowerCase(), item]));

  const current = currentRanked.map(item => {
    const project = projectByRepo.get(item.repo.toLowerCase()) || {};
    const before = previousByRepo.get(item.repo.toLowerCase());
    return {
      rank: item.rank,
      repo: item.repo,
      url: project.url || `https://github.com/${item.repo}`,
      description: project.description || '',
      description_zh: project.description_zh || '',
      translation_status: project.translation_status || 'pending',
      translation_provider: project.translation_provider || '',
      developer: project.developer || null,
      category: project.category || '其他实现型扩展',
      stars: item.stars,
      forks: item.forks,
      attention_score: item.attention_score,
      stars_delta: before ? item.stars - before.stars : null,
      forks_delta: before ? item.forks - before.forks : null,
      rank_change: before ? before.rank - item.rank : null,
      created_at: project.created_at || '',
      first_seen_at: project.first_seen_at || '',
      pushed_at: project.pushed_at || '',
      language: project.language || '',
      license: project.license || 'NOASSERTION'
    };
  });

  const momentum = previous
    ? current
        .filter(item => item.stars_delta != null)
        .map(item => ({...item, momentum_score: item.stars_delta * 10 + item.forks_delta * 25}))
        .sort((a, b) => b.momentum_score - a.momentum_score || b.stars_delta - a.stars_delta || a.repo.localeCompare(b.repo))
        .map((item, index) => ({...item, momentum_rank: index + 1}))
    : [];

  const categoryRankings = buildCategoryRankings(current);

  const previousAt = previous?.snapshot_at || null;
  const history = orderedSnapshots.map(({snapshot}) => ({
    snapshot_at: snapshot.snapshot_at,
    project_count: snapshot.projects.length,
    stars: snapshot.projects.reduce((sum, project) => sum + toNumber(project.stars), 0),
    forks: snapshot.projects.reduce((sum, project) => sum + toNumber(project.forks), 0)
  }));
  const latestTotals = history.at(-1);
  const previousTotals = history.at(-2) || null;
  return {
    schema_version: 1,
    generated_at: latest.snapshot_at,
    latest_snapshot_at: latest.snapshot_at,
    previous_snapshot_at: previousAt,
    observation_window_hours: previousAt
      ? round((latestRecord.timestamp - previousRecord.timestamp) / 3_600_000, 1)
      : null,
    current,
    momentum,
    new_projects: previousAt
      ? current.filter(item => item.first_seen_at && Date.parse(item.first_seen_at) > previousRecord.timestamp)
      : [],
    categories: [...categoryRankings]
      .sort((a, b) => b.project_count - a.project_count || b.total_stars - a.total_stars || a.category.localeCompare(b.category))
      .map(item => ({category: item.category, count: item.project_count})),
    category_rankings: categoryRankings,
    ecosystem_delta: previousTotals ? {
      stars: latestTotals.stars - previousTotals.stars,
      forks: latestTotals.forks - previousTotals.forks,
      projects: latestTotals.project_count - previousTotals.project_count
    } : null,
    history
  };
}

function signalProject(project) {
  return {
    repo: project.repo,
    url: project.url,
    description: project.description || '',
    description_zh: project.description_zh || '',
    translation_status: project.translation_status || 'pending',
    developer: project.developer || null,
    category: project.category || '其他实现型扩展',
    stars: toNumber(project.stars),
    forks: toNumber(project.forks),
    language: project.language || '',
    created_at: project.created_at || '',
    first_seen_at: project.first_seen_at || '',
    pushed_at: project.pushed_at || ''
  };
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildSignals(projects) {
  const active = projects
    .filter(project => project.status === 'active' && project.evidence_level === 'confirmed')
    .map(signalProject);
  const milestones = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000];
  return {
    latest_arrivals: [...active]
      .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at) || b.stars - a.stars || a.repo.localeCompare(b.repo))
      .slice(0, 8),
    recently_active: [...active]
      .filter(project => timestamp(project.pushed_at) > 0)
      .sort((a, b) => timestamp(b.pushed_at) - timestamp(a.pushed_at) || b.stars - a.stars || a.repo.localeCompare(b.repo))
      .slice(0, 8),
    milestone_watch: active
      .map(project => {
        const next_milestone = milestones.find(value => value > project.stars) || Math.ceil((project.stars + 1) / 25_000) * 25_000;
        return {
          ...project,
          next_milestone,
          stars_remaining: next_milestone - project.stars,
          milestone_progress: round(100 * project.stars / next_milestone, 1)
        };
      })
      .sort((a, b) => b.milestone_progress - a.milestone_progress || b.stars - a.stars || a.repo.localeCompare(b.repo))
      .slice(0, 8)
  };
}

export function validateProjectSet(projects, cutoffUtc) {
  const errors = [];
  const seen = new Set();
  const cutoff = Date.parse(cutoffUtc);
  for (const project of projects) {
    if (!project.repo || !project.repo.includes('/')) errors.push(`Invalid repo: ${project.repo || '(empty)'}`);
    const key = String(project.repo || '').toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate repo: ${project.repo}`);
    seen.add(key);
    const createdAt = Date.parse(project.created_at);
    if (Number.isNaN(createdAt)) errors.push(`Invalid created_at: ${project.repo}`);
    else if (!Number.isNaN(cutoff) && createdAt <= cutoff) errors.push(`Before cutoff: ${project.repo}`);
    if (!project.url?.startsWith('https://github.com/')) errors.push(`Invalid URL: ${project.repo}`);
    if (toNumber(project.stars) < 0 || toNumber(project.forks) < 0) errors.push(`Negative metric: ${project.repo}`);
    if (!['confirmed', 'candidate', 'excluded'].includes(project.evidence_level)) errors.push(`Invalid evidence level: ${project.repo}`);
    if (project.evidence_level === 'confirmed' && !project.evidence_reason) errors.push(`Missing evidence reason: ${project.repo}`);
  }
  return errors;
}

export function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function escapeMarkdown(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}
