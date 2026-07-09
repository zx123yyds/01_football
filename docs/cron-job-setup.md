# cron-job.org 定时触发配置

本文记录如何用 cron-job.org 作为 GitHub Actions `workflow_dispatch` 的外部备用触发器。

## 平台入口

- cron-job.org 控制台：https://console.cron-job.org/dashboard
- GitHub Workflow 文件：`.github/workflows/update-schedule.yml`

## 用途

GitHub Actions 自带 `schedule` 在新仓库或低活跃仓库上可能延迟或不稳定。cron-job.org 可以按固定频率调用 GitHub API，主动触发 workflow。

## GitHub API 地址

```text
https://api.github.com/repos/zx123yyds/01_football/actions/workflows/update-schedule.yml/dispatches
```

## cron-job.org 配置

1. 登录 cron-job.org。
2. 创建新的 cron job。
3. URL 填 GitHub API 地址。
4. Method 选择 `POST`。
5. Schedule 设置为每 10 分钟，或按需要设置为每小时 `10/20/30/40/50` 分附近。
6. Request Body 填：

```json
{ "ref": "main" }
```

7. Headers 添加：

```text
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
Authorization: Bearer <GitHub Personal Access Token>
```

不要把真实 token 写进仓库、文档或聊天记录。只在 cron-job.org 的 Header 配置界面填写。

## Token 权限

建议使用 Fine-grained Personal Access Token，并只授权本仓库。

需要的权限：

- Repository access：只选择 `zx123yyds/01_football`
- Actions：Read and write
- Contents：Read and write

## 成功标志

cron-job.org 测试运行返回：

```text
204 No Content
```

这表示 GitHub 已接受 workflow dispatch 请求，不是失败。

随后到 GitHub Actions 页面检查是否出现新的 `workflow_dispatch` run。

注意：cron-job.org History 显示成功，只代表它成功调用了 GitHub API。它不能证明页面数据已经更新。页面是否更新，还取决于 GitHub Actions 是否跑完、是否提交了新的 `public/schedule.json` 和 ICS、Vercel 是否重新部署。

## 排查顺序

1. cron-job.org History 是否显示成功。
2. 返回码是否为 `204 No Content`。
3. GitHub Actions 是否出现新的 run。
4. run 是否成功执行 `npm run refresh`。
5. run 是否产生新的数据 commit。
6. Vercel 是否因为新 commit 自动部署。
7. 线上 `/schedule.json` 的 `generatedAt` 是否更新。

如果 cron-job.org 每 10 分钟都有成功记录，但页面仍停留在旧日期，优先检查第 3 到第 7 步，不要只盯着 cron-job.org。常见原因是 workflow 没有生成新 commit、远端数据文件未变化、Vercel 没有新部署，或者前端仍读到旧的静态 JSON。

## 安全注意事项

- 不要在聊天里粘贴 token。
- 不要把 token 写入 README、docs 或代码。
- token 泄露后应立即 revoke，并重新生成。
- 如果只是排查触发链路，优先用 GitHub 页面手动 `Run workflow`，确认 workflow 本身可运行后再排查 cron-job.org。
