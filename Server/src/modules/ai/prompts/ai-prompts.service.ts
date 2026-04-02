/**
 * AI 系统/用户 Prompt 构建
 * 强制 AI 只返回 JSON，严格符合 schema
 */
import { Injectable } from '@nestjs/common';
import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';

// ─── JSON Schema 说明 ───────────────────────────────────────────────────────

const SCHEMA_DESC_ZH = `
请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。格式必须为：
{
  "risk_level": "high 或 medium 或 low 或 unknown",
  "confidence": 0-100 的整数,
  "risk_type": ["从下方允许的分类中选一个或多个"],
  "summary": "一句话总结（对话模式下写完整回复）",
  "reasons": ["原因1", "原因2", "原因3"],
  "advice": ["建议1", "建议2", "建议3"],
  "is_conversational": false
}`;

// ─── is_conversational 判断规则 ──────────────────────────────────────────────

const IS_CONVERSATIONAL_RULES_ZH = `
【is_conversational 判断规则】
- 若用户输入包含明确待检测对象（链接/电话/公司名/可疑文字/截图），进行完整风险分析，is_conversational 填 false
- 若用户输入是对上文的追问（"怎么办""为什么""能详细说""什么意思""有没有风险"等），结合上文 context 给出完整建议，is_conversational 填 true，完整答案写入 summary，risk_level 填 unknown，reasons/advice 填 []
- 若输入是问候语或与安全无关，简短友善回应，is_conversational 填 true，答案写入 summary，risk_level 填 unknown，reasons/advice 填 []`;

const SCHEMA_DESC_EN = `
You must output exactly one JSON object, with no extra text or markdown. The format MUST be:
{
  "risk_level": "high or medium or low or unknown",
  "confidence": an integer between 0 and 100,
  "risk_type": ["one or more from the allowed categories below"],
  "summary": "one-sentence summary (or full reply in conversational mode)",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "advice": ["advice 1", "advice 2", "advice 3"],
  "is_conversational": false
}`;

const IS_CONVERSATIONAL_RULES_EN = `
[is_conversational rules]
- If the user input contains something to analyze (URL, phone number, company name, suspicious text/screenshot), do full risk analysis, set is_conversational to false
- If the user is asking a follow-up question about prior context ("what should I do", "why", "explain more", "is it safe", etc.), answer using the context above, set is_conversational to true, write full answer in summary, set risk_level to unknown, reasons/advice as []
- If input is a greeting or off-topic, reply briefly, set is_conversational to true, write answer in summary, risk_level unknown, reasons/advice as []`;

// ─── 风险等级判断标准 ────────────────────────────────────────────────────────

const RISK_CRITERIA_ZH = `
【风险等级判断标准】
- high（confidence 75-100）：存在明确诈骗信号。例如：主动索要转账/验证码/密码、冒充官方机构或知名品牌、高压催促操作、虚假身份证明、已知钓鱼/诈骗特征
- medium（confidence 45-74）：有可疑信号但证据不充分。例如：话术可疑但无直接诈骗行为、域名新注册或含仿冒字符、身份无法核实、信息不透明
- low（confidence 20-44）：仅有轻微疑虑，整体可信。例如：正规机构但需注意某些细节
- unknown：输入内容不足以判断风险（如纯问候语、无意义数字、与安全无关的内容）

【confidence 评分标准】
- 85-100：多个强信号，高度确定
- 65-84：有明确信号，少量不确定性
- 45-64：部分信号，存在较大不确定性
- 20-44：主要是推测，信息非常有限
- 0-19：几乎无有效信息`;

const RISK_CRITERIA_EN = `
[RISK LEVEL CRITERIA]
- high (confidence 75-100): Clear fraud indicators. E.g.: explicit request for money/verification codes/passwords, impersonation of official agencies or known brands, high-pressure urgency, false identity proof, confirmed phishing/scam patterns
- medium (confidence 45-74): Suspicious signals but inconclusive. E.g.: suspicious language without direct fraud, newly registered domain or lookalike characters, unverifiable identity, lack of transparency
- low (confidence 20-44): Minor concerns only, generally legitimate
- unknown: Insufficient information to assess risk (greetings, meaningless input, off-topic content)

[CONFIDENCE GUIDELINES]
- 85-100: Multiple strong signals, high certainty
- 65-84: Clear signals, minor ambiguity
- 45-64: Some signals, significant uncertainty
- 20-44: Mostly speculation, very limited info
- 0-19: Almost no usable information`;

// ─── 按输入类型的专项分析指引 ───────────────────────────────────────────────

const TYPE_GUIDANCE_ZH: Record<string, string> = {
  phone: '【电话号码分析要点】关注：号段是否为虚拟号/改号软件特征（170/171/虚商号段需注意）、通话目的是否涉及转账/验证码/个人信息、是否冒充银行/公安/电商平台官方、是否有催促感',
  url: '【链接/网址分析要点】关注：域名是否仿冒知名品牌（含多余字符/拼写变体）、是否要求输入账号密码/支付信息、是否含混淆字符或参数、HTTP 非加密连接、短链跳转目标不明',
  company: '【公司/平台分析要点】关注：是否有工商注册信息或官方备案、名称是否假冒知名企业（一字之差/英文仿冒）、是否有投资/高收益承诺、是否有大量用户投诉记录',
  text: '【文本/消息分析要点】关注：话术是否有催促感/情感操控/过度承诺、是否索要转账或验证码、是否冒充官方/熟人/权威机构身份、是否存在异常要求',
  screenshot: '【截图分析要点】关注：截图中是否有转账请求/验证码索取/异常链接/虚假身份证明/高收益承诺等诈骗信号，综合图中所有文字内容判断',
};

const TYPE_GUIDANCE_EN: Record<string, string> = {
  phone: '[Phone Number Analysis] Focus on: virtual/spoofed number patterns, whether the call involves requesting money/verification codes/personal info, impersonation of banks/police/e-commerce platforms, pressure tactics',
  url: '[URL Analysis] Focus on: domain impersonation of known brands (extra chars/typos), request for credentials or payment, obfuscated characters or suspicious params, unencrypted HTTP, unknown short-link destinations',
  company: '[Company/Platform Analysis] Focus on: official registration or license, name similarities to known brands (one-letter differences), investment/high-return promises, widespread complaints',
  text: '[Text/Message Analysis] Focus on: urgency/emotional manipulation/over-promising, requests for money or verification codes, impersonation of officials/acquaintances/authorities, unusual demands',
  screenshot: '[Screenshot Analysis] Focus on: money transfer requests, verification code theft, suspicious links, false identity proofs, high-return promises — assess all visible text holistically',
};

// ─── 紧急求助热线（按地区）──────────────────────────────────────────────────

function getAntifraudHotline(country: string, language: 'zh' | 'en'): string {
  const c = (country || '').toUpperCase();
  if (c === 'CN' || c === 'CHN' || c === 'CHINA') {
    return language === 'zh'
      ? '如已受骗请立即拨打 96110（全国反诈热线）或 110 报警'
      : 'If you have been defrauded, immediately call 96110 (China anti-fraud hotline) or 110 to report';
  }
  if (c === 'US' || c === 'USA') {
    return language === 'zh'
      ? '如已受骗请向 FTC 举报（reportfraud.ftc.gov）或拨打当地警方'
      : 'If defrauded, report to the FTC at reportfraud.ftc.gov or contact local police';
  }
  if (c === 'GB' || c === 'UK') {
    return language === 'zh'
      ? '如已受骗请向 Action Fraud 举报（actionfraud.police.uk）或拨打 101'
      : 'If defrauded, report to Action Fraud at actionfraud.police.uk or call 101';
  }
  if (c === 'AU' || c === 'AUS') {
    return language === 'zh'
      ? '如已受骗请向 Scamwatch 举报（scamwatch.gov.au）或拨打 000'
      : 'If defrauded, report to Scamwatch at scamwatch.gov.au or call 000';
  }
  if (c === 'SG' || c === 'SGP') {
    return language === 'zh'
      ? '如已受骗请拨打 999 报警或向 i-Witness 举报'
      : 'If defrauded, call 999 or report via ScamShield/i-Witness';
  }
  // 默认（未知国家）
  return language === 'zh'
    ? '如已受骗请立即联系当地警方或反诈机构'
    : 'If defrauded, contact your local police or anti-fraud authority immediately';
}

@Injectable()
export class AiPromptsService {
  buildSystemPrompt(language: 'zh' | 'en', riskTypeOptions: string[]): string {
    const typesStr = riskTypeOptions.length > 0
      ? riskTypeOptions.join('、')
      : (language === 'zh' ? '诈骗、投资骗局、钓鱼网站、虚假客服、未知风险' : 'fraud, investment scam, phishing, fake customer service, unknown risk');

    if (language === 'zh') {
      return `你是一个网络安全风险分析助手，专门识别诈骗、黑灰产、钓鱼网站等风险。根据用户输入（文本、电话号、链接、公司名、截图描述等），判断是否存在风险并给出分析。

${RISK_CRITERIA_ZH}

【risk_type 允许的分类】
${typesStr}

${IS_CONVERSATIONAL_RULES_ZH}

${SCHEMA_DESC_ZH}`;
    }

    const typesStrEn = riskTypeOptions.length > 0
      ? riskTypeOptions.join(', ')
      : 'fraud, investment scam, phishing site, fake customer service, unknown risk';

    return `You are a cybersecurity risk analysis assistant. Analyze user input (text, phone number, link, company name, or screenshot) for fraud, scams, and online threats. Write all JSON string values in English only.

${RISK_CRITERIA_EN}

[Allowed risk_type categories]
${typesStrEn}

${IS_CONVERSATIONAL_RULES_EN}

${SCHEMA_DESC_EN}`;
  }

  /** URL 专用：系统角色 + 同一 JSON schema */
  buildUrlSystemPrompt(language: 'zh' | 'en', riskTypeOptions: string[]): string {
    const typesStr = riskTypeOptions.length > 0
      ? riskTypeOptions.join(language === 'zh' ? '、' : ', ')
      : (language === 'zh' ? '诈骗、钓鱼网站、未知风险' : 'fraud, phishing site, unknown risk');

    if (language === 'zh') {
      return `你是一名网络安全助理，专门分析 URL 链接风险。

${RISK_CRITERIA_ZH}

${TYPE_GUIDANCE_ZH['url']}

【risk_type 允许的分类】
${typesStr}

${IS_CONVERSATIONAL_RULES_ZH}

${SCHEMA_DESC_ZH}`;
    }

    return `You are a cybersecurity assistant specializing in URL risk analysis. Write all JSON string values in English only.

${RISK_CRITERIA_EN}

${TYPE_GUIDANCE_EN['url']}

[Allowed risk_type categories]
${typesStr}

${IS_CONVERSATIONAL_RULES_EN}

${SCHEMA_DESC_EN}`;
  }

  buildUrlUserPrompt(
    content: string,
    url: string,
    urlResult: { risk_level: string; tags: string[]; records: any[] },
    language: 'zh' | 'en',
    country?: string,
  ): string {
    const hit = urlResult.records && urlResult.records.length > 0;
    const hotline = getAntifraudHotline(country || '', language);

    if (language === 'zh') {
      if (hit) {
        const level = urlResult.risk_level || 'high';
        const tagsStr = (urlResult.tags || []).length ? `，标签：${urlResult.tags.join('、')}` : '';
        const recordsBrief = urlResult.records.slice(0, 5).map((r: any) => `[${r.riskLevel}] ${(r.content || '').slice(0, 100)}`).join('；');
        return `该 URL 已被风险数据库标记为 ${level}，请解释其危险性并给出用户应采取的措施。\n\nURL：${url}\n用户原话：${content}\n\n风险库命中：${level}${tagsStr}\n命中记录摘要：${recordsBrief}\n\n紧急求助参考：${hotline}\n\n请按约定 JSON 输出（summary、reasons 三条、advice 三条）。`;
      }
      return `我们的风险数据库中未找到该网址。请仅凭当前内容与一般安全知识给出判断。\n\n分析指引：\n- 若域名存在仿冒特征、页面要求输入账密/支付信息、含可疑参数等明显风险信号，可给出 medium 或 high\n- 若无任何可疑特征，可给出 low，并在 summary 中说明"未发现已知风险，建议通过官方渠道确认"\n- 请勿无依据地拉高或降低风险等级\n\nURL：${url}\n用户原话：${content}\n\n请按约定 JSON 输出（summary、reasons 三条、advice 三条）。`;
    }

    if (hit) {
      const level = urlResult.risk_level || 'high';
      return `This URL has been flagged as ${level} in our risk database. Explain the risk and what the user should do.\n\nURL: ${url}\nUser message: ${content}\n\nEmergency reference: ${hotline}\n\nOutput JSON with summary, 3 reasons, 3 advice.`;
    }
    return `Our risk database has no record for this URL. Analyze based on URL structure and general knowledge.\n\nGuidance:\n- If the domain has impersonation signs, requests credentials/payment, or has suspicious patterns → medium or high\n- If no suspicious features are found → low, noting "no known risk found, verify via official channels"\n- Do not arbitrarily inflate or deflate the risk level\n\nURL: ${url}\nUser message: ${content}\n\nOutput JSON with summary, 3 reasons, 3 advice.`;
  }

  buildUserPrompt(
    content: string,
    inputType: string,
    language: 'zh' | 'en',
    ragCases: KnowledgeCaseHit[],
    riskDbResult: string | null,
    country?: string,
    context?: Array<{ role: string; content: string }>,
  ): string {
    const typeLabel = language === 'zh'
      ? ({ text: '文本', phone: '电话', url: '链接', company: '公司/平台', screenshot: '截图' }[inputType] || inputType)
      : inputType;

    const typeGuidance = language === 'zh'
      ? (TYPE_GUIDANCE_ZH[inputType] || '')
      : (TYPE_GUIDANCE_EN[inputType] || '');

    // 上下文前缀（有上轮对话时注入）
    let contextPrefix = '';
    if (Array.isArray(context) && context.length > 0) {
      if (language === 'zh') {
        const lines = context.map((m) =>
          m.role === 'user' ? `用户：${m.content}` : `助手分析结果：${m.content}`,
        ).join('\n');
        contextPrefix = `【上轮对话参考】\n${lines}\n\n【当前问题】\n`;
      } else {
        const lines = context.map((m) =>
          m.role === 'user' ? `User: ${m.content}` : `Assistant result: ${m.content}`,
        ).join('\n');
        contextPrefix = `[Previous conversation context]\n${lines}\n\n[Current question]\n`;
      }
    }

    let user = language === 'zh'
      ? `${contextPrefix}用户输入类型：${typeLabel}\n内容：\n${content}`
      : `${contextPrefix}Input type: ${inputType}\nContent:\n${content}`;

    if (typeGuidance) {
      user += `\n\n${typeGuidance}`;
    }

    if (riskDbResult) {
      const dbHint = language === 'zh'
        ? `\n\n【风险库命中】：${riskDbResult}（请结合该结果综合判断，风险等级应 ≥ medium）`
        : `\n\nRisk DB hit: ${riskDbResult} (incorporate this; risk level should be at least medium)`;
      user += dbHint;
    }

    if (ragCases.length > 0) {
      const ref = language === 'zh' ? '\n\n【参考相似案例（仅作参考）】：\n' : '\n\nReference cases (for context):\n';
      const casesText = ragCases.map((c) => `[${c.title}] ${c.content.slice(0, 200)}...`).join('\n');
      user += ref + casesText;
    }

    // 电话类型附加反诈热线提示
    if (inputType === 'phone') {
      const hotline = getAntifraudHotline(country || '', language);
      const hint = language === 'zh'
        ? `\n\n如分析结果为 high，请在 advice 中包含："${hotline}"`
        : `\n\nIf result is high risk, include in advice: "${hotline}"`;
      user += hint;
    }

    if (language === 'en') {
      user += '\n\nImportant: Write all summary, reasons, and advice in English only.';
    }

    return user;
  }
}
