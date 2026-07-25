# Vercel 部署配置

本文记录本项目在 Vercel 上的导入、构建和排查配置。

## 平台入口

- Vercel 控制台：https://vercel.com
- 当前线上地址：https://01-football.vercel.app
- GitHub 仓库：https://github.com/zx123yyds/01_football

## 首次导入

1. 登录 Vercel。
2. 选择 `Add New` -> `Project`。
3. 从 GitHub 导入 `zx123yyds/01_football`。
4. Framework Preset 选择 `Other` 或保持自动识别。
5. Build Command 填：

```bash
npm run build
```

6. Output Directory 填：

```text
dist
```

7. Install Command 填：

```bash
npm install
```

8. 点击 Deploy。

## 为什么这样配置

- `npm run build` 只使用仓库内缓存生成 `public/schedule.json`、ICS 和 `dist/`，不会在部署时请求外部数据接口。
- `dist/` 是最终静态发布目录，里面包含页面、数据 JSON、日历 ICS 和国旗资源。
- Vercel 只发布 `dist/`，不会自动读取本地 dev server 的路径映射。

## 自动部署逻辑

- GitHub `main` 分支有新 commit 后，Vercel 会自动重新部署。
- 世界杯已结束，GitHub Actions 定时抓取 workflow 已归档，Vercel 不再因实时数据任务触发部署。
- 如果 cron-job.org 仍保留旧任务，请在其控制台停用；归档后的 workflow 不会再执行抓取。

## 常见排查

- 页面打不开：先确认是否是 `*.vercel.app` 在当前网络下不可达。
- 页面能打开但数据旧：确认仓库中的 `public/schedule.json` 已更新，并检查 Vercel 是否生成新 deployment。
- 本地正常但线上缺文件：检查 `dist/` 是否包含 `schedule.json`、`world-cup-2026.ics`、`calendars/`、`flags/`。
- 手机网络打不开：优先怀疑 Vercel 默认域名国内访问不稳定，不一定是代码问题。

## 推荐检查顺序

1. GitHub 最新 commit 是否已更新。
2. Vercel Deployments 是否有新部署。
3. 部署状态是否 `Ready`。
4. 打开线上 `/schedule.json` 看 `generatedAt` 是否符合仓库数据。
5. 打开线上 `/world-cup-2026.ics` 看日历文件是否可访问。

## 数据兜底检查

如果外部实时源临时失败，构建脚本会继续使用仓库内最近一次成功缓存生成页面。排查时需要同时看：

- `data/source-status.json`：本次抓取哪些源成功、哪些源使用缓存。
- `public/schedule.json` 里的 `sourceHealth`：前端实际展示的数据健康状态。
- `public/schedule.json` 里的 `generatedAt`：静态数据生成时间。

如果 `generatedAt` 更新了但比分没变，说明刷新链路是通的，下一步应排查数据源是否返回了新比分或多源匹配是否失败。
