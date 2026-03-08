# IsItSafe iOS 架构说明

本目录为按《iOS 客户端完整架构方案》实现的完整架构，与 server 接口文档严格对齐。

## 目录结构

- **App/** 入口、环境、路由
- **Networking/** 网络层（APIEndpoint、NetworkManager、APIError、RequestBuilder、AuthInterceptor、ResponseValidator）
- **Models/** 请求/响应模型（Common、Auth、AI、Query、Knowledge、Report、Subscription）
- **Storage/** TokenStore（Keychain）、UserSessionStore、LocalCacheStore、RecentSearchStore、AppSettingsStore
- **Repositories/** 对接 API
- **Services/** 业务封装
- **ViewModels/** 页面状态与逻辑
- **Views/** 页面与组件
- **IAP/** 内购（StoreKit 2 + 服务端 verify）
- **Utils/** InputClassifier、Constants、Extensions、Logger、Formatter
- **Resources/** Assets、Localizable

## 如何接入现有 Xcode 工程

1. 在 Xcode 中打开你的工程（如 `IsItSafe1.xcodeproj`）。
2. 将本目录下除 `IsItSafe1` 外的所有文件夹（App、Networking、Models、Storage、Repositories、Services、ViewModels、Views、IAP、Utils、Resources）拖入工程，勾选你的 App Target。
3. 若使用本架构作为主入口：
   - 将 **App/IsItSafeApp.swift** 设为 App 入口（保留其中的 `@main`）。
   - 从原有 **IsItSafe1App.swift** 中移除 `@main`，或删除该文件中的入口声明。
4. 确保 Deployment Target 为 **iOS 15+**（因使用 StoreKit 2）。

## 切换 Base URL 联调

1. **开发（模拟器）**：在 `AppEnvironment.swift` 中使用 `local`，默认 `http://localhost:3000`。
2. **真机调试**：使用 `lan`，并在 `AppEnvironment.swift` 中把 `baseURL` 改为你的电脑局域网 IP，例如 `http://192.168.1.100:3000`。
3. **测试/生产**：在 `AppEnvironment.swift` 中配置 `staging` / `productionCN` / `productionGlobal` 的 `baseURL`，或在 **SettingsView** 中通过「环境」选择当前环境。

当前环境由 `AppConfiguration.shared.currentEnvironment` 决定，所有请求通过 `NetworkManager` 统一使用 `AppConfiguration.shared.baseURL`，**禁止在业务代码中写死 URL**。

## 已接通接口

- GET /api/health  
- POST /api/auth/login、logout、refresh-token  
- GET /api/auth/userinfo  
- POST /api/ai/analyze、/api/ai/analyze/screenshot  
- POST /api/query/phone、url、company  
- GET /api/queries  
- POST /api/report  
- GET /api/knowledge、/api/knowledge/:id  
- POST /api/subscription/verify  
- GET /api/subscription/status  

所有请求均经 **Networking** 层，错误统一收敛为 **APIError**，401 时自动清除本地会话。

## UI 调整规则与回归检查

对 **Views/**、样式、布局做修改时，必须遵守 **接口层不被破坏** 的约定：

- **规则说明**：见 [ios/UI-CHANGE-RULES.md](UI-CHANGE-RULES.md)（允许改什么、禁止改什么、核心接口列表）。
- **回归清单**：每次 UI 改完后填写 [ios/UI-REGRESSION-CHECKLIST.md](UI-REGRESSION-CHECKLIST.md)，并输出「接口回归检查结果」。
- **原则**：UI 可迭代，接口契约不可改；任何 UI 优化都建立在接口层稳定不变的前提下。
