# App Store Server Notifications 配置说明

苹果要求为内购配置两个回调地址：**正式环境** 与 **沙盒环境**。本服务提供统一接口，两个 URL 填同一个即可。

> ## ⚠️ 重要：域名必须用 `api.starlensai.com`（不是 `www`）
>
> **现场实测确认**：
>
> | 域名 | 实际服务 |
> |---|---|
> | `www.starlensai.com` | Cloudflare Pages 静态官网（落地页）❌ 不能用 |
> | `api.starlensai.com` | Railway NestJS 后端 ✅ 必须用 |
>
> 如果误把 webhook 配在 `www`，Apple 的请求会落到 Cloudflare Pages 上、返回首页 HTML（HTTP 200），Apple 误以为"递送成功"，**但服务端根本没收到通知**。
>
> 配置时务必用：
> ```
> https://api.starlensai.com/api/subscription/apple/notifications
> ```

## 1. 回调地址（供填入 App Store Connect）

| 环境 | 填写地址 |
|------|----------|
| **Production Server URL（正式）** | `https://api.starlensai.com/api/subscription/apple/notifications` |
| **Sandbox Server URL（沙盒）** | `https://api.starlensai.com/api/subscription/apple/notifications` |

两个填同一个 URL 没问题，服务端按 `signedPayload` 里的 `environment` 字段自行区分。

## 2. 在 App Store Connect 中填写

1. 打开 [App Store Connect](https://appstoreconnect.apple.com) → 你的 App → **App 信息**。
2. 找到 **App Store 服务器通知** → 选择 **版本 2 通知** → 编辑。
3. 在 **Production Server URL** 填：`https://api.starlensai.com/api/subscription/apple/notifications`
4. 在 **Sandbox Server URL** 填：`https://api.starlensai.com/api/subscription/apple/notifications`
5. 保存。

## 3. 服务端路由实现

`Server/src/modules/subscription/subscription.controller.ts` 同时提供两条路由都指向 `handleAppleNotification`：

| 路由 | 用途 |
|---|---|
| `POST /api/subscription/apple/notifications` | **生效中（线上）** ✅ |
| `POST /api/subscription/apple-notification` | 历史兼容路由，不要在 App Store Connect 里填这个 |

两条路由都 `@Public()`（无需 JWT），处理逻辑完全相同。

## 4. 服务端要求

- 使用 **HTTPS**，支持 **TLS 1.2+**。
- 接口在收到请求后 **立即返回 HTTP 200 + `{}`**，业务异步处理。
- 当前实现：解析 `signedPayload`（JWS） + 用 Apple 证书链验签 + 更新 subscription 记录。
- **入口日志**：每次 Apple POST 命中都会打 `[APPLE_NOTIFICATION] received`；成功处理后再打 `[APPLE_NOTIFICATION] processed`。

## 5. 验证 webhook 是否打通

### 方法 A：App Store Connect 自带"发送测试通知"

1. App Store Connect → App 信息 → App Store 服务器通知 → 滚到底部
2. 点 **请求测试通知**（Request a Test Notification）
3. Apple 立刻发一条 TEST 类型通知到你的 URL
4. **去 Railway 日志 grep**：
   ```
   [APPLE_NOTIFICATION] received { hasSignedPayload: true, ... }
   ```
5. 同时去 App Store Connect → **通知历史** 看 HTTP 状态码：
   - `200` ✅ 你 server 收到并返 200
   - `4xx/5xx` ❌ server 报错，apple 会自动重试（最多 5 次/3 天）
   - 空白 ❌ URL 解析不通

### 方法 B：真实场景验证 Sandbox 订阅

1. Sandbox 测试号购买订阅
2. 等 3 分钟（Sandbox 续期周期）
3. Apple 推 `DID_RENEW`
4. Railway 日志：
   ```
   [APPLE_NOTIFICATION] received
   [APPLE_NOTIFICATION] processed { notificationType: 'DID_RENEW', status: 'active', userId: 'xxx' }
   ```

## 6. 域名解析配置（一次性）

`api.starlensai.com` 已在 Railway 项目自定义域名设置中绑定。如果以后需要新加子域名：

1. Railway → Project → Settings → Domains → 加 `xxx.starlensai.com`
2. Cloudflare DNS → `xxx` CNAME 指向 Railway 给的 `xxxxx.up.railway.app`
3. **关键**：Cloudflare 上 `xxx` 这条记录的 Proxy（橙色云朵）按需选择。如果开 Proxy，注意不要让 Pages 的 catch-all 吃掉请求；建议 API 子域走 DNS only（灰色云朵）。
