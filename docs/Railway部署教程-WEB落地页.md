# Railway 部署 WEB 落地页教程

本文档说明如何将 **WEB**（星识安全助手对外静态落地页）单独部署到 [Railway](https://railway.app)，与 Server、Admin 同级，作为对外宣传与下载入口。

---

## 一、WEB 是什么

- **位置**：项目根目录下 **`WEB`** 文件夹，与 `Server`、`admin`、`iOS` 同级。
- **内容**：纯静态页面，包含：
  - 应用名称、Logo、简介与描述
  - 应用市场下载按钮（链接可在 `WEB/config.js` 中配置；未配置时点击提示「市场正在审核中」）
- **技术**：HTML + CSS + JS，运行时用 Node 的 `serve` 包提供静态文件服务。

---

## 二、前置准备

1. **Railway 账号**  
   打开 [railway.app](https://railway.app)，登录。

2. **代码已推送到 GitHub**  
   确保仓库（如 `michaelzhao-collab/isitsafe-server`）中已包含 **`WEB`** 文件夹，且已 `git push` 到远程。

3. **WEB 目录结构**（供核对）：
   ```
   WEB/
   ├── index.html      # 落地页
   ├── terms.html      # 用户协议（通过 /terms 访问）
   ├── privacy.html    # 隐私政策（通过 /privacy 访问）
   ├── styles.css      # 样式
   ├── config.js       # 可配置：downloadUrl、appName、appSubtitle
   ├── package.json    # 启动脚本与 Node 版本
   ├── serve.json      # serve 重写：/terms → terms.html，/privacy → privacy.html
   └── assets/
       └── logo.png    # 应用 Logo
   ```

---

## 三、在 Railway 中新增 WEB 服务

### 3.1 进入已有项目（或新建项目）

- 若你已有部署 Server / Admin 的 Railway 项目，直接进入该项目。
- 若还没有项目：Railway 首页 → **New Project** → **Deploy from GitHub repo**，选择你的仓库（例如 `isitsafe-server`），先完成一次部署（可先指向任意目录），再按下面步骤把其中一个服务改成 WEB，或新增一个服务。

### 3.2 添加 WEB 服务

1. 在项目画布上点击 **「+ New」**（或 **Add service**）。
2. 选择 **「GitHub Repo」**（或 **Deploy from GitHub**），选中**同一仓库**（与 Server、Admin 相同的仓库）。
3. 选中后，Railway 会创建一个新服务（名称可能为仓库名或随机名）。

### 3.3 配置 WEB 服务

点击刚创建的服务卡片，进入该服务详情，在 **Settings** 中做如下配置：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Root Directory** | `WEB` | 构建与运行的根目录为 WEB 文件夹 |
| **Build Command** | （留空） | 静态页无需构建，可不填 |
| **Start Command** | `npx serve . -l $PORT` | 使用 `serve` 提供静态文件；同目录下 `serve.json` 会被自动读取，其中配置了 `/terms`→`terms.html`、`/privacy`→`privacy.html`，保证用户协议与隐私政策链接可访问 |
| **Watch Paths** | （可选）留空 | 不填则监听整个仓库；若只希望改 WEB 时重新部署，可填 `WEB` |

- **Variables**：一般无需配置环境变量；若将来在 `config.js` 中改为从环境变量读下载链接，可在此添加对应变量。

### 3.4 确认启动命令

- Railway 会为服务分配 **PORT**，因此必须使用 **`$PORT`**，不要写死端口。
- 使用 `serve.json` 做路径重写后，不再使用 `-s`（SPA 回退），否则 `/terms`、`/privacy` 会被回退到首页；当前配置下访问 https://你的域名/terms 与 /privacy 会正确打开协议页。
- 若未安装 `serve`，`npx serve` 会自动拉取并执行，无需在 `package.json` 的 `dependencies` 里写死（当前 `package.json` 仅通过 `npx serve` 使用即可）。

### 3.5 部署与查看

1. 保存设置后，Railway 会触发一次部署（若未自动部署，可点击 **Deploy** 或 **Redeploy**）。
2. 在 **Deployments** 中查看构建与运行日志，确认无报错。
3. 在服务详情页的 **Settings** → **Networking**（或 **Generate Domain**）中，点击 **Generate Domain**，得到类似 `xxx.up.railway.app` 的域名。
4. 浏览器访问该域名，应能看到星识安全助手落地页（Logo、名称、简介、下载按钮）；未配置下载链接时，点击按钮会提示「市场正在审核中」。

---

## 四、自定义域名（可选）

若希望使用自己的域名（例如 `www.starlensai.com` 或 `landing.starlensai.com`）：

1. 在 WEB 服务的 **Settings** → **Networking** → **Custom Domain** 中添加你的域名。
2. 按 Railway 提示在域名 DNS 处添加 **CNAME** 记录，指向 Railway 给出的目标（如 `xxx.up.railway.app`）。
3. 若使用根域名，部分平台需配置 A 记录或 CNAME 展平，按 Railway 文档操作即可。
4. 生效后，用该域名访问即可打开 WEB 落地页。

---

## 五、修改下载链接与文案

- **下载链接**：编辑 **`WEB/config.js`**，将 `downloadUrl` 改为应用市场地址（如 App Store / 应用宝链接）；留空则点击按钮时仍提示「市场正在审核中」。
- **应用名称 / 副标题**：同文件中的 `appName`、`appSubtitle` 可改。
- 修改后执行 `git add WEB/config.js`、`git commit`、`git push`，Railway 会自动重新部署 WEB 服务（若已配置从该仓库部署）。

---

## 六、与 Server、Admin 的关系

| 服务 | Root Directory | 说明 |
|------|----------------|------|
| Server | `Server` | NestJS API，需 PostgreSQL、Redis 等 |
| Admin | `admin` | 管理后台前端，构建后由静态服务器提供 |
| **WEB** | **`WEB`** | 对外落地页，纯静态，仅需 Node 运行 `serve` |

WEB 与 Server、Admin 互不依赖，可单独部署、单独配置域名，部署完成后在 **Deploy Logs** 中可查看该服务的运行日志（若有 `console.log` 也会出现在此处）。
