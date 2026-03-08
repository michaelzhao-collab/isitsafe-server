# IsItSafe iOS 客户端完整架构方案（严格对齐当前 Server 架构，补齐所有缺失项，可直接用于开发/喂给 Cursor）

目标：
基于当前已经确定的 Server 架构，为 IsItSafe 设计一套完整、可落地、可扩展的 iOS 客户端架构。
必须完整覆盖：
- iOS 工程目录结构
- 网络层
- 数据模型层
- 服务层
- 仓库层
- 本地存储层
- ViewModel 层
- 页面层
- 登录态 / 游客态
- Apple IAP 订阅闭环
- 错误处理
- 环境配置
- 与 Server 接口的完整交互方式

要求：
1. 必须严格对齐当前 Server 架构与接口设计
2. 必须补齐此前缺失的所有内容
3. 所有 iOS 请求最终都通过域名访问 Server API
4. 开发阶段支持 localhost / 局域网 IP / 测试环境 / 生产环境切换
5. 结构必须适合 SwiftUI + MVVM
6. 代码组织必须清晰，方便 Cursor 按目录生成
7. 文档适合小白阅读，但必须足够工程化，能够直接用于开发

================================================================
一、iOS 客户端总体目标
================================================================

IsItSafe iOS 客户端要完成以下事情：

1. 提供用户侧功能入口：
   - 文本风险分析
   - 截图分析
   - 电话查询
   - 网址查询
   - 公司/平台查询
   - 历史记录
   - 举报提交
   - 风险知识库浏览
   - 登录/用户信息
   - 订阅管理

2. 对接后端 API：
   - auth
   - ai
   - query
   - knowledge
   - report
   - subscription
   - queries/history

3. 管理客户端状态：
   - 游客态
   - 登录态
   - 订阅态
   - 网络请求状态
   - 错误状态
   - 页面加载状态

4. 支持未来扩展：
   - 多语言
   - 多环境
   - 国内 / 海外 Server 切换
   - 更多分析类型
   - 更复杂的订阅方案

================================================================
二、iOS 工程目录结构（必须按此组织）
================================================================

ios/
├── App/
│   ├── IsItSafeApp.swift
│   ├── AppRouter.swift
│   ├── AppEnvironment.swift
│   └── AppConfiguration.swift
│
├── Networking/
│   ├── APIEndpoint.swift
│   ├── NetworkManager.swift
│   ├── RequestBuilder.swift
│   ├── APIError.swift
│   ├── AuthInterceptor.swift
│   ├── ResponseValidator.swift
│   └── HTTPMethod.swift
│
├── Models/
│   ├── Common/
│   │   ├── BaseSuccessResponse.swift
│   │   ├── BaseErrorResponse.swift
│   │   ├── PaginationRequest.swift
│   │   └── PaginationResponse.swift
│   │
│   ├── Auth/
│   │   ├── LoginRequest.swift
│   │   ├── LoginResponse.swift
│   │   ├── UserInfoResponse.swift
│   │   └── LogoutResponse.swift
│   │
│   ├── AI/
│   │   ├── RiskAnalysisRequest.swift
│   │   ├── ScreenshotAnalyzeRequest.swift
│   │   ├── RiskAnalysisResult.swift
│   │   └── RiskAnalysisViewData.swift
│   │
│   ├── Query/
│   │   ├── PhoneQueryRequest.swift
│   │   ├── URLQueryRequest.swift
│   │   ├── CompanyQueryRequest.swift
│   │   ├── QueryHistoryItem.swift
│   │   ├── QueryHistoryListResponse.swift
│   │   └── QueryInputType.swift
│   │
│   ├── Knowledge/
│   │   ├── KnowledgeItem.swift
│   │   ├── KnowledgeListResponse.swift
│   │   ├── KnowledgeDetailResponse.swift
│   │   └── KnowledgeCategory.swift
│   │
│   ├── Report/
│   │   ├── ReportRequest.swift
│   │   ├── ReportType.swift
│   │   └── ReportSubmitResponse.swift
│   │
│   └── Subscription/
│       ├── SubscriptionVerifyRequest.swift
│       ├── SubscriptionStatusResponse.swift
│       └── SubscriptionPlan.swift
│
├── Services/
│   ├── AuthService.swift
│   ├── AIService.swift
│   ├── QueryService.swift
│   ├── KnowledgeService.swift
│   ├── ReportService.swift
│   ├── SubscriptionService.swift
│   └── UploadService.swift
│
├── Repositories/
│   ├── AuthRepository.swift
│   ├── AIRepository.swift
│   ├── QueryRepository.swift
│   ├── KnowledgeRepository.swift
│   ├── ReportRepository.swift
│   └── SubscriptionRepository.swift
│
├── Storage/
│   ├── TokenStore.swift
│   ├── UserSessionStore.swift
│   ├── LocalCacheStore.swift
│   ├── RecentSearchStore.swift
│   └── AppSettingsStore.swift
│
├── ViewModels/
│   ├── Shared/
│   │   ├── AppStateViewModel.swift
│   │   ├── LoadableState.swift
│   │   └── ErrorBannerViewModel.swift
│   │
│   ├── Home/
│   │   └── HomeViewModel.swift
│   ├── History/
│   │   ├── HistoryViewModel.swift
│   │   └── HistoryDetailViewModel.swift
│   ├── Report/
│   │   └── ReportViewModel.swift
│   ├── Knowledge/
│   │   ├── KnowledgeViewModel.swift
│   │   └── KnowledgeDetailViewModel.swift
│   ├── Profile/
│   │   ├── ProfileViewModel.swift
│   │   ├── LoginViewModel.swift
│   │   └── SubscriptionViewModel.swift
│   └── Root/
│       └── MainTabViewModel.swift
│
├── Views/
│   ├── Root/
│   │   └── MainTabView.swift
│   ├── Home/
│   │   ├── HomeView.swift
│   │   ├── AnalyzeInputBar.swift
│   │   ├── RiskResultCard.swift
│   │   ├── QuickActionGrid.swift
│   │   └── UploadScreenshotSheet.swift
│   ├── History/
│   │   ├── HistoryView.swift
│   │   ├── HistoryRow.swift
│   │   └── HistoryDetailView.swift
│   ├── Report/
│   │   ├── ReportView.swift
│   │   └── ReportTypePicker.swift
│   ├── Knowledge/
│   │   ├── KnowledgeView.swift
│   │   ├── KnowledgeCategoryTabs.swift
│   │   ├── KnowledgeRow.swift
│   │   └── KnowledgeDetailView.swift
│   ├── Profile/
│   │   ├── ProfileView.swift
│   │   ├── LoginView.swift
│   │   ├── SubscriptionView.swift
│   │   └── SettingsView.swift
│   └── Components/
│       ├── LoadingOverlay.swift
│       ├── EmptyStateView.swift
│       ├── ErrorStateView.swift
│       ├── SearchBar.swift
│       ├── ToastView.swift
│       └── PrimaryButton.swift
│
├── IAP/
│   ├── IAPManager.swift
│   ├── ProductIdentifiers.swift
│   └── PurchaseState.swift
│
├── Utils/
│   ├── Constants.swift
│   ├── Extensions.swift
│   ├── Logger.swift
│   ├── Formatter.swift
│   └── InputClassifier.swift
│
└── Resources/
    ├── Assets.xcassets
    └── Localizable.strings

================================================================
三、客户端架构模式（必须遵守）
================================================================

采用：
- SwiftUI
- MVVM
- Service + Repository 分层
- 独立网络层
- 独立本地存储层
- 独立 IAP 层

职责划分：

1. View
- 只负责 UI 展示和用户交互
- 不直接发网络请求

2. ViewModel
- 负责页面状态管理
- 调用 Service/Repository
- 输出可直接给 View 使用的状态和数据

3. Repository
- 负责具体接口调用和数据转换
- 屏蔽服务端细节

4. Service
- 对 Repository 做业务整合
- 处理多接口组合逻辑

5. Networking
- 统一发请求
- 统一注入 token
- 统一解析错误
- 统一校验响应

6. Storage
- token 存储
- session 存储
- 本地缓存
- 本地设置

================================================================
四、App 环境配置（必须补齐）
================================================================

必须支持以下环境：

1. local
- http://localhost:3000

2. lan
- http://192.168.x.x:3000

3. staging
- 测试域名

4. productionCN
- 中国线上域名，例如 https://api.isitsafe.cn

5. productionGlobal
- 海外线上域名，例如 https://api.isitsafe.com

必须实现：
AppEnvironment.swift

内容要求：
- 枚举所有环境
- 每个环境有 baseURL
- 支持切换环境
- 可在 debug 下快速切换
- release 默认走生产环境

示例：
- baseURL
- appName
- apiTimeout
- enableLogging

================================================================
五、网络层（必须完整补齐）
================================================================

1. APIEndpoint.swift
作用：
- 统一管理所有接口路径
- 所有路径必须与服务端保持一致

必须包含：
- auth.login
- auth.logout
- auth.userinfo
- ai.analyze
- ai.analyzeScreenshot
- query.phone
- query.url
- query.company
- queries.history
- report.submit
- knowledge.list
- knowledge.detail(id)
- subscription.verify
- subscription.status
- health.check

2. HTTPMethod.swift
- GET
- POST
- PUT
- DELETE

3. RequestBuilder.swift
作用：
- 构建 URLRequest
- 自动拼接 query
- 自动编码 JSON body
- 自动添加请求头

必须支持：
- Content-Type: application/json
- Authorization: Bearer <token>（如有）
- timeout
- query 参数
- body 编码

4. AuthInterceptor.swift
作用：
- 从 TokenStore 读取 token
- 自动注入 Authorization 头

5. ResponseValidator.swift
作用：
- 校验 HTTP 状态码
- 校验业务错误 JSON
- 返回统一 APIError

6. APIError.swift
必须包含以下错误类型：
- invalidURL
- networkError
- timeout
- decodingError
- unauthorized
- forbidden
- notFound
- tooManyRequests
- aiAnalysisFailed
- ocrFailed
- subscriptionVerifyFailed
- riskDatabaseQueryFailed
- knowledgeQueryFailed
- serverError
- unknown

7. NetworkManager.swift
作用：
- 所有请求统一入口
- 泛型 decode
- 日志输出（debug）
- 支持 GET/POST/PUT/DELETE
- 支持失败重试（有限次数）
- 支持统一错误抛出

要求：
- 不允许页面直接使用 URLSession
- 所有网络请求必须通过 NetworkManager

================================================================
六、数据模型层（必须完整补齐）
================================================================

1. 通用模型
- BaseSuccessResponse
- BaseErrorResponse
- PaginationRequest
- PaginationResponse

2. Auth 模型
- LoginRequest
- LoginResponse
- UserInfoResponse
- LogoutResponse

3. AI 模型
- RiskAnalysisRequest
- ScreenshotAnalyzeRequest
- RiskAnalysisResult
- RiskAnalysisViewData（给 UI 展示用）

4. Query 模型
- PhoneQueryRequest
- URLQueryRequest
- CompanyQueryRequest
- QueryHistoryItem
- QueryHistoryListResponse
- QueryInputType

5. Knowledge 模型
- KnowledgeItem
- KnowledgeListResponse
- KnowledgeDetailResponse
- KnowledgeCategory

6. Report 模型
- ReportRequest
- ReportType
- ReportSubmitResponse

7. Subscription 模型
- SubscriptionVerifyRequest
- SubscriptionStatusResponse
- SubscriptionPlan

要求：
- 所有模型都用 Codable
- 字段必须和服务端文档一致
- 预留可选字段，避免接口新增字段导致崩溃

================================================================
七、Storage 层（必须完整补齐）
================================================================

1. TokenStore.swift
作用：
- 使用 Keychain 保存 access token
- 读取 token
- 删除 token

要求：
- 登录成功写入
- 登出清除
- 401 时清除

2. UserSessionStore.swift
作用：
- 保存当前用户信息
- 保存登录状态
- 提供 isLoggedIn
- 提供 userInfo

3. LocalCacheStore.swift
作用：
- 本地缓存最近分析结果（可选）
- 缓存首页最近结果、知识库最近列表

4. RecentSearchStore.swift
作用：
- 保存用户最近搜索关键词
- 支持本地展示“最近查询”

5. AppSettingsStore.swift
作用：
- 保存语言设置
- 保存环境配置（debug）
- 保存 UI 偏好

================================================================
八、Service + Repository 层（必须完整补齐）
================================================================

Repository 负责直接调用接口：
- AuthRepository
- AIRepository
- QueryRepository
- KnowledgeRepository
- ReportRepository
- SubscriptionRepository

Service 负责组合逻辑：
- AuthService
- AIService
- QueryService
- KnowledgeService
- ReportService
- SubscriptionService

职责说明：

1. AuthRepository
- login
- logout
- fetchUserInfo

2. AuthService
- 登录成功保存 token
- 拉取用户信息
- 更新 session
- 登出清理状态

3. AIRepository
- analyzeText
- analyzeScreenshot

4. AIService
- 根据输入类型路由请求
- 对结果做统一 UI 转换
- 支持文本、截图、电话、网址、公司

5. QueryRepository
- queryPhone
- queryURL
- queryCompany
- fetchHistory

6. QueryService
- 对查询结果做通用风险结果转换
- 管理 history 分页

7. KnowledgeRepository
- fetchKnowledgeList
- fetchKnowledgeDetail

8. KnowledgeService
- 管理分类与搜索逻辑
- 处理分页

9. ReportRepository
- submitReport

10. ReportService
- 处理举报表单校验
- 处理举报提交后的状态

11. SubscriptionRepository
- verifySubscription
- fetchSubscriptionStatus

12. SubscriptionService
- 调用 IAPManager 获取 transaction/receipt
- 上传后端验证
- 同步订阅状态

================================================================
九、ViewModel 层（必须完整补齐）
================================================================

必须实现统一加载状态枚举：
LoadableState
- idle
- loading
- success
- empty
- failure

1. AppStateViewModel
作用：
- 全局登录态
- 全局用户信息
- 全局订阅状态
- 全局错误 banner

2. HomeViewModel
必须支持：
- 输入内容管理
- 输入类型识别
- 文本分析
- 截图分析
- 电话查询
- 网址查询
- 公司查询
- loading/success/error 状态
- 最近结果展示
- 复制结果

3. HistoryViewModel
必须支持：
- 拉取历史列表
- 分页
- 下拉刷新
- 空状态
- 登录态校验

4. HistoryDetailViewModel
必须支持：
- 处理历史详情的展示数据
- 风险等级颜色映射

5. ReportViewModel
必须支持：
- 举报类型选择
- 举报内容输入
- 表单校验
- 提交举报
- 提交状态提示

6. KnowledgeViewModel
必须支持：
- 分类切换
- 搜索关键词
- 列表加载
- 分页
- 空状态
- 错误重试

7. KnowledgeDetailViewModel
必须支持：
- 知识详情加载
- 长文展示状态

8. ProfileViewModel
必须支持：
- 用户信息展示
- 登录入口
- 登出逻辑
- 订阅状态展示
- 设置入口

9. LoginViewModel
必须支持：
- 国内登录表单
- 海外 Firebase 登录预留
- token 存储
- 登录失败提示

10. SubscriptionViewModel
必须支持：
- 加载产品
- 购买流程
- 恢复购买
- 上传后端验证
- 刷新订阅状态

================================================================
十、页面结构（必须完整补齐）
================================================================

TabBar 结构：
1. Home
2. History
3. Report
4. Knowledge
5. Profile

1. Home 页面
功能：
- 文本输入
- 上传截图
- 查询电话
- 查询链接
- 查询公司
- 调用不同接口
- 展示统一 RiskAnalysisResult

必须包含组件：
- AnalyzeInputBar
- QuickActionGrid
- RiskResultCard
- UploadScreenshotSheet

UI 要求：
- 浅色系
- 参考豆包和元宝风格
- 首页卡片化
- 风险等级颜色清晰
- 底部 TabBar 简洁

2. History 页面
功能：
- 历史列表
- 分页
- 点击详情
- 空状态
- 登录提示

3. Report 页面
功能：
- 举报类型选择
- 文本/电话/链接/截图举报
- 表单提交
- 成功反馈

4. Knowledge 页面
功能：
- 分类 tabs
- 搜索
- 列表页
- 详情页
- 空状态与重试

5. Profile 页面
功能：
- 用户信息
- 登录/登出
- 订阅管理
- 设置
- 语言切换入口
- 环境查看（debug）

================================================================
十一、与服务端接口的完整交互关系（必须一一对应）
================================================================

1. Home 页面接口

A. 文本分析
- POST /api/ai/analyze
请求：
{
  "content": "用户输入内容",
  "country": "CN",
  "language": "zh"
}
返回：
RiskAnalysisResult

B. 截图分析
- POST /api/ai/analyze/screenshot
请求：
{
  "content": "OCR后的文字或图片相关字段",
  "country": "CN",
  "language": "zh"
}
返回：
RiskAnalysisResult

C. 电话查询
- POST /api/query/phone
请求：
{
  "phone": "4001234567",
  "country": "CN",
  "language": "zh"
}
返回：
RiskAnalysisResult 或兼容查询结果结构（客户端统一转换为 RiskAnalysisViewData）

D. 链接查询
- POST /api/query/url
请求：
{
  "url": "https://example.com",
  "country": "CN",
  "language": "zh"
}
返回：
RiskAnalysisResult 或可转换结构

E. 公司查询
- POST /api/query/company
请求：
{
  "company": "XX投资平台",
  "country": "CN",
  "language": "zh"
}
返回：
RiskAnalysisResult 或可转换结构

2. History 页面接口
- GET /api/queries?page=1&page_size=20
请求头：
Authorization: Bearer <token>
返回：
QueryHistoryListResponse

3. Report 页面接口
- POST /api/report
请求：
{
  "type": "text | phone | url | screenshot",
  "content": "举报内容"
}
请求头：
Authorization: Bearer <token>（建议）
返回：
ReportSubmitResponse

4. Knowledge 页面接口
A. 列表
- GET /api/knowledge?page=1&page_size=20&category=诈骗&keyword=xxx
返回：
KnowledgeListResponse

B. 详情
- GET /api/knowledge/:id
返回：
KnowledgeDetailResponse

5. Profile 页面接口
A. 登录
- POST /api/auth/login

B. 登出
- POST /api/auth/logout

C. 用户信息
- GET /api/auth/userinfo

D. 订阅验证
- POST /api/subscription/verify

E. 订阅状态
- GET /api/subscription/status

================================================================
十二、登录态与游客态设计（必须补齐）
================================================================

1. 游客态
可使用：
- Home 分析
- Knowledge 浏览
- 部分举报（可选）
不可使用或受限：
- History
- 完整 Profile
- 订阅同步
- 用户关联举报

2. 登录态
可使用全部功能：
- 历史记录
- 订阅关联
- 举报关联
- 用户信息同步

3. 登录后必须做的事
- 保存 token
- 拉取 userinfo
- 更新 AppStateViewModel
- 刷新 History / Profile / Subscription

4. 401 处理
- 清除 token
- 清除 session
- 跳回游客态
- 提示“登录已失效，请重新登录”

================================================================
十三、Apple IAP 订阅闭环（必须补齐）
================================================================

1. IAPManager.swift
必须负责：
- 拉取商品
- 发起购买
- 恢复购买
- 监听交易状态

2. 购买成功后流程
- 获取 transaction / receipt
- 生成 SubscriptionVerifyRequest
- 调用 POST /api/subscription/verify
- 成功后再调用 GET /api/subscription/status
- 更新 SubscriptionViewModel + ProfileViewModel

3. 必须处理的状态
- 未购买
- 购买中
- 已购买
- 已过期
- 验证失败
- 恢复购买成功/失败

================================================================
十四、错误处理（必须完整补齐）
================================================================

1. 网络错误
- 提示“网络异常，请稍后重试”

2. AI 分析失败
- 提示“分析失败，请稍后重试”

3. 401
- 提示“登录已失效，请重新登录”

4. 403
- 提示“当前无权限访问”

5. 429
- 提示“请求过于频繁，请稍后再试”

6. 订阅验证失败
- 提示“订阅验证失败，请稍后重试”

7. 未知错误
- 提示“发生未知错误，请稍后重试”

要求：
- 页面层不直接处理原始错误码
- 统一转为 APIError
- 再映射为用户可读提示文案

================================================================
十五、分页与列表处理（必须补齐）
================================================================

History / Knowledge 列表都必须支持：
- page
- page_size
- isLoadingMore
- hasMore
- pull to refresh
- 空列表状态
- 错误重试

客户端必须有统一分页模型：
- PaginationRequest
- PaginationResponse

================================================================
十六、输入类型识别（客户端前置优化，必须补齐）
================================================================

虽然 Server 有 Input Parser，但客户端也要做前置分类，提高体验。

Utils/InputClassifier.swift 必须支持：
- 判断是否是网址
- 判断是否是电话
- 判断是否更像公司/平台名
- 其他归类为 text

作用：
- 决定 Home 页按哪个接口发请求
- 给 UI 显示更合适的占位文案与提示

================================================================
十七、本地缓存与体验优化（必须补齐）
================================================================

1. LocalCacheStore
- 缓存最近一次分析结果
- 缓存最近一次知识库列表（可选）

2. RecentSearchStore
- 保存最近输入历史
- Home 页面可显示最近查询

3. Toast / HUD
- 统一成功/失败提示
- 页面不要各自写一套

4. 全局 LoadingOverlay
- 处理全局加载态

================================================================
十八、UI 风格要求（必须执行）
================================================================

设计方向：
- 参考国内豆包和元宝 APP
- 浅色系为主
- 符合大众审美
- 清晰的底部 TabBar
- 大圆角卡片
- 轻阴影
- 白底 + 浅灰背景
- 主色偏浅蓝
- 风险等级颜色区分明确

底部 TabBar：
- 背景浅色
- 图标线性风格
- 选中高亮蓝色
- 未选中灰色
- 与整体风格统一

================================================================
十九、开发与调试要求（必须补齐）
================================================================

1. 开发环境支持 localhost
2. 真机调试支持局域网 IP
3. 生产环境用域名
4. Debug 模式输出请求日志
5. Release 模式关闭详细日志
6. 通过 /api/health 做联通性检测

================================================================
二十、当前 iOS 相比旧版本必须新增的内容（总结）
================================================================

必须新增：
1. 完整 Networking 层
2. 完整 Models 层
3. 完整 Services 层
4. 完整 Repositories 层
5. 完整 Storage 层
6. 完整 ViewModels 层
7. Apple IAP 闭环
8. 登录态 / 游客态管理
9. APIError 统一错误处理
10. LoadableState 状态管理
11. 环境切换能力
12. 分页模型
13. 输入分类器
14. 最近查询与缓存能力

================================================================
二十一、最终执行要求（给 Cursor 的实现目标）
================================================================

请严格按照以上架构在 ios/ 目录中实现完整 iOS 客户端基础架构。

实现顺序必须为：
1. App / Environment / Configuration
2. Networking
3. Models
4. Storage
5. Repositories
6. Services
7. ViewModels
8. Views
9. IAP
10. Utils

要求：
- 只能修改或新增 ios/ 下文件
- 不允许修改 server/ 和 admin/
- 所有接口路径必须和当前 server 保持一致
- 所有模型字段必须与 server 文档一致
- 所有页面必须对齐当前后端能力
- 所有此前缺失项必须补齐，不允许省略