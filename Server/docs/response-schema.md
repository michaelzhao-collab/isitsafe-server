# 返回模型 Schema（iOS / Swift Codable 参考）

本文档整理 iOS 会用到的主要返回结构，便于 Swift 侧定义 Codable 模型。字段名与类型以当前 server 实际返回为准（Prisma 默认返回 camelCase）。

---

## 1. RiskAnalysisResult

AI 分析接口（POST /api/ai/analyze、POST /api/ai/analyze/screenshot）的返回体。

**JSON 示例：**

```json
{
  "risk_level": "high",
  "confidence": 92,
  "risk_type": ["投资骗局"],
  "summary": "该内容高度疑似虚假投资骗局",
  "reasons": ["原因1", "原因2"],
  "advice": ["建议1", "建议2"],
  "score": 88
}
```

**字段说明：**

| 字段        | 类型     | 说明                          |
|-------------|----------|-------------------------------|
| risk_level  | String   | 风险等级：high/medium/low/unknown |
| confidence  | Int      | 置信度 0–100                 |
| risk_type   | [String] | 风险类型数组                  |
| summary     | String   | 一句话总结                    |
| reasons     | [String] | 判断原因数组                  |
| advice      | [String] | 建议数组                      |
| score       | Int?     | 综合风险得分，可选            |

**Swift 命名建议：**

```swift
struct RiskAnalysisResult: Codable {
    let riskLevel: String
    let confidence: Int
    let riskType: [String]
    let summary: String
    let reasons: [String]
    let advice: [String]
    let score: Int?
    
    enum CodingKeys: String, CodingKey {
        case riskLevel = "risk_level"
        case confidence
        case riskType = "risk_type"
        case summary, reasons, advice, score
    }
}
```

（若服务端统一改为 camelCase 则无需 CodingKeys。）

---

## 2. UserInfoResponse

GET /api/auth/userinfo 的返回体。

**JSON 示例：**

```json
{
  "id": "clxx1234567890",
  "phone": "13800138000",
  "email": null,
  "country": "CN",
  "role": "USER",
  "lastLogin": "2025-03-06T08:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**字段说明：**

| 字段      | 类型    | 说明                    |
|-----------|---------|-------------------------|
| id        | String  | 用户 ID                 |
| phone     | String? | 手机号                  |
| email     | String? | 邮箱                    |
| country   | String? | 国家/地区               |
| role      | String  | USER / ADMIN / SUPERADMIN |
| lastLogin | String? | 最后登录时间，ISO 8601   |
| createdAt | String  | 注册时间，ISO 8601       |

**Swift 命名建议：**

```swift
struct UserInfoResponse: Codable {
    let id: String
    let phone: String?
    let email: String?
    let country: String?
    let role: String
    let lastLogin: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, phone, email, country, role, createdAt
        case lastLogin = "last_login"
    }
}
```

---

## 3. QueryHistoryItem

GET /api/queries 返回列表中单条记录的结构。

**JSON 示例：**

```json
{
  "id": "clxx",
  "userId": "clxx_user",
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
```

**字段说明：**

| 字段       | 类型           | 说明                    |
|------------|----------------|-------------------------|
| id         | String         | 记录 ID                 |
| userId     | String?        | 用户 ID                 |
| inputType  | String         | text/phone/url/company/screenshot |
| content    | String         | 当次输入内容            |
| resultJson | [String: Any]? 或 RiskAnalysisResult? | 当次分析结果，可解析为 RiskAnalysisResult |
| riskLevel  | String?       | 风险等级                |
| confidence | Int?          | 置信度                  |
| aiProvider | String?       | 使用的 AI 提供商        |
| createdAt  | String        | 创建时间，ISO 8601      |

**Swift 命名建议：**

```swift
struct QueryHistoryItem: Codable {
    let id: String
    let userId: String?
    let inputType: String
    let content: String
    let resultJson: RiskAnalysisResult?  // 或使用 JSON 泛型解析
    let riskLevel: String?
    let confidence: Int?
    let aiProvider: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, userId, content, createdAt
        case inputType = "input_type"
        case resultJson = "result_json"
        case riskLevel = "risk_level"
        case aiProvider = "ai_provider"
        case confidence
    }
}
```

---

## 4. QueryHistoryListResponse

GET /api/queries 的完整返回体。

**JSON 示例：**

```json
{
  "items": [],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

**字段说明：**

| 字段     | 类型                | 说明         |
|----------|---------------------|--------------|
| items    | [QueryHistoryItem]  | 当前页列表   |
| total    | Int                 | 总条数       |
| page     | Int                 | 当前页码     |
| pageSize | Int                 | 每页条数     |

**Swift 命名建议：**

```swift
struct QueryHistoryListResponse: Codable {
    let items: [QueryHistoryItem]
    let total: Int
    let page: Int
    let pageSize: Int
    
    enum CodingKeys: String, CodingKey {
        case items, total, page
        case pageSize = "pageSize"
    }
}
```

---

## 5. KnowledgeItem

知识库单条案例，用于 GET /api/knowledge 的 items 元素和 GET /api/knowledge/:id。

**JSON 示例：**

```json
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
```

**字段说明：**

| 字段      | 类型     | 说明           |
|-----------|----------|----------------|
| id        | String   | 案例 ID        |
| title     | String   | 标题           |
| category  | String   | 分类           |
| content   | String   | 正文           |
| tags      | [String] | 标签数组       |
| language  | String   | 语言           |
| source    | String?  | 来源           |
| createdAt | String   | 创建时间       |
| updatedAt | String   | 更新时间       |

**Swift 命名建议：**

```swift
struct KnowledgeItem: Codable {
    let id: String
    let title: String
    let category: String
    let content: String
    let tags: [String]
    let language: String
    let source: String?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, category, content, tags, language, source
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
```

（若服务端返回 camelCase 则用 createdAt/updatedAt 无需 map。）

---

## 6. KnowledgeListResponse

GET /api/knowledge 的完整返回体。

**JSON 示例：**

```json
{
  "items": [],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

**字段说明：**

| 字段     | 类型             | 说明         |
|----------|------------------|--------------|
| items    | [KnowledgeItem]  | 当前页列表   |
| total    | Int              | 总条数       |
| page     | Int              | 当前页码     |
| pageSize | Int              | 每页条数     |

**Swift 命名建议：**

```swift
struct KnowledgeListResponse: Codable {
    let items: [KnowledgeItem]
    let total: Int
    let page: Int
    let pageSize: Int
}
```

---

## 7. ReportSubmitResponse

POST /api/report 创建举报后的返回体（即单条举报记录）。

**JSON 示例：**

```json
{
  "id": "clxx",
  "userId": "clxx_user_id",
  "type": "url",
  "content": "https://example.com/fake-page",
  "status": "PENDING",
  "relatedQueryId": null,
  "handledBy": null,
  "handledAt": null,
  "createdAt": "2025-03-06T08:00:00.000Z"
}
```

**字段说明：**

| 字段           | 类型    | 说明              |
|----------------|---------|-------------------|
| id             | String  | 举报 ID           |
| userId         | String? | 用户 ID           |
| type           | String  | text/phone/url/screenshot |
| content        | String  | 举报内容          |
| status         | String  | PENDING/HANDLED/REJECTED |
| relatedQueryId | String? | 关联的查询 ID     |
| handledBy      | String? | 处理人            |
| handledAt      | String? | 处理时间          |
| createdAt      | String  | 创建时间          |

**Swift 命名建议：**

```swift
struct ReportSubmitResponse: Codable {
    let id: String
    let userId: String?
    let type: String
    let content: String
    let status: String
    let relatedQueryId: String?
    let handledBy: String?
    let handledAt: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, userId, type, content, status, createdAt
        case relatedQueryId = "related_query_id"
        case handledBy = "handled_by"
        case handledAt = "handled_at"
    }
}
```

（以服务端实际返回的 key 为准，若为 camelCase 则无需部分 CodingKeys。）

---

## 8. SubscriptionStatusResponse

GET /api/subscription/status 或 POST /api/subscription/refresh 的返回体。

**JSON 示例（有订阅）：**

```json
{
  "active": true,
  "expireTime": "2025-03-13T08:00:00.000Z",
  "productId": "com.isitsafe.week",
  "status": "active"
}
```

**JSON 示例（无订阅）：**

```json
{
  "active": false,
  "expireTime": null,
  "productId": null,
  "status": null
}
```

**字段说明：**

| 字段       | 类型    | 说明                |
|------------|---------|---------------------|
| active     | Bool    | 是否在有效期内      |
| expireTime | String? | 过期时间，ISO 8601   |
| productId  | String? | 商品 ID             |
| status     | String? | active/expired/cancelled 等 |

**Swift 命名建议：**

```swift
struct SubscriptionStatusResponse: Codable {
    let active: Bool
    let expireTime: String?
    let productId: String?
    let status: String?
    
    enum CodingKeys: String, CodingKey {
        case active, status
        case expireTime = "expire_time"
        case productId = "product_id"
    }
}
```

---

## 9. BaseErrorResponse

建议与后端约定统一的错误体格式；当前 Nest 默认可能仅返回 statusCode、message、error，若后续统一为 code/message/detail，可按下面结构解析。

**JSON 示例：**

```json
{
  "code": 10001,
  "message": "AI analysis failed",
  "detail": "模型调用失败或返回格式不正确"
}
```

**字段说明：**

| 字段    | 类型   | 说明           |
|---------|--------|----------------|
| code    | Int    | 业务错误码     |
| message | String | 简短错误信息   |
| detail  | String?| 详细说明，可选  |

**Swift 命名建议：**

```swift
struct BaseErrorResponse: Codable {
    let code: Int
    let message: String
    let detail: String?
}
```

同时可兼容 HTTP 标准错误格式（如 statusCode、message），在解析时先判断是否存在 `code` 再当作 BaseErrorResponse 处理。

---

## 10. BaseSuccessResponse

通用成功包装（如登出、部分简单接口）。

**JSON 示例：**

```json
{
  "success": true
}
```

**字段说明：**

| 字段    | 类型 | 说明     |
|---------|------|----------|
| success | Bool | 是否成功 |

**Swift 命名建议：**

```swift
struct BaseSuccessResponse: Codable {
    let success: Bool
}
```

---

## 附：登录与刷新 Token 返回

**POST /api/auth/login、POST /api/auth/refresh-token 成功返回：**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**Swift 命名建议：**

```swift
struct LoginResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}
```

---

## 附：风险库查询返回（Query / phone | url | company）

**POST /api/query/phone、url、company 返回：**

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

**Swift 命名建议：**

```swift
struct QueryRiskResponse: Codable {
    let riskLevel: String
    let tags: [String]
    let records: [RiskDataRecord]
    
    enum CodingKeys: String, CodingKey {
        case riskLevel = "risk_level"
        case tags, records
    }
}

struct RiskDataRecord: Codable {
    let id: String
    let type: String
    let content: String
    let riskLevel: String
    let riskCategory: String?
    let tags: [String]
    let source: String?
    let evidence: String?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, type, content, tags, source, evidence
        case riskLevel = "risk_level"
        case riskCategory = "risk_category"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
```

以上所有模型均以当前 server 实际返回为准；若服务端对 key 使用 snake_case，Swift 侧用 CodingKeys 映射即可。
