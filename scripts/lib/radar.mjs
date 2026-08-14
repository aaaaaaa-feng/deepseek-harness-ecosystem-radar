const EXACT_PROJECT_PATTERN = /deepseek[-\s]?harness/i;
const DSH_TOPIC_PATTERN = /^(?:deepseek-harness|dsh-plugin)$/i;
const DSH_NAME_PATTERN = /(?:^|\/)(?:[^/]*deepseek[-_]?harness[^/]*|dsh[-_][^/]+|[^/]+[-_]dsh)$/i;
const DSH_TEXT_PATTERN = /\bDSH\b/i;
const IMPLEMENTATION_PATTERN = /plugin|extension|desktop|launcher|client|tui|terminal|cli|vision|ocr|image|browser|playwright|tool|skin|theme|ui|web|bridge|bot|gateway|router|provider|market|store|workshop|installer|docker|android|termux|memory|context|usage|cost|balance|automation|skill|bundle|patch|插件|桌面|启动器|终端|视觉|浏览器|工具|皮肤|主题|桥接|机器人|市场|安装|记忆|上下文|用量|费用|自动化/i;
const DOC_ONLY_PATTERN = /tutorial|guide|handbook|whitepaper|paper|research notes|awesome[-_ ]|curated list|教程|指南|手册|白皮书|论文|研究笔记|精选列表/i;

export function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
  const metadata = `${repo?.full_name || repo?.repo || ''} ${repo?.description || ''} ${topics.join(' ')}`;
  const allText = `${metadata}\n${readme}`;
  const exactProject = EXACT_PROJECT_PATTERN.test(allText);
  const topicMatch = topics.some(topic => DSH_TOPIC_PATTERN.test(topic));
  const dshName = DSH_NAME_PATTERN.test(repo?.full_name || repo?.repo || '');
  const dshText = DSH_TEXT_PATTERN.test(allText);
  const implementation = IMPLEMENTATION_PATTERN.test(allText) || Boolean(repo?.language);
  const docsOnly = DOC_ONLY_PATTERN.test(`${repo?.full_name || repo?.repo || ''} ${repo?.description || ''}`) && !IMPLEMENTATION_PATTERN.test(repo?.description || '');

  if (docsOnly) {
    return {level: 'excluded', reason: '资料型、教程型或纯清单仓库'};
  }
  if ((exactProject || topicMatch) && implementation) {
    return {
      level: 'confirmed',
      reason: topicMatch ? 'GitHub Topic 与实现信号同时命中' : 'README/仓库信息明确提及 DeepSeek Harness 且存在实现信号'
    };
  }
  if (dshName && dshText && implementation) {
    return {level: 'candidate', reason: 'DSH 名称与实现信号命中，但缺少完整名称或官方 Topic 证据'};
  }
  return {level: 'excluded', reason: '相关性证据不足，可能是 DSH 缩写误命中'};
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
    verification: previous.verification || evidence.verification || 'metadata-only',
    evidence_level: previous.evidence_level || evidence.level || 'candidate',
    evidence_reason: previous.evidence_reason || evidence.reason || '',
    evidence_url: previous.evidence_url || evidence.url || `https://github.com/${fullName}#readme`
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

export function buildRankings(projects, snapshots) {
  const orderedSnapshots = [...snapshots].sort((a, b) => a.snapshot_at.localeCompare(b.snapshot_at));
  const latest = orderedSnapshots.at(-1);
  if (!latest) throw new Error('At least one snapshot is required');
  const previous = orderedSnapshots.at(-2) || null;
  const projectByRepo = new Map(projects.map(project => [project.repo, project]));
  const currentRanked = rankMetrics(latest.projects);
  const previousRanked = previous ? rankMetrics(previous.projects) : [];
  const previousByRepo = new Map(previousRanked.map(item => [item.repo, item]));

  const current = currentRanked.map(item => {
    const project = projectByRepo.get(item.repo) || {};
    const before = previousByRepo.get(item.repo);
    return {
      rank: item.rank,
      repo: item.repo,
      url: project.url || `https://github.com/${item.repo}`,
      description: project.description || '',
      category: project.category || '其他实现型扩展',
      stars: item.stars,
      forks: item.forks,
      attention_score: item.attention_score,
      stars_delta: before ? item.stars - before.stars : null,
      forks_delta: before ? item.forks - before.forks : null,
      rank_change: before ? before.rank - item.rank : null,
      created_at: project.created_at || '',
      first_seen_at: project.first_seen_at || ''
    };
  });

  const momentum = previous
    ? current
        .filter(item => item.stars_delta != null)
        .map(item => ({...item, momentum_score: item.stars_delta * 10 + item.forks_delta * 25}))
        .sort((a, b) => b.momentum_score - a.momentum_score || b.stars_delta - a.stars_delta || a.repo.localeCompare(b.repo))
        .map((item, index) => ({...item, momentum_rank: index + 1}))
    : [];

  const categories = Object.entries(
    current.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const previousAt = previous?.snapshot_at || null;
  return {
    schema_version: 1,
    generated_at: latest.snapshot_at,
    latest_snapshot_at: latest.snapshot_at,
    previous_snapshot_at: previousAt,
    observation_window_hours: previousAt
      ? round((new Date(latest.snapshot_at) - new Date(previousAt)) / 3_600_000, 1)
      : null,
    current,
    momentum,
    new_projects: previousAt
      ? current.filter(item => item.first_seen_at && item.first_seen_at > previousAt)
      : [],
    categories: categories.map(([category, count]) => ({category, count}))
  };
}

export function validateProjectSet(projects, cutoffUtc) {
  const errors = [];
  const seen = new Set();
  for (const project of projects) {
    if (!project.repo || !project.repo.includes('/')) errors.push(`Invalid repo: ${project.repo || '(empty)'}`);
    if (seen.has(project.repo)) errors.push(`Duplicate repo: ${project.repo}`);
    seen.add(project.repo);
    if (project.created_at && project.created_at <= cutoffUtc) errors.push(`Before cutoff: ${project.repo}`);
    if (!project.url?.startsWith('https://github.com/')) errors.push(`Invalid URL: ${project.repo}`);
    if (toNumber(project.stars) < 0 || toNumber(project.forks) < 0) errors.push(`Negative metric: ${project.repo}`);
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
