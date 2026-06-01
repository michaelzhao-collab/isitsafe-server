# App Store Server Notifications 配置说明

苹果要求为内购配置两个回调地址：**正式环境** 与 **沙盒环境**。本服务提供统一接口，两个 URL 填同一个即可。

> ⚠️ **当前线上唯一权威配置**（2026-06-01 锁定，未经业主同意不得变更）：
>
> - **Production Server URL**：`https://www.starlensai.com/api/subscription/apple/notifications`
> - **Sandbox Server URL**：`https://www.starlensai.com/api/subscription/apple/notifications`
>
> 服务端两个路由都已实现，但**只允许使用上面这个 URL**。后续如需排查问题，按这个 URL 跟踪 Apple 的回送记录。

## 1. 回调地址（供填入 App Store Connect）

| 环境 | 填写地址 |
|------|----------|
| **Production Server URL（正式）** | `https://www.starlensai.com/api/subscription/apple/notifications` |
| **Sandbox Server URL（沙盒）** | `https://www.starlensai.com/api/subscription/apple/notifications` |

## 2. 在 App Store Connect 中填写

1. 打开 [App Store Connect](https://appstoreconnect.apple.com) → 你的 App → **App 信息**。
2. 找到 **App Store 服务器通知** → 选择 **版本 2 通知** → 编辑。
3. 在 **Production Server URL** 中填入：`https://www.starlensai.com/api/subscription/apple/notifications`。
4. 在 **Sandbox Server URL** 中填入：`https://www.starlensai.com/api/subscription/apple/notifications`。
5. 保存。苹果会向该 URL 发送 HTTPS POST，请求体为 V2 格式（含 `signedPayload` 等）。

## 3. 服务端路由实现

`Server/src/modules/subscription/subscription.controller.ts` 同时提供两条路由都指向 `handleAppleNotification`：

| 路由 | 用途 |
|---|---|
| `POST /api/subscription/apple/notifications` | **生效中（线上）** ✅ |
| `POST /api/subscription/apple-notification` | 历史兼容路由，不要在 App Store Connect 里填这个 |

两条路由都 `@Public()`（无需 JWT），处理逻辑完全相同。

## 4. 服务端要求

- 使用 **HTTPS**，支持 **TLS 1.2+**。
- 若写端口，须为 **443** 或 **≥1024**（一般不写端口即可）。
- 接口需在收到请求后 **尽快返回 HTTP 200**，业务逻辑可异步处理。
- 当前实现：收到 POST 后立即返回 `{}`（200），日志输出 `[APPLE_NOTIFICATION] received`；service 内解析 `signedPayload`（JWS） + 用 Apple 证书链验签 + 更新 subscription 记录。

## 5. 验证 webhook 是否打通

配完 URL 后：

1. 在 Sandbox 测试号买一次订阅。
2. 等 1–5 分钟，Apple 会发 `DID_RENEW` 或 `SUBSCRIBED` 类型的通知。
3. 看 Railway 服务端日志，应该有：
   ```
   [APPLE_NOTIFICATION] received notificationType=...
   ```
4. 或去 App Store Connect → **App Store 服务器通知历史**，看每条通知的 HTTP 状态码（200 即收到，4xx/5xx 即未生效）。

## 6. 域名解析与 HTTPS

`www.starlensai.com` 需要在 DNS 把 `www` CNAME 解到 Railway，并在 Railway 项目里把 `www.starlensai.com` 加到自定义域名。Railway 会自动签发 TLS 证书。
