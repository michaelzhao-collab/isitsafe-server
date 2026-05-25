# App Store Server Notifications 配置说明

苹果要求为内购配置两个回调地址：**正式环境** 与 **沙盒环境**。本服务提供统一接口，两个 URL 填同一个即可。

## 1. 回调地址（供填入 App Store Connect）

将你的 API 根地址替换下面的 `https://你的域名`（不要带末尾斜杠），例如 Railway 部署后为 `https://xxx.up.railway.app`。

| 环境 | 填写地址 |
|------|----------|
| **Production Server URL（正式）** | `https://你的域名/api/subscription/apple-notification` |
| **Sandbox Server URL（沙盒）** | `https://你的域名/api/subscription/apple-notification` |

示例（假设域名为 `isitsafe-api.example.com`）：

- Production: `https://isitsafe-api.example.com/api/subscription/apple-notification`
- Sandbox: `https://isitsafe-api.example.com/api/subscription/apple-notification`

## 2. 在 App Store Connect 中填写

1. 打开 [App Store Connect](https://appstoreconnect.apple.com) → 你的 App → **App 内购买项目**（或 **Subscriptions**）。
2. 在 **App 信息** 或 **订阅/内购** 相关设置中找到 **App Store Server Notifications**。
3. 在 **Production Server URL** 中填入：`https://你的域名/api/subscription/apple-notification`。
4. 在 **Sandbox Server URL** 中填入：`https://你的域名/api/subscription/apple-notification`。
5. 保存。苹果会向该 URL 发送 HTTPS POST，请求体为 V2 格式（含 `signedPayload` 等）。

## 3. 服务端要求

- 使用 **HTTPS**，支持 **TLS 1.2+**。
- 若写端口，须为 **443** 或 **≥1024**（一般不写端口即可）。
- 接口需在收到请求后 **尽快返回 HTTP 200**，业务逻辑可异步处理。
- 当前实现：收到 POST 后立即返回 `200`，并在日志中输出 `[APPLE_NOTIFICATION] received`；后续可在此处解析 `signedPayload`（JWS）并更新订阅/会员状态。

## 4. 本地或测试环境

若在本地用 ngrok 等做临时公网地址，例如 `https://abc123.ngrok.io`，则两个 URL 可都填：

- `https://abc123.ngrok.io/api/subscription/apple-notification`

上线后改为正式域名即可。
