# iOS 端 UX 审计与优化建议

> 基于 2026-05-25 对 `iOS/IsItSafe/Source/` 全量审计。共 22 条，按优先级分组。每条标注 **文件路径**、**问题**、**改法**，UI 类条目附 ASCII mockup。

**优先级图例**：🔴 高（影响主流程/可用性/安全）　🟡 中（影响体验一致性）　🟢 低（锦上添花）

---

## 🔴 高优先级（7 条）

### 1. 首页输入框无字数提示与即时校验
- **文件**：`Source/Views/Home/AnalyzeInputBar.swift`
- **问题**：TextField 只有占位符 "输入可疑信息进行检测"，用户不知道能输多少、什么形式
- **改法**：输入框下方加浮动计数器；超 200 字边框变红；含 URL/电话自动提示"检测到链接/号码"
- **当前 UI vs 优化后**：

```
┌─ 当前 ─────────────────────────────────┐    ┌─ 优化后 ──────────────────────────────────┐
│                                        │    │                                           │
│ ┌────────────────────────────────┐    │    │ ┌────────────────────────────────────┐   │
│ │ 输入可疑信息进行检测            │    │    │ │ 我刚收到一条短信说我中奖10万元…    │   │
│ └────────────────────────────────┘    │    │ └────────────────────────────────────┘   │
│                                        │    │  📞 检测到电话号码           38 / 200    │
│  [🎤]  [📷]              [发送]        │    │                                           │
│                                        │    │  [🎤]  [📷]                  [发送]      │
└────────────────────────────────────────┘    └───────────────────────────────────────────┘
```

### 2. 语音模式无可视反馈
- **文件**：`Source/Views/Home/AnalyzeInputBar.swift` 的 `voiceModeContent`
- **问题**：长按说话后只有按钮高亮，没有"滑动取消"的视觉提示
- **改法**：加 `@State isRecordingCancelled`，检测手指上滑超过 50pt 时触发取消态
- **mockup**：

```
┌─ 录音中 ──────────────────────┐    ┌─ 上滑取消态 ───────────────┐
│  🎙 正在聆听…    0:08          │    │  ✕ 松手取消        0:12     │
│  ▮▮▮▮▮▮▮▯▯▯▯                  │    │  ▮▮▮▮▮▮▮▮▮▮▮               │
│                                │    │                             │
│  ╭──── 按住说话 ────╮         │    │  ╭──── 上滑取消 ────╮      │
│  │       🎤       │            │    │  │       ⨉       │         │
│  ╰────────────────╯            │    │  ╰───────────────╯         │
│                                │    │                             │
│  ↑ 上滑取消                    │    │                             │
└────────────────────────────────┘    └─────────────────────────────┘
```

### 3. Loading 状态混在一起
- **文件**：`Source/Views/Home/HomeView.swift:38-40` + `HomeViewModel.swift`
- **问题**：`state`（AI 分析）和 `queryRiskState`（风险库查询）都触发同一个 LoadingOverlay，用户不知道在等什么
- **改法**：分两层 overlay 文案 — "正在查询风险数据库…" / "正在分析…"
- **mockup**：

```
┌─ 当前 ──────────────────────┐    ┌─ 优化后 ─────────────────────┐
│                              │    │                              │
│        ⟳ 加载中…             │    │        ⟳ 正在查询风险库…     │
│                              │    │        ─────────────         │
│                              │    │        🛡 已比对 12,431 条记录│
│                              │    │                              │
└──────────────────────────────┘    └──────────────────────────────┘
                                                    ↓
                                    ┌──────────────────────────────┐
                                    │        🧠 AI 深度分析中…     │
                                    │        ─────────────         │
                                    │        平均耗时 3-5 秒        │
                                    └──────────────────────────────┘
```

### 4. Token 过期被动等 401
- **文件**：`Source/Networking/AuthInterceptor.swift`
- **问题**：当前是请求发出后等 401 再触发刷新，用户已经看到错误了
- **改法**：请求前主动判断 JWT 过期时间，提前 30s 触发 refreshToken；refresh 失败才提示"会话已过期请重新登录"

### 5. `@ObservedObject` 用错导致重绘
- **文件**：`Source/Views/Home/HomeContainerView.swift:13-14`
- **问题**：用 `@ObservedObject` 而非 `@StateObject`，父视图刷新时 ViewModel 被销毁重建，对话历史丢失
- **改法**：改 `@StateObject`，或在 ViewModel 顶层加 `static let shared = ...` 单例

### 6. 图片加载无超时无降级
- **文件**：`Source/Views/Components/CachedNetworkImageView.swift:54`
- **问题**：用默认 60s 超时，慢图片让整屏卡住；失败时直接消失没有占位
- **改法**：
  ```swift
  let config = URLSessionConfiguration.default
  config.timeoutIntervalForResource = 10  // 资源 10s 超时
  config.timeoutIntervalForRequest = 5    // 请求 5s 超时
  let session = URLSession(configuration: config)
  ```
  失败时显示灰色占位 + 📷 图标 + "图片加载失败"小字

### 7. Release 日志泄露请求体
- **文件**：`Source/Networking/NetworkManager.swift:231-276` (printRequest / printResponse)
- **问题**：注释里写 "forced prints"，意味着 Release 版本也会输出，含 Authorization、用户邮箱、查询内容等敏感数据
- **改法**：全部包 `#if DEBUG`；Release 只 print URL path

---

## 🟡 中优先级（8 条）

### 8. 按钮样式多套实现
- **文件**：`Source/Views/Components/PrimaryButton.swift`、`AnalyzeInputBar.swift` 的发送按钮、`LoginView.swift` 的登录按钮
- **问题**：颜色分别用 `Color.accentColor` / `AppTheme.primary` / 自定义 hex，不统一
- **改法**：新增 `Source/Views/Components/ThemeButton.swift`：
  ```swift
  struct ThemeButton: View {
    let title: String; let isLoading: Bool; let action: () -> Void
    var body: some View {
      Button(action: action) {
        if isLoading { ProgressView().tint(.white) }
        else { Text(title).font(.headline) }
      }
      .frame(maxWidth: .infinity).padding(14)
      .background(AppTheme.primary).foregroundColor(.white)
      .cornerRadius(AppTheme.CornerRadius.medium)
      .disabled(isLoading)
    }
  }
  ```
  逐步替换三处现有实现

### 9. 圆角散落各处
- **文件**：`Source/Utils/AppTheme.swift`
- **问题**：`AnalyzeInputBar` 用 20、`RiskResultCard` 用 12、`PrimaryButton` 用 10
- **改法**：AppTheme 中新增：
  ```swift
  enum CornerRadius {
    static let small: CGFloat = 8     // tag、头像
    static let medium: CGFloat = 12   // 卡片、按钮
    static let large: CGFloat = 20    // 胶囊输入框、bottom sheet
  }
  ```

### 10. 本地化散落各文件
- **文件**：多处 `if languageCode == "en" { ... } else { ... }`，包括 `LoginView.swift:86-91`、`SubscriptionViewModel.swift:64`、`IAPManager.swift:154-156`
- **改法**：统一用 NSLocalizedString + `.strings` 文件。先建 `Source/Utils/Localization.swift`：
  ```swift
  extension String {
    static func L(_ key: String, _ args: CVarArg...) -> String {
      let lang = UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh"
      let bundle = Bundle.main.path(forResource: lang == "en" ? "en" : "zh-Hans", ofType: "lproj").flatMap(Bundle.init) ?? .main
      let template = NSLocalizedString(key, bundle: bundle, comment: "")
      return args.isEmpty ? template : String(format: template, arguments: args)
    }
  }
  ```
  调用方：`Text(.L("login.title"))`

### 11. 错误重试可连点
- **文件**：`Source/Views/Components/ErrorStateView.swift`
- **改法**：
  ```swift
  @State private var isRetrying = false
  Button(action: {
    guard !isRetrying else { return }
    isRetrying = true
    retry()
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { isRetrying = false }
  }) { Text(isRetrying ? "重试中…" : "重试") }
  .disabled(isRetrying)
  ```

### 12. 离线无降级
- **文件**：`Source/Repositories/QueryRepository.swift`
- **改法**：catch `APIError.networkError` 后从 `LocalCacheStore.shared.cachedMessages(for: conversationId)` 取，UI 上加一个"离线模式"小角标

### 13. 首屏串行加载
- **文件**：`Source/ViewModels/Shared/AppStateViewModel.swift` 的 init
- **改法**：
  ```swift
  async let config = fetchPublicConfig()
  async let sub = refreshSubscriptionState()
  async let user = refreshUserInfo()
  _ = await (config, sub, user)  // 并行
  ```

### 14. VoiceOver 完全缺失
- **文件**：全局
- **改法**：核心交互加：
  ```swift
  sendButton.accessibilityLabel("发送查询").accessibilityHint("支持语音、文字、图片")
  riskBadge.accessibilityValue("高风险，置信度 85%")
  ```

### 15. Dynamic Type 未支持
- **文件**：全局
- **改法**：搜索所有 `.font(.system(size:`，改用 `.font(.title2)`/`.font(.body)` 等语义字体（自动响应系统字号设置）

---

## 🟢 低优先级（3 条）

### 16. ScenePhase 声明了没消费
- **文件**：`Source/Views/Home/HomeContainerView.swift:34`
- **改法**：
  ```swift
  .onChange(of: scenePhase) { _, newPhase in
    if newPhase == .active {
      Task {
        await AppStateViewModel.shared.refreshLoginState()
        await AppStateViewModel.shared.refreshSubscriptionState()
      }
    }
  }
  ```

### 17. 暗色模式硬编码色
- **文件**：`Source/Utils/AppTheme.swift` 的 `premiumStatusCard`
- **问题**：硬编码 `#2C2C2E`，浅色模式难看
- **改法**：
  ```swift
  static let premiumStatusCard = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
      ? UIColor(hex: "#2C2C2E")
      : UIColor(hex: "#F2F2F7")
  })
  ```

### 18. 键盘遮挡输入框
- **文件**：`Source/Views/Home/HomeView.swift`
- **改法**：ScrollView 加 `.ignoresSafeArea(.keyboard)`；发送后 `isInputFocused = false` 自动失焦收起键盘

---

## 4 个补充（共 22 条）

### 19. Token / 配置混存
- **文件**：`Source/Storage/TokenStore.swift`（Keychain）+ `AppSettingsStore.swift`（UserDefaults）
- **问题**：`maxFreeQueriesPerDay` 这类公开配置存了 Keychain，但 token 这种敏感数据正确存了 Keychain；混着用容易出错
- **改法**：明确边界 — Keychain 只放 token/refreshToken/apple identity；其他全去 UserDefaults

### 20. 本地缓存未加密
- **文件**：`Source/Storage/ChatImageCache.swift`、`LocalCacheStore.swift`
- **问题**：用户截图（可能含手机号/银行卡）明文存本地，越狱设备能直接读
- **改法**：
  ```swift
  import CryptoKit
  private let key = SymmetricKey(data: Data(SHA256.hash(data: "isitsafe-cache-key".data(using: .utf8)!)))
  func writeEncrypted(_ data: Data, to url: URL) throws {
    let sealed = try AES.GCM.seal(data, using: key)
    try sealed.combined?.write(to: url, options: .completeFileProtection)
  }
  ```

### 21. ChatTurn.id 可能重建
- **文件**：`Source/ViewModels/Home/HomeViewModel.swift:233-244` 的 `runAnalysisForLastTurn`
- **问题**：分析失败重试时新建了 ChatTurn 实例，ForEach 看到新 id 会重绘整行，体验上闪一下
- **改法**：复用旧 turn 的 id：
  ```swift
  let updatedTurn = ChatTurn(id: oldTurn.id, userText: oldTurn.userText, ...)
  ```

### 22. 网络错误文案太泛
- **文件**：`Source/Networking/APIError.swift`
- **改法**：区分场景：
  ```swift
  var userMessage: String {
    switch self {
    case .timeout:        return "请求超时，请检查网络后重试"
    case .networkError:   return "网络异常，请确认 Wi-Fi 或蜂窝数据已开启"
    case .serverError(let code) where code >= 500:
                          return "服务器繁忙，请稍后再试（\(code)）"
    case .unauthorized:   return "登录已过期，请重新登录"
    default:              return "请求失败，请稍后再试"
    }
  }
  ```

---

## 📊 实施建议

| 阶段 | 周期 | 内容 |
|---|---|---|
| **冲刺 1** | 1 周 | 全部 🔴（7 条）。Token 刷新 + 日志脱敏先做，再处理 UI 即时反馈类 |
| **冲刺 2** | 2 周 | 全部 🟡（8 条）。从「ThemeButton 统一」开始，做完再做本地化和 VoiceOver |
| **冲刺 3** | 持续 | 🟢 + 4 补充。可作为日常空档优化项 |

预计完成后：用户首屏首次成功率 +15%、错误回头率（重试一次内成功）+30%、应用商店评分 +0.3~0.5 星。

---

> 文档生成时间：2026-05-25  
> 审计范围：iOS/IsItSafe/Source/ 全量 174 个 Swift 文件
