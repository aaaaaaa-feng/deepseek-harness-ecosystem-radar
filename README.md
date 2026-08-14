# DeepSeek Harness 生态早期雷达

一个可复查、按日更新的 DeepSeek Harness GitHub 生态观察仓库。

它回答三个问题：开源后出现了哪些实现型项目？当前哪些项目受到更多 GitHub 关注？过去一个观察窗口里，哪些项目的公开指标发生了变化？

> 这里的“已确认”只表示与 DeepSeek Harness 的相关性和实现入口有公开证据，不代表本仓库已经逐个安装、完成安全审计或生产验收。

## 最新状态

<!-- RADAR_SUMMARY_START -->
- 已确认观察项目：**60**
- 待复核候选：**0**
- 历史快照：**1**
- 最新快照：**2026-08-14T15:48:43.830Z**
- 24 小时趋势：**等待第二个快照后生成**
<!-- RADAR_SUMMARY_END -->

## 当前关注度排名

关注度分数只使用可复算的 GitHub 快照指标：

```text
70 × log10(stars + 1) + 30 × log10(forks + 1)
```

它不是产品质量、安全性或真实用户数评分。

<!-- RADAR_RANKING_START -->
| 排名 | 项目 | 分类 | Stars | 24h变化 | 排名变化 |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 桌面端与启动器 | 1326 | — | — |
| 2 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) | 界面与体验扩展 | 544 | — | — |
| 3 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 桌面端与启动器 | 157 | — | — |
| 4 | [turtle2209/Bigfish](https://github.com/turtle2209/Bigfish) | 桌面端与启动器 | 162 | — | — |
| 5 | [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) | 桌面端与启动器 | 110 | — | — |
| 6 | [Nagi-ovo/dsh-visualize](https://github.com/Nagi-ovo/dsh-visualize) | 视觉与浏览器 | 81 | — | — |
| 7 | [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui) | 视觉与浏览器 | 72 | — | — |
| 8 | [myYangyunfan/dsh_desktop](https://github.com/myYangyunfan/dsh_desktop) | 桌面端与启动器 | 76 | — | — |
| 9 | [ChisaAlter/Deepseek-Harness-Desktop](https://github.com/ChisaAlter/Deepseek-Harness-Desktop) | 桌面端与启动器 | 59 | — | — |
| 10 | [Ruler4396/dsh-launcher](https://github.com/Ruler4396/dsh-launcher) | 桌面端与启动器 | 70 | — | — |
| 11 | [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | 桌面端与启动器 | 68 | — | — |
| 12 | [xiincs/deepseek-harness-desktop](https://github.com/xiincs/deepseek-harness-desktop) | 桌面端与启动器 | 65 | — | — |
| 13 | [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 视觉与浏览器 | 40 | — | — |
| 14 | [Nagi-ovo/dsh-find-plugins](https://github.com/Nagi-ovo/dsh-find-plugins) | 插件管理与生态工具 | 68 | — | — |
| 15 | [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 开发与质量工具 | 48 | — | — |
<!-- RADAR_RANKING_END -->

完整排名见 [data/rankings.csv](data/rankings.csv)，可视化页面见 [docs/index.html](docs/index.html)。

## 自动更新机制

仓库中的 GitHub Actions 每天 09:17（Asia/Shanghai）运行一次：

1. 刷新观察清单中所有项目的 GitHub 指标。
2. 使用多组查询发现最近 7 天创建的新仓库。
3. 读取新仓库 README，按证据规则分为“自动确认、待复核、排除”。
4. 写入当天快照，计算 Star/Fork 变化和排名变化。
5. 重新生成 README、CSV、静态网页、状态页和推文草稿。
6. 由 `github-actions[bot]` 提交回默认分支。

也可以在 Actions 页面手动运行 `Daily ecosystem update`。

## 数据目录

- `data/projects.json`：已确认观察清单和最新指标。
- `data/candidates.json`：弱匹配或 fork 等待复核项目。
- `data/exclusions.json`：明确误命中与排除原因。
- `data/snapshots/`：每天一个不可混淆的指标快照。
- `data/rankings.json` / `data/rankings.csv`：由快照自动生成的排名。
- `docs/`：不依赖后端的 GitHub Pages 页面。
- `tweet-draft.md`：根据最新快照生成的 X/Twitter 草稿。

## 发布到 GitHub 后要做的两件事

1. 在仓库 `Settings → Actions → General → Workflow permissions` 中允许工作流写入仓库内容；工作流本身只申请 `contents: write`。
2. 如果需要 GitHub Pages，把仓库变量 `ENABLE_GITHUB_PAGES` 设为 `true`，并在 `Settings → Pages` 中选择 GitHub Actions 作为来源。

如默认分支启用了禁止机器人直接推送的保护规则，需要改为由工作流创建 Pull Request；当前第一版默认适配个人公开仓库的直接更新方式。

## 手动补充与排除

- 搜索漏掉的已确认仓库：加入 `config/manual-allowlist.json`。
- 明确误命中的仓库：加入 `config/manual-denylist.json`。
- 调整搜索词和回看天数：修改 `config/radar.json`。

提交新项目也可以使用仓库里的 Issue 模板。

## 本地运行

```bash
npm install
npm test
npm run build
npm run check
```

在线刷新需要 GitHub API 访问；推荐设置 `GITHUB_TOKEN` 后运行：

```bash
npm run update
```

## 数据边界

- GitHub 搜索不能证明绝对全网穷尽。
- 搜索索引、关键词、Topic 和仓库描述都会影响发现结果。
- 第一个快照只能形成当前排名；至少有两个快照后，才能计算观察窗口内的变化。
- Star/Fork 变化是 GitHub 公开指标变化，不等于真实使用、留存或代码质量。
- 详细规则见 [METHODOLOGY.md](METHODOLOGY.md)。

## License

代码采用 MIT License；被观察项目各自保留自己的许可证与权利。
