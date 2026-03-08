# IsItSafe 后台（Server）完整框架与细节（小白可读版，RAG 先用关键词检索 MVP）

目标：
搭建 IsItSafe 的后端服务（server/），为 iOS App 和 admin 管理后台提供统一 HTTPS API（最终用域名访问）。
核心是“AI 风险判断引擎”：Input Parser → Risk DB → RAG(关键词检索) → AI 多模型 → Risk Score → 缓存/日志 → 返回统一 JSON。

技术栈：
- Node.js + NestJS
- PostgreSQL（主数据库）
- Redis（缓存、限流、去重）
- Prisma ORM
- AI Provider 可切换：豆包 / OpenAI / 未来其他模型
- RAG 先做“关键词检索（全文检索/ILIKE）”，后续可升级向量检索

项目目录结构（建议）：
server/
 ├ src/
 │  ├ modules/
 │  │  ├ auth/           # 登录/Token
 │  │  ├ ai/             # 核心AI引擎（Parser/DB/RAG/Provider/Score）
 │  │  ├ query/          # 电话/网址/公司查询（复用risk_data）
 │  │  ├ knowledge/      # 知识库（案例、分类、搜索、批量导入）
 │  │  ├ report/         # 举报中心（处理状态）
 │  │  ├ subscription/   # IAP订阅验证与状态
 │  │  ├ admin/          # 管理后台专用接口（权限）
 │  │  ├ settings/       # AI Key/Provider/域名等配置
 │  │  └ analytics/      # 数据统计（查询量/风险分布）
 │  ├ common/
 │  │  ├ guards/         # JWT/Role 守卫
 │  │  ├ utils/          # normalize/hash/desensitize
 │  │  └ rate-limit/     # 防刷/限流
 │  └ main.ts
 └ prisma/

=====================================================================
一、AI风险分析统一输出格式（必须强制）
=====================================================================

所有模型必须返回 JSON ONLY（无 markdown、无多余文字）：

{
  "risk_level": "high | medium | low | unknown",
  "confidence": 0-100,
  "risk_type": [
    "诈骗",
    "黑灰产",
    "钓鱼网站",
    "投资骗局",
    "兼职骗局",
    "假客服",
    "虚假医疗",
    "老年人骗局",
    "未知风险"
  ],
  "summary": "一句话总结",
  "reasons": ["原因1","原因2"],
  "advice": ["建议1","建议2"]
}

字段说明：
- risk_level：风险等级（高/中/低/不确定）
- confidence：可信度（0-100）
- risk_type：风险类型数组
- summary：一句话总结
- reasons：判断依据（要具体）
- advice：给用户的行动建议（要可执行）

（可选 debug 字段：仅服务端日志用，默认不返回给用户）
debug:
- model_source：doubao/openai/other
- db_hit：true/false
- rag_hits：命中案例数量
- score：最终分数

=====================================================================
二、Server AI分析流程（核心逻辑）
=====================================================================

整体架构：
User Input
   │
   ▼
Input Parser（识别输入类型）
   │
   ▼
Risk Database Check（查黑名单/风险库）
   │
   ▼
RAG Knowledge Search（关键词检索案例库）
   │
   ▼
AI Model Analysis（豆包/ OpenAI/ 其他）
   │
   ▼
Risk Score Engine（统一打分校准）
   │
   ▼
Cache & Log（Redis缓存 + 写历史/日志）
   │
   ▼
Return JSON

模块说明：
- Input Parser：识别输入（text/phone/url/company/screenshot）
- Risk DB：命中黑名单直接提升风险
- RAG：从案例/知识库里找相似案例作为证据
- AI：按固定 schema 输出 JSON
- Risk Engine：合并 DB/RAG/AI，避免大模型飘
- Cache：同样问题不重复花钱
- Log：为历史/统计/优化提供数据

=====================================================================
三、输入解析系统 Input Parser
=====================================================================

用户输入类型：
- text：普通问题
- phone：电话号码
- url：网址/链接
- company：公司/平台/投资机构
- screenshot：截图（先 OCR → text）

统一解析结构：
{
  "input_type": "text | phone | url | company | screenshot",
  "content": "用户输入内容",
  "country": "CN | US | ...",
  "language": "zh | en",
  "user_id": "可选（登录后有）"
}

解析规则（示例）：
- 包含 http/https → url
- 近似电话号码（纯数字、含区号等）→ phone
- 命中“公司/平台/投资/集团/有限公司”等关键词 → company
- 否则 → text
- screenshot：OCR → text，然后走 text 流程

=====================================================================
四、风险数据库系统 Risk Database（黑名单/风险库）
=====================================================================

表：risk_data（核心风险库）
字段建议：
- id
- type：phone / url / company / wallet / keyword
- content：号码/域名/公司名/关键词（标准化存储）
- risk_level：high/medium/low
- risk_category：投资骗局/假客服/黑灰产/兼职骗局等
- tags：数组（更细标签）
- source：来源（用户举报/人工整理/公开资料）
- evidence：证据描述或链接（可选）
- created_at / updated_at

查询流程：
用户输入 → normalize（小写、去空格、去协议、去www）
→ 精确匹配（phone/url/company）
→ 关键词匹配（text）
→ 返回 db_hit 与 db_risk_level
如果数据库已标记 high：直接提升最终风险

=====================================================================
五、RAG 知识库系统（MVP：关键词检索，最快落地）
=====================================================================

RAG（MVP）= AI + “关键词检索”知识库案例
目标：让 AI 在分析时参考真实案例/知识点，提高稳定性与准确率。

表：knowledge_cases（案例/知识库）
字段建议：
- id
- title
- category（诈骗/黑灰产/老年人/投资/兼职/医疗/假客服等）
- content（正文）
- tags（如：USDT、刷单、验证码、退款、保健品）
- language（zh/en）
- source（来源）
- created_at / updated_at

关键词检索方式（MVP）：
- 使用 Postgres ILIKE 或全文检索（tsvector/tsquery）
- 输入 content 规范化后，提取关键词（或直接用原文）
- 查询：
  - title ILIKE %关键词%
  - content ILIKE %关键词%
  - tags 包含关键词
- 返回 top 3~5 条最相关案例（按匹配度排序）
- 把这些案例摘要拼进 AI Prompt（作为 evidence/context）

后续升级（不做在 MVP）：
- 增加 embedding + 向量检索（pgvector/Milvus/Pinecone）

=====================================================================
六、AI分析引擎 AI Engine（多模型切换 + Key 配置）
=====================================================================

支持 Provider：
- doubao（国内）
- openai（海外）
- other（未来扩展）

配置方式（两级，先易后难）：

A. MVP：环境变量 .env（最简单）
AI_PROVIDER=doubao
DOUBAO_API_KEY=xxx
OPENAI_API_KEY=yyy
AI_MODEL_NAME=xxx（可选）
AI_BASE_URL=xxx（可选）

B. 预留：后台可配置（settings 表 + Admin 接口）
- default_provider
- doubao_key / openai_key
- provider_base_url
- 模型名/温度/max tokens
（仅 superadmin 可改）

统一接口（后端内部）：
analyzeRisk(input) -> 返回统一 JSON（上面 schema）

Provider 结构（建议）：
ai/providers/
 ├ openai.provider.ts
 ├ doubao.provider.ts
 └ other.provider.ts（预留）

=====================================================================
七、Server 调用 AI 的核心 Prompt（生产可用版）
=====================================================================

System Prompt（固定）：
You are an AI safety risk analysis assistant.
Your task is to determine whether the user's content may involve scams, fraud, phishing, black market activities, or misleading information.

Rules:
1) Return JSON only. No markdown, no extra text.
2) If uncertain, set risk_level="unknown" and confidence <= 50.
3) Use database hits and related cases as evidence.
4) Do not fabricate facts. If you cannot verify, say uncertain.

Return JSON in this exact schema:
{
  "risk_level": "high | medium | low | unknown",
  "confidence": 0-100,
  "risk_type": [],
  "summary": "",
  "reasons": [],
  "advice": []
}

User Prompt（动态拼接）包含：
- user_input
- input_type
- country/language
- risk_db_result（命中情况）
- related_cases（RAG关键词检索返回的 3~5 条案例摘要）

AI 输入示例：
{
  "user_input":"他说投资USDT每天收益5%",
  "input_type":"text",
  "risk_db_result":"none",
  "related_cases":[
    "案例1摘要...",
    "案例2摘要..."
  ]
}

AI 输出示例：
{
  "risk_level":"high",
  "confidence":92,
  "risk_type":["投资骗局"],
  "summary":"该信息疑似虚假投资骗局",
  "reasons":[
    "承诺稳定高收益",
    "常见USDT投资诈骗模式"
  ],
  "advice":[
    "不要向陌生人转账",
    "不要参与所谓导师带单"
  ]
}

=====================================================================
八、风险评分系统 Risk Score Engine（统一校准）
=====================================================================

目的：把 AI / DB / RAG 三者合并成稳定结果，避免模型误判。

评分来源：
- AI_score：0~100（基于 AI confidence + risk_level 校准）
- DB_score：0 / 50 / 90（未命中/中/高）
- RAG_score：0~30（命中案例数量 + 关键标签命中）

公式（示例）：
score = AI_score * 0.6 + DB_score * 0.3 + RAG_score * 0.1

结果映射：
- score >= 80 → high
- 50~79 → medium
- < 50 → low
- 若 AI risk_level=unknown 且 DB 未命中 → unknown

（建议：如果 DB 命中 high，最终 risk_level 不低于 medium）

=====================================================================
九、AI 成本控制（Redis 缓存 + 去重）
=====================================================================

缓存键：
cache:ai:{hash(input_type + normalized_content + language + country + provider)}

TTL：
- 默认 24h
- DB 命中 high 的内容可设置更长（如 7 天）

流程：
用户请求 → hash → Redis 查询
- 命中 → 直接返回
- 未命中 → DB + RAG + AI + Score → 写 Redis → 返回

（建议：对接口增加 rate limit 防刷）

=====================================================================
十、日志与历史（用户体验 + 运营 + 优化）
=====================================================================

表：queries（用户历史）
- id
- user_id
- input_type
- content
- result_json
- risk_level
- confidence
- ai_provider
- created_at

表：ai_logs（模型调用日志，供统计/成本）
- id
- provider
- model
- tokens（如可获取）
- latency_ms
- prompt_hash（脱敏）
- created_at

表：admin_audit_logs（后台操作审计）
- id
- admin_id
- action（update_settings / delete_case / ban_user）
- target_id
- created_at

=====================================================================
十一、权限与安全（Admin 必须有）
=====================================================================

角色：
- user：普通用户
- admin：运营人员
- superadmin：最高权限（配置Key/管理管理员）

规则：
- iOS 用户只能访问自己的 queries、reports
- admin 可访问用户列表、查询列表、举报、知识库
- superadmin 才能改 AI Provider/Key、系统设置

技术：
- JWT + Role Guard
- Admin API 全部走 /api/admin/* 并校验角色

=====================================================================
十二、完整模块清单（后端必须包含）
=====================================================================

auth：国内/海外登录 + token
ai：核心引擎（parser/db/rag关键词检索/provider/score/cache）
query：电话/网址/公司查询（复用risk_data）
knowledge：知识库增删改查 + 分类 + 搜索 + 批量导入
report：举报提交 + 处理状态 + 统计
subscription：Apple IAP 验证 + 订阅状态
admin：后台专用接口入口 + 权限校验
settings：AI Provider/Key/域名参数（先 env，后表）
analytics：查询量/风险分布/高风险榜单/导出

=====================================================================
十三、API 总表（小白对照用）
=====================================================================

iOS（用户侧）：
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/userinfo
- POST /api/ai/analyze
- POST /api/ai/analyze/screenshot
- POST /api/query/phone
- POST /api/query/url
- POST /api/query/company
- GET  /api/queries
- POST /api/report
- GET  /api/knowledge
- GET  /api/knowledge/:id
- POST /api/subscription/verify
- GET  /api/subscription/status

Admin（管理侧）：
- GET  /api/admin/users
- PUT  /api/admin/users/:id/status
- GET  /api/admin/queries
- GET  /api/admin/reports
- PUT  /api/admin/reports/:id/status
- GET  /api/admin/knowledge
- POST /api/admin/knowledge/upload
- PUT  /api/admin/knowledge/:id
- DELETE /api/admin/knowledge/:id
- GET  /api/admin/ai/stats
- GET  /api/admin/settings
- PUT  /api/admin/settings (superadmin)

=====================================================================
十四、落地建议（按正确顺序做，避免返工）
=====================================================================

第一阶段（必须先跑通）：
- Input Parser
- Risk DB（risk_data）
- RAG（关键词检索 knowledge_cases）
- AI Provider（豆包/ OpenAI）
- 统一 JSON 输出 + Risk Score
- Redis 缓存 + queries 历史记录

第二阶段（增强）：
- settings 表支持后台改 Provider/Key
- 更完善的 analytics 报表
- RAG 升级向量检索（pgvector）

第三阶段（护城河）：
- 风险库持续沉淀（用户举报+人工整理）
- 案例库每天更新
- 逐步形成行业级识别能力






备注：不计入提示词：
已按《Server 的 AI Prompt 设计》在 Server/ 下搭好后端，并保持与规范一致。摘要如下：

1. 已按规范完成的内容
目录结构

src/modules/：auth、ai（parser、rag、risk-engine、providers、prompts）、query、knowledge、report、subscription、admin、settings、health、queries）
src/common/：guards（JWT、OptionalJwt、Roles、AdminRole）、utils（normalize、hash）、rate-limit（AI 限流）
prisma/schema.prisma、prisma/seed.ts、.env.example、README.md
Prisma 与数据

9 张表：users、queries、risk_data、knowledge_cases、reports、subscriptions、ai_logs、admin_audit_logs、settings
字段与规范一致（含 result_json、input_type、risk_level、confidence、ai_provider 等）
Seed：risk_data 4 条、knowledge_cases 5 条、settings 默认一条
核心 AI 流程

Input Parser → Risk DB 查询 → RAG 关键词检索（Postgres，top 3–5）→ AI（doubao/openai/other 预留）→ Risk Score（AI×0.6 + DB×0.3 + RAG×0.1）→ Redis 缓存（cache:ai:{hash}，24h/高风险 7d）→ 写 queries + ai_logs → 返回统一 JSON
AI 输出强制校验与兜底（unknown + 低置信度 + 记 ai_logs）
RAG 为关键词检索，并预留向量检索 TODO
API（路径未改）

用户侧：/api/auth/login、logout、userinfo；/api/ai/analyze、/api/ai/analyze/screenshot；/api/query/phone、url、company；/api/queries；/api/report；/api/knowledge、/api/knowledge/:id；/api/subscription/verify、status
管理侧：/api/admin/users、queries、reports、knowledge（含 upload、PUT、DELETE）、/api/admin/ai/stats、/api/admin/settings（GET/PUT 仅 superadmin）
健康：GET /api/health → { "status": "ok" }
权限与限流

JWT（用户与 Admin 共用 User 表，role：USER/ADMIN/SUPERADMIN）
/api/admin/* 使用 JwtAuthGuard + AdminRoleGuard
/api/ai/analyze 使用 OptionalJwt（未登录可调）+ AI 限流（Redis，约 20 次/分钟）
Redis

支持 REDIS_URL 或 REDIS_HOST+REDIS_PORT
2. 本地运行步骤（与 README 一致）
cd Server
npm install
cp .env.example .env   # 填 DATABASE_URL、REDIS_URL、JWT_SECRET、DOUBAO_API_KEY 或 OPENAI_API_KEY
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
curl 示例（README 中已写）

健康：curl -s http://localhost:3000/api/health
登录：curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"phone":"13800138000","code":"123456"}'
AI 分析：curl -s -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -d '{"content":"这个链接靠谱吗 https://fake-bank.com","language":"zh"}'
知识库：curl -s "http://localhost:3000/api/knowledge?page=1&pageSize=5"
Admin AI 统计：需先登录一个 role=ADMIN 的用户，再 curl -s "http://localhost:3000/api/admin/ai/stats" -H "Authorization: Bearer <token>"
创建 Admin：在 DB 中把某用户的 role 改为 ADMIN 或 SUPERADMIN，用该用户手机/邮箱走 /api/auth/login 即可访问管理端。

当前 npm run build 已通过。若你本地已有 PostgreSQL 和 Redis，按上述步骤即可从 0 启动并用 curl 验证上述接口。





不计入提示词：

你需要本地完成的操作
数据库迁移（在 Server 目录，且已配置 DATABASE_URL）：

npx prisma migrate dev --name add_user_profile_fields
安装 Server 依赖：

cd Server && npm install
配置 OSS：在 Server 的 .env 中配置
OSS_REGION、OSS_BUCKET、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、CDN_DOMAIN。
未配置时，调用 POST /api/upload/avatar 会返回错误提示 OSS 未配置。

三端用户资料字段与头像流程已对齐，头像仅通过 CDN URL 访问，符合「所有图片必须走 OSS + CDN」的约束。


