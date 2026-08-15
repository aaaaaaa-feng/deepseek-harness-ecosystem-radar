import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyProjectEnrichment, DEVELOPER_REGION_LABELS} from './lib/enrichment.mjs';
import {buildRankings, buildSignals, csvCell, escapeMarkdown} from './lib/radar.mjs';
import {dedupeSnapshotRecords, loadSnapshotRecords, snapshotRecordStats} from './lib/snapshots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const writeText = async (relative, content) => {
  const target = path.join(root, relative);
  const temporary = path.join(path.dirname(target), `.tmp-${path.basename(target)}-${process.pid}`);
  await fs.mkdir(path.dirname(target), {recursive: true});
  try {
    await fs.writeFile(temporary, content);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, {force: true});
  }
};
const writeJson = async (relative, value) => writeText(relative, `${JSON.stringify(value, null, 2)}\n`);

function replaceSection(markdown, start, end, content) {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error(`README markers missing: ${start} / ${end}`);
  }
  return `${markdown.slice(0, startIndex + start.length)}\n${content.trim()}\n${markdown.slice(endIndex)}`;
}

function delta(value) {
  if (value == null) return '—';
  if (value > 0) return `+${value}`;
  return String(value);
}

export async function buildArtifacts() {
  const [config, projectsPayload, candidatesPayload, developerPayload, translationPayload] = await Promise.all([
    readJson('config/radar.json'),
    readJson('data/projects.json'),
    readJson('data/candidates.json'),
    readJson('data/developers.json'),
    readJson('data/translations.json')
  ]);
  const snapshotRecords = await loadSnapshotRecords(root);
  const uniqueSnapshotRecords = dedupeSnapshotRecords(snapshotRecords);
  const snapshotStats = snapshotRecordStats(snapshotRecords);
  const snapshots = uniqueSnapshotRecords.map(record => record.snapshot);
  const enrichedProjects = applyProjectEnrichment(projectsPayload.projects, developerPayload, translationPayload);
  const rankings = buildRankings(enrichedProjects, snapshots);
  const signals = buildSignals(enrichedProjects);
  const repositoryUrl = config.public_repository_url;
  const siteUrl = config.public_site_url;
  const categoryPayload = {
    schema_version: 1,
    generated_at: rankings.generated_at,
    observation_window_hours: rankings.observation_window_hours,
    categories: rankings.category_rankings
  };
  await Promise.all([
    writeJson('data/rankings.json', rankings),
    writeJson('data/categories.json', categoryPayload)
  ]);

  const activeProjects = enrichedProjects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
  const developerAccounts = new Map(activeProjects.map(project => [project.developer.login.toLowerCase(), project.developer]));
  const developerRegions = Object.keys(DEVELOPER_REGION_LABELS).reduce((counts, region) => ({...counts, [region]: 0}), {});
  for (const developer of developerAccounts.values()) {
    const region = Object.hasOwn(developerRegions, developer.region) ? developer.region : 'unknown';
    developerRegions[region] += 1;
  }
  const translationStatus = activeProjects.reduce((counts, project) => {
    counts[project.translation_status] = (counts[project.translation_status] || 0) + 1;
    return counts;
  }, {});
  const latest = {
    schema_version: 2,
    title: 'DeepSeek Harness 生态早期雷达',
    generated_at: rankings.generated_at,
    release_cutoff_utc: config.release_cutoff_utc,
    release_cutoff_label: config.release_cutoff_label,
    schedule_label: config.schedule_label,
    repository_url: repositoryUrl,
    site_url: siteUrl,
    summary: {
      confirmed_projects: activeProjects.length,
      candidate_projects: candidatesPayload.candidates.length,
      snapshots: snapshots.length,
      hourly_snapshots: snapshotStats.hourly,
      daily_archives: snapshotStats.archives,
      has_momentum_window: Boolean(rankings.previous_snapshot_at),
      developer_accounts: developerAccounts.size,
      developer_regions: developerRegions,
      translated_descriptions: translationStatus.translated || 0,
      source_chinese_descriptions: translationStatus['source-zh'] || 0,
      pending_translations: translationStatus.pending || 0
    },
    rankings,
    signals,
    projects: activeProjects
  };
  await writeJson('data/latest.json', latest);
  await writeJson('docs/data/latest.json', latest);

  const headers = ['rank', 'repo', 'developer_region', 'developer_location', 'category', 'description_zh', 'description_original', 'stars', 'forks', 'stars_delta', 'rank_change', 'attention_score', 'snapshot_at'];
  const csvRows = rankings.current.map(item => [
    item.rank,
    item.repo,
    item.developer?.region_label || DEVELOPER_REGION_LABELS.unknown,
    item.developer?.location || '',
    item.category,
    item.description_zh || '',
    item.description || '',
    item.stars,
    item.forks,
    item.stars_delta ?? '',
    item.rank_change ?? '',
    item.attention_score,
    rankings.latest_snapshot_at
  ]);
  await writeText(
    'data/rankings.csv',
    `${headers.join(',')}\n${csvRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`,
  );
  const categoryHeaders = [
    'rank_by_stars', 'rank_by_projects', 'rank_by_momentum', 'category', 'project_count',
    'project_share', 'total_stars', 'stars_share', 'total_forks', 'stars_delta',
    'forks_delta', 'comparable_projects', 'leader_repo', 'top_3_repositories', 'snapshot_at'
  ];
  const categoryRows = rankings.category_rankings.map(item => [
    item.rank_by_stars,
    item.rank_by_projects,
    item.rank_by_momentum ?? '',
    item.category,
    item.project_count,
    item.project_share,
    item.total_stars,
    item.stars_share,
    item.total_forks,
    item.stars_delta ?? '',
    item.forks_delta ?? '',
    item.comparable_projects,
    item.leader?.repo || '',
    item.top_projects.map(project => project.repo).join(' | '),
    rankings.latest_snapshot_at
  ]);
  await writeText(
    'data/categories.csv',
    `${categoryHeaders.join(',')}\n${categoryRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`,
  );

  const topCategory = rankings.category_rankings[0];
  const observationWindow = rankings.previous_snapshot_at
    ? `${rankings.observation_window_hours} 小时`
    : '等待下一个可比较快照';
  const top10 = [
    `**数据时点：** \`${rankings.latest_snapshot_at}\`　·　**观察窗口：** ${observationWindow}`,
    '',
    '| 排名 | 项目 | 分类 | Stars | Forks | 窗口 Stars Δ | 关注分 |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: |',
    ...rankings.current.slice(0, 10).map(item =>
      `| ${item.rank} | [${escapeMarkdown(item.repo)}](${item.url}) | ${escapeMarkdown(item.category)} | ${item.stars} | ${item.forks} | ${delta(item.stars_delta)} | ${item.attention_score} |`,
    )
  ].join('\n');
  let readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
  readme = replaceSection(readme, '<!-- RADAR_TOP10_START -->', '<!-- RADAR_TOP10_END -->', top10);
  await writeText('README.md', readme);

  const status = `# 更新状态\n\n- 最新成功快照：${rankings.latest_snapshot_at}\n- 上一个观察点：${rankings.previous_snapshot_at || '暂无'}\n- 观察项目：${activeProjects.length}\n- 待复核候选：${candidatesPayload.candidates.length}\n- 历史观察点：${snapshots.length}\n- 小时明细：${snapshotStats.hourly}\n- 每日归档：${snapshotStats.archives}\n- Stars 总量第一分类：${topCategory?.category || '暂无'}（${topCategory?.total_stars || 0} Stars）\n- 维护者公开所在地：国内 ${developerRegions.mainland_china}；中国港澳台 ${developerRegions.greater_china}；海外 ${developerRegions.overseas}；未知 ${developerRegions.unknown}\n- 待翻译英文简介：${translationStatus.pending || 0}\n- 更新计划：${config.schedule_label}\n- 小时明细保留：最近 ${config.hourly_snapshot_retention_days} 天\n\n> 分类榜可以按 Stars 总量、项目数量和真实窗口增长查看；它描述生态规模与公开变化，不代表产品质量。\n\n> 所在地来自维护者 GitHub 公开资料，只是账户地点分组，不代表国籍。未知信息不会根据姓名或语言猜测。\n\n> “已确认”只表示与 DeepSeek Harness 的相关性有公开证据，不表示已经完成本地安装、安全审计或生产验收。\n`;
  await writeText('STATUS.md', status);

  const top = rankings.current[0];
  const mover = rankings.momentum[0];
  const arrival = signals.latest_arrivals[0];
  const windowText = rankings.previous_snapshot_at
    ? `${rankings.observation_window_hours}h 窗口动量：${mover ? `${mover.repo}（${delta(mover.stars_delta)} stars）` : '暂无可比较项目'}`
    : '观察窗口动量：等待第二个快照';
  const publicUrl = siteUrl || repositoryUrl;
  const linkText = publicUrl ? `\n${publicUrl}\n` : '\n在线链接：发布后补充\n';
  const locationText = `公开所在地（维护者账号）：国内 ${developerRegions.mainland_china} / 海外 ${developerRegions.overseas} / 未知 ${developerRegions.unknown}`;
  const localizedDescriptions = activeProjects.length - (translationStatus.pending || 0);
  const tweet = `# X / Twitter 草稿\n\nDeepSeek Harness 生态早期雷达更新：\n\n- 已确认观察项目：${activeProjects.length}\n- 当前关注度第 1：${top?.repo || '暂无'}（${top?.stars || 0} stars）\n- Stars 总量第一分类：${topCategory?.category || '暂无'}（${topCategory?.total_stars || 0} stars）\n- ${windowText}\n- 最近创建项目：${arrival?.repo || '暂无'}\n- ${locationText}\n- 中文可读简介：${localizedDescriptions}/${activeProjects.length}\n- 数据时点：${rankings.latest_snapshot_at}\n${linkText}\n每小时公开快照，可复查、可追溯；不代表全网穷尽，分类榜和所在地都不是产品质量或国籍判断。\n\n#DeepSeek #OpenSource #AI\n`;
  await writeText('tweet-draft.md', tweet);
  return latest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const latest = await buildArtifacts();
  console.log(JSON.stringify(latest.summary));
}
