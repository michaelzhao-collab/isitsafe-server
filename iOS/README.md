# IsItSafe iOS App (SwiftUI)

AI 风险判断助手 iOS 客户端，支持文本/截图/电话/链接分析、历史、举报、知识库、订阅与登录。

## 要求

- Xcode 15+
- iOS 16+
- 后端 API 已部署并可访问（HTTPS 或本地调试用 localhost）

## 项目结构

- `IsItSafeApp.swift` - 入口
- `ContentView.swift` - TabBar 容器
- `Views/` - HomeView、HistoryView、ReportView、KnowledgeView、ProfileView
- `Services/` - APIConfig、APIClient、AuthService
- `Models/` - AnalyzeResult 等

## 配置 API 地址

在 `Services/APIConfig.swift` 中修改 `baseURL`，或通过 Xcode 的 Scheme 环境变量设置 `API_BASE_URL`（如 `https://api.isitsafe.example.com`）。本地调试可保持 `http://localhost:3000/api`（需在 Info.plist 中允许 localhost 明文，已预留）。

## 使用 Xcode 创建工程并运行

1. 打开 Xcode，File → New → Project，选择 **App**，Next。
2. Product Name: `IsItSafe`，Interface: **SwiftUI**，Language: **Swift**，Bundle Identifier 自定，Next 并保存到本目录上一级（使当前 `IsItSafe` 文件夹成为项目内的一个 Group 或直接替换生成的目录）。
3. 若为新建空项目：将本目录下除 README.md、Info.plist 外的所有文件加入工程（拖入 Xcode，勾选 Copy items if needed、Create groups）。
4. 在 Target → Signing & Capabilities 中配置 Team。
5. 在 Target → Info 中如需要可添加 `App Transport Security` 例外（本地 HTTP 时）。
6. 连接模拟器或真机，Run。

## 功能说明

- **首页**：输入问题/电话/链接，调用 `POST /api/ai/analyze`，展示风险等级、可信度、原因与建议。
- **历史**：`GET /api/queries` 分页列表，点击查看详情。
- **举报**：选择类型与内容，`POST /api/report` 提交。
- **知识库**：`GET /api/knowledge` 按分类查看，点击进入详情。
- **我的**：手机号+验证码登录、订阅状态 `GET /api/subscription/status`、登出。

深色模式随系统自动切换；多语言可在后续增加 Localizable 与语言切换入口。
