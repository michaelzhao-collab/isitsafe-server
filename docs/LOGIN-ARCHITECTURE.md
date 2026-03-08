# IsItSafe 登录架构说明

## 1. 设计结论：Token 100 天有效期是否合理？

**合理。** 建议如下：

- **服务端**：签发 accessToken 时设置 100 天有效期（或 90/180 天，视安全策略而定）；可同时签发 refreshToken（更长有效期），用于在 accessToken 过期前刷新。
- **客户端**：只持久化 token（Keychain），不强制解析或校验过期时间；每次请求带 token，由服务端返回 401 时再处理“未登录/需重新登录”。
- **体验**：用户登录后 100 天内无需再次打开登录页；超过有效期后接口返回 401，客户端清除 token 并回到登录页，提示重新登录。

若希望“超过一定时间后需要再次登录”，100 天是一个折中：既减少打扰，又定期要求重新登录，符合常见 App 做法。

---

## 2. 当前实现要点

| 项目 | 说明 |
|------|------|
| **进入 App** | 启动时根据 `hasValidSession`（已登录或游客）决定根视图：有则进入主界面，否则进入登录页。 |
| **登录状态** | `AppStateViewModel.hasValidSession = isLoggedIn \|\| isGuestMode`；`isLoggedIn` 由 `TokenStore.accessToken != nil` 及登录/登出、401 清除 token 时更新。 |
| **Token 持久化** | `TokenStore`（Keychain）存 accessToken/refreshToken；服务端可设 100 天过期，客户端不解析 JWT 过期时间。 |
| **过期与 401** | 接口 401 时在 `ResponseValidator` 中清除 token（已有逻辑），并刷新 `AppState`；根视图会因 `hasValidSession` 变为 false 自动切回登录页（若需可在此处加“登录已过期”提示）。 |
| **游客模式** | 用户选择“游客入口”后设置 `isGuestMode = true` 并写入 UserDefaults，使用模拟数据；退出登录时调用 `exitGuestMode()` 清除，再次进入需重新登录或再次选游客。 |

---

## 3. 已修改/涉及的文件（尽量少动现有逻辑）

| 文件 | 变更 |
|------|------|
| `AppStateViewModel` | 增加 `isGuestMode`、`hasValidSession`、`exitGuestMode()`；启动时读 UserDefaults 恢复游客状态。 |
| `IsItSafeApp` | 根视图改为 `Group { if hasValidSession { MainTabView } else { LoginView } }`，先判断登录/游客再进主界面；保留 `sheet(isPresented: $router.isShowingLogin)` 供从主界面内拉起登录。 |
| `LoginView` | 重做 UI（图2 风格）、协议勾选、游客入口；游客进入时设置 mock token + `isGuestMode = true`。 |
| `LoginViewModel` | 增加 `agreementAccepted`、`canAttemptLogin`、`enterGuestMode()`；登录前校验协议。 |
| `SettingsView` | 退出登录时调用 `appState.exitGuestMode()`。 |
| `ResponseValidator` | 已有 401 清 token 逻辑，无需改；若希望 401 时自动回到登录页，可在此处或拦截层触发 `appState.refreshLoginState()`（根视图已根据 `hasValidSession` 响应）。 |

未改：`TokenStore`、`UserSessionStore`、`AuthService` 的存储与请求逻辑；仅增加“根视图按会话显示”和“游客模式”的开关与清理。

---

## 4. 可选后续增强

- **RefreshToken**：若服务端支持，在 accessToken 即将过期或收到 401 时用 refreshToken 换新 token，减少频繁要求重新登录。
- **Token 过期提示**：在 401 清除 token 并刷新状态时，可设置一次性的 “登录已过期，请重新登录” 文案，由登录页或 Toast 展示。
