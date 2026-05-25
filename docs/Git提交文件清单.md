# Git 提交文件清单

## 一、本次（Admin 接口补全 + 默认线上地址 + iOS 图片发送清空）

### Server
- `Server/src/modules/admin/admin-risk-data.controller.ts`（新增：风险数据 CRUD）
- `Server/src/modules/admin/admin.module.ts`（注册 AdminRiskDataController）
- `Server/src/modules/admin/admin-reports.controller.ts`（新增 GET /admin/reports/:id）
- `Server/src/modules/report/report.service.ts`（新增 getOne）
- `Server/src/modules/admin/admin-knowledge.controller.ts`（新增 GET /admin/knowledge/:id）

### Admin
- `admin/src/api/request.ts`（默认 baseURL 改为 https://api.starlensai.com/api）
- `admin/src/api/client.ts`（默认 BASE 改为线上；登录路径改为 /admin/auth/login）

### iOS
- `iOS/IsItSafe/Source/Views/Home/AnalyzeInputBar.swift`（发送图片/图片+文字后清空待发图片与输入框）

---

## 二、上次（风险类型与 URL 流程、图片无法识别、unknown 分值说明）

### Server
- `Server/src/modules/ai/ai.types.ts`（风险类型 + reasons/advice 各 3 条 + 兜底）
- `Server/src/modules/ai/prompts/ai-prompts.service.ts`（schema、URL 文案、系统提示）
- `Server/src/modules/ai/ai.service.ts`（URL 专用流程、图片无文字时返回「图片内容无法识别」）
- `Server/src/modules/ai/ai.module.ts`（引入 QueryModule）
- `Server/src/common/utils/normalize.ts`（extractUrlFromContent）

### iOS
- `iOS/IsItSafe/Source/Models/AI/RiskAnalysisViewData.swift`（imageContentNotRecognized + init）
- `iOS/IsItSafe/Source/ViewModels/Home/HomeViewModel.swift`（OCR 为空时展示正常卡片不报错）

---

## 三、下次（可选 / 后续）

- 若后续在 Admin 增加「分析统计」页并接后端：需在 Server 增加 `GET /admin/analytics/overview`、`/admin/analytics/risk-stats`、`/admin/analytics/daily-queries`（当前前端已用 /admin/ai/stats 等做降级）。
- 若后续在 Admin 增加「AI 服务商」CRUD：需在 Server 增加 `GET/POST /admin/ai/providers`、`PUT /admin/ai/providers/:id`、`PUT /admin/ai/providers/activate/:id`（当前前端 getAiProviders 失败时返回空列表）。
- 若调整「无法确定风险」的固定 27 分：改 `Server/src/modules/ai/risk-engine/risk-score.service.ts` 中 unknown 的 base 或权重。

---

## 四、Admin 提交类接口核对结果（本次已逐点核对）

| 前端调用 | Server 路由 | 状态 |
|----------|-------------|------|
| POST /admin/auth/login | AdminAuthController @Post('login') | ✅ |
| POST /admin/auth/change-password | AdminAuthController @Post('change-password') | ✅ |
| GET/PUT /admin/users, /admin/users/:id, :id/status | AdminUsersController | ✅ |
| GET /admin/queries, /admin/queries/:id | AdminQueriesController | ✅ |
| GET /admin/reports, GET /admin/reports/stats, PUT :id/status | AdminReportsController | ✅ |
| **GET /admin/reports/:id** | AdminReportsController @Get(':id') + ReportService.getOne | ✅ 本次新增 |
| GET /admin/knowledge, POST upload, PUT/DELETE :id | AdminKnowledgeController | ✅ |
| **GET /admin/knowledge/:id** | AdminKnowledgeController @Get(':id') | ✅ 本次新增 |
| GET/POST/PUT/DELETE /admin/risk-data, GET /admin/risk-data/:id | AdminRiskDataController | ✅ 本次新增 |
| GET/PUT /admin/settings | AdminSettingsController | ✅ |
| GET /admin/ai/stats, GET /admin/ai/logs | AdminAnalyticsController (admin/ai) | ✅ |
| GET /admin/subscription/logs | AdminSubscriptionController | ✅ |
| GET/POST /admin/messages | AdminMessagesController | ✅ |
| GET/POST/PUT/DELETE /admin/membership/plans | AdminMembershipController | ✅ |
| GET /admin/analytics/overview, risk-stats, daily-queries | 未实现 | 前端已用 /admin/ai/stats 等降级 |
| GET/POST/PUT /admin/ai/providers, activate/:id | 未实现 | 前端失败时返回空 |

---

## 五、一次性提交所有改动（含上次+本次）的推荐命令

```bash
cd /Users/micheal/Documents/IsItSafe

# 上次 + 本次 涉及文件
git add \
  Server/src/modules/ai/ai.types.ts \
  Server/src/modules/ai/prompts/ai-prompts.service.ts \
  Server/src/modules/ai/ai.service.ts \
  Server/src/modules/ai/ai.module.ts \
  Server/src/common/utils/normalize.ts \
  Server/src/modules/admin/admin-risk-data.controller.ts \
  Server/src/modules/admin/admin.module.ts \
  Server/src/modules/admin/admin-reports.controller.ts \
  Server/src/modules/admin/admin-knowledge.controller.ts \
  Server/src/modules/report/report.service.ts \
  admin/src/api/request.ts \
  admin/src/api/client.ts \
  iOS/IsItSafe/Source/Views/Home/AnalyzeInputBar.swift \
  iOS/IsItSafe/Source/Models/AI/RiskAnalysisViewData.swift \
  iOS/IsItSafe/Source/ViewModels/Home/HomeViewModel.swift \
  docs/Git提交文件清单.md

git status
git commit -m "feat: Admin 风险数据/举报详情/知识详情接口+默认线上地址; iOS 图片发送后清空; 上次 AI 风险类型与 URL 流程、图片无法识别友好返回"
git push origin main
```

（分支名非 `main` 时替换为实际分支。）
