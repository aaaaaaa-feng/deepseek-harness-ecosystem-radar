import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRankings, csvCell, escapeMarkdown} from './lib/radar.mjs';

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
  const [config, projectsPayload, candidatesPayload] = await Promise.all([
    readJson('config/radar.json'),
    readJson('data/projects.json'),
    readJson('data/candidates.json')
  ]);
  const snapshotNames = (await fs.readdir(path.join(root, 'data/snapshots')))
    .filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  const snapshots = await Promise.all(snapshotNames.map(name => readJson(`data/snapshots/${name}`)));
  const rankings = buildRankings(projectsPayload.projects, snapshots);
  const repositoryUrl = config.public_repository_url;
  await writeJson('data/rankings.json', rankings);

  const activeProjects = projectsPayload.projects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
  const latest = {
    schema_version: 1,
    title: 'DeepSeek Harness 生态早期雷达',
    generated_at: rankings.generated_at,
    release_cutoff_utc: config.release_cutoff_utc,
    release_cutoff_label: config.release_cutoff_label,
    schedule_label: config.schedule_label,
    repository_url: repositoryUrl,
    summary: {
      confirmed_projects: activeProjects.length,
      candidate_projects: candidatesPayload.candidates.length,
      snapshots: snapshots.length,
      has_momentum_window: Boolean(rankings.previous_snapshot_at)
    },
    rankings,
    projects: activeProjects
  };
  await writeJson('data/latest.json', latest);
  await writeJson('docs/data/latest.json', latest);

  const headers = ['rank', 'repo', 'category', 'stars', 'forks', 'stars_delta', 'rank_change', 'attention_score', 'snapshot_at'];
  const csvRows = rankings.current.map(item => [
    item.rank,
    item.repo,
    item.category,
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

  const topTable = [
    '| 排名 | 项目 | 分类 | Stars | Forks | 关注分 | 窗口 Stars Δ | 排名变化 |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...rankings.current.slice(0, 15).map(item =>
      `| ${item.rank} | [${escapeMarkdown(item.repo)}](${item.url}) | ${escapeMarkdown(item.category)} | ${item.stars} | ${item.forks} | ${item.attention_score} | ${delta(item.stars_delta)} | ${delta(item.rank_change)} |`,
    )
  ].join('\n');
  const summary = [
    `- 已确认观察项目：**${activeProjects.length}**`,
    `- 待复核候选：**${candidatesPayload.candidates.length}**`,
    `- 历史快照：**${snapshots.length}**`,
    `- 最新快照：**${rankings.latest_snapshot_at}**`,
    `- 观察窗口趋势：${rankings.previous_snapshot_at ? `已基于 ${rankings.observation_window_hours} 小时窗口计算` : '**等待第二个快照后生成**'}`
  ].join('\n');
  let readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
  readme = replaceSection(readme, '<!-- RADAR_SUMMARY_START -->', '<!-- RADAR_SUMMARY_END -->', summary);
  readme = replaceSection(readme, '<!-- RADAR_RANKING_START -->', '<!-- RADAR_RANKING_END -->', topTable);
  await writeText('README.md', readme);

  const status = `# 更新状态\n\n- 最新成功快照：${rankings.latest_snapshot_at}\n- 上一个快照：${rankings.previous_snapshot_at || '暂无'}\n- 观察项目：${activeProjects.length}\n- 待复核候选：${candidatesPayload.candidates.length}\n- 快照文件：${snapshots.length}\n- 更新计划：${config.schedule_label}\n\n> “已确认”只表示与 DeepSeek Harness 的相关性有公开证据，不表示已经完成本地安装、安全审计或生产验收。\n`;
  await writeText('STATUS.md', status);

  const top = rankings.current[0];
  const mover = rankings.momentum[0];
  const windowText = rankings.previous_snapshot_at
    ? `${rankings.observation_window_hours}h 窗口动量：${mover ? `${mover.repo}（${delta(mover.stars_delta)} stars）` : '暂无可比较项目'}`
    : '观察窗口动量：等待第二个快照';
  const linkText = repositoryUrl ? `\n${repositoryUrl}\n` : '\n仓库链接：发布后补充\n';
  const tweet = `# X / Twitter 草稿\n\nDeepSeek Harness 生态早期雷达更新：\n\n- 已确认观察项目：${activeProjects.length}\n- 当前关注度第 1：${top?.repo || '暂无'}（${top?.stars || 0} stars）\n- ${windowText}\n- 数据时点：${rankings.latest_snapshot_at}\n${linkText}\n这是可复查的 GitHub 快照，不代表全网穷尽，也不是产品质量榜。\n\n#DeepSeek #OpenSource #AI\n`;
  await writeText('tweet-draft.md', tweet);
  return latest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const latest = await buildArtifacts();
  console.log(JSON.stringify(latest.summary));
}
