# DeepSeek Harness 生态早期雷达

一个可复查、按小时更新的 DeepSeek Harness GitHub 生态观察仓库。

它回答三个问题：发布后出现了哪些实现型项目？当前哪些项目受到更多 GitHub 关注？过去一个真实快照窗口里，哪些项目的公开指标发生了变化？

> 这里的“已确认”只表示与 DeepSeek Harness 的相关性和实现入口有公开证据，不代表本仓库已经逐个安装、完成安全审计或生产验收。

## 最新状态

<!-- RADAR_SUMMARY_START -->
- 已确认观察项目：**60**
- 待复核候选：**0**
- 历史观察点：**1**
- 小时明细：**0**；每日归档：**1**
- 最新快照：**2026-08-14T15:48:43.830Z**
- 观察窗口趋势：**等待第二个快照后生成**
<!-- RADAR_SUMMARY_END -->

## 当前关注度排名

关注度分数只使用可复算的 GitHub 快照指标：

```text
70 × log10(stars + 1) + 30 × log10(forks + 1)
```

它不是产品质量、安全性或真实用户数评分。

<!-- RADAR_RANKING_START -->
| 排名 | 项目 | 分类 | Stars | Forks | 关注分 | 窗口 Stars Δ | 排名变化 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 桌面端与启动器 | 1326 | 68 | 273.77 | — | — |
| 2 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) | 界面与体验扩展 | 544 | 19 | 230.58 | — | — |
| 3 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 桌面端与启动器 | 157 | 12 | 187.32 | — | — |
| 4 | [turtle2209/Bigfish](https://github.com/turtle2209/Bigfish) | 桌面端与启动器 | 162 | 7 | 181.95 | — | — |
| 5 | [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) | 桌面端与启动器 | 110 | 7 | 170.27 | — | — |
| 6 | [Nagi-ovo/dsh-visualize](https://github.com/Nagi-ovo/dsh-visualize) | 视觉与浏览器 | 81 | 3 | 152.03 | — | — |
| 7 | [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui) | 视觉与浏览器 | 72 | 4 | 151.4 | — | — |
| 8 | [myYangyunfan/dsh_desktop](https://github.com/myYangyunfan/dsh_desktop) | 桌面端与启动器 | 76 | 3 | 150.12 | — | — |
| 9 | [ChisaAlter/Deepseek-Harness-Desktop](https://github.com/ChisaAlter/Deepseek-Harness-Desktop) | 桌面端与启动器 | 59 | 6 | 149.82 | — | — |
| 10 | [Ruler4396/dsh-launcher](https://github.com/Ruler4396/dsh-launcher) | 桌面端与启动器 | 70 | 3 | 147.65 | — | — |
| 11 | [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | 桌面端与启动器 | 68 | 3 | 146.78 | — | — |
| 12 | [xiincs/deepseek-harness-desktop](https://github.com/xiincs/deepseek-harness-desktop) | 桌面端与启动器 | 65 | 2 | 141.68 | — | — |
| 13 | [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 视觉与浏览器 | 40 | 8 | 141.52 | — | — |
| 14 | [Nagi-ovo/dsh-find-plugins](https://github.com/Nagi-ovo/dsh-find-plugins) | 插件管理与生态工具 | 68 | 0 | 128.72 | — | — |
| 15 | [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 开发与质量工具 | 48 | 1 | 127.34 | — | — |
<!-- RADAR_RANKING_END -->

完整排名见 [data/rankings.csv](data/rankings.csv)，可视化页面见 [docs/index.html](docs/index.html)。

## 自动更新机制

仓库中的 GitHub Actions 在每小时第 17 分钟（Asia/Shanghai）运行一次。选择第 17 分钟是为了避开 GitHub Actions 常见的整点高负载时段（[GitHub 计划任务说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)）：

1. 刷新观察清单中所有项目的 GitHub 指标。
2. 使用多组查询发现最近 7 天创建的新仓库。
3. 读取新仓库 README，按严格证据规则分为“自动确认、待复核、排除”；仅在正文中顺带提及不会自动入榜。
4. 写入一个小时明细快照，并刷新当天的长期归档点；计算真实观察窗口内的 Star/Fork 与排名变化。
5. 重新生成 README、CSV、静态网页、状态页和推文草稿。
6. 通过校验和密钥特征扫描后，由 `github-actions[bot]` 提交回默认分支。

也可以在 Actions 页面手动运行 `Hourly ecosystem update`。

GitHub API 出现短暂的限流或服务错误时会有限次重试；最终仍失败时，工作流不会提交半成品。每次更新都有 15 分钟超时上限，避免任务无限挂起。计划任务可能因 GitHub Actions 平台负载而延迟，所以页面始终展示真实快照间隔，不把它假装成精确 60 分钟。

默认保留最近 14 天的小时明细，并在 `data/archive/` 为每个上海日期保留一个长期日归档点。这样短期变化有足够颗粒度，长期历史也不会因为每年新增 8760 份完整快照而持续膨胀。

## 数据目录

- `data/projects.json`：已确认观察清单和最新指标。
- `data/candidates.json`：弱匹配或 fork 等待复核项目。
- `data/exclusions.json`：明确误命中与排除原因。
- `data/snapshots/`：最近 14 天的小时明细；旧版日快照继续兼容。
- `data/archive/`：每天一个长期归档点，内容会在当天每次成功更新后刷新。
- `data/rankings.json` / `data/rankings.csv`：由快照自动生成的排名。
- `docs/`：不依赖后端的 GitHub Pages 页面。
- `tweet-draft.md`：根据最新快照生成的 X/Twitter 草稿。

## 发布到 GitHub 后的上线检查清单

1. 把本目录推送成一个独立 GitHub 仓库。
2. 在仓库 `Settings → Actions → General → Workflow permissions` 中允许工作流写入仓库内容；小时更新工作流本身只申请 `contents: write`。
3. 如果需要 GitHub Pages，把仓库变量 `ENABLE_GITHUB_PAGES` 设为 `true`，并在 `Settings → Pages` 中选择 GitHub Actions 作为来源。页面部署使用独立、最小权限的工作流。
4. 在 Actions 页面手动运行一次 `Hourly ecosystem update`，确认真实 API 更新、机器人提交和页面部署均成功。
5. 把仓库地址写入 `config/radar.json` 的 `public_repository_url`，再运行一次 `npm run build`；页面页脚和推文草稿才会出现稳定、可复现的公开链接。

小时任务使用仓库自带的 `GITHUB_TOKEN` 提交数据。此类机器人推送不会再触发普通 `push` 工作流，所以 Pages 工作流同时监听 `Hourly ecosystem update` 的成功完成事件，确保每次数据提交后仍会部署最新页面。

当前一次运行的常规 API 请求量远低于 GitHub 对仓库 `GITHUB_TOKEN` 的每小时 1000 次额度（[GitHub Actions 限额](https://docs.github.com/en/actions/reference/limits#common-api-rate-limits)）；若未来观察项目或 README 上限显著扩大，应先重新核算请求预算。公开仓库若连续 60 天没有任何仓库活动，GitHub 可能停用计划任务；正常的小时快照提交本身会持续形成活动，但维护者仍应关注 Actions 失败通知。

如默认分支启用了禁止机器人直接推送的保护规则，需要改为由工作流创建 Pull Request；当前第一版默认适配个人公开仓库的直接更新方式。

## 手动补充与排除

- 搜索漏掉、且仍满足研究起点约束的已确认仓库：加入 `config/manual-allowlist.json`。
- 明确误命中的仓库：加入 `config/manual-denylist.json`。
- 调整搜索词和回看天数：修改 `config/radar.json`。

denylist 优先级高于 allowlist。加入 denylist 后，下一次更新会同时从已确认项目和待复核候选中移除，并记录排除原因。

提交新项目也可以使用仓库里的 Issue 模板。

## 本地运行

```bash
npm ci
npm test
npm run build
npm run check
npm run security-check
```

需要 Node.js 20 或更新版本；日常开发推荐使用仓库 `.nvmrc` 指定的 Node.js 24。

在线刷新需要 GitHub API 访问；推荐设置 `GITHUB_TOKEN` 后运行：

```bash
npm run update
```

## 数据边界

- GitHub 搜索不能证明绝对全网穷尽。
- 搜索索引、关键词、Topic 和仓库描述都会影响发现结果。
- 第一个观察点只能形成当前排名；至少有两个观察点后，才能计算窗口变化。页面会显示真实窗口小时数，不把延迟或漏跑的任务硬写成精确 1 小时。
- Star/Fork 变化是 GitHub 公开指标变化，不等于真实使用、留存或代码质量。
- 自动分类和证据判定是可复核规则，不是对项目质量或安全性的背书。
- 详细规则见 [METHODOLOGY.md](METHODOLOGY.md)。

## License

代码采用 MIT License；被观察项目各自保留自己的许可证与权利。
