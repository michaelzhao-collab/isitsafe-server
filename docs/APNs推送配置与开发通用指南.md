# APNs 推送配置与开发通用指南

> 适用范围：iOS / NestJS 后端 / Railway（或任何 PaaS）部署的 APP。
> 本指南记录了从 0 到推送成功的全部坑点。照做即可避免至少 4 个隐蔽问题。

---

## 0. 概念校准：3 种 "Push" 不要混

Apple 体系里有 **3 种完全不同**的"推送"，新人 100% 会混。先对清楚：

| 类型 | 谁推谁 | 用哪种 Key | 配置位置 |
|---|---|---|---|
| **① APNs Push to Device**（手机锁屏弹通知）| 你 server → Apple → 用户手机 | **APNs Auth Key** | `developer.apple.com → Keys`（勾 APNs） |
| **② App Store Server Notifications**（Apple 推订阅事件到你 server）| Apple → 你 server webhook | **无需 Key** | App Store Connect → App 信息 → 配 webhook URL |
| **③ App Store Server API**（你 server 主动查 Apple 订阅状态）| 你 server → Apple | **App Store Connect API Key** | App Store Connect → Users and Access → Integrations |

**本指南专门解决 ①**。② 和 ③ 是另外两个独立的体系，不要混用 Key。

---

## 1. 准备：明确 4 个不可变事实

后端代码要的就是这 4 个 env：

```bash
APNS_TEAM_ID    # 你的 Apple Developer Team ID（10 字符）
APNS_KEY_ID     # 你创建的 APNs Auth Key 的 ID（10 字符）
APNS_AUTH_KEY   # 那个 .p8 文件的 base64 主体（约 200 字符）
APNS_BUNDLE_ID  # iOS App 的 Bundle ID（如 com.your.app）
APNS_ENV        # 'production' 或 'sandbox'
```

### 1.1 拿到 `APNS_TEAM_ID`

- 登 https://developer.apple.com/account
- 右上角你头像左边，显示一串 10 字符（如 `LWQAP563XV`），**这就是 Team ID**

### 1.2 拿到 `APNS_BUNDLE_ID`

- 就是你 iOS Xcode 项目 General → Identity → Bundle Identifier
- 例 `com.devin.starlensaiapp`

### 1.3 `APNS_KEY_ID` 和 `APNS_AUTH_KEY` 要新建（见第 2 节）

### 1.4 `APNS_ENV` 怎么选

| 安装方式 | APNS_ENV |
|---|---|
| Xcode 直接 Run 到真机 | `sandbox` |
| TestFlight 装 | `production` |
| App Store 正式上架 | `production` |

**线上正式 App 永远是 `production`**。开发期同时调两套环境的话，可以让 iOS 端在 register 时把环境字段也传给 server，让 server 按设备区分（参考 IsItSafe 的 `userDevice.environment` 字段）。

---

## 2. 在 Apple Developer 创建 APNs Auth Key

> ⚠️ 这一节是最容易踩坑的地方。**Key 的来源页面只有一个对的地方**。

### 2.1 去对的页面

👉 https://developer.apple.com/account/resources/authkeys/list

这个 URL 直接跳到 **Certificates, Identifiers & Profiles → Keys** 页面。

❌ **不要**去 App Store Connect → Users and Access → Integrations → App Store Connect API（那是另一种 Key，是给 ③ 号 App Store Server API 用的，**不能拿来推送**）。

> 我们项目踩过的坑：用 `7R5NK8D437`（App Store Connect API Key）配 APNs，签名能通过但 Apple 返 `InvalidProviderToken`。

### 2.2 创建 Key

1. 点页面中央 **Create a key**（或右上角 ➕）
2. **Key Name**：随便填，识别用，比如 `<APP名字> APNs Push`
3. **Services**：往下滚找到 ☑ **Apple Push Notifications service (APNs)** —— **只勾这一个**
   - ⚠️ 列表里还有 `Sign in with Apple`、`DeviceCheck`、`App Store Connect API` 等，**全部不要勾**
   - 一个 Key 一个用途，撤销时不互相影响
4. 点 **Continue** → 确认 → **Register**

### 2.3 下载 .p8（**只能下载一次**）

注册成功页面会显示：
- **Key ID**：10 字符（如 `R8X9YZ1234`） → **立刻复制保存**
- **Download** 按钮

点 Download，浏览器下载文件，名字长这样：
```
AuthKey_R8X9YZ1234.p8
```

**Apple 只允许下载一次**，丢了得撤销重建（线上别撤销否则推送瞬断）。

---

## 3. 提取 .p8 的 base64 主体

### 3.1 看 .p8 内容（验证格式正确）

```bash
cat ~/Downloads/AuthKey_R8X9YZ1234.p8
```

应该长这样（5 行）：
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg<...约 200 字符...>
<继续 base64>
<继续 base64>
LmgySajB
-----END PRIVATE KEY-----
```

### 3.2 一行命令提取出 base64

```bash
cat ~/Downloads/AuthKey_R8X9YZ1234.p8 | grep -v PRIVATE | tr -d '\n'
```

输出一长串约 200 字符，**没有换行 / 没有 BEGIN / 没有 END**。开头是 `MIG...`，结尾是 base64 字符。这就是要填给 Railway 的值。

> 后端的 normalize 逻辑会把它自动补回 BEGIN/END 头尾、按 64 字符/行重新换行。

---

## 4. 配置 PaaS 环境变量

### 4.1 Railway / Vercel 单行 env 框

直接粘第 3 步那一长串。**不要手动加 `\n` 转义**，多行 PEM 不要硬塞进单行框（PaaS 会破坏格式）。

| 变量名 | 值 |
|---|---|
| `APNS_TEAM_ID` | 10 字符 Team ID（trim 干净，结尾不带空格/换行） |
| `APNS_KEY_ID` | 10 字符 Key ID（同上） |
| `APNS_AUTH_KEY` | 单行 base64（约 200 字符，**不带** BEGIN/END/换行） |
| `APNS_BUNDLE_ID` | 例 `com.devin.starlensaiapp` |
| `APNS_ENV` | `production` 或 `sandbox` |

### 4.2 已知坑：复制粘贴常见污染

- ✗ 复制时混入 BOM `﻿`（Mac 文本编辑器复制易出现）
- ✗ 末尾多空格 / 换行
- ✗ 从 PDF / Word 复制混入非 ASCII 空格 ` `
- ✗ 手动加 `\n` 字面量

**最稳的做法**：用第 3.2 的 `cat | grep -v | tr` 命令链直接终端拷贝，绕开图形界面的隐形字符问题。

### 4.3 Railway 多行变量（替代方案）

如果 PaaS 支持"Raw editor"或"multi-line"模式（部分 Railway 项目有 **Edit as Raw** 按钮），可以直接粘**完整 5 行 PEM**（含 BEGIN/END）。但**不推荐**——单行 base64 模式最稳。

---

## 5. 后端实现要点（NestJS / Node）

> 这一节给后端开发参考；如果你直接用 IsItSafe 的代码，跳过即可。

### 5.1 依赖

```typescript
import * as http2 from 'http2';
import { createSign, createPrivateKey } from 'crypto';
```

**不需要任何第三方 APNs 库**。Node 内建 `http2` + `crypto` 完全够用，零依赖。

### 5.2 normalize 私钥

后端 env 拿到 `APNS_AUTH_KEY` 后必须用以下逻辑规范化（兜底各种粘贴姿势）：

```typescript
private normalizeApnsPrivateKey(raw: string): string {
  if (!raw) return raw;
  let key = raw;
  // 1. 去 BOM
  key = key.replace(/^﻿/, '');
  // 2. 非断行空格 → 普通空格
  key = key.replace(/ /g, ' ');
  // 3. 字面量 \n → 真换行
  if (key.includes('\\n')) {
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  // 4. CRLF → LF
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // 5. 提取 BEGIN/END 之间的内容（如果有头尾标识）
  const beginIdx = key.indexOf('BEGIN PRIVATE KEY-----');
  const endIdx = key.indexOf('-----END');
  let base64Body: string;
  if (beginIdx >= 0 && endIdx > beginIdx) {
    const start = key.indexOf('-----', beginIdx);
    const after = key.slice(start).indexOf('\n');
    const bodyStart = after >= 0 ? start + after : beginIdx;
    base64Body = key.slice(bodyStart, endIdx);
  } else {
    base64Body = key;
  }
  // 6. 只留 base64 合法字符
  const base64Clean = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');
  // 7. 按 64 字符/行重新换行，加回头尾
  const wrapped = base64Clean.match(/.{1,64}/g)?.join('\n') ?? base64Clean;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}
```

### 5.3 签 JWT（ES256）

```typescript
private getJwt(): string {
  // trim 防 Railway 末尾隐藏空格
  const teamId = (process.env.APNS_TEAM_ID ?? '').trim();
  const keyId = (process.env.APNS_KEY_ID ?? '').trim();
  const authKey = this.normalizeApnsPrivateKey(process.env.APNS_AUTH_KEY ?? '');

  const header = { alg: 'ES256', kid: keyId };  // 注意不要加 typ:JWT
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iss: teamId, iat };

  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signer = createSign('SHA256');
  signer.update(signingInput);
  const privateKey = createPrivateKey({ key: authKey, format: 'pem' });
  // dsaEncoding=ieee-p1363 直接得到 JOSE 期望的 r||s 64 字节，无需手动转换
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${base64UrlBuffer(signature)}`;
}

function base64Url(s: string) {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlBuffer(buf: Buffer) {
  return buf.toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
```

**JWT 注意点**：
- header **不要加 `typ` 字段**（Apple 会拒）
- `iat` 用秒级时间戳
- JWT 缓存 ≤ 50 分钟（Apple 60 分钟硬上限）
- 用 ES256（P-256 ECDSA），dsaEncoding 必须是 `ieee-p1363`

### 5.4 HTTP/2 投递

```typescript
const url = environment === 'sandbox'
  ? 'https://api.sandbox.push.apple.com:443'
  : 'https://api.push.apple.com:443';
const session = http2.connect(url);

const headers = {
  ':method': 'POST',
  ':path': `/3/device/${deviceToken}`,
  authorization: `bearer ${jwt}`,
  'apns-topic': bundleId,        // ← 这里一定是 Bundle ID，不是 Team ID
  'apns-push-type': 'alert',
  'apns-priority': '10',
  'content-type': 'application/json',
};
const stream = session.request(headers);
stream.write(JSON.stringify({
  aps: {
    alert: { title: '...', body: '...' },
    sound: 'default',
    'mutable-content': 1,
  },
}));
stream.end();
```

**连接复用**：HTTP/2 连接维持长连接，**不要每次请求都重新 connect**（Apple 会限流）。一个进程内 prod 和 sandbox 各保留一条复用即可。

---

## 6. iOS 客户端要点

### 6.1 申请通知权限

```swift
import UserNotifications

UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
    guard granted else { return }
    DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
    }
}
```

### 6.2 拿到 device token

在 AppDelegate（或 SwiftUI 的 UIApplicationDelegateAdaptor）：

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    // POST token 到自己 server
    registerDeviceToServer(token)
}
```

### 6.3 上报 token 到 server

```swift
// POST /api/v3/devices  (with JWT)
struct Body: Codable {
    let deviceToken: String
    let platform: String        // "ios"
    let environment: String     // "production" or "sandbox"
    let appVersion: String?
    let locale: String?
}
```

### 6.4 Xcode Capabilities

iOS Project → **Signing & Capabilities** → **+ Capability** → 加 **Push Notifications**。
不加这个，证书阶段就会拒。

### 6.5 Info.plist

`UIBackgroundModes` 加 `remote-notification`（如果要后台推送/静默推送）。

---

## 7. 端到端验证（自查清单）

### 7.1 后端诊断端点

部署后调一次，**所有字段都应该 OK**：

```bash
curl -s https://你的域名/api/admin/diagnostics/push-config \
  -H "Authorization: Bearer <admin jwt>" | python3 -m json.tool
```

检查：

| 字段 | 期望 |
|---|---|
| `APNS_TEAM_ID_trimmedLength` | `10` |
| `APNS_TEAM_ID_hasTrailingWhitespace` | `false` |
| `APNS_KEY_ID_trimmedLength` | `10` |
| `APNS_KEY_ID_hasTrailingWhitespace` | `false` |
| `APNS_BUNDLE_ID` | 与 iOS Xcode Bundle ID 一致 |
| `base64Len` | 180–320 之间 |
| `base64LengthLooksRight` | `true` |
| **`signTestResult.ok`** | **`true`** |

`signTestResult.ok = true` 说明本地能签出有效 JWT。仍然推送失败的话问题在 Apple 那侧（KID 不匹配 / Key 没勾 APNs / Key 被撤销）。

### 7.2 看真实 JWT 与 Apple 后台对照

```bash
curl -s https://你的域名/api/admin/diagnostics/show-jwt \
  -H "Authorization: Bearer <admin jwt>"
```

返回里：
- `header.kid` 必须与 `developer.apple.com → Keys` 页面里那个 Key 的 ID 字符对字符一致
- `payload.iss` 必须与 `developer.apple.com` 右上角 Team ID 字符对字符一致

### 7.3 iOS 端确认设备 token 入库

后端管理 UI 上查询 `user_devices` 表，应该有 1 条以上记录，`failureCount < 5`。

### 7.4 发测试推送

后端 admin UI 触发 `POST /admin/push/send { audience: 'user', targetUserId, title, body }`。

期望：
- 同步返回 `{ ok: true, delivered: 1, failed: 0 }`
- 手机 0.5 秒内响一下

---

## 8. 错误码对照表

| 错误 reason | 真实含义 | 修复方向 |
|---|---|---|
| `env_missing:APNS_XXX,...` | 某个 env 没配 | 回第 4 节，补齐 5 个 env |
| `jwt_sign_failed: error:1E08010C:DECODER routines::unsupported` | .p8 base64 格式破坏 | 重做第 3 步，用终端命令提取，**不要**用图形界面复制 |
| `jwt_sign_failed: ...其他...` | 私钥类型不对 / KEY_ID 写错对不上文件 | 确认 .p8 是 ES256（P-256），文件名后 10 字符 = KEY_ID |
| `InvalidProviderToken` | KID/TEAM_ID 与 Apple 后台不匹配，或 Key 没勾 APNs，或 Key 用错（如 App Store Connect API Key）| 1️⃣ Apple Developer → Keys 确认 Key 存在且 APNs ☑；2️⃣ 用 `show-jwt` 端点比对 kid/iss |
| `BadDeviceToken` | env `APNS_ENV` 与设备来源不一致 | TestFlight/AppStore → `production`；Xcode run → `sandbox` |
| `BadTopic` | `APNS_BUNDLE_ID` 与 iOS Bundle ID 不一致 | 改 env |
| `Unregistered` | 该 device token 已失效（用户卸载/重置）| server 自动删该 device 记录（本指南实现已含） |
| `TooManyRequests` | 短时间推同一设备过多 | 限流；或用 `apns-collapse-id` 合并 |
| `apns_internal: ENOTFOUND` / `ECONNREFUSED` | 网络/DNS 异常 | 重试；检查 Railway 出口网络 |
| `no_device` | 这个用户没在 `user_devices` 表里 | iOS 端确认走过 `registerForRemoteNotifications` 并 POST 给 server |

---

## 9. 常见误区 FAQ

### Q1：可以用 App Store Connect API Key 推送吗？

**不可以**。那个 Key 是给 App Store Server API（查订阅、退款、消费数据）用的，APNs 后端会返 `InvalidProviderToken`。

### Q2：一个 .p8 Key 同时勾多个服务（APNs + Sign in with Apple + DeviceCheck）能用吗？

技术上可以，但**强烈不建议**。撤销时影响所有服务。最佳实践：一个 Key 一个 capability。

### Q3：sandbox 和 production 两套环境怎么共存？

iOS 端在 `register` 时把 `environment` 字段也传给 server（基于 build configuration）。Server 按设备的 environment 路由到不同 APNs 域名。已实现见本项目代码。

### Q4：能不能用证书（.cer/.p12）而不是 .p8？

可以，但是**老方案，不推荐**。证书一年到期需手动续期，且每个 App 需独立证书。.p8 Key 永不过期、可跨多个 App 用（同 Team 内）。

### Q5：推送了但手机没响？

排查顺序：
1. server 返回是不是 `delivered: true`？不是 → 看错误码表
2. iOS 端通知权限有没有给？设置 → 通知 → 你 App → 允许通知
3. iOS 端在前台时默认不弹 banner（要在 `userNotificationCenter:willPresent:` 里调用 `completionHandler([.banner, .sound])`）
4. 真机/模拟器？**模拟器收不到 APNs**

### Q6：App Store Server Notifications 的 webhook 和 APNs 是一回事吗？

**完全不是**。前者是 Apple → 你 server，后者是你 server → 用户手机。两者用不同的 Key、不同的 URL、不同的认证方式。详见第 0 节对照表。

---

## 10. 安全建议

- `APNs_AUTH_KEY` 视为机密，不要写进代码 / 不要 commit 到 git
- Railway/Vercel 的 env 已经加密存储，正常使用即可
- **不要在日志里打印完整 `authKey`**；调试时只打前 30 字符（用于诊断 PEM 头）
- 不要让 `show-jwt` / `push-config` 诊断端点对外暴露 —— 必须用 admin 角色保护（本指南实现已含 `JwtAuthGuard + AdminRoleGuard`）

---

## 附录 A：完整 env 示例

```bash
# Apple Developer Account Team ID（右上角 10 字符）
APNS_TEAM_ID=LWQAP563XV

# APNs Auth Key ID（.p8 文件名后 10 字符）
APNS_KEY_ID=R8X9YZ1234

# .p8 中间 base64 主体单行（约 200 字符）
APNS_AUTH_KEY=MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg2mHyGVLmbjnNLKhAqyUT0w8q2txWBvSFOJLN6wDImEigCgYIKoZIzj0DAQehRANCAARXbrYmNmxBoAXGDchuQGE/RT1NqPDqqFaZV0itjmOUPJiWxP8dK30qaPDDmaW4UwBE4glLtfwIqwrdLmgySajB

# iOS App Bundle ID
APNS_BUNDLE_ID=com.your.app

# 'production' 或 'sandbox'
APNS_ENV=production
```

---

## 附录 B：一图看懂"3 种 Push"

```
                    ┌──────────────────────┐
                    │  Apple                │
                    └───┬──────────────────┘
                        │
       ┌────────────────┼─────────────────────┐
       │① APNs Push     │② Server Noti V2     │③ Server API
       │ to device      │ Apple → 你 server   │ 你 server → Apple
       │                │ (订阅事件 webhook)  │ (主动查订阅)
       ▼                ▼                     ▲
   📱 用户手机       🖥️ 你 server         🖥️ 你 server
   (锁屏弹通知)      (收订阅事件)        (查订阅状态)

   认证：APNs       认证：Apple 用 JWS    认证：App Store
   Auth Key         自己签名，你只验签     Connect API Key +
                                          Issuer ID + JWT

   配置位置：       配置位置：             配置位置：
   developer        App Store Connect      App Store Connect
   .apple.com       → App 信息 → 通知 URL  → Users and Access
   → Keys → APNs                            → Integrations
```

**本指南只覆盖 ①**。② 见 `App-Store-Server-Notifications-配置.md`，③ 暂未接入。

---

## 附录 C：常用一行命令速查

```bash
# 提取 .p8 base64 主体（去头尾 + 单行）
cat ~/Downloads/AuthKey_XXXXX.p8 | grep -v PRIVATE | tr -d '\n'

# 诊断 push env
curl -s https://api.your.com/api/admin/diagnostics/push-config \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 看实际 JWT 头/payload
curl -s https://api.your.com/api/admin/diagnostics/show-jwt \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# admin 发测试推送
curl -X POST https://api.your.com/api/admin/push/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"audience":"user","targetUserId":"cm...","title":"测试","body":"hello"}'
```

---

## 变更记录

- 2026-06-01：首版，基于 IsItSafe / StarLensAI 实战经验提炼
