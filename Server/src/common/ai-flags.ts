/**
 * 2026-10-06 AI 分析链路 V2 开关（复核报告 docs/AI分析链路复核-2026-10-06.md）：
 *   评分「等级下限」、去掉独立的大模型意图分类、拿不准一律检测、免费额度成功后再扣、失败结果不缓存。
 * Railway 设 AI_V2=false 可整体回退到旧逻辑，无需改代码。
 */
export const AI_V2 = process.env.AI_V2 !== 'false';
/** 提示词版本：进缓存 key，提示词一改旧结论自动失效 */
export const PROMPT_VERSION = '2026-10-07.v3.4';
/** Redis 里的风险库版本号：后台增删改风险库时 +1，参与 cache:ai: 的 key，旧结论自动失效 */
export const RISK_DB_VERSION_KEY = 'risk:db:version';
/** 是否把提示词全文、用户原文、模型原始返回打进日志（含个人信息），默认关 */
export const AI_DEBUG_LOG = process.env.AI_DEBUG_LOG === 'true';
/** 豆包默认模型（Railway 未设 DOUBAO_MODEL 时生效）；provider 与缓存 key 必须用同一个值 */
export const DEFAULT_DOUBAO_MODEL = 'doubao-seed-2-1-lite-260915';
