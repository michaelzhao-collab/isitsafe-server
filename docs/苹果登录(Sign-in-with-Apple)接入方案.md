# 苹果登录（Sign in with Apple）接入方案

## 一、概述

Sign in with Apple 是 Apple 要求的、在 App 内提供第三方登录时必须同时提供的登录方式。接入分为 **iOS 客户端** 与 **服务端校验与账号绑定** 两部分。

---

## 二、前置条件

1. **Apple Developer 账号**：已加入 Apple Developer Program（年费）。
2. **App ID**：在 [Identifiers](https://developer.apple.com/account/resources/identifiers/list) 中为当前应用启用 **Sign in with Apple** capability。
3. **Service ID（可选）**：若需在网页端也支持苹果登录，需创建 Service ID 并配置；仅 iOS App 登录可先不做。

---

## 三、iOS 端接入步骤

### 3.1 工程配置

1. 在 Xcode 中打开项目 → 选中 Target **IsItSafe** → **Signing & Capabilities**。
2. 点击 **+ Capability**，添加 **Sign in with Apple**。

### 3.2 使用 AuthenticationServices

```swift
import AuthenticationServices

// 在登录页点击「Apple」时：
let request = ASAuthorizationAppleIDProvider().createRequest()
request.requestedScopes = [.fullName, .email]

let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.presentationContextProvider = self
controller.performRequests()
```

### 3.3 实现 Delegate

- **ASAuthorizationControllerDelegate**  
  - `authorizationController(didCompleteWithAuthorization:)`：成功时拿到 `ASAuthorizationAppleIDCredential`。  
  - 可获取：  
    - `user`：苹果用户唯一标识（同一 App 下不变，**需传给服务端**）。  
    - `identityToken`：JWT，**需传给服务端做校验**。  
    - `authorizationCode`：可选，部分服务端用 code 换 token。  
    - `fullName`：仅首次授权有，需本地或服务端存一份。  
    - `email`：仅首次授权有，可选存。
  - `authorizationController(didCompleteWithError:)`：用户取消或失败，做错误提示。

- **ASAuthorizationControllerPresentationContextProviding**  
  - 返回当前 window 的 `viewController`，用于弹出苹果登录界面。

### 3.4 注意点

- `identityToken` 与 `user` 必须发给**自己的后端**验证并建站内账号，不要只在前端用。
- 首次授权后，后续同一用户再登录可能不再给 `fullName`/`email`，所以首次拿到后要持久化或上传服务端。

---

## 四、服务端接入步骤

### 4.1 校验 identityToken（JWT）

苹果返回的 `identityToken` 是 JWT，服务端需：

1. **获取 Apple 公钥**  
   - 端点：`https://appleid.apple.com/auth/keys`  
   - 用 JWT 头里的 `kid` 找到对应公钥。

2. **校验签名**  
   - 用该公钥验证 JWT 签名，确保未被篡改。

3. **校验声明（claims）**  
   - `iss`: 应为 `https://appleid.apple.com`  
   - `aud`: 应为你的 **App Bundle ID**（或 Service ID，若用网页登录）  
   - `exp`: 未过期  
   - `sub`: 苹果用户唯一 ID，与客户端拿到的 `user` 一致，用于做你站内的用户唯一标识。

### 4.2 用户与账号绑定

- 若 `sub` 在库里已存在（之前用苹果登录过）：直接登录，签发你自己的 JWT。
- 若不存在：  
  - 创建新用户（可把 `email`、`name` 存起来，若客户端传了）。  
  - 在 User 表建议增加字段：`appleSub`（或 `apple_id`）唯一索引，用于以后用苹果登录时查用户。  
  - 再签发你自己的 JWT 返回客户端。

### 4.3 接口设计建议

- **POST /api/auth/apple**  
  - Body：`{ "identityToken": "xxx", "user": "xxx", "email": null, "fullName": null }`（后两者仅首次有值时可传）。  
  - 服务端校验 `identityToken`，解析出 `sub`，查/建用户，写 session 或 JWT，返回与当前手机号登录一致的登录结果（如 accessToken、refreshToken、user 信息）。

---

## 五、与当前项目的衔接

- **AuthService / LoginViewModel**：  
  - 增加「苹果登录」入口：点击后调 `ASAuthorizationController.performRequests()`，在 delegate 回调里拿 `identityToken` + `user`（及可选 `email`/`fullName`），调 `AuthService.loginWithApple(identityToken:user:email:fullName:)`。
- **AuthRepository / APIEndpoint**：  
  - 新增 `POST /api/auth/apple`，body 传上述字段。
- **Server**：  
  - 新增 `AuthController` 中的 `apple()` 或单独 `AppleAuthController`。  
  - 使用现有 JWT 签发逻辑，仅「用户查找/创建」改为按 `sub`（及 `appleSub` 字段）处理。

---

## 六、参考

- [Sign in with Apple 官方文档](https://developer.apple.com/sign-in-with-apple/)  
- [验证 Apple 身份令牌（服务端）](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user)  
- 公钥接口：`GET https://appleid.apple.com/auth/keys`  
- 可用 npm 包：`apple-signin-auth`（Node 下校验 JWT、解析 payload）。

---

## 七、简要清单

| 步骤 | 说明 |
|------|------|
| 1 | Apple Developer 中为 App ID 启用 Sign in with Apple |
| 2 | Xcode 为 Target 添加 Sign in with Apple capability |
| 3 | iOS 使用 AuthenticationServices 调起苹果登录，实现 delegate，拿到 identityToken + user |
| 4 | 服务端提供 POST /api/auth/apple，校验 identityToken（Apple 公钥 + claims） |
| 5 | 服务端按 sub 查/建用户，写 appleSub，签发自有 JWT，返回与现有登录一致的结构 |
| 6 | 客户端收到 token 后与现有登录流程一致（存 token、拉 user、进首页） |

按上述步骤即可完成「仅 iOS App + 自有后端」的苹果登录接入；若后续要做网页端苹果登录，再增加 Service ID 与 redirect 流程即可。
