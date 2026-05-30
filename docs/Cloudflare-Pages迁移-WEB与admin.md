# WEB + admin 从 Railway 迁移到 Cloudflare Pages

> **目标**：把静态落地页 `WEB/` 与 React SPA `admin/` 从 Railway 迁到 Cloudflare Pages，全程零宕机，老用户无感。
> **保留**：`Server/`（NestJS API）继续留在 Railway，它不能跑在 Pages 上。

---

## 0. 为什么 admin / WEB 适合迁，Server 不能迁

| 项 | 是否能迁到 Cloudflare Pages | 原因 |
|---|---|---|
| **WEB/** | ✅ 直接迁 | 纯静态 HTML/CSS/JS，Pages 天生干这个 |
| **admin/** | ✅ 直接迁 | Vite + React SPA，build 出 `dist/`，Pages 直接服务静态文件 |
| **Server/** | ❌ 不要迁 | NestJS 长连接 + Prisma + BullMQ + Redis + HTTP/2 APNs，需要常驻 Node 进程；Pages Functions / Workers 跑不了原样 |

**关键事实**：你 DNS 已经在 Cloudflare（`docs/Cloudflare-Access-Admin登录保护.md` 印证了），所以"切流量"等于改一行 CNAME，Cloudflare 自己签证书。

---

## 1. 迁移总策略（保证零影响）

每个站点都走"**先并存，再切流量**"的双轨：

```
┌────────────────────────────────────────────────────────────────┐
│ 阶段 A   Railway 仍服务线上流量      Pages 部署 + preview 测试     │
│         admin.starlensai.com         isitsafe-admin.pages.dev  │
├────────────────────────────────────────────────────────────────┤
│ 阶段 B   Pages 加 Custom Domain，DNS CNAME 改指向 Pages         │
│         切流量 = 一行 DNS 改动，30s 内 propagate              │
├────────────────────────────────────────────────────────────────┤
│ 阶段 C   观察 24-48h，确认无问题，Railway 服务下线            │
└────────────────────────────────────────────────────────────────┘
```

**为什么用户无感**：
- DNS 切换是同一个域名（`admin.starlensai.com` 不变），用户的书签、Cookie、Cloudflare Access 配置全部继续生效
- CF Pages 部署后，自动配置 HTTPS（用 Universal SSL，分钟级别签）
- Cookie domain 是 `.starlensai.com`，与底层服务实现无关

---

## 2. 迁移 admin（先做这个，风险更小因为是内部使用）

### 2.1 准备工作（已经做了）

我已经在仓库里创建了：

```
admin/public/_redirects     # SPA 回退：/* -> /index.html 200
```

这是 Cloudflare Pages 的 SPA fallback 约定，等价于 Railway 时 `serve` 默认的"找不到就回退 index.html"。React Router 的深层路径（如 `/intel/abc/edit`）刷新时必须靠这个，否则 404。

### 2.2 在 Cloudflare Dashboard 创建项目

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选你这个 repo（如果还没授权，CF 会让你装 GitHub App）
3. 配置：
   - **Project name**：`isitsafe-admin`
   - **Production branch**：`main`
   - **Build command**：`cd admin && npm ci && npm run build`
   - **Build output directory**：`admin/dist`
   - **Root directory**：留空（保持仓库根，这样 build 命令的 `cd admin` 才正确）
4. **Environment variables**（重要）：
   - `VITE_API_BASE_URL` = `https://api.starlensai.com/api`
     - 这必须是 Server 在 Railway 上的真实公网地址
     - **build-time** 变量，改了要 redeploy 才生效
5. 点 **Save and Deploy**

第一次 build 大概 2-3 分钟。完成后会给你一个 `*.pages.dev` 域名，例如 `isitsafe-admin.pages.dev`。

### 2.3 在 preview 域名上测试

⚠️ **注意 Cloudflare Access**：你现在 `admin.starlensai.com` 上有 Access 邮箱验证保护。**Access 是绑在 hostname 上的，preview 域名 `*.pages.dev` 不受 Access 保护**。这意味着 preview 测试时直接打开网页就能进登录页（admin 用户名密码登录会照常工作，因为 Server 仍在线）。

测试清单：
- [ ] 登录页打开（GET `/login` 不 404）
- [ ] 输入 admin 账密 + Turnstile，能登录进 dashboard
- [ ] 刷新一个深层路径（如 `/intel`）不 404
- [ ] 一个 API 操作（如查家庭组列表）能正常返回数据
- [ ] 浏览器 Network 看 API 调用真实打到 `api.starlensai.com`（不是 localhost / Railway 老地址）

### 2.4 加 Custom Domain + 切 DNS

1. CF Pages 项目 → **Custom domains** → **Set up a custom domain** → `admin.starlensai.com`
2. CF 会自动检测：因为 DNS 已经在 CF，它会问你"要不要把原有的 CNAME / A 记录改成指向 Pages？" → 点确认
3. CF 自动签证书（1-2 分钟），Universal SSL 自动生效
4. **此时流量自动切完**：访问 `admin.starlensai.com` 会从 Railway 切到 Pages
5. Cloudflare Access 配置不需要动，继续保护这个 hostname

**回滚方法（万一）**：CF DNS 把这条记录改回原来的 Railway CNAME（建议先记下 Railway 的 `*.up.railway.app` 域名）。

### 2.5 观察 24-48h 后下线 Railway

- 看 Cloudflare Pages 的 **Analytics** → 请求数 / 错误率
- 看 Server 端日志 admin 接口调用是否正常
- 没问题就去 Railway 删 admin service（项目下右上角 → Settings → Delete）

---

## 3. 迁移 WEB（同样套路）

### 3.1 准备（已经做了）

```
WEB/_redirects
```
内容是：
```
/terms     /terms.html     200
/privacy   /privacy.html   200
```
等价于 Railway 时代 `WEB/serve.json` 的 rewrites。

### 3.2 Pages 项目配置

不一样的地方：**WEB 是纯静态没 build 步骤**。

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git
2. 选同一 repo
3. 配置：
   - **Project name**：`isitsafe-web`
   - **Production branch**：`main`
   - **Build command**：（留空）
   - **Build output directory**：`WEB`
   - **Root directory**：留空
4. 不需要环境变量
5. Save and Deploy

### 3.3 preview 测试

- [ ] 首页能加载，图片/CSS 正常
- [ ] `/terms` 和 `/privacy` 短链能正常跳到对应页（这个验证 `_redirects` 生效）
- [ ] `config.js` 里的 appStoreUrl / contactEmail 等显示正确

### 3.4 Custom Domain + 切 DNS

跟 admin 一样。WEB 当前是哪个域名（`www.starlensai.com` / `starlensai.com` / 别的？）就 add 哪个 custom domain。Pages 接管后 CF 自动签证。

---

## 4. CORS / 跨域是否要改

**Server CORS 配置**：检查 `Server/src/main.ts` 或 `app.module.ts` 里的 CORS 设置。

```ts
// 比如这样
app.enableCors({
  origin: ['https://admin.starlensai.com', 'https://starlensai.com', ...]
});
```

✅ **如果 origin 白名单是写死的域名**（如上）：**不用改**。因为 Pages 切流量后访问者看到的还是 `admin.starlensai.com`。

⚠️ **如果你想在 preview 阶段（`*.pages.dev`）也测 API 调用**：要么临时加 `*.pages.dev` 到 origin 白名单，要么直接到了 custom domain 阶段再测。**推荐后者**，省事。

---

## 5. 监控 + 回滚

### Pages 内置 Analytics
CF Pages 控制台 → Analytics 看：
- Total requests
- 4xx / 5xx 错误率
- Top URLs

### 紧急回滚（流量已切到 Pages 但发现问题）
- CF DNS 控制台 → 找 `admin` 那条 CNAME → 改回 Railway 的 `*.up.railway.app` 地址
- 1-2 分钟生效，用户重连即可
- **前提**：Railway 服务还没删

### Cloudflare Access 异常排查
如果切到 Pages 后 Access 不弹邮箱验证页：
- 检查 Zero Trust → Access → Applications 里 `admin.starlensai.com` 的 application 是否还存在
- Pages 切换不会破坏 Access 配置，但偶尔需要重启 Cloudflare 边缘缓存（强制刷新或换个浏览器试）

---

## 6. 别忘了的 cleanup

迁移成功 7 天后：
- [ ] Railway 上的 `admin` / `WEB` 服务下线
- [ ] `admin/package.json` 里的 `serve` 依赖可以删（CF Pages 不需要）
- [ ] `WEB/package.json` 里的 `start` script 和 `serve.json` 留着也没事，但已经没人用
- [ ] `docs/Railway部署教程-Admin*.md` / `docs/Railway部署教程-WEB落地页.md` 可以标 deprecated 或删除
- [ ] CF 同站可以加一些有用的免费能力：
  - WAF（防恶意请求）
  - Bot Fight Mode（admin 域名建议开）
  - Page Rules / Transform Rules（如果有定制重定向）

---

## 7. 顺手能拿到的好处

| 项 | Railway | Cloudflare Pages |
|---|---|---|
| 月成本 | $5+ per service | 免费（500 builds/月，无限带宽） |
| 冷启动 | 有（serve 进程） | 无（边缘 CDN） |
| 全球延迟 | 单点 US-West | 全球 300+ POP |
| HTTPS 证书 | Railway 给 | CF Universal SSL 自动 |
| 回滚 | 重新 deploy | 一键回滚到任意旧版本 |
| 灰度 / preview | 没 | 每条 PR / 分支自动 preview URL |

每次 push 到 `main` 都会自动 redeploy。每条 PR / 分支也都会有独立的 preview URL，可以用来给团队 review。

---

## 8. 总结操作清单

按这个顺序做，全程不影响线上：

1. ✅ 仓库已加 `admin/public/_redirects` 和 `WEB/_redirects`（**这就是 git 已经在的改动**）
2. ☐ Cloudflare Dashboard 建 `isitsafe-admin` Pages 项目，build = `cd admin && npm ci && npm run build`，output = `admin/dist`
3. ☐ 设环境变量 `VITE_API_BASE_URL=https://api.starlensai.com/api`
4. ☐ 在 `*.pages.dev` preview 上验证 admin 完整可用
5. ☐ Custom Domain 加 `admin.starlensai.com` → DNS 自动切到 Pages
6. ☐ 观察 1-2 天，确认 OK 后 Railway 上的 admin service 删除
7. ☐ 重复 2-6 步给 WEB（output = `WEB`，无 build command）
8. ☐ 后续：Server 继续留 Railway，只是 API 调用方从 admin / WEB 改成走 Pages 边缘

整个过程对**普通用户、admin 用户、Cloudflare Access 配置都零影响**。
