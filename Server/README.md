# IsItSafe 后端 API

Node.js + NestJS + Prisma + PostgreSQL + Redis，严格按《Server 的 AI Prompt 设计》实现。

## 从 0 到 1 本地启动

### 1. 环境要求

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 2. 安装依赖

```bash
cd Server
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少填写：
# - DATABASE_URL（PostgreSQL 连接串）
# - REDIS_URL 或 REDIS_HOST+REDIS_PORT
# - JWT_SECRET
# - 任选其一：DOUBAO_API_KEY 或 OPENAI_API_KEY（用于 AI 分析）
```

### 4. 数据库迁移与种子数据

```bash
# 生成 Prisma Client
npx prisma generate

# 执行迁移（会创建所有表）
npx prisma migrate dev --name init

# 写入示例数据（risk_data、knowledge_cases、settings）
npx prisma db seed
```

若使用已有数据库且无迁移历史，可先：

```bash
npx prisma migrate dev --name init
```

再执行 `npx prisma db seed`。

### 5. 启动服务

```bash
npm run start:dev
```

服务默认在 `http://localhost:3000`，接口前缀为 `/api`。

---

## 关键接口与 curl 示例

### 健康检查（无需鉴权）

```bash
curl -s http://localhost:3000/api/health
# 期望：{"status":"ok"}
```

### 用户登录（获取 JWT）

```bash
# 手机号登录（MVP mock，不校验验证码）
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'

# 邮箱登录
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

返回示例：`{"accessToken":"...","refreshToken":"...","expiresIn":604800}`。后续请求在 Header 中带 `Authorization: Bearer <accessToken>`。

### AI 分析（未登录也可调用，会限流）

```bash
curl -s -X POST http://localhost:3000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"content":"这个链接靠谱吗 https://fake-bank.com","language":"zh"}'
```

返回为统一 JSON schema，例如：

```json
{
  "risk_level": "high",
  "confidence": 85,
  "risk_type": ["钓鱼网站"],
  "summary": "一句话总结",
  "reasons": ["原因1", "原因2"],
  "advice": ["建议1", "建议2"],
  "score": 82
}
```

### 知识库列表（无需鉴权）

```bash
curl -s "http://localhost:3000/api/knowledge?page=1&pageSize=5"
```

### 管理端 - AI 统计（需 Admin/Superadmin JWT）

先用上面登录接口登录一个 **role 为 ADMIN 或 SUPERADMIN** 的用户（需在 DB 中把某用户的 `role` 改为 `ADMIN`），拿到 `accessToken`：

```bash
# 将 YOUR_ACCESS_TOKEN 替换为实际 token
curl -s "http://localhost:3000/api/admin/ai/stats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 创建 Admin 账号

数据库迁移后，可将任意用户的 `role` 改为 `ADMIN` 或 `SUPERADMIN`，用该用户手机/邮箱登录即可访问 `/api/admin/*`：

```sql
UPDATE users SET role = 'ADMIN' WHERE phone = '13800138000' LIMIT 1;
```

或使用 Prisma Studio：

```bash
npx prisma studio
```

在 `users` 表中编辑对应用户的 `role` 字段。

---

## 目录结构（与规范一致）

```
server/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── ai/
│   │   │   ├── parser/
│   │   │   ├── rag/
│   │   │   ├── risk-engine/
│   │   │   ├── providers/
│   │   │   └── prompts/
│   │   ├── query/
│   │   ├── knowledge/
│   │   ├── report/
│   │   ├── subscription/
│   │   ├── admin/
│   │   ├── settings/
│   │   ├── health/
│   │   └── queries/
│   ├── common/
│   │   ├── guards/
│   │   ├── utils/
│   │   └── rate-limit/
│   ├── main.ts
│   └── app.module.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── package.json
├── .env.example
└── README.md
```

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 开发模式启动（watch） |
| `npm run build` | 构建 |
| `npm run start:prod` | 生产启动 |
| `npx prisma migrate dev` | 开发环境迁移 |
| `npx prisma db seed` | 执行种子数据 |
| `npx prisma studio` | 打开 Prisma Studio |

---

## 接口一览（路径不可改）

- **用户侧**：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/userinfo`、`POST /api/ai/analyze`、`POST /api/ai/analyze/screenshot`、`POST /api/query/phone`、`POST /api/query/url`、`POST /api/query/company`、`GET /api/queries`、`POST /api/report`、`GET /api/knowledge`、`GET /api/knowledge/:id`、`POST /api/subscription/verify`、`GET /api/subscription/status`
- **管理侧**：`GET/PUT /api/admin/users`、`GET /api/admin/queries`、`GET/PUT /api/admin/reports`、`GET/POST/PUT/DELETE /api/admin/knowledge`、`GET /api/admin/ai/stats`、`GET /api/admin/settings`、`PUT /api/admin/settings`（仅 superadmin）
- **健康**：`GET /api/health`
