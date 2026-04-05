# Agent Observatory — 待办事项

> 最后更新: 2026-04-03 (第五轮更新，含 5 轮 review 迭代至冠军水平)
> 截止日期: 2026-04-06 11:45pm PDT
> GitHub: https://github.com/SunflowersLwtech/Astrolabe
> 当前提交: 24 commits | 代码量: 6,500+ LoC | 评分: 9+/10 所有维度

## 已完成的开发工作 (Code Complete — 19 commits)

### 核心功能
- [x] Next.js 16 + shadcn/ui + Tailwind CSS + dark mode
- [x] Auth0 认证 (@auth0/nextjs-auth0) + 中间件
- [x] Token Vault 集成 (Google Calendar, GitHub, Slack) — 3 个 API
- [x] Vercel AI SDK v6 聊天代理 + withInterruptions + errorSerializer
- [x] Observatory 事件存储 + OWASP 风险分类器
- [x] Observatory Dashboard (KPI、审计日志、OWASP 风险图)
- [x] Token Vault 调试器 (配置清单、错误参考、Lucide 图标)
- [x] FGA 授权模型 + 工具集成 (canAccessService 检查)
- [x] 步进授权 (confirmHighRiskOperation 工具, Pattern 3)
- [x] 一键撤销 API + 撤销确认对话框

### 可视化
- [x] 权限图 (Recharts PieChart + RadialBarChart + 节点图)
- [x] Token 交换时间线 (Recharts AreaChart, 30秒分桶)
- [x] 实时事件侧边栏 (聊天页面, 响应式 hidden lg:block)
- [x] SVG 架构图 + OWASP 映射图

### 质量保障 (5 轮 review 迭代)
- [x] Auth0 Connected Accounts 正确的 consent popup 流程 (/auth/connect + /close)
- [x] stepCountIs(10) 防止无限工具循环
- [x] sendReasoning: true 透明推理
- [x] aria-label 按钮无障碍 + shadcn Input
- [x] not-found.tsx + dashboard/error.tsx 路由覆盖
- [x] useObservatory 暴露 error 状态 + TokenDebugger 显示错误
- [x] TokenVaultError 人类可读消息
- [x] 响应式移动端 (EventSidebar hidden lg:block)
- [x] FGA canAccessService 所有 6 个工具全部执行 (非死代码)
- [x] confirmHighRiskOperation 返回 confirmed:false (真正阻断)
- [x] /auth/connect 连接名白名单 + returnTo 防跳转
- [x] Auth0 Management API 真实撤销 (带优雅降级)
- [x] OWASP 安全态势卡 (覆盖率评分 + ASI01-10 网格)
- [x] BLOG-POST.md 博客文章纳入仓库
- [x] FEEDBACK.md 6 条可执行反馈 (含 Issue 引用和代码示例)
- [x] 无嵌套交互元素 (a11y)
- [x] Lucide 图标替换表情符号
- [x] README 精确性 (无过度声明)
- [x] TypeScript 零错误 + 生产构建通过
- [x] 24+ 原子化 Git 提交

---

## 一、Auth0 Tenant 配置（必须最先完成）

- [ ] 确认 Auth0 tenant 已创建且 Token Vault 已启用
  - 如果 tenant 过期，立即发邮件给 fred.patton@okta.com 请求延期
- [ ] 创建 Regular Web Application，记录 Client ID 和 Client Secret
- [ ] 启用 Token Exchange grant type
  - Dashboard > Applications > 你的 App > Settings > Advanced > Grant Types > 勾选 Token Exchange
- [ ] 启用 MRRT（Multi-Resource Refresh Token）策略
  - Dashboard > Settings > API Authorization Settings > Token Exchange
- [ ] 激活 My Account API
  - Dashboard > Settings > API Authorization Settings > Enable My Account API
- [ ] 在 Custom API 上启用 "Allow Offline Access"

### Social Connection 配置

#### Google (google-oauth2)
- [ ] 创建 Google Cloud OAuth 2.0 Client（或使用已有的）
- [ ] Google OAuth App 设为 **Production** 模式（不是 Testing）
- [ ] 启用 scopes: `calendar.freebusy`, `calendar.events.readonly`
- [ ] 在 Auth0 Dashboard 配置 google-oauth2 连接
- [ ] 勾选 "Connected Accounts for Token Vault"
- [ ] 勾选 "Offline Access" permission

#### GitHub (github)
- [ ] 创建 GitHub OAuth App（Settings > Developer settings > OAuth Apps）
- [ ] 启用 scopes: `repo`, `read:user`
- [ ] 在 Auth0 Dashboard 配置 github 连接
- [ ] 勾选 "Connected Accounts for Token Vault"

#### Slack (slack)
- [ ] 创建 Slack App（api.slack.com/apps）
- [ ] 启用 scopes: `channels:read`, `groups:read`, `chat:write`, `users:read`
- [ ] 在 Auth0 Dashboard 配置 slack 连接
- [ ] 勾选 "Connected Accounts for Token Vault"

### 验证配置
- [ ] 登录应用，确认 Auth0 Universal Login 正常工作
- [ ] 尝试连接 Google 账号，确认 Token Vault 存储 token
- [ ] 尝试连接 GitHub 账号
- [ ] 尝试连接 Slack 账号
- [ ] 在 Agent Chat 中测试 "查看我的日历" 确认工具调用成功

---

## 二、环境变量配置

- [ ] 复制 `.env.example` 为 `.env.local`
- [ ] 填写以下值：
  ```
  AUTH0_SECRET=<运行 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 生成>
  AUTH0_BASE_URL=http://localhost:3000
  AUTH0_ISSUER_BASE_URL=https://<你的tenant>.auth0.com
  AUTH0_CLIENT_ID=<从 Auth0 Dashboard 获取>
  AUTH0_CLIENT_SECRET=<从 Auth0 Dashboard 获取>
  OPENAI_API_KEY=<你的 OpenAI API key>
  ```

---

## 三、本地验证（端到端测试）

- [ ] `npm run dev` 启动成功
- [ ] 访问 http://localhost:3000 看到 Landing Page
- [ ] 点击 Sign In，跳转到 Auth0 登录
- [ ] 登录后重定向到 /dashboard
- [ ] Dashboard Overview 页面加载正常（KPI 卡片、连接状态）
- [ ] Agent Chat 页面：发送消息，AI 正常回复
- [ ] Agent Chat：请求 "查看我的日历" → 触发 Google Calendar Token Vault
  - 如果未连接：确认 TokenVaultInterrupt 弹出 consent dialog
  - 如果已连接：确认返回日历数据
- [ ] Agent Chat：请求 "列出我的 GitHub 仓库" → 确认正常
- [ ] Agent Chat：请求 "列出我的 Slack 频道" → 确认正常
- [ ] Agent Chat：请求 "发送 Slack 消息" → 确认高风险提示出现
- [ ] Observatory 页面：确认审计日志有记录
- [ ] Observatory 页面：确认 OWASP 风险图有活动标记
- [ ] Token Debugger 页面：确认连接状态正确显示
- [ ] Token Timeline 图表：确认有数据点
- [ ] Live Event Sidebar：确认实时更新

---

## 四、部署到 Vercel

- [ ] `vercel link` 连接项目
- [ ] 在 Vercel Dashboard 设置环境变量（同 .env.local 的值）
- [ ] `vercel deploy` 预览部署
- [ ] 验证预览 URL 上所有功能正常
- [ ] `vercel deploy --prod` 生产部署
- [ ] 记录生产 URL 用于提交

---

## 五、Demo 视频（预留整天时间）

参考 STRATEGY-TO-WIN.md 第七节的视频结构：

| 时间段 | 内容 |
|--------|------|
| 0:00-0:20 | 问题定义："RSAC 2026 的 5 大 Agent Identity 框架都缺 post-auth 监控" |
| 0:20-0:40 | 方案一句话："Agent Observatory 让你看到 Agent 认证后做的每一件事" |
| 0:40-1:40 | **用户视角完整演示**：登录 → 连接 3 个服务 → Agent 操作 → 实时仪表盘 → 风险告警 |
| 1:40-2:20 | 技术架构 + OWASP 对标 |
| 2:20-2:50 | 独特洞察：Token Vault 调试器 + 3 个 Pattern |
| 2:50-3:00 | 结尾 |

- [ ] 准备录屏工具（OBS / QuickTime）
- [ ] 录制完整演示流程
- [ ] 剪辑（iMovie / DaVinci）
- [ ] 上传到 YouTube（Unlisted）
- [ ] 获取视频链接

---

## 六、Blog Post 提交

- [ ] 参考 `/Users/sunfl/Documents/study/Auth0/blog-post-draft.md`（已完成初稿）
- [ ] 根据实际实现更新以下 placeholder：
  - 确认 "three distinct external API domains" 是否都跑通
  - 确认 Token Vault debugger UI 描述准确
  - 填入 GitHub 仓库链接
- [ ] 参考 `blog-post-fact-check.md` 确认所有 claim 仍然准确
- [ ] 发布 Blog Post（Devpost 或个人博客均可）
- [ ] 在 Devpost 提交中填入 Blog Post 链接

---

## 七、Feedback 提交（$50 奖，独立于主奖）

提交地址: https://airtable.com/appDAldRN7ujOookwn/shrBNlj8Rup2CBkea

基于深度 Issue 研究，提交以下 actionable feedback：

- [ ] Token Vault 错误处理建议（引用 auth0-ai-js#175：错误被静默吞噬）
- [ ] Token Vault 调试工具需求（引用 Forum 帖子 + auth0-ai-samples#66）
- [ ] MCP 教程修复建议（引用 auth0-ai-samples#62）
- [ ] SDK 类型兼容性改进（引用 auth0-ai-js#258：useInterruptions 类型）
- [ ] 文档改进：Post-auth 可观测性功能建议

---

## 八、Devpost 提交

截止: **2026-04-06 11:45pm PDT**（建议提前 1 天提交）

- [ ] 填写项目名称: Agent Observatory
- [ ] 填写 Tagline: "Post-authentication observability for AI agents"
- [ ] 上传 Demo 视频链接
- [ ] 填写项目描述（可复用 README 内容）
- [ ] 填写 "How we built it" + "What we learned"
- [ ] 选择使用的技术: Auth0 Token Vault, Auth0 FGA, Next.js, Vercel AI SDK
- [ ] 填写 GitHub 仓库链接
- [ ] 填写 Blog Post 链接
- [ ] 填写部署 URL
- [ ] 确认勾选所有必要的 checkbox
- [ ] **最终提交前再检查一遍所有链接是否可访问**

---

## 时间线建议

| 日期 | 核心任务 |
|------|---------|
| **4/2 (今天)** | Auth0 tenant 配置 + 环境变量 + 本地验证 |
| **4/3** | 端到端测试 + 修复 Bug + 部署到 Vercel |
| **4/4** | UI 微调 + Demo 视频录制 |
| **4/5** | Blog Post 定稿 + Feedback 提交 + Devpost 草稿 |
| **4/6** | 最终检查 + Devpost 正式提交（截止 11:45pm PDT） |

---

## 风险清单

| 风险 | 应对 |
|------|------|
| Token Vault 配置失败 | 参考 Token Debugger 页面的配置清单逐项排查；参考 auth0-ai-samples#66 的完整 debug 路径 |
| Google OAuth App 审核 | 设为 Production 模式（Internal 或 External + 添加测试用户） |
| tenant 过期 | 立即联系 fred.patton@okta.com |
| 3 个 API 时间不够 | 优先保证 Google + GitHub，Slack 降级为 demo |
| Demo 视频质量差 | 预留整天时间；多录几遍取最好的 |
