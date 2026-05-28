# Cloudflare Access：admin 后台邮箱验证保护

## 你想要的效果
打开 `admin.starlensai.com` → **自动跳转 Cloudflare 邮箱验证页** → 输入邮箱 → 收 6 位 PIN → 输入 PIN → 进 admin 后台

跟你之前看到的截图（`altimetercompass-pages.cloudflareaccess.com/cdn-cgi/access/login/admin.lumenmo.com`）一样的体验。

**关键**：这是 Cloudflare 网关层验证，**完全不需要改代码**，只在 Cloudflare 控制台配置。我之前误加的应用层 Turnstile 是不同的东西，已保留为可选（不强制）。

---

## 前置条件

- ✅ admin 后台域名（比如 `admin.starlensai.com`）DNS **必须在 Cloudflare**
  - 如果还没接入 Cloudflare：先到 dash.cloudflare.com → Add a Site → 按提示把 NS 指向 Cloudflare
  - 接入后等几分钟生效
- ✅ Cloudflare Zero Trust 已开通（免费 50 个 user，标准 admin 完全够用）
  - dash.cloudflare.com → 左侧 Zero Trust（首次进会让你创建 team domain，例如 `starlens.cloudflareaccess.com`）

---

## 5 分钟配置步骤

### 1. 进入 Zero Trust 控制台
- dash.cloudflare.com → 左侧 **Zero Trust** → 进入 Zero Trust dashboard

### 2. 添加 Access Application
- 左侧 **Access → Applications** → **Add an application**
- 选 **Self-hosted**
- 填写：
  - **Application name**: `StarLens Admin`
  - **Session Duration**: `24 hours`（建议，过期再验）
  - **Application Domain**:
    - Subdomain: `admin`
    - Domain: `starlensai.com`
    - Path: 留空（保护整个站点）
  - 其他默认 → **Next**

### 3. 配置 Identity Providers（身份验证方式）
- 默认有 **One-time PIN**（邮箱 OTP）— 这就是你截图里看到的"输入邮箱收 PIN"
- 也可以加 Google / GitHub / Microsoft / Apple ID 等 SSO
- 推荐：**只勾 One-time PIN** —— 最简单，对管理员够用
- → **Next**

### 4. 配置 Policy（谁能访问）
- Policy name: `Allow Admins`
- Action: `Allow`
- 选 Rules：
  - **方案 A（最简单，推荐）**：
    - Include → **Emails** → 输入允许的邮箱（按回车多个）
      - `moco202366@gmail.com`
      - `（你团队其他成员的邮箱）`
  - **方案 B（按域名放行）**：
    - Include → **Emails ending in** → `@starlensai.com`（如果你团队用公司邮箱）
- → **Next**

### 5. 跳过其他选项 → **Add application**

### 6. 完成
等 1-2 分钟生效，然后打开 `admin.starlensai.com`：
- 自动跳到 `starlens.cloudflareaccess.com/cdn-cgi/access/login/...`
- 输入允许的邮箱
- 收到 6 位 PIN（邮件标题 `Your Cloudflare login code`）
- 输入 PIN → 进 admin

后续 24 小时内不再要求验证（session 时长可调）。

---

## 工作原理

```
你访问 admin.starlensai.com
   │
   ▼
Cloudflare 边缘检查：有没有 cf-access-jwt-assertion cookie?
   │
   ├─ 没有 / 已过期 → 跳到 cloudflareaccess.com 验证页
   │   ├─ 输入邮箱 → CF 发 PIN
   │   ├─ 输入 PIN 通过
   │   └─ CF 在浏览器设 cf-access-jwt cookie + 跳回 admin
   │
   └─ 有效 cookie → 通过，请求才到达你的 admin 服务器
```

你的 admin server 端**完全不知道这层验证存在**，因为 CF 边缘就拦截了。CF 还会在转发到你 server 时加 header：
- `CF-Access-Authenticated-User-Email`：通过验证的邮箱
- `CF-Access-Jwt-Assertion`：完整 JWT（可二次校验）

---

## 高级（可选）：让 Server 端信任 CF Access

如果你想直接用 CF 的邮箱身份登录（**砍掉 admin 后台的用户名密码**），可在 jwt-auth.guard 加：
1. 检查 `CF-Access-Authenticated-User-Email` header
2. 反查 admin 表：邮箱匹配的话直接发 JWT

本次未做这层（保留 admin 用户名密码登录作为双层保护：先 CF Access，再后端账密）。

---

## 常见问题

### Q1: 我没把域名挂在 Cloudflare 怎么办？
A: 必须先挂。Cloudflare Access 只能保护通过 Cloudflare 解析的域名。挂法：
- Cloudflare → Add Site → 输入 `starlensai.com` → 选免费 plan
- 按提示在你域名注册商把 NS 改成 Cloudflare 给的两个
- 等 NS 生效（最快 5 分钟）

### Q2: Railway 后端怎么跟 Cloudflare 集成？
A: 你的 Server (`api.starlensai.com`) 也建议挂 Cloudflare，但**不要给 Server 加 Access**（iOS 客户端拿不到 CF cookie）。只给 `admin.starlensai.com` 加 Access。

### Q3: 我现在没接入 Cloudflare，能临时用其他方案吗？
A: 短期方案：用 admin server 用户名密码 + 我刚加的 Turnstile（widget 防爆破）。等域名接入 Cloudflare 后再启用 Access。

### Q4: 担心 Cloudflare 服务挂了怎么办？
A: 可以在 Zero Trust → Settings → Authentication 配 **bypass policy** 应急；或在 admin server 保留密码登录作为兜底（本次未删，仍可用）。

### Q5: 是否影响 iOS 客户端访问？
A: **完全不影响**。CF Access 只保护 `admin.starlensai.com`，iOS 走的是 `api.starlensai.com`，是不同 subdomain。
