# 方法与证据边界

## 研究起点

严格起点为 `2026-08-13T13:02:03.901Z`，即 `2026-08-13 21:02:03（北京时间）`。

仓库创建时间早于或等于起点的项目不会作为“发布后新项目”纳入主观察清单。维护者仍可在单独的背景资料中引用它们，但不能混进发布后趋势样本。

## 三层证据状态

### 已确认

README、仓库名称/描述或 GitHub Topic 明确提及 `DeepSeek Harness` / `deepseek-harness`，并且存在插件、桌面端、工具、部署、视觉、渠道等实现信号。

“已确认”只确认相关性和公开实现入口，不等于：

- 已在本机安装运行；
- 已通过安全审计；
- 已验证所有 README 声明；
- 已达到生产可用标准。

### 待复核

仓库名与描述只使用 `DSH` 缩写，或属于 fork，尚不足以自动证明独立功能。这类项目保留在 `data/candidates.json`，不进入公开排名。

### 排除

包括明显误命中、教程/白皮书/纯清单、起点前项目、无实现证据项目和维护者 denylist。

## 发现方式

每日任务查看最近 7 天创建的仓库，默认使用：

- `"deepseek harness" in:name,description,readme`
- `deepseek-harness in:name,description,readme`
- `topic:deepseek-harness`
- `topic:dsh-plugin`
- `dsh-plugin in:name,description`

搜索结果会受到 GitHub 索引延迟和每次返回上限影响。对漏检仓库使用 `config/manual-allowlist.json` 补充。

## 排名

### 当前关注度

```text
70 × log10(stars + 1) + 30 × log10(forks + 1)
```

使用对数是为了避免一个头部项目完全压扁其他项目。Issues 不进入分数，因为未关闭 Issue 既可能代表活跃，也可能代表缺陷，含义不稳定。

### 观察窗口变化

```text
stars_delta = 当前 stars - 上一个快照 stars
forks_delta = 当前 forks - 上一个快照 forks
rank_change = 上一个快照排名 - 当前排名
```

`rank_change > 0` 表示排名上升。页面使用真实快照间隔，不把 20 小时或 30 小时的间隔硬称为精确 24 小时。

### 动量排序

```text
10 × stars_delta + 25 × forks_delta
```

动量分只是传播和二次开发信号的代理，不是长期增长率。至少需要两个快照才能生成。

## 快照策略

每天保留一个上海日期命名的 JSON 快照。同一天手动重复运行会刷新当天文件，不会伪造多个“日增长”观察点。

如果 GitHub API 返回限流或其他错误，更新脚本会失败并保留上一次成功数据，不会用空结果覆盖历史。
