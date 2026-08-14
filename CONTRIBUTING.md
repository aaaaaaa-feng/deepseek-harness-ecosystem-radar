# 贡献指南

## 提交一个项目

优先使用 Issue 模板。请提供：

- `owner/repo`；
- 项目与 DeepSeek Harness 的直接关系；
- README 或 manifest 证据；
- 安装/运行入口；
- 项目是否为 fork，以及独立改动是什么。

维护者确认后，可以把仓库加入 `config/manual-allowlist.json`。

## 修正误收项目

请在 Issue 中说明误收原因。确认后将仓库加入 `config/manual-denylist.json`，并从已确认清单移除。

## 本地检查

```bash
npm ci
npm test
npm run build
npm run check
npm run security-check
```

不要手工编辑 `data/rankings.json`、`data/rankings.csv`、`data/latest.json`、`docs/data/latest.json`、`STATUS.md` 或 `tweet-draft.md`；它们由构建脚本生成。
