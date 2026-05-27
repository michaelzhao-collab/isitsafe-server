# Cloudflare Turnstile admin 登录验证接入指南

## 为什么用 Turnstile
- 替代 Google reCAPTCHA，**完全免费 + 不依赖 Google 服务**（国内可用）
- 隐私友好（不追踪用户行为）
- 用户体验好（多数时候自动通过，不弹拼图）

## 一、注册 Cloudflare Turnstile（你来操作，约 3 分钟）

1. 打开 https://dash.cloudflare.com → 左侧菜单选 **Turnstile**
2. 点 **Add site**
3. 填写：
   - **Site name**: `StarLens Admin`
   - **Domain**: `admin.starlensai.com`（或你 admin 后台部署的域名，**不能填 IP**）
   - **Widget Mode**: `Managed`（推荐，自动判定，多数情况无感）
   - 可选附加域名：本地开发可加 `localhost`
4. 提交后会拿到：
   - **Site Key**：前端用，公开可见（类似 `0x4AAAAAAAxxx`）
   - **Secret Key**：后端用，**严格保密**（类似 `0x4AAAAAAAxxx_secret`）

## 二、Server 端配置（Railway）

在 Railway → 你的 Server 服务 → Variables 加：

```env
TURNSTILE_SECRET=<刚才的 Secret Key>
```

部署后 Server 会在 admin 登录时自动校验 Turnstile token。

## 三、Admin 前端配置

### 本地开发
在 `admin/` 目录新建 `.env.local`（已被 .gitignore 排除）：
```env
VITE_TURNSTILE_SITE_KEY=<刚才的 Site Key>
```

### 线上部署
取决于你的部署平台：
- **Vercel/Cloudflare Pages**：在项目环境变量里加 `VITE_TURNSTILE_SITE_KEY`
- **Railway 静态站**：同上
- **Nginx 自部署**：build 前 `export VITE_TURNSTILE_SITE_KEY=xxx`，或写到 `.env` 后再 `npm run build`

> ⚠️ Vite 的 env 变量必须 `VITE_` 前缀且 build 时注入，**不是运行时**。改了 key 必须重新 build。

## 四、验证启用是否成功

1. 打开 admin 登录页
2. 你应该能看到 **安全验证** 区域显示一个 Cloudflare 小 widget（多数情况下自动打勾）
3. 点登录按钮：
   - 没勾或 token 失效 → 按钮置灰 / 报错"请先完成人机验证"
   - 通过 → 正常登录

## 五、未启用 / 跳过验证的兼容性

代码做了**双向 fail-open**：
- Server 没配 `TURNSTILE_SECRET` → 跳过校验（不阻塞老登录）
- Admin 没配 `VITE_TURNSTILE_SITE_KEY` → 不显示 widget，登录直通

**完全启用**需要两边都配。

## 六、常见问题

### Q: widget 一直转圈不出来
A: 检查 Cloudflare 控制台里 domain 是否包含当前访问的域名（含 localhost）

### Q: 登录后报"人机验证失败"
A: token 是一次性的，登录失败会自动 reset widget；如反复失败检查 Server 的 TURNSTILE_SECRET 是不是和 Cloudflare 后台一致

### Q: 想要更严格的模式（每次都强制弹验证）
A: Cloudflare 后台改 Widget Mode 为 `Invisible` 或 `Non-interactive`

### Q: 沙箱测试 Site Key
A: Cloudflare 提供测试 key：
- Site Key: `1x00000000000000000000AA`（永远通过）
- Secret: `1x0000000000000000000000000000000AA`
本地开发可用，避免每次真实校验。

## 七、安全注意事项
- Secret Key 绝对不要 commit 到 git
- 如果泄露：Cloudflare 后台可以 rotate secret
- 单台机器登录失败次数仍建议加 IP 限流（本次未做，Server 端的暴力破解防御依赖 Turnstile + 后续可加 redis 计数）
