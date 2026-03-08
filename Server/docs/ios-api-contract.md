# iOS API 接入契约

本文档按页面整理 **iOS 会实际调用的接口**，便于客户端的请求参数、返回模型、调用时机与失败处理统一约定。**Admin 管理端接口不在此列。**

**正式环境 Base URL：** `https://api.starlensai.com`（所有接口路径以 `/api` 开头，如 `/api/auth/login`）。

---

## Home 页面

**使用接口：**

- POST /api/ai/analyze
- POST /api/ai/analyze/screenshot
- POST /api/query/phone
- POST /api/query/url
- POST /api/query/company

**调用时机：**

- 用户输入一段文字后点击「分析」→ 调用 `POST /api/ai/analyze`。
- 用户上传截图/图片并请求分析 → 调用 `POST /api/ai/analyze/screenshot`（建议客户端先 OCR，将文字通过 `content` 传入）。
- 用户仅查电话/网址/公司是否在风险库 → 分别调用 `POST /api/query/phone`、`/api/query/url`、`/api/query/company`。

**请求参数：**

- **analyze**：`content`（必填）、`country`（可选）、`language`（可选，默认 zh）。
- **analyze/screenshot**：`content`（必填，OCR 文本或 base64 图片）、`language`（可选）、`isScreenshot`（可选）。
- **query/phone | url | company**：`content`（必填，电话号码/URL/公司名）。

**返回模型：**

- AI 分析：`RiskAnalysisResult`（含 risk_level、confidence、risk_type、summary、reasons、advice、score 等）。
- 风险库查询：`QueryRiskResponse`（risk_level、tags、records）。

**是否需要 token：**

- 否（可选）。未登录可正常使用；登录后建议带 token，便于写入历史记录并在「历史」中展示。

**失败处理：**

- 网络失败：提示「网络异常，请稍后重试」。
- 400 参数错误：提示「输入内容有误，请检查后再试」。
- 429 请求过于频繁：提示「操作过于频繁，请稍后再试」。
- 500 / AI 异常：提示「分析失败，请稍后重试」；可重试 1 次，勿无限重试。

---

## History 页面

**使用接口：**

- GET /api/queries

**调用时机：**

- 进入历史记录页时拉取第一页；上拉加载更多时递增 `page`。

**请求参数：**

- `page`：页码，从 1 开始。
- `pageSize`：每页条数，建议 20。
- `riskLevel`：可选，按风险等级筛选（high/medium/low）。

**返回模型：**

- `QueryHistoryListResponse`（items、total、page、pageSize）。
- 每条 item 对应 `QueryHistoryItem`（含 id、content、inputType、resultJson、riskLevel、confidence、createdAt 等）。

**是否需要 token：**

- 建议带 token。未登录时服务端可能只返回空列表或不做用户过滤；登录后仅返回当前用户历史。

**失败处理：**

- 网络失败：提示「加载失败，请稍后重试」，支持下拉刷新重试。
- 401：可引导登录或仅展示空状态「登录后查看历史记录」。

---

## Report 页面

**使用接口：**

- POST /api/report

**调用时机：**

- 用户填写举报类型、内容后点击「提交」。

**请求参数：**

- `type`：必填，text | phone | url | screenshot。
- `content`：必填，举报内容描述或原文。
- `relatedQueryId`：可选，若本次举报来自某次分析，可传该分析的 query id。

**返回模型：**

- `ReportSubmitResponse`：服务端返回创建的举报记录（id、userId、type、content、status、createdAt 等）。

**是否需要 token：**

- 可选。未登录可提交；登录后带 token 可关联到用户。

**失败处理：**

- 网络失败：提示「提交失败，请检查网络后重试」。
- 400：提示「请完善举报类型和内容」。
- 提交成功：提示「举报已提交，我们会尽快处理」。

---

## Knowledge 页面

**使用接口：**

- GET /api/knowledge
- GET /api/knowledge/:id

**调用时机：**

- 列表页进入时拉取第一页；上拉加载更多时递增 `page`；可按 `category`、`search` 筛选。
- 点击某条案例进入详情时调用 `GET /api/knowledge/:id`。

**请求参数：**

- **列表**：`page`、`pageSize`、`category`（可选）、`search`（可选）、`language`（可选，默认 zh）。
- **详情**：路径参数 `id`。

**返回模型：**

- 列表：`KnowledgeListResponse`（items、total、page、pageSize）；单条为 `KnowledgeItem`。
- 详情：`KnowledgeItem`（id、title、category、content、tags、language、source、createdAt、updatedAt）。

**是否需要 token：**

- 否。知识库接口均不需要登录。

**失败处理：**

- 网络失败：提示「加载失败，请稍后重试」，支持重试或下拉刷新。
- 404（详情）：提示「该内容不存在或已下架」。
- 列表为空：展示「暂无案例」等空状态。

---

## Profile 页面

**使用接口：**

- GET /api/auth/userinfo
- POST /api/auth/logout
- POST /api/auth/refresh-token（通常在 token 过期时由网络层自动调用）
- GET /api/subscription/status
- POST /api/subscription/verify（内购完成后）
- POST /api/subscription/refresh（可选，用于刷新订阅状态）

**调用时机：**

- 进入个人中心：调用 `GET /api/auth/userinfo` 展示头像、昵称、手机/邮箱等；调用 `GET /api/subscription/status` 展示会员状态。
- 用户点击登出：调用 `POST /api/auth/logout`，成功后清除本地 token 并跳转登录/首页。
- 内购完成：将收据与 productId 提交到 `POST /api/subscription/verify`。
- 需要刷新订阅状态时：调用 `POST /api/subscription/refresh` 或再次 `GET /api/subscription/status`。

**请求参数：**

- **userinfo**：无，依赖 token。
- **logout**：无，依赖 token。
- **refresh-token**：body 传 `refreshToken`。
- **subscription/status**：无，依赖 token。
- **subscription/verify**：`productId`、`receipt`、`paymentMethod`（可选，默认 Apple）。

**返回模型：**

- 用户信息：`UserInfoResponse`（id、phone、email、country、role、lastLogin、createdAt）。
- 登出：`{ "success": true }`。
- 刷新 token：与登录一致，`accessToken`、`refreshToken`、`expiresIn`。
- 订阅状态：`SubscriptionStatusResponse`（active、expireTime、productId、status）。

**是否需要 token：**

- userinfo、logout、subscription/* 均需要 token（用户已登录）。
- refresh-token 不需要在 Header 带 accessToken，但在 body 中需要有效的 refreshToken。

**失败处理：**

- 401（userinfo / subscription）：视为登录失效，清除 token 并跳转登录；可先尝试 refresh-token 再重试一次。
- 网络失败：提示「加载失败，请稍后重试」。
- 订阅验证失败：若服务端返回 10003 等，提示「订阅验证失败，请稍后重试或联系客服」。

---

## 登录 / 注册流程（独立于 Profile）

**使用接口：**

- POST /api/auth/login
- POST /api/auth/refresh-token

**调用时机：**

- 用户输入手机号/邮箱及验证码后点击登录 → `POST /api/auth/login`。
- accessToken 过期且 refreshToken 仍有效时，由网络层自动调用 `POST /api/auth/refresh-token`，再重试原请求。

**请求参数：**

- **login**：`phone` + `code`，或 `email` + `code`，或 `phone` + `smsCode`（三选一组合）。MVP 阶段验证码写死为 **`123456`**，仅该码可通过校验。
- **refresh-token**：`refreshToken`。

**返回模型：**

- 登录/刷新成功：`LoginResponse`（accessToken、refreshToken、expiresIn）。

**是否需要 token：**

- 否。

**失败处理：**

- 401：提示「手机号/邮箱或验证码错误」或「登录已失效，请重新登录」。
- 429：提示「尝试次数过多，请稍后再试」。
- 网络失败：提示「网络异常，请稍后重试」。

---

## iOS 接入建议

### 1. Base URL 如何配置

- **开发环境（模拟器）：**  
  `http://localhost:3000`

- **真机调试：**  
  使用本机局域网 IP，例如：`http://192.168.1.100:3000`（将 `192.168.1.100` 替换为你的电脑在局域网中的 IP）。确保手机与电脑在同一 WiFi 下。

- **生产环境：**  
  **`https://api.starlensai.com`**（正式域名，接口前缀为 `/api`，完整示例：`https://api.starlensai.com/api/auth/login`）。请确保 App 中生产环境 baseURL 配置为该域名（不含末尾 `/api`），并已配置 SSL。

建议在工程内用 Build Configuration 或环境变量区分 Debug / Release，对应不同 Base URL，避免把开发地址带到生产。

### 2. Token 如何存储

- **建议使用 Keychain** 存储 accessToken 和 refreshToken，避免被越狱或备份导出。
- 登录或刷新 token 成功后，将 `accessToken`、`refreshToken` 写入 Keychain；登出或收到 401 且刷新失败时清除。
- 需要登录的接口在请求头中统一添加：`Authorization: Bearer <accessToken>`。
- 可在 App 启动或进入前台时检查 token 是否存在，决定是否展示登录页或自动带 token 请求。

### 3. 请求头如何统一封装

- 所有请求建议统一设置：  
  `Content-Type: application/json`
- 若当前已登录（Keychain 中有 accessToken），则统一追加：  
  `Authorization: Bearer <accessToken>`
- 若接口明确不需要 token（如登录、健康检查、知识库列表），可不带 Authorization；可选登录的接口（如 AI 分析、举报、历史）建议有 token 就带，以关联用户数据。

### 4. 分页接口如何处理

- 分页参数统一使用：  
  - `page`：从 1 开始。  
  - `pageSize`：每页条数，建议 20。
- 服务端返回的 `total` 表示符合条件的总条数，可用于计算总页数或展示「共 N 条」。
- 列表为空时：`items` 为空数组 `[]`，`total` 为 0；建议 UI 展示「暂无数据」等空状态，而不是错误提示。
- 上拉加载更多：当 `items.count < total` 时，可请求 `page + 1`；当已无更多数据时不再请求。

### 5. 失败重试建议

- **GET 接口**（如知识库列表、历史列表、用户信息、订阅状态）：可重试 1～2 次，间隔 1～2 秒。
- **POST /api/ai/analyze**：建议仅重试 1 次；避免因 AI 或网络问题导致多次计费或限流。
- **429 请求过于频繁**：不要立即重试；提示用户「操作过于频繁，请稍后再试」，并延迟一段时间（如 60 秒）后再允许操作。
- 登录、支付、举报等敏感操作：按业务决定是否重试，一般提示失败后由用户主动重试即可。

### 6. 未登录和已登录的调用差异

- **未登录也可调用的接口（无需 token）：**  
  - POST /api/auth/login  
  - POST /api/auth/refresh-token  
  - GET /api/health  
  - GET /api/knowledge、GET /api/knowledge/:id  
  - GET /api/query/tags  
  - POST /api/ai/analyze、POST /api/ai/analyze/screenshot（可选带 token）  
  - POST /api/query/phone、url、company（可选带 token）  
  - POST /api/report（可选带 token）  
  - GET /api/queries（未登录时可能返回空列表或不做用户过滤）

- **必须登录才能调用的接口（需 token）：**  
  - GET /api/auth/userinfo  
  - POST /api/auth/logout  
  - GET /api/subscription/status  
  - POST /api/subscription/verify  
  - POST /api/subscription/refresh  

- **登录后的行为差异：**  
  - AI 分析、举报、历史记录会与当前用户关联（写入 userId）。  
  - 历史记录仅展示当前用户的数据。  
  - 可正常使用订阅相关接口。

以上约定与当前 server 实现一致，可直接作为 iOS 端接口契约使用。
