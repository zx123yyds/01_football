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
npm run refresh
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

- `npm run refresh` 会抓取最新数据、生成 `public/schedule.json`、生成 ICS，并构建 `dist/`。
- `dist/` 是最终静态发布目录，里面包含页面、数据 JSON、日历 ICS 和国旗资源。
- Vercel 只发布 `dist/`，不会自动读取本地 dev server 的路径映射。

## 自动部署逻辑

- GitHub `main` 分支有新 commit 后，Vercel 会自动重新部署。
- GitHub Actions 定时更新数据并提交新 commit 后，也会触发 Vercel 重新部署。
- 如果 Actions 没有产生新 commit，Vercel 不会自动重新部署，线上 `generatedAt` 也不会变。
- cron-job.org 只负责触发 GitHub Actions，不会直接改 Vercel 数据。看到 cron-job.org 成功后，还要继续确认 GitHub commit 和 Vercel deployment。

## 常见排查

- 页面打不开：先确认是否是 `*.vercel.app` 在当前网络下不可达。
- 页面能打开但数据旧：检查 GitHub Actions 是否有新 run、新 commit，以及 Vercel 是否生成新 deployment。
- cron-job.org 成功但页面旧：打开 GitHub Actions run，看 `npm run refresh` 是否成功、是否有 auto commit；再打开 Vercel Deployments，看对应 commit 是否部署完成。
- 本地正常但线上缺文件：检查 `dist/` 是否包含 `schedule.json`、`world-cup-2026.ics`、`calendars/`、`flags/`。
- 手机网络打不开：优先怀疑 Vercel 默认域名国内访问不稳定，不一定是代码问题。

## 推荐检查顺序

1. GitHub 最新 commit 是否已更新。
2. Vercel Deployments 是否有新部署。
3. 部署状态是否 `Ready`。
4. 打开线上 `/schedule.json` 看 `generatedAt` 是否更新。
5. 打开线上 `/world-cup-2026.ics` 看日历文件是否可访问。

## 数据兜底检查

如果外部实时源临时失败，构建脚本会继续使用仓库内最近一次成功缓存生成页面。排查时需要同时看：

- `data/source-status.json`：本次抓取哪些源成功、哪些源使用缓存。
- `public/schedule.json` 里的 `sourceHealth`：前端实际展示的数据健康状态。
- `public/schedule.json` 里的 `generatedAt`：静态数据生成时间。

如果 `generatedAt` 更新了但比分没变，说明刷新链路是通的，下一步应排查数据源是否返回了新比分或多源匹配是否失败。
