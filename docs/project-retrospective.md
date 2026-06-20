# 2026 世界杯赛程网站项目复盘

这是一份轻量化复用型技术总结，重点沉淀本项目中能直接复用的开发经验、反复修改的问题和下次同类项目的前置规范。

## 1. 项目简述

### 业务目标

制作一个 2026 世界杯赛程信息网站，方便用户查看完整赛程、北京时间、比分、积分榜、射手榜，并支持订阅到日历。

### 技术形态

- 静态站点：`index.html`、`src/main.js`、`src/styles.css`
- 数据产物：`public/schedule.json`
- 日历订阅：`public/world-cup-2026.ics`、`public/calendars/*.ics`
- 数据脚本：`scripts/sync-reference-ics.mjs`、`scripts/update-data.mjs`
- 校验脚本：`scripts/validate-static.mjs`、`scripts/verify-browser.mjs`
- 自动更新：本地 dev server 定时刷新，GitHub Actions 定时刷新，前端定时重新读取 JSON

### 技术栈与技术方案

前端技术：

- 原生 HTML/CSS/JavaScript，不引入前端框架，降低部署和构建复杂度。
- CSS Grid/Flex 做响应式布局，赛程卡片在桌面和移动端都保持 `主队 / 比分 / 客队` 三列结构。
- 前端通过 `fetch('/schedule.json?t=时间戳', { cache: 'no-store' })` 读取数据，避免静态托管缓存旧 JSON。
- 国旗使用本地 SVG 图片资源 `public/flags/CODE.svg`，不依赖系统 emoji 字体，避免 Windows 显示异常。

数据与生成方案：

- Node.js ESM 脚本负责数据抓取、清洗、合并和静态产物生成。
- `data/reference-schedule.json` 作为基础赛程缓存，保存 104 场比赛、队伍、国旗代码、场馆等低频数据。
- CCTV 接口用于积分榜和射手榜，FIFA Watch 接口用于实时比分覆盖。
- 实时比分采用覆盖层：基础比分来自缓存，实时源有数据时覆盖 `score` 和 `matchStatus`。
- 多源队伍匹配使用稳定代码和 slug，必要时用 alias 修正，例如 `south-korea -> korea-republic`。
- 外部源失败或赛事结束后接口下线时，保留上一次成功缓存继续生成页面，并在 `sourceHealth` 里记录当前使用的是实时数据还是缓存数据。

日历订阅方案：

- 生成标准 ICS：总日历 `world-cup-2026.ics`、阶段日历 `calendars/stage-*.ics`、小组日历 `calendars/group-*.ics`。
- 构建时把 ICS 文件复制到 `dist/`，静态托管即可订阅。

本地开发方案：

- `scripts/serve.mjs` 使用 Node 原生 HTTP server 提供本地预览。
- 本地服务启动时会输出明确访问地址，并在启动刷新完成后再次提示。
- 本地 dev server 支持定时刷新数据，但改代码后仍要重启服务，确保新 JS/CSS/静态资源生效。

构建与部署方案：

- `npm run refresh` 串联抓取、生成、校验和构建。
- `scripts/build-static.mjs` 生成 `dist/`，复制 `index.html`、`src/`、`schedule.json`、ICS、`flags/`。
- Vercel 使用 `npm run refresh` 作为 Build Command，`dist` 作为 Output Directory。

自动更新方案：

- GitHub Actions 使用 cron `10,20,30,40,50 * * * *` 高频更新。
- cron-job.org 可作为备用触发器，通过 GitHub `workflow_dispatch` 调度。


验证方案：

- `scripts/validate-static.mjs` 做静态数据校验：比赛数量、字段完整性、ICS 事件数量。
- `scripts/verify-browser.mjs` 用 Playwright 验证桌面和手机端：布局、搜索、筛选、比分、榜单、国旗图片、ICS 访问。
- 验证国旗时不仅看 DOM 数量，还检查图片是否加载成功，避免 Windows 或静态资源路径问题。


## 2. 可复用高效经验

### Codex 使用技巧

- 先让 Codex 明确数据源、刷新频率、展示模块和验证方式，不要只说“做个网站”。
- 每次视觉反馈最好带截图，并直接指出问题位置，例如“右侧这列没有含义”“内容都挤在中间一竖”。
- 数据类项目必须要求 Codex 加自动校验脚本，不只靠肉眼看页面。
- 静态站要明确本地刷新和线上刷新是两套机制。
- 本地 dev server 的刷新间隔和线上 cron 分钟点要分别说明，避免把“本地 5 分钟轮询”误解成“线上整点 10 分触发”。
- 多数据源合并时要检查名称、slug、国家代码是否完全一致；像 `south-korea` 和 `korea-republic` 这种别名会导致比分漏合并。
- 国旗不要只用 emoji 做主展示。macOS、iOS、部分 Android 能正常显示，不代表 Windows 能正常显示；面向公开访问时优先使用 SVG/图片国旗。
- 修改 UI 后要跑桌面和移动端截图验证，尤其检查横向溢出、文本挤压、表头缺失。
- 手动调试移动端时，先右键页面选择“检查”打开 DevTools，再用 `Shift + Command + M` 切到移动端视图；先肉眼确认手机布局，再用 Playwright 做自动化截图验证。
- 每次修改代码或构建脚本后，要重启本地服务或确认 dev server 已重新加载，避免用户看到旧 bundle、旧 JSON 或旧静态资源。
- 涉及 Git 操作时，提交和推送必须单独确认。Codex 可以先完成代码修改和验证，但 `git commit`、`git push` 应等待用户明确同意。
- 线上问题不要只看页面截图，要同时检查数据文件、部署产物、GitHub Actions run、Vercel deployment 四个环节。

### 可复用脚本结构

推荐数据型静态站都提供这几类命令：

```json
{
  "scripts": {
    "sync:reference": "抓取外部数据源",
    "build": "生成 public/schedule.json 和 ICS，并运行静态校验",
    "refresh": "抓取数据 + 生成产物 + 校验",
    "dev": "启动本地服务并定时刷新",
    "check": "完整静态校验",
    "verify:browser": "Playwright 浏览器验证"
  }
}
```

### 前端防缓存读取

页面定时读取最新 JSON 时，避免浏览器或静态托管缓存旧数据：

```js
fetch(`/schedule.json?t=${Date.now()}`, { cache: "no-store" });
```

### 运行命令经验

- `npm install` 是按 `package.json` / `package-lock.json` 安装依赖，首次拉项目、换电脑或删除 `node_modules` 后必须先执行。
- 日常本地预览一般用 `npm run dev`，但本项目 dev server 启动会先刷新数据，并可能改动 `public/schedule.json` 和 ICS。
- 如果只是看页面或改文档，要注意自动刷新造成的生成文件变更；提交前用 `git status` 确认是否混入无关数据文件。
- `npm run check` 会重新构建，也会更新 `generatedAt` / `DTSTAMP`；如果本次只改文档或 workflow，应恢复这些生成文件，避免提交噪音。

### 数据刷新链路

推荐链路：

1. `sync:reference` 抓取外部源数据。
2. `build` 生成前端 JSON 和 ICS。
3. `refresh` 串联抓取和生成。
4. 本地 dev server 启动后自动刷新，之后按间隔刷新。
5. GitHub Actions 高频定时刷新。
6. 前端页面定时重新 fetch `schedule.json`。

线上刷新要注意：前端轮询只能读取已经部署出去的静态文件。若 GitHub Actions 没跑、没有新 commit、Vercel 没重新部署，页面再怎么 `fetch` 也只能读到旧 `schedule.json`。

本地和线上刷新要分开描述：

- 本地 `npm run dev` 默认按间隔刷新，例如 5 分钟一次，下一次刷新时间是以上次刷新完成时间为基准。
- 线上 cron 写成 `10,20,30,40,50 * * * *` 时，是每小时这些分钟点附近触发，不保证秒级准点。
- 用户看到的 `generatedAt` 是数据生成完成时间，不等于 cron 被调度的瞬间，也不等于 Vercel 完成部署的瞬间。

实时比分建议做成覆盖层：

1. 基础赛程、国旗、场馆等低频数据用本地缓存保底。
2. 比分、比赛状态、事件动态用实时源覆盖缓存。
3. 积分榜、射手榜可以独立抓取，不要和赛程源绑死。
4. 单个实时源失败时保留上一份成功缓存，并继续生成站点。

### 部署经验

本项目按静态站部署，推荐产物目录为 `dist/`。构建命令和发布目录：

```text
Build command: npm run refresh
Output directory: dist
```

静态部署要避免依赖本地开发服务器的路径映射能力。本地 server 可以把 `/schedule.json` 映射到 `public/schedule.json`，但 Vercel/Netlify/Cloudflare Pages 只认构建产物里的真实文件路径。

稳妥做法：

- 构建脚本显式生成 `dist/index.html`。
- 构建脚本显式复制 `dist/schedule.json`。
- 构建脚本显式复制 `dist/world-cup-2026.ics`。
- 构建脚本显式复制 `dist/calendars/*.ics`。
- 如果线上路径不确定，可以给数据读取增加兜底路径，例如先读 `/schedule.json`，失败再读 `/public/schedule.json`。

### GitHub Actions 经验

- `cron: "*/10 * * * *"` 表示每小时 `00/10/20/30/40/50` 分附近触发。
- 如果希望避开整点，只在 `10/20/30/40/50` 触发，可以写成：

```yaml
schedule:
  - cron: "10,20,30,40,50 * * * *"
```

- GitHub Actions 使用 UTC，但分钟点不受时区影响，所以北京时间仍是每小时的 `10/20/30/40/50` 分附近。
- GitHub Actions 不是秒级准点，可能延迟几分钟。
- 新仓库的定时 workflow 不一定立刻出现 run。可以先用 `workflow_dispatch` 手动触发一次，验证链路是否通。
- 自动刷新链路要检查三件事：Actions 是否有 run、run 是否成功、是否产生新 commit。
- 如果 GitHub 原生 schedule 长时间没有触发，可以用 cron-job.org 定时调用 GitHub `workflow_dispatch` 作为备用触发器。
- cron-job.org 调用成功时 GitHub API 通常返回 `204 No Content`，这不是失败，而是 dispatch 成功。
- 不要让用户在聊天里粘贴 GitHub token；应让用户在 cron-job.org 或 GitHub Secrets 界面自己配置。
- GitHub Actions 插件版本和项目 Node 版本是两层：`actions/setup-node@v6` 是 action 工具版本，`node-version: 22` 才是项目运行 Node 版本。

常用检查命令：

```bash
gh run list --repo owner/repo --workflow "Update World Cup Schedule" --limit 5
gh run watch <run-id> --repo owner/repo --exit-status
gh api repos/owner/repo/commits --jq '.[0:5][] | [.sha[0:7], .commit.author.date, .commit.message] | @tsv'
```

### Git 与远程同步经验

- 远端每 10 分钟可能由 GitHub Actions 自动提交数据，本地 `push` 前必须先 `git fetch origin main` 和 `git rebase origin/main`。
- HTTPS 和 SSH 都可以连接 GitHub 远程仓库。HTTPS 使用 token/凭证登录，配置简单；SSH 使用本机私钥和 GitHub 公钥登录，配好后通常更适合频繁 `fetch` / `push`。
- GitHub HTTPS 在国内网络下可能慢、断或出现 HTTP/2 错误；可以先用本地代理 alias `setproxy`，或配置 `git config --global http.version HTTP/1.1` 缓解。
- SSH 需要先在本机生成公钥，并添加到 GitHub SSH Keys；`ssh -T git@github.com` 成功后再切 remote。SSH/HTTPS 只影响本机 git 操作，不影响 Vercel 或 GitHub Actions。
- GitHub 网页查看每次提交改动：仓库页面点 `commits`，进入某个 commit 后看 Files changed；本地可用 `git show <commit>`。

### Vercel 经验

- Vercel 默认域名是 `*.vercel.app`，国内网络可能不稳定，表现为打不开、TLS reset、手机流量打不开、必须开代理。
- 这通常不是代码问题，而是域名/网络可达性问题。
- 如果目标用户主要在国内，优先考虑自定义域名、Cloudflare Pages、国内 OSS/CDN 或国内服务器。
- Vercel 项目后台地址不是公开访问地址。公开访问地址通常是 `https://项目名.vercel.app`。
- Vercel 只有在 GitHub 出现新 commit 后才会自动重新部署；如果 Actions 没提交新数据，Vercel 不会变。

### 好用 Prompt 模板

#### 数据型静态站起步

```text
请基于当前项目实现一个可自动更新的数据型静态网站。
要求：
1. 明确区分数据抓取、数据生成、前端展示、自动刷新。
2. 所有外部数据必须有来源，不允许伪造。
3. 生成校验脚本，验证核心数据数量和字段完整性。
4. 使用 Playwright 做桌面和移动端截图验证。
5. 页面需要支持筛选、搜索、状态展示和移动端适配。
```

#### 截图驱动修 UI

```text
请根据截图修复 UI 问题。
重点检查：
1. 信息是否有表头或解释。
2. 数字列是否能看出含义。
3. 是否有横向溢出。
4. 是否存在内容集中在中间、两侧空白的问题。
5. 移动端是否挤压、遮挡或换行难看。
修复后跑浏览器验证并生成截图。
```

#### 补自动刷新

```text
请为这个数据项目补充自动刷新机制。
要求：
1. 本地开发服务启动后自动刷新数据。
2. 线上定时任务高频刷新。
3. 前端页面定时重新读取最新 JSON。
4. 日历 ICS 同步更新。
5. README 写清楚刷新频率和部署注意事项。
```

#### 部署静态站

```text
请把当前项目整理成可部署到 Vercel/Netlify/Cloudflare Pages 的静态站。
要求：
1. 生成 dist/ 作为唯一发布目录。
2. dist/ 内必须包含 index.html、src/、schedule.json、world-cup-2026.ics、calendars/*.ics。
3. 不依赖本地 dev server 的路径映射。
4. README 写清楚 Build Command 和 Output Directory。
5. 构建后验证 dist/ 文件完整性。
```

#### 调试线上刷新

```text
请排查线上数据为什么没有定时刷新。
检查顺序：
1. 前端是否只是轮询旧 JSON。
2. GitHub Actions 是否有 run。
3. 最近一次 run 是否成功。
4. run 是否产生新 commit。
5. Vercel 是否因新 commit 重新部署。
6. 线上 schedule.json 的 generatedAt 是否更新。
不要只检查前端代码。
```

#### 移动端 UI 回归

```text
请修复移动端布局问题，并同时展示桌面和手机端效果。
要求：
1. 使用 Playwright 生成 desktop-verification.png 和 mobile-verification.png。
2. 检查移动端是否横向溢出。
3. 检查关键卡片是否保持预期结构。
4. 对数据列表类页面，检查首个卡片高度是否异常。
5. 不要只看桌面端截图。
```

## 3. 高频踩坑避雷表

| 问题现象 | 产生原因 | 修复手段 | 永久规避规则 |
| --- | --- | --- | --- |
| 页面没有定时刷新 | 只生成了静态 JSON，没有后台刷新机制 | 增加 `npm run refresh`、dev server 定时刷新、GitHub Actions 定时任务、前端轮询 | 数据型静态站必须设计抓取、生成、部署、前端读取完整刷新链路 |
| 每日更新太慢 | 世界杯一天多场，比分和榜单变化频繁 | GitHub Actions 改为每 10 分钟，本地每 5 分钟，前端每 2 分钟读取 | 比赛、金融、新闻类数据不能默认每日更新，应按业务变化频率设计 |
| 积分榜、射手榜缺失 | 只做了赛程视图，没有扩展赛事数据 | 接入 CCTV 积分榜和射手榜接口 | 体育项目默认应包含赛程、比分、积分榜、射手榜 |
| 国旗没有显示 | 数据源有国旗，但生成 JSON 时没带出来 | 在数据生成脚本里合并 `flag` 和 `code`，前端统一渲染国旗组件 | 数据生成层要保留展示所需元数据 |
| Windows 上国旗异常 | 页面用国旗 emoji 渲染，macOS/iOS/Android 支持较好，但 Windows 字体经常显示成国家代码、方块或乱码 | 改为本地 SVG 国旗图片，emoji 只作为图片加载失败兜底 | 跨平台公开站点不要依赖 emoji 作为关键图标，尤其是国旗 |
| 页面太单调 | 卡片样式重复、色彩层次不足 | 使用多色调分组、不同状态色、积分榜色带、比分高亮 | 数据密集页面要有状态色、分组色、主次层级 |
| 内容像中间一竖 | 容器宽度、网格布局和卡片列数没有适配大屏 | 使用 `auto-fill/minmax` 网格，扩大主容器宽度 | 大屏页面必须验证 1440px 以上截图 |
| 数字列没有含义 | 积分榜只显示数据，没有表头 | 增加 `排 / 球队 / 赛 / 胜平负 / 净胜 / 分` 表头 | 所有表格型数据必须有列头，哪怕是卡片内表格 |
| 右侧积分列看不懂 | 只有数字，没有视觉强调 | 把积分列做成胶囊样式，并在表头标“分” | 关键指标列必须视觉突出并有标题 |
| 移动端可能挤压 | 国旗、队名、比分都在同一行 | 使用固定列宽、文本截断、响应式布局 | 加图标、国旗、队徽后必须跑移动端截图 |
| 手机端赛程卡片布局混乱 | 移动端 CSS 把三列比分行改成单列，导致队名、比分、队名上下堆叠 | 在小屏仍保留 `主队 / 比分 / 客队` 三列，只缩小列宽、字号、国旗尺寸 | 移动端不是简单把 grid 改成一列；关键业务结构要保持可读 |
| 电脑端看着正常，手机端很差 | 只看了桌面截图，没有把手机截图作为验收项 | Playwright 同时生成桌面和手机截图，并加入移动端布局断言 | 每次 UI 修改必须同时展示桌面和手机效果 |
| 手动看着正常但手机仍有问题 | 只在桌面宽度缩小窗口看，没有切换 DevTools 设备模拟 | 先右键“检查”打开 DevTools，再用 `Shift + Command + M` 打开移动端视图，并结合 Playwright mobile viewport 验证 | 移动端验收要同时包含手动设备视图和自动化截图 |
| 改完代码但页面还是旧效果 | 本地 dev server 没重启，或浏览器还在读旧静态资源/旧 JSON | 修改完成后重启服务，并用浏览器验证重新加载后的页面 | 每次代码、构建脚本、静态资源变更后，都要重启本地服务或确认热更新生效 |
| 前端轮询了但线上时间不更新 | 前端只重新读取静态 JSON，但 GitHub Actions 没跑或 Vercel 没重新部署 | 检查 Actions run、最新 commit、远程 `schedule.json`、Vercel deployment | 自动刷新不是只有前端轮询，必须验证数据生成和部署链路 |
| GitHub Actions 配了 cron 但没运行 | 新 workflow 可能没有立即产生 schedule run，或需要先手动触发验证 | 用 `gh workflow run` 手动触发一次，再 `gh run watch` 看结果 | 新增定时 workflow 后必须手动触发一次验证链路 |
| 定时刷新分钟点不符合预期 | `*/10` 包含整点 `00`，且表达不够直观 | 改成 `10,20,30,40,50 * * * *` | 对产品有明确时间点要求时，用显式 cron 分钟列表 |
| 本地刷新和线上刷新混淆 | 本地 dev server 是按间隔刷新，线上 cron 是固定分钟点触发 | README 和答复中明确区分本地 5 分钟、线上 `10/20/30/40/50` 分钟点 | 所有刷新说明必须标明“本地/线上/前端轮询”是哪一层 |
| 实时比分被基础缓存卡住 | 为避开 `2026fifa.qiaomu.ai` 超时，只使用缓存 `reference-schedule.json`，无法拿到最新赛况 | 增加 FIFA Watch `/api/match-live.json?lang=zh` 作为比分覆盖层，央视继续负责积分榜/射手榜 | 基础赛程和实时比分要分层：基础数据可缓存，比分状态必须有实时源 |
| 实时比分有 6 场但只合并 5 场 | 不同数据源的队伍 slug 不一致，例如 FIFA Watch 用 `south-korea`，本地参考源用 `korea-republic` | 增加 slug alias 归一化，并用合并数量校验覆盖效果 | 多源合并不能只按显示名硬匹配，必须有别名表和匹配结果统计 |
| 单个外部源超时拖垮整轮刷新 | 用 `curl && curl && build` 串联，任一源失败都会导致后续生成中断 | 改为 `scripts/fetch-live-data.mjs` 逐个抓取，失败时保留上一次缓存 | 定时任务抓多个源时必须容错，不能让非核心源失败导致整站数据不更新 |
| 世界杯结束后接口下线 | 外部数据源可能关闭专题、改接口或返回空数据 | 保留 `data/*.json` 最近一次成功缓存，抓取失败时继续用缓存生成，并把源状态写入 `sourceHealth` | 数据站必须有离线兜底，不能把页面可用性绑定在赛事期间接口上 |
| GitHub 原生 cron 不稳定 | 新仓库或低活跃仓库的 `schedule` 可能延迟或长时间不触发 | 使用 cron-job.org 调 GitHub `workflow_dispatch` 补一层外部触发 | 对高频数据站，不能只依赖单一调度器；至少保留手动触发和外部触发方案 |
| 用户误贴 GitHub token | 配置第三方 cron 时不清楚 token 放哪里，直接发到聊天里 | 立即提醒撤销旧 token，后续只指导在平台界面配置，不在聊天里接收 token | 所有密钥配置都走平台 Secret/Header 输入框，不进入对话和仓库 |
| Vercel 默认域名手机打不开 | `*.vercel.app` 在国内网络下可能不稳定或被 reset | 换网络验证，必要时绑定自定义域名或换国内 CDN/静态托管 | 面向国内用户不要默认认为 Vercel 域名稳定可访问 |
| Vercel 页面能打开但数据失败 | 静态发布目录里没有预期的 `/schedule.json`，或路径映射只在本地 server 生效 | 构建 `dist/` 时显式复制根路径数据文件，并给前端加兜底数据路径 | 静态托管只认构建产物真实路径，不认本地 server fallback |
| 未经确认执行推送 | Codex 误把代码修改后的推送也当作任务的一部分 | 明确改为提交/推送前必须等待用户同意 | Git 操作分层：修改、验证、提交、推送四步必须分别确认 |
| README 与实际不一致 | 功能改了但文档没同步 | 更新刷新说明、命令说明、部署说明 | 每次改运行机制必须同步 README |
| 验证只靠肉眼 | 视觉修了但数据可能错 | 增加 `validate-static.mjs` 和 `verify-browser.mjs` | 数据项目必须有自动校验，不接受“看起来可以” |

## 4. 下次同类项目前置规范清单

### 数据规范

- 明确主数据源、备用数据源、展示字段来源。
- 把基础赛程、实时比分、积分榜、射手榜拆成独立数据层，不要混成一个抓取入口。
- 多源队伍匹配必须准备别名表，例如 `south-korea -> korea-republic`。
- 生成 JSON 时保留展示所需元数据：国旗、代码、状态、比分、来源。
- 国家/地区标识应提供稳定图片资源，例如 `public/flags/CODE.svg`，不要只依赖系统 emoji 字体。
- 所有外部数据必须能重新抓取，不手填核心数据。
- 明确刷新频率，比赛日建议 5 到 10 分钟级别。
- 外部实时源失败时保留上一份成功缓存，并在生成数据里标记 `scoreSource`。
- 生成数据里要保留 `sourceHealth`，用于判断当前页面来自实时源还是最近一次缓存。
- 每次接入新实时源后，统计“源返回条数”和“成功合并条数”，发现不一致要排查别名或顺序问题。

### 页面规范

- 首屏直接进入可用功能，不做空泛 landing page。
- 数据密集页面必须有搜索、筛选、快捷查看、状态标签、表头、移动端适配。
- 表格型数据必须有列名。
- 关键数字必须说明含义。
- 比分、积分、排名必须有视觉层级。
- 国家、球队展示优先带国旗或队徽。
- 关键图标要跨 Windows/macOS/iOS/Android 验证；emoji 只能做兜底或装饰，不做唯一视觉信息。

### 自动化规范

- 必须提供 `npm run refresh`。
- 必须提供 `npm run check`。
- 必须提供 `npm run verify:browser`。
- 必须提供可部署的 `dist/` 构建产物。
- 本地 dev server 应支持自动刷新。
- 每次修改后应自动重启本地服务，或在最终反馈里明确服务是否仍运行、是否需要重启。
- 前端 fetch JSON 应加防缓存参数。
- 线上部署应有定时任务。
- 高频刷新建议同时保留 GitHub Actions 手动触发、GitHub schedule、外部 cron-job.org 触发三种入口。
- 定时任务要提交或发布生成后的 JSON 和 ICS。
- 新增或修改 GitHub Actions 后，必须手动触发一次确认可运行。
- README 必须写清楚刷新机制。


### 部署规范

- Vercel/Netlify/Cloudflare Pages 的发布目录统一用 `dist`。
- 不要把本地 dev server 的路径行为当作线上行为。
- 线上公开地址和平台后台地址要区分。
- 面向国内访问时，提前评估 `vercel.app`、`github.io` 等默认域名的可达性。
- 若要求稳定国内访问，优先准备自定义域名、CDN 或国内静态托管方案。

### 协作与 Git 规范

- Codex 可以执行代码修改和验证。
- Codex 不应在未获得明确同意前执行 `git commit`。
- Codex 不应在未获得明确同意前执行 `git push`。
- 本项目后续提交信息优先使用中文，方便在 GitHub 提交列表里直接理解改动内容。
- 因远端自动数据提交频繁，提交前后都要确认本地和远端关系，例如 `ahead`、`behind`、`diverged`。
- 如果需要提交，应先汇报改动文件、验证结果和待提交范围。
- 如果本地有数据刷新造成的大量数据文件变更，应单独说明，避免和 UI 修改混在一起。
