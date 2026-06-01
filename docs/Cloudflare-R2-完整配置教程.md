# Cloudflare R2 + Railway env 完整配置教程

> 业主反馈：R2 完全没配置过，意见反馈图片 / 语音深伪上传 全部报"R2 服务连接失败"
> 本文件给出从 0 到能用的完整步骤，预计 15-20 分钟

---

## 💡 为什么用 Cloudflare R2

| 选项 | 价格 | 优点 |
|---|---|---|
| **Cloudflare R2** | 免费 10GB 存储 + 流量免费（无出网费）| 性价比最高，业界主流 |
| AWS S3 | $0.023/GB 存储 + $0.09/GB 出网 | 老牌，但流量贵 |
| 阿里云 OSS | ¥0.12/GB 存储 + ¥0.5/GB 出网 | 国内访问快，但海外慢 |

**R2 是当前最便宜的对象存储**，零出网费意味着 CDN 流量永远免费。

---

## 1️⃣ 注册 Cloudflare 账号

如果没有：
1. 打开 [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. 用邮箱注册
3. 验证邮箱

---

## 2️⃣ 开通 R2 服务

1. 进 Cloudflare Dashboard 后，左侧导航找 **R2 Object Storage**
2. 第一次进会让你 **激活 R2**，按要求填一张信用卡（**不会扣钱，免费档 10GB 内零费用**）
3. 激活后能看到 R2 主页

---

## 3️⃣ 创建 Bucket（存储桶）

1. R2 主页 → 点 **Create bucket**
2. 填写：

| 字段 | 填什么 |
|---|---|
| **Bucket name** | `starlens-uploads` （**记住这个名字，后面要填到 Railway**）|
| **Location** | **Automatic**（自动选最近 region）|
| **Default Storage Class** | **Standard**（默认即可）|

3. 点 **Create bucket**

---

## 4️⃣ 获取 R2_ACCOUNT_ID

1. 在 R2 主页右侧，能看到一栏 **Account ID**（32 位十六进制字符串）
2. **复制下来**，这就是 `R2_ACCOUNT_ID`

或者：
1. 点右上角你头像 → **Profile** → **API Tokens** 页面
2. 顶部就显示 Account ID

---

## 5️⃣ 创建 API Token（拿到 ACCESS_KEY_ID + SECRET_ACCESS_KEY）

1. 回到 R2 主页 → 左侧 **Manage R2 API Tokens** (或 R2 settings → API Tokens)
2. 点 **Create API token**
3. 填写：

| 字段 | 填什么 |
|---|---|
| **Token name** | `starlens-server` |
| **Permissions** | **Admin Read & Write**（业务需要读写）|
| **Specify bucket(s)** | 选 **Apply to specific buckets only** → 勾选刚才建的 `starlens-uploads` |
| **TTL（生存时间）** | **Forever**（永久，业务用）|

4. 点 **Create API Token**

5. 立刻显示一次性的凭证（**关掉就再也看不到，必须现在抄下来**）：

| 字段 | 怎么用 |
|---|---|
| **Access Key ID** | 这是 `R2_ACCESS_KEY_ID` |
| **Secret Access Key** | 这是 `R2_SECRET_ACCESS_KEY` |
| **Endpoint** | 不用，service 代码已经按 Account ID 自动拼接 |

> ⚠️ **关键**：这个页面关掉后无法再看 Secret Access Key。如果丢了，必须重新生成 API Token。

---

## 6️⃣ 启用 R2 Public Access（可选但建议）

让上传的文件能通过 URL 公开访问：

### 方案 A：用 R2 自带的 r2.dev 域名（最简单）

1. 进 `starlens-uploads` bucket → **Settings**
2. 找 **Public R2.dev Bucket URL** → 点 **Allow Access**
3. 复制显示的 URL，类似 `https://pub-XXXXX.r2.dev`
4. **这就是 `CDN_DOMAIN`**

### 方案 B：用自定义域名（更专业，需要域名）

1. 进 `starlens-uploads` bucket → **Settings**
2. **Custom Domains** → **Connect Domain**
3. 输入 `cdn.starlensai.com`（你的子域名）
4. Cloudflare 自动配 DNS（前提：starlensai.com 是 Cloudflare 托管）
5. `CDN_DOMAIN=https://cdn.starlensai.com`

> 推荐方案 A，先跑起来。方案 B 等以后想换品牌再迁。

---

## 7️⃣ 在 Railway 配置 5 个 env 变量

1. 登 [https://railway.app](https://railway.app)
2. 选 IsItSafe 项目 → **Variables** 标签
3. 添加 / 修改这 5 项：

| 变量名 | 值（举例） |
|---|---|
| `R2_ACCOUNT_ID` | `abc1234567890def1234567890fedcba` |
| `R2_ACCESS_KEY_ID` | `aaaaaaaaaaaaaaaaaaaaaa` |
| `R2_SECRET_ACCESS_KEY` | `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` |
| `R2_BUCKET` | `starlens-uploads` |
| `CDN_DOMAIN` | `https://pub-XXXXX.r2.dev`（不带末尾斜杠）|

4. **保存**，Railway 自动重新部署服务（约 1-2 分钟）

---

## 8️⃣ 验证配置成功

### 方法 A：调反馈页面，传一张图

1. iOS App → 我的 → 意见反馈
2. 写一段文字，加一张图片
3. 提交 → 应该提示"提交成功"（不再报 R2 错误）
4. Admin 后台 → 用户反馈 → 应该能看到那张图

### 方法 B：直接看 Railway 日志

1. Railway dashboard → IsItSafe-Server 服务 → Deployments → 最新 deployment → Logs
2. 搜索 `Upload`
3. 没有 `[Upload] R2 client not initialized` 警告 = 配置成功
4. 如果还有警告，回去检查 5 个 env 是否全部填了 + 拼写正确

---

## 9️⃣ 故障排查

### 错误：`R2 服务连接失败，请检查 R2_ACCOUNT_ID 配置`
- **原因**：`R2_ACCOUNT_ID` 错了或为空
- **修复**：重新对照 Cloudflare 主页 Account ID（32 位十六进制）

### 错误：`存储凭证错误，请联系管理员`
- **原因**：`R2_ACCESS_KEY_ID` 或 `R2_SECRET_ACCESS_KEY` 错了
- **修复**：去 Cloudflare 删旧的 API Token，重建一个，重填 Railway env

### 错误：`R2 Bucket 不存在`
- **原因**：`R2_BUCKET` 拼错或 bucket 已删
- **修复**：去 Cloudflare R2 主页看 bucket 名是否完全匹配

### 错误：`R2 拒绝访问（403）`
- **原因**：API Token 权限不够（创建时选了 Read Only）
- **修复**：重新创建 Token，权限选 **Admin Read & Write**

### 上传成功但用户看不到图片
- **原因**：`CDN_DOMAIN` 没配 / 配错 / bucket public access 没开
- **修复**：步骤 6 重做一次，确保 r2.dev URL 公开可访问

---

## 🔐 安全建议

1. **不要把 SECRET_ACCESS_KEY 提交到 git** —— 只放 Railway env
2. **API Token 定期轮换**（每 90 天一次较好）
3. **Bucket 不要存敏感内容**（虽然有 public URL 但路径是带 hash 的，不容易猜）
4. **流量异常监控**：Cloudflare R2 主页能看每天的请求量，如果突然飙到 GB 级别说明可能被滥用

---

## 💰 成本预估

R2 免费档：
- **存储**：10GB 免费 / 月
- **请求**：100 万次写入 + 1000 万次读取 免费 / 月
- **流量**：**永久免费**（R2 最大优势）

按 StarLensAI 的体量：
- 每个反馈图 ~200KB
- 每个深伪音频 ~1MB
- 10GB ≈ 5 万张图或 1 万个音频

每月几百到几千张图完全在免费档内。

超出后：
- 存储 $0.015/GB
- 请求 $0.36/百万次

100GB 存储 + 1000 万请求 ≈ **$1.5 / 月**，几乎无成本。

---

## 📋 操作 Checklist

- [ ] Cloudflare 账号注册 + 登录
- [ ] 激活 R2 Object Storage（填信用卡，免费档不扣钱）
- [ ] 创建 bucket `starlens-uploads`
- [ ] 抄下 Account ID（这是 R2_ACCOUNT_ID）
- [ ] 创建 R2 API Token（Admin Read & Write）
- [ ] 抄下 Access Key ID 和 Secret Access Key
- [ ] 启用 bucket Public Access (r2.dev URL)
- [ ] 抄下 r2.dev URL（这是 CDN_DOMAIN）
- [ ] Railway → Variables → 填 5 个 env
- [ ] 等 Railway 自动 deploy 完成
- [ ] iOS App 测试上传 + admin 后台看图

---

## 📅 变更历史

- **2026-06-02 V1**：完整 R2 配置教程（首次配置）
