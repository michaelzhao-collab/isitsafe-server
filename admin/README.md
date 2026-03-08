# IsItSafe Admin（管理后台）

AI 风控平台管理后台，严格通过 Server API 获取数据，不直连数据库。

## 技术栈

- React 18 + TypeScript
- Vite
- Ant Design 5
- React Router 6
- Axios（统一封装于 `api/request.ts`）
- 状态管理：Context（Auth）

## 目录结构（与需求一致）

```
admin/
  src/
    api/           # 统一 API：request.ts + users/queries/reports/risk/knowledge/ai/settings/analytics/adminUsers
    pages/         # dashboard, users, queries, reports, riskDatabase, knowledge, aiSettings, systemSettings, analytics, adminUsers
    components/    # tables, filters, forms, charts
    router/        # index.tsx
    layouts/       # AdminLayout.tsx
```

## 开发

1. 复制环境变量：
   ```bash
   cp .env.example .env
   ```
2. 在 `.env` 中设置 `VITE_API_BASE_URL`：
   - 开发：`http://localhost:3000/api`
   - 生产：`https://api.isitsafe.com/api`
3. 安装并启动：
   ```bash
   npm install
   npm run dev
   ```
4. 使用 **手机号或邮箱 + 验证码** 登录（与 Server `/api/auth/login` 一致）。MVP 阶段验证码可填任意；管理员需为 ADMIN/SUPERADMIN 角色。

## 构建

```bash
npm run build
```
产物在 `dist/`。

## 模块与接口

| 模块 | 页面 | 主要接口 |
|------|------|----------|
| Dashboard | Dashboard | GET /api/admin/analytics/overview（或 /admin/ai/stats） |
| Users | UsersList, UserDetail | GET /api/admin/users, PUT /api/admin/users/:id/status |
| AI Queries | QueriesList, QueryDetail | GET /api/admin/queries, GET /api/admin/queries/:id |
| Reports | ReportsList, ReportDetail | GET/PUT /api/admin/reports, /api/admin/reports/:id/status |
| Risk Database | RiskList, RiskEdit | GET/POST/PUT/DELETE /api/admin/risk-data |
| Knowledge Base | KnowledgeList, KnowledgeEdit | GET /api/admin/knowledge, POST upload, PUT/DELETE :id |
| AI Settings | AIProviders | GET /api/admin/settings, PUT（Superadmin）, /admin/ai/providers（若实现） |
| System Settings | Settings | GET/PUT /api/admin/settings |
| Analytics | AnalyticsDashboard | GET /api/admin/analytics/* 或 /admin/ai/stats |
| Admin Users | AdminUsersList | GET/POST/PUT /api/admin/admin-users（若实现） |

所有请求自动携带 `Authorization: Bearer <token>`，401 时跳转登录。配色见项目根目录 `docs/COLOR-PALETTE.md`。
