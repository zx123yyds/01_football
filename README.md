# 2026 世界杯赛程

一个面向北京时间的 2026 世界杯赛程信息网站，支持按日期、阶段、小组、球队/城市/场馆搜索，并生成可订阅到日历的 ICS 文件。

## 项目预览

![2026 世界杯赛程网站预览](docs/assets/world-cup-schedule-preview.png)

## 本地运行

```bash
npm install
npm run refresh
npm run dev
```

## 验证

```bash
npm run check
```

`npm run update:data` 会从 `data/schedule.seed.json` 生成：

- `public/schedule.json`
- `public/world-cup-2026.ics`
- `public/calendars/stage-*.ics`
- `public/calendars/group-*.ics`

`npm run sync:reference` 会联网抓取央视积分榜、央视射手榜、FIFA Watch 实时比分和 FIFA Watch 完整赛程页，并基于仓库中已缓存的 `data/reference-schedule.json` 同步更新 `data/matches.tsv`。赛程基础数据不在定时任务中请求 `2026fifa.qiaomu.ai`，避免外部源临时不可达导致整轮刷新失败；实时比分通过 `data/fifawatch-live.json` 覆盖当前比赛，历史比分和淘汰赛真实对阵通过 `data/fifawatch-schedule.html` 补齐。

`npm run refresh` 会联网抓取积分榜、射手榜、实时比分，并重新生成 `public/schedule.json` 和全部 ICS。外部源失败或后续接口下线时，会继续使用仓库中最近一次成功抓取的缓存数据渲染页面，不让整轮刷新中断；本次数据源状态会写入 `data/source-status.json` 和 `public/schedule.json` 的 `sourceHealth` 字段。`npm run dev` 启动后会先刷新一次数据，之后默认每 5 分钟自动刷新一次；可用环境变量调整：

```bash
REFRESH_INTERVAL_MS=60000 npm run dev
```

## 数据说明

数据源优先核对 FIFA 官方公开赛程，并参考懂球帝中文赛程和参考站的信息架构。当前源表收录 104 场比赛的北京时间、阶段、小组和对阵；个别未完成复核的场馆字段以“待核对”展示，不伪造比分、晋级结果或未确认场馆。

参考来源：

- FIFA 官方赛程，用于核对官方赛程、比赛编号、阶段和场馆：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/match-schedule
- 懂球帝中文赛程参考，用于核对中文赛程信息和北京时间展示：https://m.dongqiudi.com/article/5543600.html
- 央视世界杯专题、积分榜和射手榜，用于补充积分榜、射手榜等赛事榜单：https://worldcup.cctv.com/2026/
- FIFA Watch 中文站实时比分和完整赛程，用于补齐比分、比赛状态、淘汰赛真实对阵和队伍代码：https://fifawatch.com/zh

## 自动更新

`.github/workflows/update-schedule.yml` 配置为每小时的 10、20、30、40、50 分运行一次，自动抓取最新比分、积分榜、射手榜并提交生成后的 JSON 和 ICS。前端页面每 2 分钟重新读取一次 `schedule.json`，用户不需要手动刷新页面。若部署到静态托管平台，日历订阅地址通常为：

```text
https://你的域名/world-cup-2026.ics
```

注意：cron-job.org 或 GitHub Actions 显示触发成功，只代表刷新任务开始运行。页面数据是否真正更新，还要继续确认 Actions 是否成功生成新 commit、Vercel 是否完成新部署、线上 `/schedule.json` 的 `generatedAt` 是否变化。

## 外部平台


- Vercel 控制台：https://vercel.com
- cron-job.org 控制台：https://console.cron-job.org/dashboard

配置说明：

- Vercel 部署配置：[docs/vercel-setup.md](docs/vercel-setup.md)
- cron-job.org 定时触发配置：[docs/cron-job-setup.md](docs/cron-job-setup.md)

## 部署

本项目可以按静态站部署。构建后会生成 `dist/`，里面包含 `index.html`、`src/`、`schedule.json`、全部 ICS 文件。

### 推荐方案：Vercel

1. 把项目推到 GitHub。
2. 在 Vercel 导入这个 GitHub 仓库。
3. 构建命令填写：

```bash
npm run refresh
```

4. 输出目录填写：

```text
dist
```

5. 部署完成后，别人访问 Vercel 分配的域名即可。

### Netlify / Cloudflare Pages

配置同样是：

```text
Build command: npm run refresh
Publish directory: dist
```

### GitHub Pages

如果只想用 GitHub Pages，可以用 Actions 把 `dist/` 发布到 Pages。注意 GitHub Pages 默认不会运行后台服务，因此数据更新依赖 `.github/workflows/update-schedule.yml` 的定时任务重新提交数据并触发重新部署。

### 本地生成可部署文件

```bash
npm install
npm run refresh
```

生成结果在：

```text
dist/
```
