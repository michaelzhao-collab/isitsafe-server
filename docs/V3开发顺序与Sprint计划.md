# V3 一期开发顺序 & Sprint 计划

> **日期**：2026-05-27
> **基础文档**：[`V3技术架构与实现.md`](./V3技术架构与实现.md) / [`V3第一期需求.md`](./V3第一期需求.md)
> **团队**：2-3 人（暂定 1 iOS + 1 服务端 + 0.5 设计/QA 共享）
> **工期**：16 周（约 4 个月）
> **总工时**：26 工时周

---

## 0. 排序原则

按以下 4 个维度综合排序：

1. **依赖**：被依赖的先做（E 是基建必须最先）
2. **风险**：高风险（不确定能否做出来）先做，**失败快**
3. **可独立验证价值**：能独立给用户看到的优先（J/B 这种主流场景）
4. **第三方等待**：需要外部合同/账号的并行启动（A1 provider / B 编辑团队）

---

## 1. 开发优先级（5 模块排序）

### 🥇 优先级 1：E 家庭守护账号（W1-W7，8w）
**最先做，无条件**

**理由**：
- 是 J / A1 / B 的基础依赖（家庭组关系、官方广播、心跳）
- 关怀机制涉及短信网关 → 需要时间踩坑（合规、模板报备、限流）
- 官方匿名广播的"触发者隐藏"是隐私核心，必须做扎实

**子任务排序**（按内部依赖）：
1. **W1**：DB migration（5 张新表）+ 心跳接口 + 家庭组 CRUD
2. **W2**：邀请码生成/兑换 + Universal Link + 加入流程
3. **W3**：活跃日志 + careCronJob（2/3 天未活跃）
4. **W4**：短信网关接入（阿里云+Twilio）+ 限流
5. **W5**：官方广播 AI 分类（接 V2 编排）+ 排重 + 分发
6. **W6**：主动分享流程 + 三结果弹框
7. **W7**：联调 + QA + 数据看板

### 🥈 优先级 2：J 长辈专属模式（W6-W8，3w，与 E 后半段并行）
**依赖 E 已建好的家庭组**

**理由**：
- 工时短，可以贴在 E 后半段并行
- 依赖 E 的家庭组关系做"远程开启长辈模式"+ SOS 拨号
- 65+ 老年实测是硬约束，提早开始才能赶上灰度

**子任务**：
- **W6**：长辈模式 Token + 字号 1.5x + 极简首页 + 3 大按钮
- **W7**：TTS（火山引擎/iFLYTEK 备）+ 拍照 OCR + SOS 直拨
- **W8**：5-10 名 65+ 用户实测 + 调整文案/触控

### 🥉 优先级 3：B 情报推送 + Tab 改造（W8-W11，7w）
**前置：W3 开始内容团队招聘**

**理由**：
- 必须等 E 的官方广播表（family_broadcast）落地，因为 B 的 feed 接口要联表查
- 内容运营是真正的瓶颈 → 团队招聘 W3 启动，工程 W8 启动，给 5 周缓冲
- 首页通知条改动是 V2 代码的 minor touch

**子任务**：
- **W8**：编辑团队招聘到位 + 数据源签约
- **W9**：DB migration + 首页通知条 + Tab 改名 + Segment 切换
- **W10**：情报详情 + 用户上报 + 偏好设置
- **W11**：Admin 后台情报管理 + AI 改写助手

### 🏅 优先级 4：A1 语音深伪检测（W12-W13，4w）
**前置：W3 开始 provider 评估，W10 完成 200 样本测试集**

**理由**：
- 准确率是最大风险 → provider 评估 + 基准测试集要早启动
- 上线前 200 样本 ≥ 80% 准确率是硬约束
- Share Extension 苹果审核可能有迭代

**子任务**：
- **W12**：iOS 录音/上传/Share Extension + 服务端异步任务 + WS
- **W13**：结果展示 + 历史 + 用户反馈打标 + 联调

### 🏅 优先级 5：F 海外暗网监控（W13-W14，4w）
**仅海外，独立模块**

**理由**：
- 与 A1 同期，海外用户接受度高的"付费王牌"功能
- HIBP API 接入相对成熟（已有标准库）
- 邮箱验证流程独立，不阻塞其他模块

**子任务**：
- **W13**：DB migration + HIBP API 接入 + 邮箱验证
- **W14**：扫描 cron + 告警 UI + 修复引导

### W15-W16：QA + 灰度发布
- 全模块联调 + 法务/合规 review
- TestFlight 内测 5 人 1 周
- 5% 灰度 3 天 → 25% 3 天 → 全量

---

## 2. 启动前置 Checklist（W1 之前必须完成）

**没全部 ✅ 不允许开第一行 V3 业务代码**：

- [ ] **工程 2-3 人到位**（iOS 1 + 服务端 1 + 设计/QA 0.5 共享）
- [ ] **阿里云短信账号开通 + 模板报备**（关怀机制依赖，国内）
- [ ] **Twilio 账号开通 + 短信模板**（关怀机制依赖，海外）
- [ ] **B 模块 ¥80k 内容运营预算批准**（3 个月）
- [ ] **A1 第三方 provider 启动评估**（Reality Defender / 火山引擎 询价并谈判）
- [ ] **E 模块"免费 + 共享非监控"定位全员对齐**（避免后续营销画饼）
- [ ] **V2 现有用户表 backup**（DB 迁移前必备）
- [ ] **Railway 生产环境 staging 镜像**（用于灰度）

---

## 3. 第一周（W1）具体任务清单

### W1.D1（周一）— 启动日
**iOS**:
- [ ] 创建 V3 feature branch：`git checkout -b feature/v3-family`
- [ ] APIEndpoint.swift 加 V3 endpoint cases（family/heartbeat 子集，先不实现）
- [ ] 新建 `Source/Models/Family/` 目录 + `FamilyGroup.swift` / `FamilyMember.swift` Codable

**Server**:
- [ ] 创建 V3 feature branch
- [ ] `prisma/migrations/v3_001_user_extensions.sql` — user 表加 6 个字段
- [ ] `prisma/migrations/v3_002_family_tables.sql` — 5 张家庭表
- [ ] 在 staging 跑通 migration，验证 V2 接口无回归

**准备**:
- [ ] 阿里云短信账号申请（如未完成）
- [ ] 召集团队 1 小时 kickoff 会议，对齐 PRD/技术架构关键决策

### W1.D2 — 服务端骨架
**Server**:
- [ ] `src/modules/family/family.module.ts`
- [ ] `src/modules/family/family.service.ts`（空方法签名）
- [ ] `src/modules/family/family.controller.ts`（路由声明，所有方法返回 501）
- [ ] `src/modules/family/dto/` 4 个 DTO 文件
- [ ] 注册到 `app.module.ts`
- [ ] Postman/Insomnia collection 准备 12 个 family 接口

### W1.D3 — 心跳接口
**Server**:
- [ ] `src/modules/user/user-heartbeat.controller.ts`（独立小模块）
- [ ] `POST /api/v3/user/heartbeat` 实现完整：节流（5 分钟）+ 写 user_activity 表
- [ ] 单测覆盖

**iOS**:
- [ ] `Source/Services/HeartbeatService.swift`（含节流逻辑 + 失败本地队列）
- [ ] 接入 `AppDelegate.applicationDidBecomeActive`
- [ ] 接入 `HomeContainerView.onChange(scenePhase)`

### W1.D4 — 家庭组 CRUD（不含邀请码）
**Server**:
- [ ] `POST /api/v3/family/groups` 实现 — 创建（免费，无套餐校验）
- [ ] `GET /api/v3/family/groups/me` 实现
- [ ] `DELETE /api/v3/family/groups/:id` 实现（owner 校验）
- [ ] `POST /api/v3/family/groups/:id/leave` 实现

**iOS**:
- [ ] `FamilyService.swift` + `FamilyRepository.swift`
- [ ] `FamilyViewModel.swift` 状态机

### W1.D5 — 家庭页 UI 骨架
**iOS**:
- [ ] `Source/Views/Family/FamilyView.swift`
- [ ] Tab 栏新增"家庭" Tab（MainTabView.swift 改 3→4 Tab）
- [ ] 创建家庭组流程（无家庭组态 → E-P2 → E-P10）

**Server**:
- [ ] `POST /api/v3/family/groups/:id/invites` 接口骨架 + 邀请码生成（6 位 BASE32）

### W1 周五（Review Day）
- [ ] **代码 review** + 合并到 dev 分支
- [ ] **演示**：服务端能创建/查询/删除家庭组；iOS 能进入家庭页看到空状态
- [ ] **回顾**：本周遇到的问题，下周计划调整

---

## 4. 周度里程碑（W2-W16）

| 周 | 主线 | 副线 | 验收点 |
|---|---|---|---|
| **W1** | E 基建：DB+心跳+家庭组 CRUD | 设计 Token 落地 | 能创建/查询家庭组 |
| **W2** | E 邀请：邀请码+UL+加入流程 | 内容团队招聘启动 | 真实手机可以邀请家人加入 |
| **W3** | E 关怀：活跃日志+careCronJob 雏形 | 设计 J 长辈 Token | 2/3 天未活跃自动 push |
| **W4** | E 短信：阿里云+Twilio 接入 | A1 provider 评估启动 | 3 天未活跃自动发短信 |
| **W5** | E 广播：AI 分类+排重+分发 | A1 200 样本采集 | 触发查询自动广播家庭 |
| **W6** | E 主动分享+三结果弹框 / J 长辈 Token+首页 | — | J 长辈首页 3 大按钮可点击 |
| **W7** | E 联调+QA / J TTS+OCR+SOS | — | E 模块 DoD 全部通过 |
| **W8** | J 65+ 用户实测 / B 编辑团队上线 / 通知条+Tab 改造 | A1 200 样本基准跑通 | 长辈用户 30s 完成主流程 |
| **W9** | B 情报详情+上报+偏好 | — | B-P0~P5 可用 |
| **W10** | B Admin 后台+AI 改写助手 | A1 测试集 ≥ 80% 准确率确认 | 编辑可发布情报 |
| **W11** | B 全部 DoD / 联调 | — | B 模块 DoD 全部通过 |
| **W12** | A1 上传+WS+Share Extension | F HIBP 接入启动 | 用户可上传语音得到结果 |
| **W13** | A1 结果展示+历史 / F 邮箱验证 | — | A1 模块 DoD 全部通过 |
| **W14** | F 扫描 cron+告警 UI | 全模块联调 | F 模块 DoD 全部通过 |
| **W15** | QA + 法务/合规 review | TestFlight 5 人 | 5 人内测通过 |
| **W16** | 5% → 25% → 全量 | 数据看板观察 | V3 一期上线 |

---

## 5. 风险预案（卡住时怎么办）

### Plan A: 一切顺利 → 按 16 周排期上线

### Plan B: E 模块超时（W7 未完成）
- 删 E-P6b 等次要页面，保留三大机制核心
- J 模块用 V2 用户表的 user_id 暂时跑，等 E 完成再切
- 推迟整体上线 2 周到 W18

### Plan C: A1 准确率 < 80%
- A1 模块**不在一期上线**，挪到二期
- 替换为"V2 已有功能强化"（如知识库改造、URL 检测增强）
- 一期模块从 5 减为 4，工时 26w → 22w

### Plan D: B 内容运营预算不到位
- B 模块**降级**为"仅展示家庭官方消息"（不含系统全网情报）
- 首页通知条仅展示家庭官方
- 留出 4w 工时给 E 模块加强

### Plan E: 短信网关受阻（合规/限流）
- 关怀机制改为"3 天未活跃只 push，不 sms"
- 短信留二期再加
- 不影响 E 模块整体上线

### Plan F: 苹果 IAP 审核拒绝（家庭 Pro 套餐）
- 沿用 V2 已审过的"个人 Pro"单套餐
- 家庭 Pro 转入"赠送家人 Pro"模式（送 1 月 Pro 给家人，不收家人钱）
- 二期再争取家庭套餐

---

## 6. 关键里程碑评审会议

| 时间 | 评审主题 | 出席 | 决策点 |
|---|---|---|---|
| W2 末 | E 基建评审 | 全员 | 家庭组核心功能是否扎实，进 W3 还是返工 |
| W4 末 | 短信网关 + 关怀机制评审 | 工程+合规 | 短信文案 OK 否，限流策略 |
| W7 末 | **E 模块 DoD** | 全员 | E 是否可发布灰度，是否启动 J/B |
| W10 末 | **A1 准确率评审** | 工程+产品 | 准确率达标启动开发，不达标走 Plan C |
| W11 末 | **B 模块 DoD** | 全员 | B 是否可发布 |
| W14 末 | **全模块联调评审** | 全员 | 进入 QA + 灰度 |
| W15 末 | **法务/合规 review** | 工程+法务 | 上线 GO/NO-GO |

---

## 7. 数据看板（W1 就要搭好，不要拖到上线后）

### 必备指标（W1-W3 接入 PostHog/Mixpanel）

```yaml
基础事件:
  - app_open  # 心跳
  - app_foreground
  - module_enter  # 进入哪个 Tab/页

E 模块:
  - family_group_created
  - family_invite_sent
  - family_invite_redeemed
  - family_member_added
  - family_broadcast_triggered  # 触发广播（不显示具体内容）
  - family_broadcast_delivered  # 推送到家
  - family_care_push_sent
  - family_care_sms_sent

J 模块:
  - elder_mode_enabled
  - elder_query_completed  # 完成主流程
  - elder_sos_dialed

B 模块:
  - intel_feed_open
  - intel_detail_view
  - intel_submission

A1 模块:
  - deepfake_check_started
  - deepfake_check_completed
  - deepfake_user_feedback  # 准/不准

F 模块（仅海外）:
  - breach_target_added
  - breach_alert_received
  - breach_alert_dismissed

转化漏斗:
  - free → 个人 Pro
  - free → 家庭 Pro
  - 个人 Pro → 家庭 Pro 升级
```

### 北极星指标
- **DAU**（每日活跃用户）
- **家庭组渗透率**（创建过家庭组的 DAU / 总 DAU）
- **付费转化率**（订阅 Pro 的 DAU / 总 DAU）
- **关怀机制触发数 / 周**（衡量价值传导）
- **官方广播 CTR**（验证"官方"权威感设计）

---

## 8. 资源使用估算（开发期）

### 服务器（Railway）
- V2 当前规格够用
- 新增 BullMQ worker dyno ≈ +$5/月
- Redis 升级到中等规格 ≈ +$10/月

### 第三方 API（开发+测试期，前 4 个月）
- 阿里云短信：测试用量 < ¥500
- Twilio：测试用量 < $50
- Reality Defender：评估期 free trial / 试用合同
- HIBP：商业 API $4/月最低档够开发用

### 数据库
- Postgres 现有规格可承载（V3 新增 9 张表 + 6 字段，总数据增量 < 10%）

### 人力（4 个月）
- iOS 工程师 × 4mo
- 服务端工程师 × 4mo
- 设计师 × 1mo
- QA × 0.5mo
- 编辑团队 × 2mo（W8 起）

---

## 9. 我现在就能帮你做

如果你说"开工"，我下一步可以立刻做：

| 选项 | 工作 | 估算 |
|---|---|---|
| **A** | 写 V3 第 1 个 PR：DB migration v3_001 + v3_002 文件 | 1-2 小时 |
| **B** | 写 V3 服务端 family 模块骨架（module/service/controller/dto） | 2-3 小时 |
| **C** | 写 iOS 端 V3 endpoint enum + HeartbeatService | 1-2 小时 |
| **D** | 全部 ABC 一次性给你（一个 commit / 多个 PR） | 4-6 小时 |

我建议从 **A** 开始（数据库 schema 落地是地基），跑通 staging 后再上 B/C。

---

## 10. 我建议的发起方式

**今晚或明天上午**：召集 kickoff 会议（30 分钟），过一遍：
1. 本文档（开发顺序）
2. V3 技术架构（架构图 + 时序图）
3. 启动 checklist（哪些前置还没完成）
4. W1 任务分工

**然后**：让我开始写 W1.D1 的代码（DB migration + V3 endpoint enum 框架）。

---

> **下一步**：告诉我你的选择 — A / B / C / D 还是其他。
