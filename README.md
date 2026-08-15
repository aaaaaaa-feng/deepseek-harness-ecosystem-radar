# DeepSeek Harness 生态早期雷达

一个可复查、按小时更新的 DeepSeek Harness GitHub 生态观察仓库。

它回答六个问题：发布后出现了哪些实现型项目？当前哪些项目受到更多 GitHub 关注？哪些功能分类更大或增长更快？过去一个真实快照窗口里，哪些项目的公开指标发生了变化？维护者公开位于哪里？英文项目简介用中文怎么理解？

> 这里的“已确认”只表示与 DeepSeek Harness 的相关性和实现入口有公开证据，不代表本仓库已经逐个安装、完成安全审计或生产验收。

## 最新状态

<!-- RADAR_SUMMARY_START -->
- 已确认观察项目：**250**
- 待复核候选：**23**
- 历史观察点：**2**
- 小时明细：**1**；每日归档：**2**
- 维护者公开所在地：国内 **45**；中国港澳台 **0**；海外 **11**；未知 **169**
- 项目简介：自动/缓存翻译 **27**；原文含中文 **94**；待翻译 **114**
- 当前 Stars 总量第一分类：**桌面端与启动器**（4106 Stars，38 个项目）
- 最新快照：**2026-08-15T05:58:37.929Z**
- 观察窗口趋势：已基于 14.2 小时窗口计算
<!-- RADAR_SUMMARY_END -->

## 当前关注度排名

关注度分数只使用可复算的 GitHub 快照指标：

```text
70 × log10(stars + 1) + 30 × log10(forks + 1)
```

它不是产品质量、安全性或真实用户数评分。

<!-- RADAR_RANKING_START -->
| 排名 | 项目 | 维护者公开所在地 | 分类 | Stars | Forks | 关注分 | 窗口 Stars Δ | 排名变化 |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 未知 | 桌面端与启动器 | 2945 | 139 | 307.23 | +1619 | 0 |
| 2 | [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 未知 | 开发与质量工具 | 996 | 31 | 255.06 | +948 | +13 |
| 3 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) | 国内 | 界面与体验扩展 | 678 | 22 | 239.08 | +134 | -1 |
| 4 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 未知 | 桌面端与启动器 | 198 | 18 | 199.28 | +41 | -1 |
| 5 | [turtle2209/Bigfish](https://github.com/turtle2209/Bigfish) | 未知 | 桌面端与启动器 | 185 | 7 | 185.96 | +23 | -1 |
| 6 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 未知 | 插件管理与生态工具 | 116 | 11 | 177.15 | +89 | +11 |
| 7 | [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) | 国内 | 桌面端与启动器 | 126 | 8 | 175.89 | +16 | -2 |
| 8 | [myYangyunfan/dsh_desktop](https://github.com/myYangyunfan/dsh_desktop) | 未知 | 桌面端与启动器 | 124 | 6 | 172.14 | +48 | 0 |
| 9 | [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | 未知 | 桌面端与启动器 | 123 | 4 | 167.51 | +55 | +2 |
| 10 | [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 国内 | 视觉与浏览器 | 78 | 8 | 161.46 | +38 | +3 |
| 11 | [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui) | 未知 | 视觉与浏览器 | 82 | 5 | 157.68 | +10 | -4 |
| 12 | [ChisaAlter/Deepseek-Harness-Desktop](https://github.com/ChisaAlter/Deepseek-Harness-Desktop) | 未知 | 桌面端与启动器 | 70 | 7 | 156.68 | +11 | -3 |
| 13 | [Nagi-ovo/dsh-visualize](https://github.com/Nagi-ovo/dsh-visualize) | 海外 | 视觉与浏览器 | 87 | 3 | 154.18 | +6 | -7 |
| 14 | [Ruler4396/dsh-launcher](https://github.com/Ruler4396/dsh-launcher) | 未知 | 桌面端与启动器 | 81 | 3 | 152.03 | +11 | -4 |
| 15 | [Nagi-ovo/dsh-find-plugins](https://github.com/Nagi-ovo/dsh-find-plugins) | 海外 | 插件管理与生态工具 | 75 | 1 | 140.69 | +7 | -1 |
<!-- RADAR_RANKING_END -->

完整排名见 [data/rankings.csv](data/rankings.csv)，可视化页面见 [docs/index.html](docs/index.html)。网页会把全部项目收进一个独立滚动的榜单视窗，表头保持吸顶，页面不会因排名数量增长而被不断拉长。

## 功能分类榜

分类榜不使用不可解释的综合分。默认按分类内项目的 Stars 总量排序，同时保留“项目数量榜”和“真实观察窗口增长榜”；网页可以在三种视角之间切换并一键筛选该分类的全部项目。

<!-- RADAR_CATEGORY_RANKING_START -->
| Stars 排名 | 功能分类 | 项目数 | Stars 总量 | Forks 总量 | 窗口 Stars Δ | 头部项目 |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | 桌面端与启动器 | 38 | 4106 | 215 | +1841 | [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) |
| 2 | 开发与质量工具 | 14 | 1099 | 40 | +961 | [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) |
| 3 | 界面与体验扩展 | 28 | 868 | 30 | +162 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) |
| 4 | 插件管理与生态工具 | 33 | 560 | 35 | +143 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) |
| 5 | 视觉与浏览器 | 25 | 304 | 26 | +66 | [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) |
| 6 | 其他实现型扩展 | 55 | 144 | 22 | +9 | [c3ll256/dsh-toy](https://github.com/c3ll256/dsh-toy) |
| 7 | 记忆、上下文与成本 | 31 | 135 | 13 | +20 | [Nwflower/dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) |
| 8 | 渠道与模型接入 | 14 | 88 | 7 | -5 | [anysearch-team/anysearch-dsh](https://github.com/anysearch-team/anysearch-dsh) |
| 9 | 终端与部署 | 12 | 42 | 3 | +6 | [openma-ai/deepseek-harness-tui](https://github.com/openma-ai/deepseek-harness-tui) |
<!-- RADAR_CATEGORY_RANKING_END -->

完整分类数据见 [data/categories.json](data/categories.json) 与 [data/categories.csv](data/categories.csv)。

## 开发者所在地与中文介绍

页面中的“国内 / 中国港澳台 / 海外 / 未知”来自仓库维护者账号主动公开的 GitHub `location`。它描述的是账号公开所在地，不是国籍、团队成员构成或项目归属；组织账号也按同一规则处理。系统只识别明确的国家、地区、省市名称，`Earth`、`Remote`、空值和无法可靠识别的自由文本都保留为“未知”，不会根据姓名、头像、语言或邮箱猜测。

项目简介始终保留 GitHub 英文原文。原文已有中文时直接展示；纯英文简介优先读取翻译缓存，只有新项目或原文发生变化时才通过 GitHub Models 翻译成简体中文。网页默认显示中文，并允许展开核对英文原文。模型调用失败、配额不足或权限不可用时，排名更新仍会继续，页面暂时展示英文并标记为待翻译；已有译文不会被清空。

## 自动更新机制

仓库中的 GitHub Actions 在每小时第 17 分钟（Asia/Shanghai）运行一次。选择第 17 分钟是为了避开 GitHub Actions 常见的整点高负载时段（[GitHub 计划任务说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)）：

1. 刷新观察清单中所有项目的 GitHub 指标。
2. 使用多组查询发现最近 7 天创建的新仓库。
3. 读取新仓库 README，按严格证据规则分为“自动确认、待复核、排除”；仅在正文中顺带提及不会自动入榜。
4. 对新维护者读取 GitHub 公开资料；已有资料默认缓存 30 天，再按公开地点做保守分组。
5. 为新增或变化的纯英文简介调用 GitHub Models，并把译文缓存到仓库；不会重复翻译未变化的文本。
6. 写入一个小时明细快照，并刷新当天的长期归档点；计算真实观察窗口内的 Star/Fork 与排名变化。
7. 重新生成项目榜、功能分类榜、README、CSV、静态网页、状态页和推文草稿。
8. 通过校验和密钥特征扫描后，由 `github-actions[bot]` 提交回默认分支。

也可以在 Actions 页面手动运行 `Hourly ecosystem update`。

GitHub API 出现短暂的限流或服务错误时会有限次重试；最终仍失败时，工作流不会提交半成品。每次更新都有 15 分钟超时上限，避免任务无限挂起。计划任务可能因 GitHub Actions 平台负载而延迟，所以页面始终展示真实快照间隔，不把它假装成精确 60 分钟。

默认保留最近 14 天的小时明细，并在 `data/archive/` 为每个上海日期保留一个长期日归档点。这样短期变化有足够颗粒度，长期历史也不会因为每年新增 8760 份完整快照而持续膨胀。

## 数据目录

- `data/projects.json`：已确认观察清单和最新指标。
- `data/candidates.json`：弱匹配或 fork 等待复核项目。
- `data/exclusions.json`：明确误命中与排除原因。
- `data/developers.json`：维护者公开地点、保守地区分组和最近核对时间；同一维护者只保存一份。
- `data/translations.json`：按仓库与英文原文匹配的中文翻译缓存。
- `data/snapshots/`：最近 14 天的小时明细；旧版日快照继续兼容。
- `data/archive/`：每天一个长期归档点，内容会在当天每次成功更新后刷新。
- `data/rankings.json` / `data/rankings.csv`：由快照自动生成的排名。
- `data/categories.json` / `data/categories.csv`：功能分类的 Stars 总量、项目数、窗口增长与分类 Top 3。
- `docs/`：不依赖后端的 GitHub Pages 页面。
- `tweet-draft.md`：根据最新快照生成的 X/Twitter 草稿。

## 发布到 GitHub 后的上线检查清单

1. 把本目录推送成一个独立 GitHub 仓库。
2. 在仓库 `Settings → Actions → General → Workflow permissions` 中允许工作流写入仓库内容；小时更新工作流只申请 `contents: write` 与 `models: read`。其中 `models: read` 让内置 `GITHUB_TOKEN` 调用 [GitHub Models](https://docs.github.com/en/github-models/quickstart)，不需要另存模型 API Key。
3. 如果需要 GitHub Pages，把仓库变量 `ENABLE_GITHUB_PAGES` 设为 `true`，并在 `Settings → Pages` 中选择 GitHub Actions 作为来源。页面部署使用独立、最小权限的工作流。
4. 在 Actions 页面手动运行一次 `Hourly ecosystem update`，确认真实 API 更新、机器人提交和页面部署均成功。
5. 把仓库地址写入 `config/radar.json` 的 `public_repository_url`，再运行一次 `npm run build`；页面页脚和推文草稿才会出现稳定、可复现的公开链接。

小时任务使用仓库自带的 `GITHUB_TOKEN` 读取 GitHub API、调用 GitHub Models 并提交数据。此类机器人推送不会再触发普通 `push` 工作流，所以 Pages 工作流同时监听 `Hourly ecosystem update` 的成功完成事件，确保每次数据提交后仍会部署最新页面。

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

只想重新核对维护者公开地点时，可以运行 `npm run refresh-developers`。本地 Token 若没有 GitHub Models 权限，项目数据仍可更新，只是新的纯英文简介会等待下一次具备 `models: read` 权限的在线任务翻译。

## 数据边界

- GitHub 搜索不能证明绝对全网穷尽。
- 搜索索引、关键词、Topic 和仓库描述都会影响发现结果。
- 第一个观察点只能形成当前排名；至少有两个观察点后，才能计算窗口变化。页面会显示真实窗口小时数，不把延迟或漏跑的任务硬写成精确 1 小时。
- Star/Fork 变化是 GitHub 公开指标变化，不等于真实使用、留存或代码质量。
- 自动分类和证据判定是可复核规则，不是对项目质量或安全性的背书。
- 分类 Stars 总量容易受到单个头部项目影响；应同时查看项目数量榜、分类 Top 3 和真实窗口增长榜，不把规模误读为质量。
- GitHub `location` 是维护者自行填写的自由文本，可能为空、过期、玩笑化或代表组织办公地；地区分组不代表国籍，也不能覆盖仓库全部贡献者。
- 中文简介是辅助阅读的机器翻译或人工基线翻译，英文原文仍是核对依据；翻译不构成对项目功能声明的验证。
- 详细规则见 [METHODOLOGY.md](METHODOLOGY.md)。

## License

代码采用 MIT License；被观察项目各自保留自己的许可证与权利。
