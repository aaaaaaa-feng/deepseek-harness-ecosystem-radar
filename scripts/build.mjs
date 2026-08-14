import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRankings, csvCell, escapeMarkdown} from './lib/radar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const writeJson = async (relative, value) => {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
};

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
  await writeJson('data/rankings.json', rankings);

  const activeProjects = projectsPayload.projects.filter(project => project.status === 'active' && project.evidence_level === 'confirmed');
  const latest = {
    schema_version: 1,
    title: 'DeepSeek Harness 生态早期雷达',
    generated_at: rankings.generated_at,
    release_cutoff_utc: config.release_cutoff_utc,
    release_cutoff_label: config.release_cutoff_label,
    schedule_label: config.schedule_label,
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
  await fs.writeFile(
    path.join(root, 'data/rankings.csv'),
    `${headers.join(',')}\n${csvRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`,
  );

  const topTable = [
    '| 排名 | 项目 | 分类 | Stars | 24h变化 | 排名变化 |',
    '| ---: | --- | --- | ---: | ---: | ---: |',
    ...rankings.current.slice(0, 15).map(item =>
      `| ${item.rank} | [${escapeMarkdown(item.repo)}](${item.url}) | ${escapeMarkdown(item.category)} | ${item.stars} | ${delta(item.stars_delta)} | ${delta(item.rank_change)} |`,
    )
  ].join('\n');
  const summary = [
    `- 已确认观察项目：**${activeProjects.length}**`,
    `- 待复核候选：**${candidatesPayload.candidates.length}**`,
    `- 历史快照：**${snapshots.length}**`,
    `- 最新快照：**${rankings.latest_snapshot_at}**`,
    `- 24 小时趋势：${rankings.previous_snapshot_at ? `已基于 ${rankings.observation_window_hours} 小时窗口计算` : '**等待第二个快照后生成**'}`
  ].join('\n');
  let readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
  readme = replaceSection(readme, '<!-- RADAR_SUMMARY_START -->', '<!-- RADAR_SUMMARY_END -->', summary);
  readme = replaceSection(readme, '<!-- RADAR_RANKING_START -->', '<!-- RADAR_RANKING_END -->', topTable);
  await fs.writeFile(path.join(root, 'README.md'), readme);

  const status = `# 更新状态\n\n- 最新成功快照：${rankings.latest_snapshot_at}\n- 上一个快照：${rankings.previous_snapshot_at || '暂无'}\n- 观察项目：${activeProjects.length}\n- 待复核候选：${candidatesPayload.candidates.length}\n- 快照文件：${snapshots.length}\n- 更新计划：${config.schedule_label}\n\n> “已确认”只表示与 DeepSeek Harness 的相关性有公开证据，不表示已经完成本地安装、安全审计或生产验收。\n`;
  await fs.writeFile(path.join(root, 'STATUS.md'), status);

  const top = rankings.current[0];
  const mover = rankings.momentum[0];
  const tweet = `# X / Twitter 草稿\n\nDeepSeek Harness 生态早期雷达更新：\n\n- 已确认观察项目：${activeProjects.length}\n- 当前关注度第 1：${top?.repo || '暂无'}（${top?.stars || 0} stars）\n- 24h 动量：${mover ? `${mover.repo}（${delta(mover.stars_delta)} stars）` : '等待第二个快照'}\n- 数据时点：${rankings.latest_snapshot_at}\n\n这是可复查的 GitHub 快照，不代表全网穷尽，也不是产品质量榜。\n\n#DeepSeek #OpenSource #AI\n`;
  await fs.writeFile(path.join(root, 'tweet-draft.md'), tweet);
  return latest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const latest = await buildArtifacts();
  console.log(JSON.stringify(latest.summary));
}
