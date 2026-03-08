# iOS UI 调整规则

**原则：UI 可以持续迭代，接口契约不能被破坏。任何 UI 优化都必须建立在「接口层稳定不变」的前提下。**

---

## 一、允许的 UI 调整

以下内容**可以**因 UI 优化而被修改：

- 页面布局（VStack/HStack/List/Grid 等）
- 颜色、字体、间距、圆角、阴影、图标
- 组件拆分方式（拆成更小的 View、抽成 Component）
- 交互体验（动画、手势、反馈）
- 新增**纯展示型** UI 组件（不发起请求、不改请求字段）

---

## 二、禁止因 UI 调整而修改的内容

以下内容**禁止**因 UI 调整而被修改、删除、重命名或破坏：

### 1. Networking 层（整层禁止动）

- `Networking/` 下所有文件
- 特别禁止动：
  - `APIEndpoint.swift`（路径、方法、query 定义）
  - `NetworkManager.swift`（请求入口、解码、错误映射）
  - `RequestBuilder.swift`（URL、body、header 构造）
  - `APIError.swift`（错误类型与文案）
  - `AuthInterceptor.swift`（token 注入）
  - `ResponseValidator.swift`（状态码与错误解析）

### 2. 数据模型层（字段与解码禁止动）

- 所有 `Models/` 中与**服务端对接的字段**禁止改
- 禁止改：
  - 请求/响应模型的**字段名**（包括 Codable 的 CodingKeys 与 JSON 的对应关系）
  - 类型（如 String/Int/[String]）与可选性
- 可以：在 Models 中新增**仅用于 UI 展示**的字段或类型（不参与编码/解码的）

### 3. Repositories 层（接口调用禁止动）

- 所有 `Repositories/` 中的**接口调用逻辑**禁止改
- 禁止改：调用的 endpoint、传参、返回值类型

### 4. Services 层（接口封装禁止动）

- 所有 `Services/` 中的**接口封装逻辑**禁止改
- 禁止改：调用的 Repository 方法、参数、返回、与 Storage 的配合

### 5. ViewModel 中的接口逻辑（禁止动）

- 禁止改：
  - 调用哪个 Service 方法
  - 请求参数如何从 UI 状态组装（字段名、结构）
  - 响应如何写入状态（字段名、结构）
  - 业务调用顺序（如先 verify 再 fetchStatus）
- 可以：改**展示用**的 `@Published` 名称、或**仅 UI 绑定方式**（如改成子 View 专用的小对象），前提是不改上面几条。

### 6. 其他禁止项

- **baseURL / 环境配置**：禁止因 UI 调整而改
- **分页参数**：`page`、`pageSize` 等名称与含义禁止改
- **Token 注入逻辑**：禁止改
- **Home 输入类型与接口分流**：text→analyze、phone→query/phone、url→query/url、company→query/company、screenshot→analyze/screenshot，禁止改

---

## 三、核心接口契约（必须保持不变）

UI 调整后，以下行为必须仍然成立：

| 功能         | 必须调用的接口                          |
|--------------|-----------------------------------------|
| 文本分析     | POST /api/ai/analyze                    |
| 截图分析     | POST /api/ai/analyze/screenshot         |
| 电话查询     | POST /api/query/phone                   |
| 链接查询     | POST /api/query/url                     |
| 公司查询     | POST /api/query/company                 |
| 历史记录     | GET /api/queries                        |
| 举报         | POST /api/report                       |
| 知识库列表   | GET /api/knowledge                      |
| 知识库详情   | GET /api/knowledge/:id                  |
| 登录         | POST /api/auth/login                    |
| 用户信息     | GET /api/auth/userinfo                  |
| 登出         | POST /api/auth/logout                   |
| 订阅验证     | POST /api/subscription/verify           |
| 订阅状态     | GET /api/subscription/status            |

---

## 四、若必须动到 ViewModel 或页面绑定

- **只允许**调整：UI 展示层绑定方式（例如把一个大 ViewModel 拆成多个只读的「展示模型」）
- **禁止**：
  - 改接口路径、请求方法
  - 改请求/响应字段名
  - 改业务调用顺序
- 改完后必须按《接口回归检查清单》做一遍检查。

---

## 五、每次 UI 调整后必做

1. 执行一遍 **接口回归检查**（见 `UI-REGRESSION-CHECKLIST.md`）。
2. 输出 **「接口回归检查结果」**，至少包含：
   - 本次修改了哪些 UI 文件
   - 是否修改了 Networking / Models / Repositories / Services / ViewModel 接口逻辑
   - 所有核心接口是否仍保持一致
   - 是否可以继续联调测试

---

## 六、快速自检清单

- [ ] 未改 `Networking/` 任何文件
- [ ] 未改 `Models/` 中与请求/响应相关的字段名与 Codable 映射
- [ ] 未改 `Repositories/` 的调用方式
- [ ] 未改 `Services/` 的调用方式
- [ ] 未改 ViewModel 中「调哪个接口、传什么参、用哪个返回字段」
- [ ] 未改 baseURL、分页参数、token 注入、Home 分流逻辑
- [ ] 已填写《接口回归检查结果》
