# IsItSafe 部署到 Railway 详细教程

本文档说明如何将 **Server（NestJS + Prisma + Redis）** 与 **Admin（React + Vite）** 部署到 [Railway](https://railway.app)，使所有 API 与管理后台正常可用。前面为 **Railway 部署的完整步骤**（精确到每一步），**本地部署与自检**放在文档最后附录。

---

## 零、用命令行把整个文件夹上传到 GitHub

GitHub 网页不能拖拽上传整个文件夹，需要用 **命令行** 把本地项目（含 `Server`、`admin` 等）推上去。按下面步骤在**项目根目录**（能看到 `Server`、`admin` 文件夹的那一层）操作。

### 0.1 前提

- 本机已安装 **Git**（[下载](https://git-scm.com/)）。终端执行 `git --version` 能输出版本即表示已安装。
- 在 GitHub 上已建好仓库 **michaelzhao-collab/isitsafe-server**（可先建空仓库，不要勾选 “Add a README” 等，避免首次 push 冲突）。

### 0.2 首次上传整个项目

在终端中进入你的项目根目录（例如 `cd /Users/你的用户名/Documents/IsItSafe`），然后依次执行：

```bash
# 若当前目录还没有 Git 仓库，先初始化
git init

# 添加远程仓库（若已存在 origin 可跳过或先 git remote remove origin 再添加）
git remote add origin https://github.com/michaelzhao-collab/isitsafe-server.git

# 添加要上传的文件（添加全部：当前目录下所有变更，含 Server、admin 等）
git add .

# 若只想上传 Server 和 admin 两个文件夹，可改为：
# git add Server admin

# 提交（引号里可改成你的说明）
git commit -m "Initial commit: Server and Admin"

# 确保主分支名为 main（若已是 main 可跳过）
git branch -M main

# 推送到 GitHub（首次用 -u 关联上游分支）
git push -u origin main
```

执行过程中若提示输入账号密码，**用户名**填你的 GitHub 用户名，**密码**填 **Personal Access Token**（在 GitHub → Settings → Developer settings → Personal access tokens 里生成），不要用登录密码。

### 0.3 之后有改动，再次上传

改完代码后，在**同一项目根目录**执行：

```bash
git add .
git commit -m "你的提交说明"
git push
```

若远程已有别人或别处推送的提交，先执行 `git pull --rebase origin main` 再 `git push`，避免冲突。

### 0.4 建议：忽略不需要上传的目录

在项目根目录放一个 **`.gitignore`** 文件，避免把 `node_modules`、`.env` 等推上去。例如内容可包含：

```gitignore
node_modules/
.env
.env.local
dist/
*.log
.DS_Store
```

这样 `git add .` 时会自动忽略这些，只上传代码和必要配置。

---

## 一、前置准备

1. **Railway 账号**  
   打开 [railway.app](https://railway.app)，注册并登录。

2. **代码仓库**  
   将 **Server** 和 **admin** 推送到 GitHub 仓库 **`michaelzhao-collab/isitsafe-server`**（完整地址：`https://github.com/michaelzhao-collab/isitsafe-server`）。  
   - 仓库内需包含 **`Server`**、**`admin`** 两个文件夹（名称与大小写一致）。  
   - 可不推送 `iOS` 文件夹，Railway 只根据配置的根目录（`Server`、`admin`）构建。

---

## 二、在 Railway 创建项目并添加数据库

**流程总览（一共只有 4 个服务）**

| 顺序 | 服务       | 怎么来 |
|------|------------|--------|
| 1    | PostgreSQL | + New → Database → PostgreSQL |
| 2    | Redis      | + New → Database → Redis |
| 3    | Server     | + New → GitHub Repo → 选 isitsafe-server，再设 Root Directory = `Server`（若 2.1 选了「从 GitHub 部署」则已有一个服务，直接把它配成 Server，不用再 + New） |
| 4    | Admin      | 再 + New → GitHub Repo → 选同一仓库，设 Root Directory = `admin` |

**不要**从 GitHub 添加第三次：应用服务只有 **Server** 和 **Admin** 这两个。

### 2.1 新建项目（第 1～4 步）

1. 登录 Railway 后，在首页或项目列表页点击 **「New Project」**（或 **「Create new project」**）。
2. 在弹窗中选择 **「Empty Project」**（空项目），先不要选「Deploy from GitHub repo」。  
   - 这样项目里暂时没有服务，后面我们按顺序添加：先加数据库，再加 Server，再加 Admin，避免多出一个未配置的「第一个服务」。
3. 若你**已经**用了「Deploy from GitHub repo」并生成了一个服务，也没关系：那个服务就当作 **Server**，在「三」里直接进入该服务，设 Root Directory = **`Server`** 并按 3.2～3.5 配置即可，**不用再点 + New 添加一个 Server**。
4. 若首次使用 Railway，需在添加 GitHub 仓库时按提示 **授权 Railway 访问你的 GitHub**（在「三」或「四」里添加服务时会用到）。

### 2.2 添加 PostgreSQL（第 5～8 步）

5. 进入项目后，在画布（Project Canvas）上点击 **「+ New」**（或 **「Add service」**），或使用快捷键 **Ctrl+K**（Windows）/ **Cmd+K**（Mac）打开菜单。
6. 在菜单中选择 **「Database」**，再选 **「PostgreSQL」**（或 **「Add PostgreSQL」**）。
7. 等待 PostgreSQL 服务部署完成（状态变为 Running / 绿色）。
8. 点击该 **PostgreSQL** 服务卡片 → 进入服务详情 → 打开 **「Variables」** 标签页，确认能看到 **`DATABASE_URL`**（以及可能有的 `PGHOST`、`PGPORT` 等）。记下变量名是 **`DATABASE_URL`**，后面给 Server 用。

### 2.3 添加 Redis（第 9～12 步）

9. 回到项目画布，再次点击 **「+ New」**。
10. 选择 **「Database」** → **「Redis」**。若列表里没有 Redis，可在 **「Templates」** 或搜索框搜 **Redis** 后添加。
11. 等待 Redis 服务部署完成。
12. 点击该 **Redis** 服务 → **「Variables」**，确认有 **`REDIS_URL`** 或 **`REDIS_PRIVATE_URL`**（不同模板可能不同）。后面以 **`REDIS_URL`** 为例；若你的模板是 `REDIS_PRIVATE_URL`，则 Server 变量里用同名即可。

### 2.4 小结

此时项目里应有 **2 个服务**：**PostgreSQL**、**Redis**。接下来只再添加 **2 个应用服务**：一个配成 **Server**，一个配成 **Admin**（都是从同一仓库用 Root Directory 区分），**一共 4 个服务**。

---

## 三、部署 Server（NestJS API）

### 3.1 添加并配置 Server 服务（第 13～18 步）

- **若你在 2.1 选了「Empty Project」**：在项目画布上点击 **「+ New」** → 选择 **「GitHub Repo」** → 选 **`michaelzhao-collab/isitsafe-server`**，确认添加。会多出**一个**服务，这个就是 **Server**，下面进入该服务配置。
- **若你在 2.1 选了「Deploy from GitHub repo」**：项目里已经有一个连了仓库的服务，**不用再 + New**，直接点进**那个服务**，把它当成 Server 按下面步骤配置即可。

13. 进入要作为 **Server** 的那个服务（名称可能是仓库名或随机名）。
14. 在左侧或顶部找到 **「Settings」**，点击进入设置页。
15. 打开 **「Source」** 页（Settings 左侧或顶部）：  
16. **已连接仓库**：应显示 **`michaelzhao-collab/isitsafe-server`**（若还没有，在 Source 里连接该仓库）。  
17. **Root Directory**：点 **「Add Root Directory」** 或输入框，填写 **`Server`**（与仓库里文件夹名一致）。表示构建和部署都以该子目录为根。  
18. **Branch connected to production**：确认为 **`main`**（或你实际推送的分支）。**Wait for CI**（可选）：若仓库里配置了 GitHub Actions，可开启。

### 3.2 设置 Server 的构建与启动命令（第 19～22 步）

19. 在 Settings 里打开 **「Build」** 页：  
    - **Builder**：一般为 Railpack、node 版本自动检测，**无需改**。  
    - **Metal Build Environment**：可选，开启可加速构建，**可不配置**。  
    - **Custom Build Command**：点击 **「+ Build Command」**（或展开输入框），填入：**`npm ci && npx prisma generate && npm run build`**（若已有默认值请替换）。  
    - **Watch Paths**：点击 **「Add pattern」** 或输入框旁下拉，填入 **`Server/**`**，表示只有 **Server** 目录有变更时才触发该服务重新部署（避免改 admin 时也触发 Server 部署）。
20. 在 Settings 中打开 **「Deploy」** 页（该页有 Custom Start Command、Teardown、Cron Schedule、Healthcheck Path、Serverless、Restart Policy 等）。
21. **「Custom Start Command」**（启动命令）：  
    - 若框里默认是 **`node server.js`**，请**删掉并改为**：**`npx prisma migrate deploy && node dist/main.js`**。  
    - 我们的项目入口是 `dist/main.js`，不是 `server.js`；前面先执行数据库迁移再启动服务。
22. **「Healthcheck Path」**（可选但建议）：点击 **「+ Healthcheck Path」**，填入 **`/api/health`**。  
    - 这样部署完成后 Railway 会请求该地址，确认服务已正常再切换流量，部署失败时会自动回滚。
23. **「Restart Policy」**：保持默认 **「On Failure」** 即可（进程非正常退出时自动重启容器）。
24. 保存设置（无保存按钮则一般为自动保存）。

### 3.3 为 Server 配置环境变量（第 26～35 步）

26. 在该 Server 服务内，切换到 **「Variables」** 标签页。
27. **引用 PostgreSQL 的 DATABASE_URL**：  
    - 点击 **「+ New Variable」** 或 **「Add Reference」** / **「Reference Variable」**。  
    - 若出现「引用其他服务的变量」选项：选择 **「Reference」**，在「服务」下拉框选 **PostgreSQL**，在「变量」下拉框选 **`DATABASE_URL`**，本地变量名保持 **`DATABASE_URL`**，确认添加。  
    - 若没有引用入口：打开 **PostgreSQL** 服务的 **Variables**，复制 `DATABASE_URL` 的值，回到 Server 的 Variables，新建变量，名 **`DATABASE_URL`**，值粘贴刚才复制的连接串，保存。
28. **引用 Redis 的 REDIS_URL**：  
    - 同样用 **「Add Reference」**：服务选 **Redis**，变量选 **`REDIS_URL`**（或你模板里的 Redis 连接变量名），本地变量名保持 **`REDIS_URL`**。  
    - 或从 Redis 服务复制连接串，在 Server 里新建变量 **`REDIS_URL`** 并粘贴。
29. 添加 **JWT 相关变量**（必填）：  
    - **`JWT_SECRET`**、**`JWT_REFRESH_SECRET`**：不是从别处「获取」的，需要自己**生成随机字符串**（生产环境建议 32 位以上，且两个值不要相同）。生成方式见下方「JWT 密钥如何生成」。  
    - **`JWT_EXPIRES_IN`**：Access Token 有效期，直接填 **`7d`**（表示 7 天），也可填 `24h`、`30m` 等。  
    - **`JWT_REFRESH_EXPIRES_IN`**：Refresh Token 有效期，直接填 **`30d`**（表示 30 天）。  
    在 Server 的 Variables 里点 **「+ New Variable」**，逐个添加以上变量名和值并保存。
30. **PORT**：若 Railway 未自动注入，则手动添加 **`PORT`**，值 **`3000`**（多数情况 Railway 会自动注入，可先不填，若启动报错再补）。
31. （可选）若使用 **豆包 AI**：添加 **`AI_PROVIDER`** = **`doubao`**，以及 **`DOUBAO_API_KEY`**、**`DOUBAO_API_URL`**、**`DOUBAO_MODEL`**（按你实际配置）。
32. （可选）若使用 **OpenAI**：添加 **`AI_PROVIDER`** = **`openai`** 以及 **`OPENAI_API_KEY`** 等。
33. （可选）若使用 **阿里云 OSS**：添加 **`OSS_REGION`**、**`OSS_BUCKET`**、**`OSS_ACCESS_KEY_ID`**、**`OSS_ACCESS_KEY_SECRET`**、**`CDN_DOMAIN`**。
34. 确认 **Variables** 列表中至少包含：**`DATABASE_URL`**、**`REDIS_URL`**、**`JWT_SECRET`**、**`JWT_REFRESH_SECRET`**、**`JWT_EXPIRES_IN`**、**`JWT_REFRESH_EXPIRES_IN`**。
35. 保存所有变量（若有保存按钮）。

**JWT 密钥（JWT_SECRET / JWT_REFRESH_SECRET）如何生成**  
这两个值不是从网站或后台「获取」的，需要自己生成一长串随机字符，且两个值要不同。任选一种方式即可：

- **方式一（推荐，终端）**：在 Mac / Linux 终端执行两次，得到两个不同的字符串，分别用作 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`：  
  `openssl rand -base64 32`
- **方式二（Node）**：在终端执行  
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`  
  同样执行两次，得到两个值。
- **方式三**：用任意「随机密码生成器」生成 32 位以上随机字符串（可含大小写字母、数字），生成两个不同的，分别填进去。

**有效期（JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN）**  
直接填固定写法即可，不用生成：`JWT_EXPIRES_IN` = **`7d`**，`JWT_REFRESH_EXPIRES_IN` = **`30d`**。

### 3.4 为 Server 生成公网域名（第 36～39 步）

36. 在 Server 服务内，打开 **「Settings」** → **「Networking」**（该页有 **Public Networking** 公网域名、**Private Networking** 同项目内服务互通）。
37. **按自己域名部署**：在 **Public Networking** 下点击 **「Custom Domain」**（或 **「Add domain」** → **Custom**），按下面「3.4.1 绑定自定义域名（Server）」完成绑定。**API 根地址** 即为 **`https://api.你的网站.com/api`**（将 `api.你的网站.com` 换成你实际绑定的 Server 域名）。  
    **若暂不用自己域名**：可先点击 **「Generate Domain」** 生成系统默认域名（形如 `xxx.up.railway.app`），API 根地址为 **`https://该默认域名/api`**。
38. 把 **API 根地址** 保存到记事本，后面配置 Admin 的 **`VITE_API_BASE_URL`** 要用。

**3.4.1 绑定自定义域名（Server，不用系统默认域名时）**

1. 在 Server 服务的 **Settings** → **Networking** → **Public Networking** 下，点击 **「Custom Domain」**（或 **「Add domain」** → **Custom**）。
2. 输入你要用的域名，例如 **`api.你的网站.com`**（不要带 `https://` 或路径）。
3. **「Enter the port your app is listening on」**：填 Server 实际监听的端口。若 NestJS 使用 `process.env.PORT` 且未在 Variables 里覆盖，Railway 一般会注入 **3000** 或 **8080**，这里填与之一致即可（例如 **3000** 或界面预填的 **8080**）；若在 Variables 里设了 **PORT**，则填该值。
4. Railway 会显示 **DNS 配置说明**：通常要求添加一条 **CNAME** 记录：
   - **主机/名称**：填子域名部分（如 `api`，或按提示填 `api.你的网站.com` 对应的主机名）。
   - **目标/值**：Railway 会给出，形如 **`xxx.up.railway.app`**（即该服务当前的默认域名），原样复制。
   - 若提示用 **A 记录**，则按页面上显示的 IP 填写。
5. 到你的**域名服务商**（阿里云、腾讯云、Cloudflare、GoDaddy 等）的 DNS 管理里，新增上述 CNAME（或 A）记录，保存。
6. 等待 **DNS 生效**（几分钟到几十分钟不等）。在 Railway 的 Custom Domain 处可查看状态，显示为 **Verified** 或绿勾即表示生效。
7. Railway 会为该自定义域名自动配置 **HTTPS**，无需再单独申请证书。
8. **API 根地址** 即为：**`https://api.你的网站.com/api`**（用你填的自定义域名）。后面 Admin 的 **`VITE_API_BASE_URL`**、健康检查、访问接口均用该地址。

### 3.5 触发部署并检查 Server（第 40～43 步）

40. 若未自动部署，在 Server 服务页点击 **「Deploy」** 或 **「Redeploy」**，等待构建与部署完成。
41. 在 **「Deployments」** 中点击最新一次部署，查看 **「Logs」**，确认无报错（若有报错，常见为缺 `DATABASE_URL` / `REDIS_URL` 或 Prisma 迁移失败，回到 3.3 检查变量）。
42. 在浏览器中访问你的 **Server 地址** + **`/api/health`**。  
    - **按自己域名**：**`https://api.你的网站.com/api/health`**。  
    - 若用系统默认域名：**`https://<Railway 给的默认域名>/api/health`**。  
    应看到类似 **`{"status":"ok"}`** 的 JSON，表示 Server 已正常对外服务。
43. 若健康检查失败，根据 Logs 中的报错修正环境变量或迁移后再部署一次。

---

## 四、部署 Admin（React 管理后台）

### 4.1 从 GitHub 添加 Admin 服务（第 41～45 步）

41. 回到项目画布，再次点击 **「+ New」**。
42. 选择 **「GitHub Repo」**，仍选择 **`michaelzhao-collab/isitsafe-server`**（isitsafe-server）仓库，添加。
43. 会**再**多出**一个**服务（这是第二个、也是最后一个从仓库来的应用服务），点击进入该服务。
44. 打开 **「Settings」** → **「Source」**：点 **「Add Root Directory」** 或在该页填 Root Directory 为 **`admin`**（**不要**写成 **`/admin`**，不要前导斜杠；若仓库里是 **`Admin`** 则填 **`Admin`**）；确认 **Branch connected to production** 为 **`main`**（或你推送的分支）。
45. 保存。至此项目里共 **4 个服务**：PostgreSQL、Redis、Server、Admin。

### 4.2 设置 Admin 的构建与输出（第 46～50 步）

46. 打开 **「Build」** 页：**Custom Build Command** 填 **`npm install && npm run build`**（Railway 构建缓存可能导致 `node_modules/.vite` 被锁定，用 `npm install` 替代 `npm ci` 可避免 EBUSY；且需在 admin 的 vite.config 中设置 `cacheDir: '.vite'` 将缓存移出 node_modules）；**Watch Paths** 点 **「Add pattern」** 填 **`admin/**`**（或 **`Admin/**`**），仅 admin 目录变更时触发该服务部署。
47. **Admin 是静态站（Vite 构建出 dist）**：Railway 官方文档里**没有**「Output Directory」/「Publish directory」配置项，需要用 **Start Command** 启动一个进程来提供 `dist` 目录。
48. 打开 **「Deploy」** 页，找到 **「Custom Start Command」**（或 **Start Command**），填入：  
    **`npx serve dist -s -l $PORT`**  
    （`-s` 单页应用回退，`-l` 不写访问日志，`$PORT` 使用 Railway 注入的端口。）
49. 在 **admin** 项目的 **package.json** 的 **dependencies** 里需有 **`serve`**，部署时才会能执行 `npx serve`。  
    若还没有：在本地 `admin` 目录执行 **`npm install serve`**，提交并推送 **package.json**、**package-lock.json**；若本教程已为你在 `admin/package.json` 中加入了 `serve`，只需正常提交推送即可。
50. 保存 Railway 上的设置。无需再找「Output Directory」。

### 4.3 配置 Admin 的 API 地址（第 51～53 步）

51. 在该 Admin 服务内，打开 **「Variables」** 标签页。
52. 点击 **「+ New Variable」**，变量名：**`VITE_API_BASE_URL`**，值：**你在 3.4 步保存的 API 根地址**（不要末尾多加 `/`）。  
    - **按自己域名部署时**：填 **`https://api.你的网站.com/api`**（与 Server 绑定的自定义域名一致，例如 `api.starlensai.com` 则填 **`https://api.starlensai.com/api`**）。  
    - 若 Server 用系统默认域名：填 **`https://<Server 的默认域名>/api`**。
53. 保存。**注意**：修改 `VITE_API_BASE_URL` 后必须 **重新部署**（重新 Build）才会生效，因为该值会在构建时打进前端代码。

### 4.4 为 Admin 配置域名并验证（第 54～57 步）

54. 在 Admin 服务的 **Settings** → **Networking** 中：  
    - **按自己域名部署**：点击 **「Add Custom Domain」**，输入你的 Admin 访问域名（例如 **`admin.你的网站.com`**）。界面会要求填写 **「Enter the port your app is listening on」**：填 **8080**（Railway 为 Web 服务注入的 `PORT` 常为 8080；若界面已预填 8080 则保持即可；若该服务 Variables 里显式设置了 **PORT**，则填与之一致）。然后按 Railway 提示到域名服务商处添加 CNAME（目标为 Railway 给出的值），等待 Verified 后即可用该域名访问。  
    - **若暂不用自己域名**：可点击 **「Generate Domain」** 生成系统默认域名（形如 `xxx.up.railway.app`）。  
    **说明**：Start Command 中的 `npx serve dist -s -l $PORT` 会监听 Railway 注入的 **PORT**（多为 8080），此处填的端口须与该值一致，域名访问的 80/443 由 Railway 转发到该端口。
55. 记下 Admin 的访问地址（自己域名如 **`https://admin.你的网站.com`**，或系统默认域名）。
56. 在浏览器中打开该地址，应能看到 **Admin 登录页**。
57. 使用管理员账号登录（若尚无管理员，见「六、部署后检查清单」中创建方式），确认能正常请求列表、统计等接口（无跨域或 404）。

### 4.5 若 Admin 白屏或接口错误

- 检查 **Variables** 中 **`VITE_API_BASE_URL`** 是否与 Server 的 API 根地址完全一致（含 `https://` 和 `/api`），然后 **重新部署** Admin。  
- 确认 Server 的 **`/api/health`** 在浏览器可访问。

---

## 五、CORS 与管理员账号说明

- **CORS**：当前 Server 为 `origin: true`，允许任意来源。若后续要限制为 Admin 域名，可在 Server 的 Variables 中增加 **`CORS_ORIGIN`** 等并在代码中使用。
- **Admin 登录**：管理后台使用 **用户名 + 密码**，接口为 **`POST /api/admin/auth/login`**（与 C 端手机号+验证码登录分离）。**`VITE_API_BASE_URL`** 须指向 Server 的 API 根（如 `https://api.starlensai.com/api`），否则会报错或 Internal server error。
- **首次添加管理员**：通过执行 **seed** 创建（见下节「执行 seed」）。Seed 会创建/更新用户名为 **`admin`**、默认密码 **`Admin123!`**、角色为 **SUPERADMIN** 的账号；**首次登录后请立即在后台右上角「修改密码」中更换密码**。
- **修改管理员密码**：登录管理后台后，点击右上角 **「修改密码」**，填写当前密码与新密码即可；或调用 **`PUT /api/admin/auth/change-password`**（Body: `currentPassword`、`newPassword`，需带管理员 token）。

### 5.1 执行 seed（创建管理员与示例数据）

Seed 会创建管理后台账号（username: admin / 默认密码: Admin123!）以及示例 risk_data、knowledge_cases、settings。**Railway 当前不提供在服务器上直接执行任意命令的界面**，只能用下面两种方式之一在**本地**执行（执行时会把数据写入 Railway 上的 PostgreSQL）。

**方式一：本地用 Railway 注入的环境变量执行（推荐）**

1. 安装 [Railway CLI](https://docs.railway.app/develop/cli)：`npm i -g @railway/cli` 或按官网安装。
2. 在终端登录并关联项目：`railway login`，在项目根目录执行 `railway link` 选择你的 Railway 项目（或先 `cd Server` 再 link，使当前目录对应 Server 服务）。
3. 进入 Server 目录并执行 seed（CLI 会注入该项目/服务的 `DATABASE_URL` 等变量）：
   ```bash
   cd Server
   railway run npx prisma db seed
   ```
4. 若未 link 到具体服务，可指定服务：`railway run --service "你的 Server 服务名" npx prisma db seed`。执行成功后，用用户名 **admin**、密码 **Admin123!** 登录管理后台，并尽快修改密码。

**方式二：本地手动指定 DATABASE_URL**

1. 在 Railway 控制台打开 **PostgreSQL** 服务 → **Variables** 或 **Connect**，复制 **`DATABASE_URL`**（或 **Public URL**，若用公网连）。
2. 在**本机**打开终端，进入 **Server** 目录，执行（将 `你的DATABASE_URL` 替换为复制的连接串）：
   ```bash
   cd Server
   DATABASE_URL="你的DATABASE_URL" npx prisma db seed
   ```
3. 若连接串含特殊字符，请用单引号包住：`DATABASE_URL='postgresql://...' npx prisma db seed`。执行成功后，用用户名 **admin**、密码 **Admin123!** 登录管理后台，并尽快修改密码。

**首次部署且尚未有迁移时**：若 Schema 新增了字段（如 `username`、`password_hash`），需先做一次迁移再执行 seed。在本地（已配置同一 `DATABASE_URL`）执行：
```bash
cd Server
# 生成并应用迁移（会创建迁移文件并写入数据库）
npx prisma migrate dev --name add_admin_username_password
# 再执行 seed
npx prisma db seed
```
若你使用 **Railway CLI** 注入变量，可写成：`railway run npx prisma migrate dev --name add_admin_username_password`（仅本地有迁移文件时），然后 `railway run npx prisma db seed`。生产环境部署时 Server 的 **Start Command** 里已有 **`npx prisma migrate deploy`**，会自动应用已有迁移，无需在 Railway 上再执行 migrate。

---

## 六、部署后检查清单

- [ ] **Server 健康检查**：用你的 Server 地址（自己域名如 `https://api.你的网站.com/api/health`，或 Railway 默认域名 + `/api/health`）访问，返回 JSON（如 `{"status":"ok"}`）。
- [ ] **Admin 能打开**：用你的 Admin 地址（自己域名如 `https://admin.你的网站.com`，或 Railway 默认域名）可打开登录页。
- [ ] **Admin 登录**：用管理员账号（执行 seed 后为用户名 **admin**、默认密码 **Admin123!**）能登录；若无管理员，按「5.1 执行 seed」在本地执行一次 seed。
- [ ] **Admin 请求 API**：登录后列表、统计等接口正常，无跨域或 404。
- [ ] **数据库**：在 Railway PostgreSQL 的 Data 或本地用 `prisma studio` 连 `DATABASE_URL` 检查表是否已由迁移创建。
- [ ] **Redis**：Server 日志中无 Redis 连接错误。

---

## 七、更新部署（发新版本）

1. 本地改完代码后推送到 **`michaelzhao-collab/isitsafe-server`** 的对应分支。
2. **自动部署**：若在 **Settings → Source** 里已开启「Deploy on push」或等效选项，Railway 会检测到 push 并自动重新构建、部署；确认部署分支（如 `main`）与你在 GitHub 推送的分支一致即可。
3. **Server**：Railway 会根据 `Server/**` 变更自动重新构建并执行 `prisma migrate deploy`；若新增环境变量，在 Server 的 Variables 中添加后保存即可触发重新部署。
4. **Admin**：会随 `admin/**`（或 `Admin/**`）变更自动重新 build；若修改了 **`VITE_API_BASE_URL`**，在 Variables 中更新后需 **重新部署** 一次。

---

## 八、常见问题

- **Server 启动报错或一直重启**：若 **Deploy** 页的 **Custom Start Command** 仍是 **`node server.js`**，请改为 **`npx prisma migrate deploy && node dist/main.js`**（我们项目入口是 `dist/main.js`，不是 `server.js`）。
- **Server 报 “DATABASE_URL not found”**：在 Server 的 Variables 中通过 Reference 或手动添加 PostgreSQL 的 `DATABASE_URL`。
- **Server 报 Redis 连接失败**：确认 Redis 已部署，并在 Server 的 Variables 中配置了正确的 `REDIS_URL`（或当前模板提供的变量名）。
- **Prisma 迁移失败**：查看部署 Logs；常见为 `DATABASE_URL` 错误或迁移与 schema 不一致，可在本地用同一 `DATABASE_URL` 执行 `npx prisma migrate deploy` 复现。
- **Admin 白屏或接口 404**：确认 `VITE_API_BASE_URL` 为完整 API 根路径（含 `https://` 和 `/api`），且修改后已重新部署 Admin；确认 Server `/api/health` 可访问。
- **CORS 错误**：当前 Server 为 `origin: true`，一般不会出现；若已改为指定域名，请确保 Admin 访问域名在 CORS 的 origin 列表中。

---

## 九、Source / Build / Deploy / Networking / Config-as-code 页是干啥的（速览）

| 页面 | 作用 | 需要配置的项 |
|------|------|----------------|
| **Source** | 连哪个仓库、用哪个分支、项目在仓库里哪个子目录（Root Directory）、是否等 CI 通过再部署 | **Root Directory**（Server 填 `Server`，Admin 填 `admin`）；确认 **Branch** 为 `main`；可选 **Wait for CI** |
| **Build** | 用啥构建器、自定义构建命令、哪些路径变更触发重新部署（Watch Paths） | **Custom Build Command**；**Watch Paths**（Server 填 `Server/**`，Admin 填 `admin/**`）。Builder / Metal 一般不用改 |
| **Deploy** | 启动命令、健康检查地址、失败是否重启等 | **Custom Start Command**（Server 必填：`npx prisma migrate deploy && node dist/main.js`）；建议 **Healthcheck Path** 填 `/api/health`；**Restart Policy** 默认 On Failure 即可 |
| **Networking** | 公网访问地址（自定义域名 / 默认域名）、TCP 代理；同项目内服务间私网访问 | **按自己域名部署**：Server 与 Admin 各点 **Custom Domain** 绑定（如 `api.你的网站.com`、`admin.你的网站.com`），到域名服务商配 CNAME；暂不绑则用 **Generate Domain**；**Private Networking** 一般不用配 |
| **Config-as-code** | 用仓库里的配置文件（如 railway.json）管理构建和部署，而不是只在界面里点选 | **可选**。不用的话按前面在 Source/Build/Deploy 里配置即可；要用则点 **+ Add File Path** 填配置文件路径（如 `Server/railway.json`） |

### Networking 页说明

- **Public Networking**：对外访问地址。**按自己域名部署**时，Server 与 Admin 均用 **Custom Domain** 绑定（如 Server：`api.你的网站.com`，Admin：`admin.你的网站.com`），在域名服务商处为各自子域名配 CNAME 指向 Railway 给出的目标。**Default Public Domain**（「Generate Domain」生成的 `xxx.up.railway.app`) 仅在不绑自定义域名时使用。**TCP Proxy** 用于暴露非 HTTP 端口，一般用不到。
- **Private Networking**：同项目内多个服务之间内网访问用的。会有一个 **Internal Service Domain**（如 `isitsafe-server.railway.internal`），同一项目里的其他服务可直接用服务名（如 `isitsafe-server`）当主机名访问，不走公网。我们当前是 Admin 用公网 API 地址连 Server，不依赖私网，所以不用特别配置。

### Config-as-code 页说明

- 用 **Railway Config File**（如 `railway.json` 或 `railway.toml`）把构建命令、启动命令等写在仓库里，部署时 Railway 按文件执行。适合希望「配置跟代码一起版本管理」的情况。
- **不配置**：完全在 Settings 的 Source / Build / Deploy 里点选即可，本教程默认按这种方式。
- **要配置**：在仓库里加配置文件，再在 **Config-as-code** 页点 **「+ Add File Path」**，填文件路径（例如 `Server/railway.json`）。注意若设置了 Root Directory 为 `Server`，路径要按 Railway 文档写（有时需写相对 Root 的路径或绝对路径如 `/Server/railway.json`）。

---

## 十、速查：仓库、目录与命令

| 项目     | 值 |
|----------|-----|
| GitHub 仓库 | `michaelzhao-collab/isitsafe-server` |
| Server 根目录 | `Server` |
| Server 构建命令 | `npm ci && npx prisma generate && npm run build` |
| Server 启动命令 | `npx prisma migrate deploy && node dist/main.js` |
| Admin 根目录 | `admin`（仓库内为小写则填 `admin`） |
| Admin 构建命令 | `npm ci && npm run build` |
| Admin 输出目录 | `dist` |
| API 前缀 | 所有接口以 `/api` 开头 |

---

# 附录：本地部署与自检

以下为**可选**内容：若你未在本地运行过项目，可直接按上文在 Railway 部署，用「六、部署后检查清单」判断是否正常。若你想在本地先跑通再部署，或部署后想本地对照环境变量，可按下面步骤操作。

## 如何判断部署是否正常

- **Server**：用你的 Server 地址（自己域名如 `https://api.你的网站.com/api/health`）能返回 JSON（如 `{"status":"ok"}`），且无 500。
- **Admin**：用你的 Admin 地址（自己域名如 `https://admin.你的网站.com`）能打开登录页，登录后能正常请求接口，无跨域或 404。

## 本地运行 Server（可选）

1. 本机需已安装 **Node.js**、**PostgreSQL**、**Redis**。
2. 进入 **`Server`** 目录，复制 **`.env.example`** 为 **`.env`**。
3. 在 **`.env`** 中填写：**`DATABASE_URL`**（本地 PostgreSQL 连接串）、**`REDIS_URL`**（本地 Redis，如 `redis://localhost:6379`）、**`JWT_SECRET`**、**`JWT_REFRESH_SECRET`**（任意随机字符串），以及按需填写 AI、OSS 等。
4. 在 **`Server`** 目录下执行：  
   **`npm ci && npx prisma generate && npm run build && npx prisma migrate deploy && node dist/main.js`**
5. 浏览器访问 **`http://localhost:3000/api/health`**，有 JSON 返回即表示 Server 本地运行正常。

## 本地构建 Admin（可选）

1. 进入 **`admin`**（或 **`Admin`**）目录。
2. 可选：新建 **`.env`** 或 **`.env.local`**，设置 **`VITE_API_BASE_URL=http://localhost:3000/api`**（与本地 Server 一致）。
3. 执行：**`npm ci && npm run build`**。
4. 无报错且生成 **`dist/`** 目录即表示 Admin 构建正常。本地预览可执行 **`npx serve dist -s -l 3001`** 后访问 `http://localhost:3001`（需已安装 `serve`）。

按上述步骤完成后，Railway 上的接口与 Admin 后台即可正常使用；本地部分仅用于自检或开发对照。

---

## 十二、Git 提交说明（每次改完代码后）

每次修改代码并准备推送到 GitHub 时，按下面步骤操作（以下为**本次**「管理后台独立账号密码 + seed 说明」相关修改的文件与命令，之后每次改完我会在回复中列出**当次**需提交的文件与命令）。

### 本次需提交的文件

| 类型 | 路径 |
|------|------|
| Server | `Server/prisma/schema.prisma` |
| Server | `Server/prisma/seed.ts` |
| Server | `Server/prisma/migrations/20260308000000_add_admin_username_password/migration.sql` |
| Server | `Server/src/modules/auth/auth.service.ts` |
| Server | `Server/src/modules/admin/admin-auth.service.ts`（新） |
| Server | `Server/src/modules/admin/admin-auth.controller.ts`（新） |
| Server | `Server/src/modules/admin/admin.module.ts` |
| Admin | `admin/src/api/admin.ts` |
| Admin | `admin/src/pages/Login.tsx` |
| Admin | `admin/src/components/Layout.tsx` |
| 文档 | `docs/Railway部署教程-Server与Admin.md` |

### 提交命令（在项目根目录执行）

```bash
# 1. 进入项目根目录（若当前已在根目录可省略）
cd /Users/micheal/Documents/IsItSafe

# 2. 查看状态（确认上述文件在列表中）
git status

# 3. 添加本次修改/新增的文件
git add Server/prisma/schema.prisma \
  Server/prisma/seed.ts \
  "Server/prisma/migrations/20260308000000_add_admin_username_password/migration.sql" \
  Server/src/modules/auth/auth.service.ts \
  Server/src/modules/admin/admin-auth.service.ts \
  Server/src/modules/admin/admin-auth.controller.ts \
  Server/src/modules/admin/admin.module.ts \
  admin/src/api/admin.ts \
  admin/src/pages/Login.tsx \
  admin/src/components/Layout.tsx \
  docs/Railway部署教程-Server与Admin.md

# 4. 提交（说明写清楚便于以后查看）
git commit -m "feat(admin): 管理后台独立账号密码登录 + seed 与部署说明

- Server: User 表增加 username/passwordHash，POST /admin/auth/login、change-password
- Admin: 登录改为用户名+密码，右上角增加「修改密码」
- Seed: 创建 admin/Admin123! 管理员；文档补充本地/Railway 执行 seed 与修改密码说明"

# 5. 推送到远程
git push
```

**说明**：之后每次你改完代码，我会在回复末尾给出**当次**的「需提交的文件」和「提交命令」，你复制执行即可。
