# AI 分析完整流程：从用户输入到 APP 展示

本文档按**当前代码**梳理：用户输入一段内容后，从发给大模型到收到内容并显示在 APP 上的**全链路**，包括各环节的数据格式。

---

## 一、你图里看到的现象说明

图中展示的是：

- **用户输入**：有人发短信说要退款给我,我应该相信吗? 告诉我原因。
- **展示结果**：未知 / 得分 27 / 无法确定风险 / 原因：AI 返回格式异常或无法解析 / 建议：请谨慎对待,勿轻信对方。

这些文案来自服务端的**兜底逻辑**：当豆包返回的内容**无法被解析成约定 JSON** 时，`parseAndValidateAiOutput` 会返回上述固定内容。也就是说：**大模型有被调用，但返回的格式不符合预期，后端按“解析失败”处理并给了兜底结果。**

下面按步骤说明整条链路的格式与代码位置。

---

## 二、整体流程概览

```
用户输入
  → iOS 构造请求 body
  → POST /api/ai/analyze（Server）
  → 解析类型 → 风险库 → RAG → 拼装 Prompt
  → 调用豆包（大模型）→ 拿到 raw 文本
  → 解析/校验 JSON → 得分引擎 → 写库/缓存
  → 返回 JSON 给 iOS
  → iOS 解码 → 转成 ViewData → RiskResultCard 展示
```

---

## 三、各环节数据格式（按当前代码）

### 1. 用户输入（APP）

- 用户输入：`有人发短信说要退款给我,我应该相信吗? 告诉我原因。`
- 在 **HomeViewModel** 中：`analyze()` → `runAnalysisForLastTurn(content: content, isScreenshot: false)`。
- **InputClassifier.classify(content, isScreenshot: false)**：  
  - 当前逻辑下，无 URL/电话/公司关键词时归为 **aiText**，走 **POST /api/ai/analyze**（不是 /api/query/url 等）。

---

### 2. iOS 发给 Server 的请求

**接口**：`POST https://api.starlensai.com/api/ai/analyze`

**Request Headers**（示意）：

- `Content-Type: application/json`
- `Accept: application/json`
- `Authorization: Bearer <accessToken>`（已登录时）

**Request Body**（JSON，来自 `RiskAnalysisRequest`）：

```json
{
  "content": "有人发短信说要退款给我,我应该相信吗? 告诉我原因。",
  "language": "zh",
  "country": null
}
```

- `content`：用户输入原文。
- `language`：固定 `"zh"`（当前调用处）。
- `country`：可选，多为 `null`。

代码位置：  
`iOS` → `AIService.analyzeText` → `AIRepository.analyze(RiskAnalysisRequest)` → `NetworkManager.request(.aiAnalyze, body: request)`。

---

### 3. Server 入口与 DTO

**Controller**：`AiController.analyze()`  
- Body 绑定：`AnalyzeTextDto { content, language?, country? }`  
- 调用：`AiService.analyze({ content, language, country }, userId)`。

---

### 4. Server 内部：解析 → 风险库 → RAG → Prompt

**（1）输入解析**  
- `InputParserService.parse(content, isScreenshot)`  
- 使用 `detectType(content)`：  
  - 无 `http(s)://`、非 URL 模式、非电话、无公司关键词 → **inputType = "text"**。  
- 输出：`{ inputType: "text", normalizedContent, originalContent }`。

**（2）风险库**  
- `RiskService.checkRisk(inputType, originalContent)`  
- 若库里无命中 → `dbCheck = null`，后续 prompt 里不附带“风险库命中”说明。

**（3）RAG 知识库**  
- `RagKeywordService.keywordExtract(originalContent)` 得到关键词。  
- `RagKeywordService.searchKnowledgeCases(keywords, 5, language)` 得到若干条案例。  
- 有则拼进 userPrompt 的“参考案例”部分，没有则为空。

**（4）拼装发给大模型的 Prompt**

- **System Prompt**（`AiPromptsService.buildSystemPrompt(language)`）  
  - 中文时大意：你是安全风险分析助手，根据用户输入分析诈骗、黑灰产、钓鱼等风险。  
  - 后面紧跟一段**强制 JSON 格式说明**（见下）。

- **User Prompt**（`AiPromptsService.buildUserPrompt(originalContent, inputType, language, ragCases, dbCheck?.risk_level)`）  
  - 示例（无风险库命中、无 RAG 案例时）：
    ```text
    用户输入类型：文本
    内容：
    有人发短信说要退款给我,我应该相信吗? 告诉我原因。
    ```
  - 若有风险库命中，会追加：`风险库命中结果：high/medium/low（请结合该结果综合判断）`。  
  - 若有 RAG 案例，会追加：`参考以下相似案例（仅作参考）：\n[标题] 内容...`。

- **System 里约定的 JSON Schema**（当前代码中的说明文字）：
  ```text
  请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。格式必须为：
  {
    "risk_level": "high 或 medium 或 low 或 unknown",
    "confidence": 0-100 的整数,
    "risk_type": ["从以下选一个或多个：诈骗、黑灰产、钓鱼网站、投资骗局、兼职骗局、假客服、虚假医疗、老年人骗局、未知风险"],
    "summary": "一句话总结",
    "reasons": ["原因1", "原因2"],
    "advice": ["建议1", "建议2"]
  }
  ```

---

### 5. 提交给大模型（豆包）的格式

**调用方式**：HTTP POST，OpenAI 兼容的 Chat Completions 接口。

- **URL**：`{DOUBAO_API_URL}/chat/completions`（如 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`）  
- **Headers**：`Authorization: Bearer <DOUBAO_API_KEY>`，`Content-Type: application/json`  

**Body（发给豆包的 JSON）**：

```json
{
  "model": "doubao-pro-32k",
  "messages": [
    {
      "role": "system",
      "content": "你是一个安全风险分析助手。根据用户输入... \n请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。格式必须为：\n{ \"risk_level\": \"high 或 medium 或 low 或 unknown\", ... }"
    },
    {
      "role": "user",
      "content": "用户输入类型：文本\n内容：\n有人发短信说要退款给我,我应该相信吗? 告诉我原因。"
    }
  ],
  "temperature": 0.3
}
```

也就是说：**提交给大模型的是「系统说明 + 用户内容」两段纯文本，没有单独再传 JSON schema 对象**；格式约定写在 system 的 `content` 里。

---

### 6. 大模型（豆包）返回的内容

**HTTP 响应**：标准 Chat Completions 结构。

- 我们只用：`response.data.choices[0].message.content`  
- 类型：**字符串**。  
- 期望内容：**一个合法 JSON 字符串**，且字段为 `risk_level`、`confidence`、`risk_type`、`summary`、`reasons`、`advice`（下划线命名），例如：

```json
{"risk_level":"medium","confidence":75,"risk_type":["假客服"],"summary":"此类退款短信常为假客服诈骗，需警惕。","reasons":["主动退款多为诈骗话术","索要验证码或链接"],"advice":["勿点链接、勿透露验证码","通过官方渠道核实"]}
```

**若豆包返回的是**：

- 带 markdown 代码块（如 \`\`\`json ... \`\`\`）、前后多余说明、或键名/结构不一致（如 `riskLevel` 驼峰、少字段、多了一层包装等），  
则会在下一步被判定为「解析失败」，进入兜底逻辑。

---

### 7. Server 解析豆包返回并得到“分析结果”

**（1）取 raw 字符串**  
- `AiProviderService.analyzeWithDoubao` 返回 `{ raw: content, provider, model, tokens, latencyMs }`，其中 `content` 即上面的 `choices[0].message.content` 字符串。

**（2）解析与校验**  
- `parseAndValidateAiOutput(aiResult.raw)`（`ai.types.ts`）：  
  - 去掉 \`\`\`json / \`\`\`，trim。  
  - `JSON.parse(cleaned)`，再按约定取字段并校验类型。  
  - 若**任一步抛错或字段不符合**：**不抛异常，直接返回兜底对象**：

```ts
{
  risk_level: 'unknown',
  confidence: 50,
  risk_type: ['未知风险'],
  summary: '无法确定风险',
  reasons: ['AI 返回格式异常或无法解析'],
  advice: ['请谨慎对待，勿轻信对方'],
}
```

你图里的「无法确定风险」「原因：AI 返回格式异常或无法解析」「建议：请谨慎对待,勿轻信对方」就是这份兜底。

**（3）得分与最终等级**  
- `RiskScoreService.compute(parsedAi.risk_level, parsedAi.confidence, dbHit, ragCases)`  
  - 当 `parsedAi.risk_level === 'unknown'` 且无 `dbHit` 时，最终 `risk_level` 仍为 `'unknown'`，score 会算出一个数值（例如 27）。  
- 得到 **AnalyzeResult**：`{ ...parsedAi, risk_level, score }`（下划线命名保留）。

---

### 8. Server 返回给客户端（iOS）的格式

**HTTP**：200/201，Body 为 JSON。

**Response Body（AnalyzeResult，当前实现）**：

```json
{
  "risk_level": "unknown",
  "confidence": 50,
  "risk_type": ["未知风险"],
  "summary": "无法确定风险",
  "reasons": ["AI 返回格式异常或无法解析"],
  "advice": ["请谨慎对待，勿轻信对方"],
  "score": 27
}
```

（当解析失败时，就是上述兜底 + score 引擎算出的分数。）

---

### 9. iOS 接收并解码

- **接口**：`POST /api/ai/analyze` 的响应。  
- **解码类型**：`RiskAnalysisResult`（Codable），字段为**驼峰**：`riskLevel`、`confidence`、`riskType`、`summary`、`reasons`、`advice`、`score`。  
- **Key 策略**：`JSONDecoder` 使用 `convertFromSnakeCase`，因此服务端下划线 `risk_level` 会映射到 `riskLevel`。  
- **AIRepository.analyze** 返回 `RiskAnalysisResult`，**AIService** 再转成 **RiskAnalysisViewData**（对可选字段做兜底：`riskLevel ?? "unknown"` 等）。

---

### 10. APP 上展示给用户的数据与 UI

- **数据**：`RiskAnalysisViewData`  
  - `riskLevel` → 展示用文案：`riskLevelDisplay`（"未知" / "高风险" / "中风险" / "低风险"）  
  - `score` → "得分 27"  
  - `summary` → "无法确定风险"  
  - `reasons` → 列表，标题「原因」，逐条展示  
  - `advice` → 列表，标题「建议」，逐条展示  

- **UI**：**RiskResultCard**  
  - 顶部：`riskLevelDisplay` + 得分  
  - 正文：`summary`  
  - 若有 `reasons`：标题「原因」+ 列表  
  - 若有 `advice`：标题「建议」+ 列表  

所以你图里的每一行，都对应上述兜底 + ViewData + RiskResultCard 的展示逻辑。

---

## 四、流程与格式小结表

| 阶段           | 数据/格式说明 |
|----------------|----------------------------------------------------------------|
| 用户输入       | 纯文本，如："有人发短信说要退款给我,我应该相信吗? 告诉我原因。" |
| iOS → Server   | POST /api/ai/analyze，Body: `{ "content", "language", "country" }` |
| Server 内部    | 解析为 text → 风险库查 → RAG 查 → 拼 system + user prompt |
| 发给豆包       | POST .../chat/completions，body: `{ model, messages: [system, user], temperature }` |
| 豆包返回       | `choices[0].message.content` 一个字符串，期望为合规 JSON |
| Server 解析    | `parseAndValidateAiOutput(raw)` → 成功则结构化结果，失败则**兜底**（你图里的文案） |
| 得分与最终结果 | `RiskScoreService.compute` → `AnalyzeResult`（含 score、risk_level） |
| Server → iOS   | JSON：`risk_level`、`confidence`、`risk_type`、`summary`、`reasons`、`advice`、`score` |
| iOS 展示       | `RiskAnalysisResult` → `RiskAnalysisViewData` → **RiskResultCard**（未知/得分/总结/原因/建议） |

---

## 五、你图里“未知 + 得分 27 + AI 返回格式异常”的成因

- **豆包确实被调用了**，但返回的 `content` 在服务端**没有被成功解析成约定 JSON**。  
- 可能原因包括：  
  - 返回了 markdown 代码块或前后有说明文字，清理后仍不是合法 JSON。  
  - 键名用了驼峰（如 `riskLevel`）或多了/少了字段，导致解析或校验失败。  
  - 返回被截断、编码问题等。  
- 一旦解析失败，**不会把 raw 直接给用户**，而是用固定兜底 + 得分引擎的分数（如 27），所以你会看到「未知」「得分 27」「无法确定风险」「原因：AI 返回格式异常或无法解析」。

要确认具体原因，需要看 Server 日志里 **`[DOUBAO] RAW_FULL`** 的完整内容；若你愿意，我可以再根据你贴出的 RAW_FULL 帮你改解析逻辑或 Prompt，让豆包稳定输出可解析的 JSON。
