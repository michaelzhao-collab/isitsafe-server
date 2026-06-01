# App Store Connect 定价调整 + 首购优惠（Introductory Offer）配置教程

> 业主决定：方案 B 定价（$2.99 / $9.99 / $59.99）+ 首购优惠
> 本文件给出 App Store Connect 完整操作步骤

---

## ✅ 当前代码已就位

- `Server/prisma/seed.ts`：DB seed 价格已改为新价格（admin 后台显示用）
- `iOS/IsItSafe/Source/Local.storekit`：本地 StoreKit 配置已改新价格 + Xcode 内测首购优惠 demo

但 **真实用户付的钱**取决于 **App Store Connect 后台配置**，必须手动改。

---

## 1️⃣ 调整正式定价（每个产品一次）

### 步骤

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 选 **我的 App** → **StarLens AI** → 左侧 **应用内购买（Apps and In-App Purchases）**
3. 找到 3 个订阅产品（点产品名进详情）：
   - `starlens.weekly.subscription`
   - `starlens.monthly.subscription`
   - `starlens.yearly.subscription`

### 每个产品改价

进产品详情后：

1. 找到 **订阅价格 / Subscription Pricing** 区块
2. 点 **编辑 / Edit**
3. 选 **主要价格 / Primary Price**：

| 产品 | 新价格 |
|---|---|
| `starlens.weekly.subscription` | **$2.99 USD / 周** |
| `starlens.monthly.subscription` | **$9.99 USD / 月** |
| `starlens.yearly.subscription` | **$59.99 USD / 年** |

4. **选择何时生效**：
   - **立即生效（Effective Date: Today）**：所有用户下次续费按新价。但 **现有订阅用户**会收到 Apple 的提价通知，他们要在 30 天内主动接受新价才会续费（否则订阅自动取消）。
   - **未来某日生效（Effective Date: Future）**：可选下次产品上线后生效。

> ⚠️ **建议**：你目前**还没有真实付费用户**（Sandbox 测试不算），所以**直接立即生效**最简单。

5. 点 **保存 / Save**
6. 三个产品都改一遍

### 国家区配置（人民币）

Apple 价格分档自动按 USD 换算其他国家货币。中国区会自动得到：

| 美元 | 人民币 |
|---|---|
| $2.99 | **¥18** |
| $9.99 | **¥68** |
| $59.99 | **¥388** |

可以在 **Pricing → All Other Countries/Regions** 检查所有国家价格。一般不用动，Apple 已经按区域购买力优化过。

---

## 2️⃣ 配置首购优惠（Introductory Offers）

首购优惠 = Apple 官方的 **促销定价**机制，**100% 由 App Store 在购买流程里展示**，iOS 代码不用改。

### 推荐方案（已写进 Local.storekit）

| 产品 | 正价 | 首购优惠 | 折扣 |
|---|---|---|---|
| 月卡 | $9.99/月 | **$1.99 第 1 个月** | -80% |
| 年卡 | $59.99/年 | **$29.99 第 1 年** | -50% |
| 周卡 | $2.99/周 | （建议不做，太短了）| - |

> 心理：用月 $1.99 强吸引首购，第二个月恢复 $9.99；年付 $29.99 (= $2.5/月) 给"试试一整年"的人。

### 步骤

#### Step 1：进入产品详情

App Store Connect → StarLens AI → 应用内购买 → 选月会员 `starlens.monthly.subscription`

#### Step 2：创建首购优惠

1. 滚到 **订阅优惠（Subscription Offers）** 区块
2. 点 **+ 优惠（Offer）** → 选 **Introductory Offer（首次购买优惠）**
3. 填写：

| 字段 | 月卡填什么 | 年卡填什么 |
|---|---|---|
| **Offer Type** | Pay As You Go（按周期付费）| Pay As You Go |
| **Duration** | 1 month | 1 year |
| **Number of Periods** | 1 | 1 |
| **Promo Price** | $1.99 | $29.99 |
| **Eligibility** | New Subscribers（仅新用户）| New Subscribers |

#### Step 3：保存

- 点 **Save**
- 该优惠会在 1-24h 内同步到 App Store 全网

#### Step 4：年卡也配一次

回到产品列表，选 `starlens.yearly.subscription`，重复 Step 2-3（Duration 改为 1 year，Promo Price $29.99）。

---

## 3️⃣ iOS 端验证（无需改代码）

正式上线后：
1. 用户首次打开订阅页 → Apple StoreKit 自动检测他是"新用户"
2. 月卡按钮显示：**"$1.99 the first month, then $9.99/month"**
3. 用户付款时显示：**"You'll be charged $1.99 today. Your subscription renews at $9.99/month starting Aug 1, 2026."**

老用户（已订阅过、退订过）打开订阅页，看到的还是正价 $9.99。

---

## 4️⃣ 涨价影响（你目前没真实用户，可跳过）

如果以后有真实付费用户，涨价时 Apple 会强制：
- 提前 **30 天**给用户邮件 + In-App 弹框通知
- 用户必须在通知里点 **"Continue Subscription"** 同意涨价
- 不同意 → 当前周期结束后**自动取消订阅**

降价无需用户确认，立即生效。

---

## 5️⃣ 首购优惠常见 Q&A

### Q: 优惠期内用户能取消吗？
A: 可以。任何 Apple 订阅都支持随时取消，剩余优惠期付费的部分按 Apple 退款政策处理。

### Q: 用户跨设备会算"新用户"两次吗？
A: 不会。Apple 按 **Apple ID** 判定，一个 Apple ID 任意设备只能首购一次。

### Q: 我能给 Sandbox 测试账号用 Introductory Offer 吗？
A: 能。Sandbox 完全支持首购优惠测试，加速时间也按 Sandbox 规则缩短（1 个月 = 5 分钟）。

### Q: 用户先订月卡用了首购，再升级年卡，年卡有首购吗？
A: 月 → 年的"升级"按 Apple 规则也算首购，**用户能拿年卡 $29.99 首购**（前提是年卡也开了首购优惠）。

### Q: 老用户退订后再来订阅，首购优惠还能用吗？
A: 默认不能（一个 Apple ID 一次性）。如果想拉回，可以配 **Win-Back Offer**（流失召回优惠），跟首购独立。

---

## 📋 操作 Checklist

### A. 涨价
- [ ] App Store Connect → starlens.weekly.subscription → $2.99
- [ ] App Store Connect → starlens.monthly.subscription → $9.99
- [ ] App Store Connect → starlens.yearly.subscription → $59.99
- [ ] 选择 "Effective Today" 立即生效

### B. 首购优惠
- [ ] 月卡 → Introductory Offer → Pay As You Go / 1 month / $1.99 / New Subscribers
- [ ] 年卡 → Introductory Offer → Pay As You Go / 1 year / $29.99 / New Subscribers
- [ ] 周卡不做首购

### C. 验证
- [ ] App Store Connect 产品列表显示新价格
- [ ] Sandbox 用新账号买月卡 → 应该显示 $1.99 introductory
- [ ] Sandbox 用新账号买年卡 → 应该显示 $29.99 introductory

---

## 📅 变更历史

- **2026-06-02 V1**：方案 B 定价（$2.99/$9.99/$59.99）+ 月卡首购 $1.99 + 年卡首购 $29.99
- 之前价格：$0.99 / $4.99 / $24.99（无首购优惠）
