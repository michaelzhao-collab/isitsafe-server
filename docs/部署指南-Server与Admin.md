# IsItSafe 部署指南：Server 与 Admin

本文档说明如何将 **Server（NestJS API）** 与 **Admin（React 管理后台）** 部署到服务器，并随项目变更**持续更新**。

---

## 一、前置条件

- 一台 Linux 服务器（如 Ubuntu 22.04）
- 域名（如 `api.isitsafe.com`、`admin.isitsafe.com`）
- 已安装：
  - **Node.js** 18+（推荐 LTS）
  - **npm** 或 **pnpm**
  - **PostgreSQL** 14+
  - **Redis** 6+
  - **Nginx**（反向代理 + 静态资源）
  - （可选）**PM2** 用于 Node 进程管理

---

## 二、Server 部署

### 2.1 克隆与安装

```bash
cd /opt  # 或你的部署目录
git clone <你的仓库地址> IsItSafe
cd IsItSafe/Server
npm ci
```

### 2.2 环境变量

复制并编辑 `.env`（不要提交到 Git）：

```bash
cp .env.example .env
nano .env
```

必填项示例：

```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/isitsafe?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=<强随机字符串>
JWT_REFRESH_SECRET=<另一强随机字符串>
# OSS（头像/统一上传）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=xxx
OSS_ACCESS_KEY_SECRET=xxx
CDN_DOMAIN=https://cdn.isitsafe.com
# AI 等按需配置
AI_PROVIDER=doubao
DOUBAO_API_KEY=xxx
```

### 2.3 数据库迁移

```bash
cd /opt/IsItSafe/Server
npx prisma migrate deploy
npx prisma generate
```

### 2.4 构建

```bash
npm run build
```

产物在 `dist/`。

### 2.5 使用 PM2 运行（推荐）

```bash
npm install -g pm2
pm2 start dist/main.js --name isitsafe-server
pm2 save
pm2 startup  # 按提示执行，实现开机自启
```

或使用 ecosystem 文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'isitsafe-server',
    script: 'dist/main.js',
    cwd: '/opt/IsItSafe/Server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
  }],
};
```

然后：`pm2 start ecosystem.config.js`。

### 2.6 Nginx 反向代理（API）

在 `/etc/nginx/sites-available/isitsafe-api` 中配置（示例）：

```nginx
server {
    listen 80;
    server_name api.isitsafe.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/isitsafe-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS：使用 certbot 或已有证书，在同上 `server` 中增加 `listen 443 ssl` 及 `ssl_certificate` / `ssl_certificate_key`。

---

## 三、Admin 部署

### 3.1 构建

在项目根目录：

```bash
cd /opt/IsItSafe/admin
npm ci
```

配置 API 地址后构建：

```bash
echo "VITE_API_BASE_URL=https://api.isitsafe.com/api" > .env.production
npm run build
```

产物在 `dist/`（静态 HTML/JS/CSS）。

### 3.2 使用 Nginx 托管静态

在 `/etc/nginx/sites-available/isitsafe-admin` 中配置：

```nginx
server {
    listen 80;
    server_name admin.isitsafe.com;
    root /opt/IsItSafe/admin/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用并重载 Nginx（同上）。HTTPS 同样用 certbot 或已有证书。

---

## 四、更新部署（发布新版本）

### 4.1 Server

```bash
cd /opt/IsItSafe
git pull
cd Server
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart isitsafe-server
```

如有新增环境变量，先在 `.env` 中补全再重启。

### 4.2 Admin

```bash
cd /opt/IsItSafe/admin
git pull
npm ci
# 确保 .env.production 中 VITE_API_BASE_URL 正确
npm run build
# 无需重启进程，Nginx 直接读 dist/ 新文件
```

---

## 五、文档更新约定

- 本文档路径：**`docs/部署指南-Server与Admin.md`**
- 当出现以下情况时，请**同步更新本文档**：
  - 新增/变更环境变量（Server 或 Admin）
  - 新增数据库迁移或 Prisma 相关步骤
  - 部署方式变更（如改用 Docker、K8s）
  - 域名、目录、端口变更
- 建议在合并部署相关改动时，在 MR/PR 中勾选“已更新部署指南”。

---

## 六、检查清单

部署后建议确认：

- [ ] `https://api.isitsafe.com/api/health` 返回正常
- [ ] Admin 能打开且接口请求指向 `https://api.isitsafe.com/api`
- [ ] 登录、用户资料、上传等核心流程可用
- [ ] Server 日志无报错：`pm2 logs isitsafe-server`

---

*最后更新：随统一文件上传与部署相关改动一起维护。*
