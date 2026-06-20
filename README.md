# 2026 世界杯赛程

一个面向北京时间的 2026 世界杯赛程信息网站，支持按日期、阶段、小组、球队/城市/场馆搜索，并生成可订阅到日历的 ICS 文件。

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

## 项目复盘

本项目的可复用开发经验、踩坑记录和下次同类项目前置规范见 [docs/project-retrospective.md](docs/project-retrospective.md)。

`npm run update:data` 会从 `data/schedule.seed.json` 生成：

- `public/schedule.json`
- `public/world-cup-2026.ics`
- `public/calendars/stage-*.ics`
- `public/calendars/group-*.ics`

`npm run sync:reference` 会联网抓取参考站公开 ICS，并同步更新 `data/matches.tsv`。懂球帝移动页可能触发站点安全拦截，因此不做绕过；FIFA 官方页面和参考站公开 ICS 用作主要核对依据。

`npm run refresh` 会联网抓取赛程、比分、积分榜、射手榜，并重新生成 `public/schedule.json` 和全部 ICS。`npm run dev` 启动后会先刷新一次数据，之后默认每 5 分钟自动刷新一次；可用环境变量调整：

```bash
REFRESH_INTERVAL_MS=60000 npm run dev
```

## 数据说明

数据源优先核对 FIFA 官方公开赛程，并参考懂球帝中文赛程和参考站的信息架构。当前源表收录 104 场比赛的北京时间、阶段、小组和对阵；个别未完成复核的场馆字段以“待核对”展示，不伪造比分、晋级结果或未确认场馆。

参考来源：

- https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/match-schedule
- https://m.dongqiudi.com/article/5543600.html
- https://2026fifa.qiaomu.ai/

## 自动更新

`.github/workflows/update-schedule.yml` 配置为每 10 分钟运行一次，自动抓取最新赛程、比分、积分榜、射手榜并提交生成后的 JSON 和 ICS。前端页面每 2 分钟重新读取一次 `schedule.json`，用户不需要手动刷新页面。若部署到静态托管平台，日历订阅地址通常为：

```text
https://你的域名/world-cup-2026.ics
```

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
