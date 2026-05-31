# AI 分析能力优化方案 V1

> 创建日期：2026-05-31
> 适用范围：/api/ai/analyze 核心链路（intent 分流 + scam_detection 主分析）
> 撰写约束：非工程师可执行；不依赖人工大规模测试；安全可回滚

---

## 0. TL;DR

| 项 | 当前 | 这个方案要做到 |
|---|---|---|
| 分析质量 | "看起来对、不够具体" | 具体到这条 query 的细节 |
| 评测能力 | 无 | 有 admin 页 5 分钟看一批样本+打分 |
| 改 prompt 的风险 | 直接全量上线 | 灰度 1% → 影子模式 → 全量 |
| 决策方式 | 凭感觉 | 看数据 |
| 用户测试成本 | 高（人工跑 50 条） | 低（admin 页点几下） |

**核心思路**：不一上来就重做架构。**先建可观测性（看得见现状）→ 再做安全微调 → 用影子模式对比新旧 → 再决定要不要拆 multi-stage**。

---

## 1. 当前架构与问题

### 1.1 链路

```
iOS → POST /api/ai/analyze
       ↓
[Intent Classifier 7 层规则 + AI 兜底]
       ↓
  ├─ scam_detection → 走完整 ai.service.analyze（DB + RAG + DeepSeek 大调用 → JSON）
  ├─ general_chat   → IntentResponseService（小调用 → freeText）
  ├─ knowledge_query → IntentResponseService（小调用 → steps）
  └─ help_request   → IntentResponseService（小调用 → 应急步骤）
```

### 1.1.1 Intent Classifier 7 层完整逻辑

> 文件：`Server/src/modules/ai/intent/intent-classifier.service.ts`
> 设计目标：本地规则覆盖 70%+ 流量，AI 兜底覆盖剩余 30%
> 输出 `via` 字段记录命中层级，便于 admin 评测和优化

```
classify(content, ctx)
   │
   ▼
[Layer 0] 附件检查 (ctx.hasAttachment)
   │   图片 OCR / 语音转写 上传 → scam_detection (rule_strong)
   │   理由：用户主动上传附件几乎不会是闲聊
   │
   ▼
[Layer 1] 强信号正则 hasStrongSignal()       ← V3 F1 修复后提到 Layer 6 之前
   │   任一命中 → scam_detection (rule_strong)
   │   ┌─ URL  / 裸 www / 短链域名 (t.cn/bit.ly等) / 裸域名
   │   ├─ 中国手机号 / 国际手机号 / 座机号
   │   ├─ 银行卡（13-19 位数字 + Luhn 校验）
   │   ├─ 身份证号（18 位）
   │   ├─ 验证码 + 4-6 位数字
   │   ├─ 二维码 / 扫码关键词
   │   ├─ 金额 + 转账动作
   │   └─ 社交账号 ID（微信/QQ/Skype/Telegram/WhatsApp/抖音/Instagram + ID 字符串）
   │
   ▼
[Layer 6] 长度 / 字符兜底 isTooShortOrTrivial()
   │   触发条件：≤2 字 / 纯 emoji / 纯标点 / 重复字符（"啊啊啊"）
   │   ├─ 有 ctx.lastIntent 且 content<20 字 → 继承上一轮 intent (rule_ctx)
   │   └─ 否则 → general_chat (rule_short)
   │
   ▼
[Layer 2] help_request 关键词 matchesHelp()
   │   30+ 中文 + 15+ 英文关键词
   │   "被骗了 / 转账了 / 钱被转 / 怎么追回 / 96110 / 报警 /
   │    账号被盗 / 救我 / 求救 / SOS / 急急急 / 我完了"
   │   命中 → help_request (rule_help)
   │
   ▼
[Layer 3] scam_detection 关键词 matchesScamKeywords()
   │   ┌─ 3.1 直问真假：是不是骗子 / 真的吗 / 靠谱吗 / 可信吗 / 帮我看 / 帮我查 / 是 AI 吗
   │   ├─ 3.3 冒充话术：涉嫌洗钱 / 我是公安 / 安全账户 / 退税 / 中奖 /
   │   │              高息 / 高回报 / 保本 / 暴利 / 暴富 / 稳赚 / 躺赚 /
   │   │              日入过万 / 跟单 / 老师带飞 / 私募内幕
   │   ├─ 3.4 第三方指代：对方说 / 他说 / 让我转 / 老师让我 /
   │   │              有人说 / 有人介绍 / 有人推荐 / 群里有人
   │   └─ 3.5 平台异常：淘宝退款 / 银行短信 / 顺丰异常 / 风控
   │   命中 → scam_detection (rule_scam)
   │
   ▼
[Layer 4] knowledge_query 关键词 matchesKnowledge()
   │   ┌─ 4.1 定义型：什么是 / 什么叫 / 是什么 / 指的是什么
   │   ├─ 4.2 方法型：怎么识别 / 如何识别 / 怎么防 / 怎么举报 / 怎么报警 / 怎么追回
   │   ├─ 4.3 信息型：反诈中心 / 96110 / 有哪些 / 有几种
   │   ├─ 4.4 教育意图：教我 / 告诉我 / 想了解 / 学习 / 科普一下
   │   ├─ 4.5 术语本身：杀猪盘 / 钓鱼网站 / AI 换脸 / 深伪 / 黑产 / 灰产
   │   └─ 4.6 英文：what is / how to identify / explain / ponzi / phishing
   │   命中 → knowledge_query (rule_knowledge)
   │
   ▼
[Layer 5] general_chat 关键词 matchesGeneralChat()
   │   ┌─ 寒暄：你好 / 在吗 / 再见 / 晚安
   │   ├─ 感谢：谢谢 / 多谢 / 666 / 厉害
   │   ├─ 情绪：哈哈 / 难受 / 累 / 开心
   │   ├─ 问机器人：你是谁 / 你能干啥 / 怎么用
   │   └─ 显式非检测：不是问真假 / 就闲聊 / 随便聊 / 陪我说话
   │   命中 → general_chat (rule_chat)
   │
   ▼
[Layer 6.5] 上下文继承（前 6 层都没命中）
   │   有 ctx.lastIntent 且 content<30 字 → 继承上轮 intent (rule_ctx)
   │   触发场景："那这个呢？" / "为什么？" / "继续" 类延续追问
   │
   ▼
[Layer 7] AI 兜底 aiClassify()
   │   调 DeepSeek 让 AI 直接判定（system + user prompt 见后）
   │   返回 4 类之一 → (via: ai)
   │   AI 失败 → general_chat (via: ai_fail)
```

**Layer 7 的 DeepSeek 调用**：

System Prompt:
```
你是意图分类器。把用户消息归到 4 个类别中之一，只返回 1 个英文 key，
禁止任何额外文字。类别：scam_detection (辨别真假) / general_chat (闲聊) /
knowledge_query (问反诈知识) / help_request (紧急求助)
```

User Prompt:
```
用户消息：「{content.slice(0, 500)}」
类别：
```

预期返回：`scam_detection` 等单词

### 1.1.2 上下文继承机制（ctx.lastIntent 来源）

> 文件：`Server/src/modules/ai/ai.service.ts.inferLastIntent()`

iOS 把上轮 assistant 回复打 tag 后传给服务端：

```
[intent:scam_detection|risk:high] 20% 收益听起来很诱人...
[intent:general_chat] 你好呀！我是星识安全助手...
[intent:knowledge_query] 杀猪盘是...
[intent:help_request] 立即拨打 96110...
```

服务端按以下顺序解析 `lastIntent`：

| 优先级 | 检测方式 | 适用 |
|---|---|---|
| 0 | 正则 `^\s*\[intent:([a-z_]+)\]` 解析 tag | iOS 新格式（V4+）|
| 1 | JSON.parse 看 `obj.intent` | 兼容老格式 |
| 2 | 文本启发式（96110/止付 → help；什么是/杀猪盘 → knowledge；[high]/[medium]/风险/可疑/诈骗 → scam）| iOS 老版本兜底 |
| 3 | 都没匹配 → general_chat | 默认 |

解析出来的 `lastIntent` 喂给 Layer 6 和 Layer 6.5，让"需要"、"那这个呢"类短句续问能继承上一轮的意图。

### 1.1.3 各层流量分布预估（实测可在 admin AI 评测页 via 字段统计）

| Layer | 命中场景 | 预估占比 | 平均延迟 |
|---|---|---|---|
| 0 附件 | OCR/语音上传 | <5% | <10ms |
| 1 强信号 | 含 URL/号码/卡号 | ~40% | <10ms |
| 6 trivial | 1-2 字短句 | ~10% | <10ms |
| 6.5 上下文继承 | "继续/为什么" | ~5% | <10ms |
| 2 help | 已受害 | <5% | <10ms |
| 3 scam 关键词 | 问"是不是骗子" | ~15% | <10ms |
| 4 knowledge | 问"什么是 XX" | ~5% | <10ms |
| 5 chat | 寒暄 | ~10% | <10ms |
| 7 AI 兜底 | 其他 | ~5% | 200-500ms + 一次 DeepSeek 调用 |

设计目标：90%+ 流量在本地规则解决（Layer 0-6.5），仅 ~10% 落到 AI 兜底。

### 1.1.4 各 intent 进入后的处理路径

```
scam_detection → ai.service.analyze 完整流程
  • inputParser 解析输入类型
  • riskService 查精确风险库
  • rag.searchKnowledgeCases 取相似案例（≤5 条）
  • prompts.buildSystemPrompt + buildUserPrompt 组装
  • DeepSeek 大调用（~1500 token in / ~500 token out）
  • riskScoreService 综合评分
  • ensureFullResult i18n 兜底
  • Redis 缓存（high:365天/其他:90天）
  • 写 query + ai_log + ai_evaluation_sample

general_chat / knowledge_query / help_request → IntentResponseService.generate
  • getPromptForIntent 选对应 intent 的 prompt 模板
  • buildContextPrefix 注入历史对话（最多 50 轮 / 16000 字）
  • DeepSeek 小调用（~500-1500 token in / ~200 token out）
  • safeJsonParse 容错
  • Redis 缓存 1h（help_request 不缓存）
  • 写 ai_evaluation_sample
```

### 1.2 真正的问题（按严重程度排）

| # | 问题 | 严重 | 当前症状 |
|---|---|---|---|
| 1 | **无评测基线** | 🔴 致命 | 改一版 prompt 不知道是好是坏，永远在猜 |
| 2 | **分析模板化** | 🟠 重要 | summary/reasons 都长得像反诈中心新闻稿，缺细节 |
| 3 | **RAG 案例当"参考"注入** | 🟠 重要 | AI 套模板而非独立判断（框架效应） |
| 4 | **confidence 强制分桶** | 🟡 一般 | AI 倾向输出 75/85 等边界值，分布不自然 |
| 5 | **无 CoT** | 🟡 一般 | 推理过程黑盒，错了不知道为啥 |
| 6 | **无反馈闭环** | 🟠 重要 | 用户点了/不点广播，没人记录 |
| 7 | **risk_type 白名单太窄** | 🟡 一般 | "暴利赚钱"硬塞"投资骗局"，缺"传销/其它"等 |

### 1.3 不是问题的问题（曾经想做但其实不必要）

| 曾考虑的 | 为什么暂时不做 |
|---|---|
| 拆 multi-stage pipeline | 单次调用质量瓶颈不在结构，在 prompt 本身 |
| 加 LLM Validator | 5-10 行规则代码能覆盖 80% 验证逻辑 |
| 加 Stage 4 Format 转换 | 用 `<verdict><reasons>` 标签 + 正则提取即可 |
| 重做 Intent Classifier | 现有 7 层 + AI 兜底已经够用 |

---

## 2. 目标

### 2.1 6 个月内要做到

| 指标 | 当前估计 | 6 个月目标 |
|---|---|---|
| Schema 解析失败率 | ~5% | <1% |
| 高风险召回率（真诈骗被识别为 high）| ~75% | ~85% |
| 误报率（safe 被误判为 medium+） | ~20% | <12% |
| reasons "具体度"（人工评 1-5）| ~3.0 | ~4.0 |
| P50 响应时间 | 3-5s | 2-3s |
| 每次成本 | ~$0.002 | <$0.0015 |

### 2.2 不做什么（明确划线）

- ❌ 不会一上来推倒重写 ai.service.analyze
- ❌ 不会强制用户自己做大规模测试
- ❌ 不会在没有数据的情况下做大型架构改动
- ❌ 不会引入新的依赖（vector DB / vision LLM）除非数据证明必要

---

## 3. 设计哲学

1. **看见现状**：先把生产里 AI 输入输出全收集起来（无需用户做事）
2. **小步快跑**：每次改 prompt 一项，单独验证
3. **影子模式**：新 prompt 后台跑、用户看旧的（零风险）
4. **数据驱动**：决策基于"50 条样本人工打分"，不靠感觉
5. **AI 助手代劳**：所有代码改动和数据归拢都由 AI 助手做，用户只需要在 admin 页点几下打分

---

## 4. 四阶段执行路径

```
P0 可观测性（1 周）
   │
   ▼
P1 安全微改（1 周，灰度 1%）
   │
   ▼
P2 影子模式 + 数据收集（2-3 周）
   │
   ▼
P3 基于数据决策下一步
   ├─ 数据说"分析质量明显涨了" → 全量上线，结束本期
   ├─ 数据说"涨了但不够" → 加 RAG 重排 / Validator
   ├─ 数据说"没涨" → prompt 不是瓶颈，查别的方向（缓存/streaming/模型替换）
   └─ 数据说"反而降了" → 回滚，复盘
```

---

## 5. P0 — 可观测性（这周做完）

> **目标**：把生产里每次 AI 调用的输入、输出、用户反应全记录下来，并且 admin 能 5 分钟看一批。
> **谁来做**：AI 助手写代码；用户只在 admin 页打分。

### 5.1 数据库改动

新加 `ai_evaluation_samples` 表（不影响现有表）：

```prisma
model AiEvaluationSample {
  id              String   @id @default(cuid())
  conversationId  String?
  userId          String?
  /// 输入快照
  inputContent    String   @db.Text
  inputType       String   /// text / phone / url / company / screenshot
  language        String   /// zh / en
  /// 实际发给 AI 的 prompt 完整副本（system + user）
  promptSnapshot  Json
  /// AI 原始 raw 响应
  aiRawResponse   String   @db.Text
  /// 经 parseAndValidateAiOutput 后的结构化结果
  parsedResult    Json
  /// intent 分类结果 + via
  intent          String?
  intentVia       String?
  /// prompt 版本号（"baseline" / "v2_cot" / "v3_reranked" 等）
  promptVersion   String   @default("baseline")
  /// 用户后续行为（可选，事后填）
  userSharedToFamily Boolean?
  userDismissed   Boolean?
  /// admin 评分（事后人工填）
  adminScore      Int?     /// 1-5
  adminLabel      String?  /// 准确/具体/安全 综合标签
  adminNotes      String?  @db.Text
  /// 元信息
  modelProvider   String   /// doubao / deepseek
  latencyMs       Int
  tokensUsed      Int?
  createdAt       DateTime @default(now())

  @@index([createdAt(sort: Desc)])
  @@index([promptVersion, createdAt])
  @@index([adminScore])
  @@map("ai_evaluation_samples")
}
```

### 5.2 服务端改动

`ai.service.ts.analyze()` 末尾追加：

```typescript
// 异步写评测样本（不阻塞响应）
this.recordEvaluationSample({
  conversationId,
  userId,
  inputContent: input.content,
  inputType: parsed.inputType,
  language,
  promptSnapshot: { system: systemPrompt, user: userPrompt },
  aiRawResponse: aiResult?.raw ?? '',
  parsedResult: final,
  intent: 'scam_detection',
  intentVia: 'rule_strong', // 或 ai 等
  promptVersion: 'baseline',
  modelProvider: provider,
  latencyMs: Date.now() - startedAt,
  tokensUsed: aiResult?.tokens,
}).catch((e) => this.logger.warn(`记录评测样本失败: ${e.message}`));
```

抽样率控制：可以 100% 也可以 10%（看 DB 写压力）。建议初期 100%。

### 5.3 Admin 页

新建 `/ai-evaluation` 页面：

```
┌──────────────────────────────────────────────┐
│  AI 分析评测中心                                │
├──────────────────────────────────────────────┤
│  筛选：  prompt 版本 [baseline ▼]  状态 [未评分 ▼] │
│         intent [全部 ▼]   时间 [近 7 天 ▼]      │
│                                                │
│  样本列表（每条展开看 prompt + 输出）             │
│  ┌─ 用户问: "微信号 xyz..." ──── ⭐⭐⭐ [打分] ─┐│
│  │  AI 答: high risk ...                       ││
│  │  [展开看完整 prompt]                         ││
│  │  打分：⭐⭐⭐⭐⭐  □准确 □具体 □安全 备注[ ] ││
│  └──────────────────────────────────────────┘ │
│  ...                                            │
│                                                │
│  统计  baseline 已标注 32/100  平均 3.4 ⭐      │
└──────────────────────────────────────────────┘
```

用户日常工作：每天打开 1 次，5 分钟评 10 条。

### 5.4 P0 验收标准

- [ ] DB 表创建并完成 migration
- [ ] 服务端写入采样代码上线
- [ ] Admin 页可以浏览样本 + 打分 + 看统计
- [ ] 部署 3 天后，至少 50 条样本被记录
- [ ] 用户人工评出 20 条，建立 baseline 分（baseline_score = 平均⭐数）

---

## 6. P1 — 安全微改（P0 完成后，1 周）

> **目标**：改 prompt 的 4 个小点，灰度 1% 用户试用。
> **触发条件**：P0 已收集到 ≥ 30 条人工标注 baseline 样本。

### 6.1 改动清单

#### 6.1.1 加 CoT（Chain of Thought）

System prompt 末尾加：

```
## 输出前请先在 <think> 标签内自由推理（不要写 JSON）：
<think>
1. 这条 query 在说什么？关键事实是什么？
2. 有没有诈骗的"骨架"？是什么类型？
3. 有反向证据吗？也许是合法场景？
4. 我有多大把握？
</think>

然后再输出 JSON。服务端会自动剥掉 <think> 部分，不要担心格式问题。
```

服务端 `parseAndValidateAiOutput()` 改为：

```typescript
// 剥掉 <think>...</think>
const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
// 然后继续原有的 JSON 解析
```

**好处**：AI 真做推理；token 多一点但 reasons 明显更具体。
**风险**：响应略变慢（+10-15%），成本略增（+15-20%）。

#### 6.1.2 confidence 去分桶

system prompt 删除：

```
- high（confidence 75-100）...
- medium（confidence 45-74）...
- low（confidence 20-44）...
```

改成：

```
- confidence 写 0-100 的整数，反映你的实际把握。
- 不要为了对齐档位强行打分。
- 服务端会根据 risk_level + confidence 综合渲染。
```

iOS 端：`riskLevel` 仍按 server 计算结果显示（high/medium/low 区分依旧）。

#### 6.1.3 RAG 案例措辞改写

`ai-prompts.service.ts.buildUserPrompt` 改：

```typescript
// 老的
const ref = '\n\n【参考相似案例（仅作参考）】：\n';
// 新的
const ref = '\n\n【可能相关的反诈知识（也可能不相关，自己判断）】：\n';
```

**好处**：缓解锚定效应。

#### 6.1.4 risk_type 加"其它"兜底

system prompt 的 risk_type 提示改：

```
【risk_type 允许的分类】
诈骗、投资骗局、兼职骗局、钓鱼网站、老年人骗局、黑灰产、情感骗局、传销、非法集资、其它
（确实不属于以上任何一类时选"其它"，不要硬塞）
```

iOS 也加 "其它" 标签的渲染（默认灰色 Tag）。

### 6.2 灰度策略

不全量上线。按 `userId hash % 100 < 1` 分流 1%：

```typescript
const isExperimental = (createHash('md5').update(userId ?? 'anon').digest().readUInt8(0) < 3);
const promptVersion = isExperimental ? 'v1_cot_2026q2' : 'baseline';
```

记录到 `promptVersion` 字段。Admin 页可按版本筛选查看。

### 6.3 P1 验收标准

- [ ] 灰度配置部署上线
- [ ] 1 周后采集到 ≥ 100 条 v1_cot_2026q2 样本
- [ ] 用户人工评 30 条 v1 样本
- [ ] 对比 baseline_score vs v1_score：
  - 如果 v1 ≥ baseline + 0.5 ⭐ → 进入 P2 影子模式
  - 如果差距 < 0.5 ⭐ → 改动可能不够，回 6.1 继续微调
  - 如果 v1 < baseline → 回滚 v1，复盘

---

## 7. P2 — 影子模式（P1 通过后，2-3 周）

> **目标**：新 prompt 已在 1% 用户上验证有效。现在让它跟 baseline 在每个请求上**并行跑**，对比哪个好。
> **关键**：用户看到的仍是 baseline，不影响体验。

### 7.1 实现思路

`ai.service.analyze()` 改为：

```typescript
// 同时跑两个 prompt
const [baselineResult, shadowResult] = await Promise.allSettled([
  this.runWithPrompt(baselinePrompt, ...),
  this.runWithPrompt(shadowPrompt, ...),
]);

// 用户看 baseline
const userResult = baselineResult.status === 'fulfilled' ? baselineResult.value : null;

// 异步对比两边，写入 evaluation_samples 时打"shadow 对照对"
this.recordShadowComparison(baselineResult, shadowResult);

return userResult;
```

成本：每次 AI 调用 ×2。所以**只在 5-10% 流量开影子模式**，足够采集数据。

### 7.2 Admin 对比页

```
┌──────────────────────────────────────────────────────┐
│  影子对比查看                                          │
├──────────────────────────────────────────────────────┤
│  用户问: "微信号 ty20191215hy"                          │
│                                                        │
│  ┌─── baseline ──────┐  ┌─── shadow (v1_cot) ──┐    │
│  │ risk: medium       │  │ risk: high             │    │
│  │ confidence: 65     │  │ confidence: 82         │    │
│  │ summary: ...       │  │ summary: 具体到... │    │
│  │ reasons:           │  │ reasons:               │    │
│  │ - 模板化原因 1     │  │ - 包含"赚钱暴利"高危词 │    │
│  │ - 模板化原因 2     │  │ - 陌生人主动加微信     │    │
│  │ - 模板化原因 3     │  │ - 缺乏可验证身份信息   │    │
│  └────────────────────┘  └────────────────────────┘    │
│                                                        │
│  哪个好？  [○ baseline   ○ shadow   ○ 差不多]         │
│  说明（可选）：[                              ]        │
└──────────────────────────────────────────────────────┘
```

### 7.3 P2 验收标准

- [ ] 影子模式部署，10% 流量同时跑两个 prompt
- [ ] 持续 2 周采集 ≥ 200 对对比
- [ ] 用户人工对比 50 对
- [ ] **shadow 胜率 ≥ 65%** → 全量上线 v1，进入 P3
- [ ] shadow 胜率 50-65% → 不够明显，继续优化 prompt 微调
- [ ] shadow 胜率 < 50% → 回退，复盘 prompt 改动逻辑

---

## 8. P3 — 基于数据决策（P2 完成后，持续）

P2 跑完后，看数据决定下一步。给一个 decision matrix：

| 数据现象 | 下一步动作 |
|---|---|
| **召回率低**（真诈骗被漏 ≥ 25%） | 加 RAG 重排（embedding 召回）+ 关键词扩充 |
| **精确率低**（safe 误报 ≥ 18%） | 加规则 Validator 拦"绝对/必然"等过激词 |
| **延迟高**（P95 > 6s） | streaming 输出（iOS 边收边渲染）+ 调小 max_tokens |
| **成本高**（>$0.003 / 次） | 缓存策略优化 + 短查询用小模型 |
| **specific 度低**（reasons 仍模板化）| multi-stage：先 CoT 推理 → 再结构化 |
| **以上都还行** | 维持现状，转去做别的功能 |

**关键原则**：不超过 1 个方向并行优化。每次改一项，跑 1-2 周验证，再决定下一项。

---

## 9. 回滚预案

每次变更都有明确的回滚开关：

| 变更项 | 回滚方式 |
|---|---|
| P0 采样写入 | 设环境变量 `AI_EVAL_SAMPLE_RATE=0` 即停止采样 |
| P1 灰度新 prompt | 设环境变量 `AI_EXPERIMENT_PERCENT=0` 即全部走 baseline |
| P2 影子模式 | 设环境变量 `AI_SHADOW_PERCENT=0` 即关闭 |
| P3 全量新 prompt | 改 `BASELINE_PROMPT_VERSION` 切回 v0 |

任何阶段如果用户投诉激增、客诉率 +3%、CTR 下降 -10%，**立即回滚**到上一稳定版本。

---

## 10. 时间表

| 周 | 阶段 | 用户参与 | 工作量 |
|---|---|---|---|
| W1 | P0 部署采样 + admin 页 | 部署完成后第 3-7 天每天评 10 条 | AI 助手 1d 写代码；用户 5min×7 天 |
| W2 | 整理 baseline 评分 + 准备 v1 prompt | 用户审一下 prompt 改动 | AI 助手 0.5d |
| W3 | P1 灰度 1% v1 | 周末看一下灰度数据 | AI 助手 0.5d |
| W4 | 持续灰度 + 评 v1 样本 | 每天 5min 评 10 条 v1 | 用户 5min×7 天 |
| W5 | 对比 baseline vs v1 → 决定进 P2 | 看决策报告 | AI 助手 1d 生成报告 |
| W6-W7 | P2 影子模式跑 | 偶尔人工对比 | 用户 5min×14 天 |
| W8 | P3 基于数据决策 | 看决策报告 | AI 助手 0.5d |
| W9+ | 选定一个方向继续 | 按需 | 视方向而定 |

**总周期 8-10 周，用户每周 1-2 次 5 分钟操作，零代码工作。**

---

## 11. AI 助手代劳清单

✅ **AI 助手做的所有事**：
- DB schema + migration（P0）
- 服务端采样代码（P0）
- Admin 评测页 UI（P0）
- prompt 改写 + Validator 规则（P1）
- 灰度配置 + 影子模式代码（P1, P2）
- 每周生成数据分析报告（P1 末、P2 中、P2 末）
- 决策建议（每阶段末）

❌ **必须用户做的事**：
- 在 admin 评测页打分（每周 5min × 几天，无法代劳）
- 关键决策点确认（要不要进 P2、要不要进 P3、回滚不回滚）
- 对 prompt 修改方向的业务判断

---

## 12. 关键问题 FAQ

### Q1：为什么不一开始就拆 multi-stage？

A：multi-stage 真正必要的 4 个条件（token 塞不下 / 多模型 / 工具调用 / 极高质量要求）我们都不满足。盲目拆只是增加复杂度、调试难度、失败点，质量未必涨。让数据告诉我们要不要拆。

### Q2：为什么要影子模式而不是直接 A/B？

A：A/B 让一部分用户真的看新 prompt，如果新 prompt 有问题用户会受影响。影子模式后台跑、用户看旧版，零体验风险。验证完才全量。

### Q3：我评不出 50 条怎么办？

A：30 条够。重要的是覆盖典型场景：诈骗类（投资/刷单/杀猪盘/钓鱼/冒充）、闲聊、知识问答、追问、边缘案例。AI 助手可以筛好 30 条候选给你，你只需要打分。

### Q4：如果 P1 灰度发现新 prompt 不行怎么办？

A：直接回滚 `AI_EXPERIMENT_PERCENT=0`，零影响。然后 AI 助手分析具体失败 case，提下一版 prompt。这是迭代过程，第一版可能不行很正常。

### Q5：DeepSeek API 偶尔慢/挂会影响这个流程吗？

A：不影响。采样写入是异步的、灰度是 try/catch 的、影子模式是 Promise.allSettled 的。任何 stage 失败都降级到 baseline。

### Q6：预算上限是多少？

A：
- P0 采样：~$2/月（仅 DB 写入）
- P1 灰度 1%：~$0.5/月（额外 AI 调用）
- P2 影子模式 10%：~$5/月（双倍 AI 调用）
- P3 决策：按选定方向算

总计 **W1-W8 实验期成本 < $20**，可接受。

---

## 13. 附录：术语

| 术语 | 释义 |
|---|---|
| baseline | 当前生产 prompt 的版本 |
| shadow / 影子模式 | 新 prompt 跟旧 prompt 并行跑，但用户只看旧的 |
| 灰度（canary） | 让小比例用户先看新版 |
| 评测样本 | 真实生产 AI 调用的输入+输出+人工评分的快照 |
| CoT (Chain of Thought) | 让 AI 先自由推理再出结构化输出 |
| 框架效应 | 给 AI 示例时，AI 倾向于"套示例的模板" |
| 锚定 | 给 AI 一个数（如 confidence=75 阈值），AI 倾向往这附近输出 |

---

## 14. 变更记录

| 日期 | 版本 | 主要修订 |
|---|---|---|
| 2026-05-31 | V1 | 初稿。基于 W1-W8 实操可执行原则。 |

---

## 下一步

✅ 收到这个文档，**请回复以下任意一个**：

1. **"开始 P0"** → AI 助手立即写 DB schema + admin 评测页 + 采样代码
2. **"先调整方案"** → 你觉得哪里不合理，AI 助手按你的反馈改 V2
3. **"先讨论 Q&A 里某个问题"** → AI 助手详细回答你的疑问
