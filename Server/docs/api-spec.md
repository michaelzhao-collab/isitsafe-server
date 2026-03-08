# IsItSafe API 接口规范

本文档基于当前 server 已实现接口整理，供 iOS 客户端直接使用。所有路径、方法、参数与返回以实际代码为准。

**基础说明：**

- 所有接口前缀为 `/api`（如 `POST /api/auth/login` 表示完整路径为 `http(s)://host/api/auth/login`）。
- 需要 token 的接口请在请求头中携带：`Authorization: Bearer <accessToken>`。
- 除特别说明外，请求体均为 `Content-Type: application/json`。
- 文档中「是否需要登录」与「是否需要 token」一致：需要登录即需要带 token。

**标记说明：**

- **iOS 会调用**：iOS 客户端会使用的接口。
- **Admin 专用**：仅管理后台使用，iOS 不调用。

---

## 1. auth 模块

### POST /api/auth/login

**说明：**  
统一登录入口，支持手机号或邮箱（MVP 阶段不校验验证码，仅 mock）。

**是否需要登录：** 否  
**是否需要 token：** 否

**请求头：**  
`Content-Type: application/json`

**Query 参数：** 无

**请求体：**  
以下三种方式任选其一即可：

- 手机号登录：`{ "phone": "13800138000", "code": "123456" }`
- 邮箱登录：`{ "email": "user@example.com", "code": "123456" }`
- 短信验证码：`{ "phone": "13800138000", "smsCode": "123456" }`

| 字段     | 类型   | 必填 | 说明           |
|----------|--------|------|----------------|
| phone    | string | 否*  | 手机号         |
| email    | string | 否*  | 邮箱           |
| code     | string | 否   | 验证码（mock） |
| smsCode  | string | 否   | 短信验证码     |

\* phone 与 email 至少传一个。

**返回示例（成功）：**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**字段说明：**

- accessToken: 访问令牌，后续需登录的接口均带此 token。
- refreshToken: 刷新令牌，用于刷新 accessToken。
- expiresIn: accessToken 有效时间（秒），当前为 7 天。

**失败返回示例：**

- 未传 phone 且未传 email：HTTP 401，如 `{ "statusCode": 401, "message": "请提供 phone 或 email" }`。
- 账号被锁定（多次失败）：HTTP 429，如 `{ "message": "Account temporarily locked." }`。

**错误码说明：**  
401 未提供凭证；429 登录尝试过多被锁定。

**iOS 调用注意事项：**

- 登录成功后请持久化 `accessToken` 与 `refreshToken`（建议 Keychain），并在需要登录的接口头中统一带 `Authorization: Bearer <accessToken>`。
- `expiresIn` 可用于判断是否即将过期，并在适当时机调用刷新 token 接口。

---

### POST /api/auth/logout

**说明：**  
登出，服务端使当前用户的 refreshToken 失效。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求头：**  
`Authorization: Bearer <accessToken>`  
`Content-Type: application/json`

**Query 参数：** 无  
**请求体：** 无（或空对象）

**返回示例（成功）：**

```json
{
  "success": true
}
```

**失败返回示例：**  
未带 token 或 token 无效：HTTP 401。

**iOS 调用注意事项：**  
登出时除调用本接口外，建议本地清除已保存的 token。

---

### GET /api/auth/userinfo

**说明：**  
获取当前登录用户信息。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求头：**  
`Authorization: Bearer <accessToken>`

**Query 参数：** 无  
**请求体：** 无

**返回示例（成功）：**

```json
{
  "id": "clxx1234567890",
  "phone": "13800138000",
  "email": null,
  "country": "CN",
  "avatar": "https://cdn.isitsafe.com/avatar/default.png",
  "nickname": "Devin",
  "gender": "male",
  "birthday": "1995-03-12",
  "role": "USER",
  "lastLogin": "2025-03-06T08:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "subscriptionStatus": "active"
}
```

**字段说明：**

- id: 用户 ID。
- phone: 手机号，可能为 null。
- email: 邮箱，可能为 null。
- country: 国家/地区，可能为 null。
- avatar: 头像 CDN URL，可能为 null。
- nickname: 昵称，可能为 null。
- gender: 性别，male | female | unknown。
- birthday: 生日，YYYY-MM-DD，可能为 null。
- role: 角色，USER / ADMIN / SUPERADMIN。
- lastLogin: 最后登录时间，ISO 8601。
- createdAt: 注册时间，ISO 8601。
- subscriptionStatus: 订阅状态，如 active，可能为 null。

**失败返回示例：**  
token 无效或用户不存在：HTTP 401。

**iOS 调用注意事项：**  
用于个人中心等展示；role 在 iOS 端通常仅展示，不做权限控制。

---

### PUT /api/user/profile

**说明：**  
修改当前用户资料（头像 URL、昵称、性别、生日）。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求体：** JSON，字段均可选，只传需要修改的项。

```json
{
  "avatar": "https://cdn.isitsafe.com/avatar/xxx.png",
  "nickname": "Devin",
  "gender": "male",
  "birthday": "1995-03-12"
}
```

- avatar: 头像 CDN URL（由 POST /api/upload/avatar 返回）。
- nickname: 昵称。
- gender: male | female | unknown。
- birthday: YYYY-MM-DD。

**返回示例（成功）：** `{ "success": true }`

---

### POST /api/upload/avatar

**说明：**  
上传头像图片，Server 上传至 OSS 后返回 CDN URL。所有图片必须走 OSS + CDN，不允许本地存储。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求类型：** multipart/form-data  
**字段：** file（图片文件，JPEG/PNG，建议 ≤5MB）

**返回示例（成功）：**

```json
{
  "url": "https://cdn.isitsafe.com/avatar/abc123.png"
}
```

客户端随后应调用 PUT /api/user/profile 将返回的 url 写入用户 avatar 字段。

---

### POST /api/upload/file（统一上传）

**说明：**  
统一文件上传接口，根据 type 写入不同 OSS 目录。所有图片走 OSS + CDN，Server 不落盘。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求类型：** multipart/form-data  
**字段：**

- file: 图片文件（必填）
- type: 枚举（必填），见下表

| type       | OSS 目录      |
|-----------|----------------|
| avatar    | avatar/        |
| report    | reports/       |
| screenshot| screenshots/   |
| case      | cases/         |
| knowledge | knowledge/     |

**文件限制：** image/jpeg、image/png、image/webp；≤10MB。

**文件名规则：** `{userId}-{timestamp}.{ext}`

**返回示例（成功）：**

```json
{
  "url": "https://cdn.isitsafe.com/reports/usr_xxx-1709123456789.png"
}
```

供 iOS、Admin、AI 模块、举报系统等统一使用。

---

### POST /api/auth/refresh-token

**说明：**  
使用 refreshToken 换取新的 accessToken 与 refreshToken。

**是否需要登录：** 否（但需携带 refreshToken）  
**是否需要 token：** 否（在 body 中传 refreshToken）

**请求头：**  
`Content-Type: application/json`

**请求体：**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**返回示例（成功）：**  
与登录接口相同，返回新的 `accessToken`、`refreshToken`、`expiresIn`。

**失败返回示例：**  
refreshToken 无效或过期：HTTP 401，如 `{ "message": "Invalid refresh token" }`。

**iOS 调用注意事项：**  
当 accessToken 过期收到 401 时，可先调用本接口刷新，再重试原请求；若刷新也返回 401，则引导用户重新登录。

---

## 2. ai 模块

**iOS 会调用。**

### POST /api/ai/analyze

**说明：**  
用户提交文本进行 AI 风险分析（支持文本、电话、链接、公司等内容的语义分析）。

**是否需要登录：** 可选（登录后会记录 user_id，未登录也可使用）  
**是否需要 token：** 可选，建议登录后带 token 以便写入历史记录

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**Query 参数：** 无

**请求体：**

```json
{
  "content": "对方让我投资USDT，说稳赚不赔",
  "country": "CN",
  "language": "zh"
}
```

| 字段    | 类型   | 必填 | 说明                    |
|---------|--------|------|-------------------------|
| content | string | 是   | 待分析内容              |
| country | string | 否   | 国家/地区，如 CN        |
| language| string | 否   | 语言，zh / en，默认 zh  |

**返回示例（成功）：**

```json
{
  "risk_level": "high",
  "confidence": 92,
  "risk_type": ["投资骗局"],
  "summary": "该内容高度疑似虚假加密货币投资骗局",
  "reasons": [
    "承诺稳定高收益",
    "常见USDT投资诈骗模式"
  ],
  "advice": [
    "不要转账给陌生人",
    "不要参与所谓导师投资"
  ],
  "score": 88
}
```

**字段说明：**

- risk_level: 风险等级，high | medium | low | unknown。
- confidence: 置信度 0–100。
- risk_type: 风险类型数组，如诈骗、钓鱼网站、投资骗局等。
- summary: 一句话总结。
- reasons: 判断原因数组。
- advice: 建议数组。
- score: 综合风险得分（可选，服务端可能返回）。

**失败返回示例：**

- 参数错误（如 content 缺失）：HTTP 400，如 `{ "statusCode": 400, "message": ["content must be a string"] }`。
- 请求过于频繁：HTTP 429，如 `{ "message": "AI 分析请求过于频繁，请稍后再试" }`。
- AI 服务异常：HTTP 500 或业务错误格式（若后续统一）：`{ "code": 10001, "message": "AI analysis failed", "detail": "模型调用失败或返回格式不正确" }`。

**错误码说明：**  
400 参数校验失败；429 限流；500 服务端/AI 异常。

**iOS 调用注意事项：**

- 该接口有频率限制（如每分钟 20 次），429 时提示用户稍后重试。
- 未登录可调用，但不会关联到用户历史；登录后带 token 会写入历史并在「历史记录」中展示。

---

### POST /api/ai/analyze/screenshot

**说明：**  
截图/图片内容风险分析。当前服务端支持：客户端将截图做 OCR 后把文字通过 `content` 传入；或传 base64 图片（服务端 OCR 为预留，可能返回“暂不支持”提示）。

**是否需要登录：** 可选  
**是否需要 token：** 可选

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**请求体：**

```json
{
  "content": "截图中的文字内容，或图片 base64 字符串",
  "language": "zh",
  "isScreenshot": true
}
```

| 字段        | 类型    | 必填 | 说明                          |
|-------------|---------|------|-------------------------------|
| content     | string  | 是   | OCR 后的文字，或图片 base64  |
| language    | string  | 否   | zh / en，默认 zh              |
| isScreenshot| boolean | 否   | 是否按截图场景处理            |

**返回示例（成功）：**  
与 `POST /api/ai/analyze` 相同，为统一风险分析结果结构（risk_level、confidence、risk_type、summary、reasons、advice 等）。

**返回示例（服务端暂不支持 OCR 时）：**  
仍为 200，但内容为兜底提示，例如：

```json
{
  "risk_level": "unknown",
  "confidence": 0,
  "risk_type": ["未知风险"],
  "summary": "暂不支持截图识别，请上传文字或使用客户端 OCR 后传文本",
  "reasons": ["服务端 OCR 未启用"],
  "advice": ["请手动输入截图中的文字进行分析"]
}
```

**失败返回示例：**  
同 `POST /api/ai/analyze`（400/429/500 等）。

**iOS 调用注意事项：**  
建议客户端先做 OCR，将识别出的文字通过 `content` 传入，可得到稳定分析结果；若传 base64，需兼容服务端返回“暂不支持”的文案展示。

---

## 3. query 模块

**iOS 会调用。**

用于按类型（电话/网址/公司）查询风险库，返回风险等级与匹配记录，不经过 AI。

### POST /api/query/phone

**说明：**  
根据电话号码或号码片段查询风险库。

**是否需要登录：** 可选  
**是否需要 token：** 可选

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**请求体：**

```json
{
  "content": "13800138000"
}
```

| 字段    | 类型   | 必填 | 说明     |
|---------|--------|------|----------|
| content | string | 是   | 电话号码或片段 |

**返回示例（成功）：**

```json
{
  "risk_level": "high",
  "tags": ["诈骗", "假客服"],
  "records": [
    {
      "id": "clxx",
      "type": "phone",
      "content": "+86 13800138000",
      "riskLevel": "high",
      "riskCategory": "诈骗",
      "tags": ["诈骗", "假客服"],
      "source": "seed",
      "evidence": "用户举报多次",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**字段说明：**

- risk_level: 命中时的最高风险等级，未命中时为 low。
- tags: 所有命中记录的标签聚合。
- records: 命中的 risk_data 列表。

**失败返回示例：**  
参数错误时 HTTP 400。

**iOS 调用注意事项：**  
仅做风险库匹配，不做 AI 分析；可与 AI 分析配合使用（例如先查库再决定是否调 AI）。

---

### POST /api/query/url

**说明：**  
根据 URL 或域名查询风险库。

**是否需要登录：** 可选  
**是否需要 token：** 可选

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**请求体：**

```json
{
  "content": "https://fake-bank-login.com"
}
```

| 字段    | 类型   | 必填 | 说明        |
|---------|--------|------|-------------|
| content | string | 是   | URL 或域名  |

**返回示例（成功）：**  
结构与 `POST /api/query/phone` 一致（risk_level、tags、records）。

**失败返回示例：**  
参数错误时 HTTP 400。

**iOS 调用注意事项：**  
同 phone，仅风险库查询。

---

### POST /api/query/company

**说明：**  
根据公司/平台名称查询风险库。

**是否需要登录：** 可选  
**是否需要 token：** 可选

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**请求体：**

```json
{
  "content": "某某高收益理财平台"
}
```

| 字段    | 类型   | 必填 | 说明           |
|---------|--------|------|----------------|
| content | string | 是   | 公司/平台名称  |

**返回示例（成功）：**  
结构与 `POST /api/query/phone` 一致（risk_level、tags、records）。

**失败返回示例：**  
参数错误时 HTTP 400。

**iOS 调用注意事项：**  
同 phone、url，仅风险库查询。

---

### GET /api/query/tags

**说明：**  
获取风险库中所有标签列表（用于筛选或联想）。

**是否需要登录：** 否  
**是否需要 token：** 否

**请求头：** 无特殊要求

**Query 参数：** 无

**返回示例（成功）：**

```json
["诈骗", "假客服", "钓鱼", "投资骗局", "兼职骗局"]
```

**失败返回示例：**  
一般无业务错误；网络或 500 按通用错误处理。

**iOS 调用注意事项：**  
数组为字符串列表，可直接用于 UI 展示或筛选。

---

## 4. knowledge 模块

**iOS 会调用。**

### GET /api/knowledge

**说明：**  
分页获取知识库案例列表，支持按分类、关键词筛选。

**是否需要登录：** 否  
**是否需要 token：** 否

**请求头：** 无特殊要求

**Query 参数：**

| 参数     | 类型   | 必填 | 说明           |
|----------|--------|------|----------------|
| category | string | 否   | 分类筛选       |
| page     | number | 否   | 页码，默认 1   |
| pageSize | number | 否   | 每页条数，默认 20 |
| search   | string | 否   | 关键词（标题/内容） |
| language | string | 否   | 语言，默认 zh  |

**请求体：** 无

**返回示例（成功）：**

```json
{
  "items": [
    {
      "id": "clxx",
      "title": "假冒银行短信钓鱼案例",
      "category": "钓鱼网站",
      "content": "用户收到冒充银行的短信...",
      "tags": ["钓鱼", "银行", "短信"],
      "language": "zh",
      "source": "seed",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

**字段说明：**

- items: 当前页知识案例列表。
- total: 符合条件的总条数。
- page: 当前页码。
- pageSize: 每页条数。

**失败返回示例：**  
一般无业务错误；无效参数可能返回 400。

**iOS 调用注意事项：**  
分页使用 `page` 与 `pageSize`；`total` 可用于计算总页数或展示“共 N 条”；列表为空时 `items` 为空数组。

---

### GET /api/knowledge/:id

**说明：**  
根据 ID 获取单条知识案例详情。

**是否需要登录：** 否  
**是否需要 token：** 否

**请求头：** 无特殊要求

**Query 参数：** 无  
**路径参数：** id — 知识案例 ID

**返回示例（成功）：**

```json
{
  "id": "clxx",
  "title": "假冒银行短信钓鱼案例",
  "category": "钓鱼网站",
  "content": "用户收到冒充银行的短信，内含链接诱导输入银行卡号与密码...",
  "tags": ["钓鱼", "银行", "短信", "仿冒"],
  "language": "zh",
  "source": "seed",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**失败返回示例：**  
ID 不存在：HTTP 404（如 Prisma findUniqueOrThrow 抛出的 P2025）。

**iOS 调用注意事项：**  
详情页直接解析上述字段展示即可。

---

## 5. report 模块

**iOS 会调用。**

### POST /api/report

**说明：**  
用户提交举报（链接、电话、文本、截图等）。

**是否需要登录：** 可选（未登录可提交，但不关联用户）  
**是否需要 token：** 可选，建议登录后带 token

**请求头：**  
`Authorization: Bearer <token>`（可选）  
`Content-Type: application/json`

**Query 参数：** 无

**请求体：**

```json
{
  "type": "url",
  "content": "https://example.com/fake-page",
  "relatedQueryId": "clxx_query_id_optional"
}
```

| 字段           | 类型   | 必填 | 说明                          |
|----------------|--------|------|-------------------------------|
| type           | string | 是   | 类型：text / phone / url / screenshot |
| content        | string | 是   | 举报内容描述或原文            |
| relatedQueryId | string | 否   | 关联的查询 ID（若来自某次分析） |

**返回示例（成功）：**  
返回创建的举报记录（服务端返回 Prisma 创建的 report 对象，字段为 camelCase），例如：

```json
{
  "id": "clxx",
  "userId": "clxx_user_id",
  "type": "url",
  "content": "https://example.com/fake-page",
  "status": "PENDING",
  "relatedQueryId": "clxx_query_id_optional",
  "handledBy": null,
  "handledAt": null,
  "createdAt": "2025-03-06T08:00:00.000Z"
}
```

**失败返回示例：**  
参数错误（如 type、content 缺失）：HTTP 400。

**iOS 调用注意事项：**  
提交成功后可根据 `id` 或 `status` 做简单反馈；`status` 初始为 PENDING，后续由管理端处理。

---

## 6. subscription 模块

**iOS 会调用。**

### POST /api/subscription/verify

**说明：**  
验证应用内购买收据并更新或创建订阅状态（当前为 mock 逻辑，真实环境需对接 Apple/Google 验证）。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求头：**  
`Authorization: Bearer <accessToken>`  
`Content-Type: application/json`

**请求体：**

```json
{
  "productId": "com.isitsafe.week",
  "receipt": "base64_encoded_receipt_data",
  "paymentMethod": "Apple"
}
```

| 字段          | 类型   | 必填 | 说明                    |
|---------------|--------|------|-------------------------|
| productId     | string | 是   | 商品 ID                 |
| receipt       | string | 是   | 收据数据（如 base64）   |
| paymentMethod| string | 否   | Apple / Google，默认 Apple |

**返回示例（成功）：**

```json
{
  "success": true,
  "subscription": {
    "id": "clxx",
    "userId": "clxx",
    "productId": "com.isitsafe.week",
    "status": "active",
    "expireTime": "2025-03-13T08:00:00.000Z",
    "historyLog": [],
    "paymentMethod": "Apple",
    "createdAt": "2025-03-06T08:00:00.000Z",
    "updatedAt": "2025-03-06T08:00:00.000Z"
  }
}
```

**失败返回示例：**  
未登录或 token 无效：HTTP 401。

**错误码说明：**  
若后续增加业务错误，可能返回如 10003 订阅验证失败。

**iOS 调用注意事项：**  
购买完成后将 Apple 返回的收据与 productId 传入；服务端当前按 productId 含 "week" 等做简单过期时间 mock。

---

### GET /api/subscription/status

**说明：**  
获取当前用户的订阅状态。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求头：**  
`Authorization: Bearer <accessToken>`

**Query 参数：** 无  
**请求体：** 无

**返回示例（成功）：**

```json
{
  "active": true,
  "expireTime": "2025-03-13T08:00:00.000Z",
  "productId": "com.isitsafe.week",
  "status": "active"
}
```

**无订阅时：**

```json
{
  "active": false,
  "expireTime": null,
  "productId": null,
  "status": null
}
```

**失败返回示例：**  
未登录：HTTP 401。

**iOS 调用注意事项：**  
用于会员/订阅页展示；`active` 为 true 表示当前在有效期内。

---

### POST /api/subscription/refresh

**说明：**  
刷新订阅状态（如检查是否过期并更新 status）。

**是否需要登录：** 是  
**是否需要 token：** 是

**请求头：**  
`Authorization: Bearer <accessToken>`

**Query 参数：** 无  
**请求体：** 无（或空对象）

**返回示例（成功）：**  
与 `GET /api/subscription/status` 结构相同（active、expireTime、productId、status）。

**失败返回示例：**  
未登录：HTTP 401。

**iOS 调用注意事项：**  
可在进入订阅页或恢复购买后调用一次，以同步最新状态。

---

## 7. queries / history 模块

**iOS 会调用。**

### GET /api/queries

**说明：**  
分页获取查询/分析历史。未登录时 `where` 无 userId，返回空列表或全部（以服务端实现为准）；登录后仅返回当前用户的历史。

**是否需要登录：** 可选（登录后只返回该用户历史，未登录可能返回空列表）  
**是否需要 token：** 可选，建议登录后带 token 以看到自己的历史

**请求头：**  
`Authorization: Bearer <token>`（可选）

**Query 参数：**

| 参数      | 类型   | 必填 | 说明           |
|-----------|--------|------|----------------|
| page      | number | 否   | 页码，默认 1   |
| pageSize  | number | 否   | 每页条数，默认 20 |
| riskLevel | string | 否   | 按风险等级筛选 |

**请求体：** 无

**返回示例（成功）：**

```json
{
  "items": [
    {
      "id": "clxx",
      "userId": "clxx",
      "inputType": "text",
      "content": "对方让我投资USDT",
      "resultJson": {
        "risk_level": "high",
        "confidence": 92,
        "risk_type": ["投资骗局"],
        "summary": "该内容高度疑似虚假投资骗局",
        "reasons": ["原因1"],
        "advice": ["建议1"]
      },
      "riskLevel": "high",
      "confidence": 92,
      "aiProvider": "doubao",
      "createdAt": "2025-03-06T08:00:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

**字段说明：**

- items: 历史记录列表，每条为一次分析/查询。
- resultJson: 当次分析的完整结果（与 AI 分析返回结构一致）。
- inputType: text | phone | url | company | screenshot。
- total、page、pageSize: 分页信息。

**失败返回示例：**  
无特殊业务错误；401 表示未登录（若接口要求登录）。

**iOS 调用注意事项：**  
历史页建议登录后使用；未登录时可能为空列表。分页与 knowledge 一致，用 `page`、`pageSize`、`total`。

---

## 8. health（通用）

**iOS 可调用（如启动时检测服务可用性）。**

### GET /api/health

**说明：**  
健康检查，用于判断服务是否可用。

**是否需要登录：** 否  
**是否需要 token：** 否

**请求头：** 无特殊要求

**Query 参数：** 无  
**请求体：** 无

**返回示例（成功）：**

```json
{
  "status": "ok"
}
```

**失败返回示例：**  
服务不可用时可能无响应或 5xx。

**iOS 调用注意事项：**  
可用于启动时或设置页“检查更新/连接”等轻量探测。

---

## 9. admin 模块（Admin 专用，iOS 不调用）

以下接口仅管理后台使用，需使用 **role 为 ADMIN 或 SUPERADMIN** 的用户登录后携带 token 访问。iOS 客户端**不要**调用这些接口。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/admin/users | 用户列表 |
| PUT  | /api/admin/users/:id/status | 更新用户状态 |
| GET  | /api/admin/queries | 查询记录列表 |
| GET  | /api/admin/queries/:id | 单条查询详情 |
| GET  | /api/admin/reports | 举报列表 |
| PUT  | /api/admin/reports/:id/status | 更新举报状态 |
| GET  | /api/admin/reports/stats | 举报统计 |
| GET  | /api/admin/knowledge | 知识库列表 |
| POST | /api/admin/knowledge/upload | 上传/新增知识 |
| PUT  | /api/admin/knowledge/:id | 更新知识 |
| DELETE | /api/admin/knowledge/:id | 删除知识 |
| GET  | /api/admin/ai/stats | AI 调用统计 |
| GET  | /api/admin/ai/logs | AI 调用日志 |
| GET  | /api/admin/settings | 获取设置（脱敏） |
| PUT  | /api/admin/settings | 更新设置（仅 SUPERADMIN） |
| GET  | /api/admin/subscription/logs | 订阅日志 |

以上 admin 接口的请求头均需：`Authorization: Bearer <admin_access_token>`，且 token 对应用户的 role 必须为 ADMIN 或 SUPERADMIN。

---

**文档版本与代码对应：** 本文档与当前 server 实现一致；若服务端后续增加统一错误体（如 code、message、detail），以实际返回为准，iOS 可做兼容解析。
