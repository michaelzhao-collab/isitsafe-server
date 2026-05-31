/**
 * V3 #5 意图分类器
 *
 * 设计目标：用规则层覆盖 70%+ 流量，AI 兜底覆盖剩余 30%
 *
 * 优先级（命中即停）：
 *   1. 强信号触发（URL / 手机号 / 银行卡 / 验证码 / 二维码 / 金额）
 *   2. help_request 关键词（已损失情绪）
 *   3. scam_detection 关键词（疑问 + 平台 + 冒充话术）
 *   4. knowledge_query 关键词（教育 / 询问性质）
 *   5. general_chat 关键词（寒暄 / 情绪）
 *   6. 长度 / 字符兜底
 *   7. AI 分类兜底（仅 ~30% 流量进来）
 *
 * 上下文继承：短句 + 有 lastIntent → 继承
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../providers/ai-provider.service';

export type Intent =
  | 'scam_detection'
  | 'general_chat'
  | 'knowledge_query'
  | 'help_request';

export interface IntentContext {
  /** 上一轮的 intent，用于"那这个呢"类延续 */
  lastIntent?: Intent;
  /** 是否有附件（图片 OCR、语音转写）— 强提示 scam_detection */
  hasAttachment?: boolean;
  /** OCR / 语音转写的文本（如果有，并入 content 做规则匹配）*/
  attachmentText?: string;
}

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(private aiProvider: AiProviderService) {}

  // ====================================================================
  // 第 1 层：强信号正则
  // ====================================================================

  /** HTTP/HTTPS 链接 */
  private static readonly RE_URL = /\bhttps?:\/\/[^\s]+/i;
  /** 裸 www 链接 */
  private static readonly RE_WWW = /\bwww\.[a-z0-9\-]+\.[a-z]{2,}\b/i;
  /** 短链域名 */
  private static readonly SHORT_LINK_DOMAINS = [
    't.cn', 'suo.im', 'url.cn', 'dwz.cn', 'bit.ly', 'tinyurl.com',
    's.t.cn', 'v.douyin.com', 'h5.eqxiu.com', 'mp.weixin.qq.com',
  ];
  /** 裸域名（含 .com/.cn/.net 等后缀）*/
  private static readonly RE_BARE_DOMAIN =
    /\b[a-z0-9\-]+\.(com|cn|net|org|app|io|me|top|xyz|info|club|store|shop|live|vip|cc|tv)\b/i;
  /** 中国手机号 */
  private static readonly RE_CN_PHONE = /(?<!\d)(?:\+?86)?[\s\-]?1[3-9]\d{9}(?!\d)/;
  /** 国际手机号 ≥7 位（避免误判普通数字）*/
  private static readonly RE_INTL_PHONE = /(?<!\d)\+\d{1,4}[\s\-]?\d{6,14}(?!\d)/;
  /** 中国座机号 */
  private static readonly RE_LANDLINE = /(?<!\d)0\d{2,3}[\s\-]?\d{7,8}(?!\d)/;
  /** 候选银行卡号（长度 13-19，需 Luhn 校验）*/
  private static readonly RE_CARD_CANDIDATE = /(?<!\d)\d{13,19}(?!\d)/g;
  /** 身份证号（中国 18 位） */
  private static readonly RE_ID_CARD = /(?<!\d)\d{17}[\dXx](?!\d)/;
  /** 验证码 + 4-6 位数字 */
  private static readonly RE_CODE =
    /(验证码|verification|verify|code)[\s:：]*\d{4,6}/i;
  /** 二维码 / 扫码 */
  private static readonly RE_QR = /(扫码|二维码|付款码|收款码|scan.*qr|QR\s*code)/i;
  /** 金额 + 转账 动作 */
  private static readonly RE_TRANSFER_AMOUNT =
    /(转账|转钱|汇款|付款|打款|转给|transfer|send)[\s\S]{0,20}\d+/i;
  /** 社交账号 ID：微信/QQ/Skype/Telegram/Line/WhatsApp/抖音/Instagram 等关键词 + ID 字符串
   *  典型样本：
   *    "微信号 ty20191215hy" / "vx: abc_123" / "QQ 12345678"
   *    "我的微信 xyz123" / "wx号 hello"
   *  ID 规则：首字符字母或数字，总长 4-30
   *  注意：去掉 "ig" / "tw" 等过短关键词，否则会与正常英文 / 单词冲突
   */
  private static readonly RE_SOCIAL_HANDLE =
    /(微信号?|微\s*信|vx|wx|qq号?|扣扣|skype|telegram|whatsapp|抖音号?|tiktok|instagram)[\s:：是的]*[a-zA-Z0-9][a-zA-Z0-9._\-]{3,29}/i;

  /** Luhn 算法（信用卡号校验）*/
  private luhnValid(num: string): boolean {
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  private hasStrongSignal(content: string): boolean {
    if (IntentClassifierService.RE_URL.test(content)) return true;
    if (IntentClassifierService.RE_WWW.test(content)) return true;
    // 短链
    for (const d of IntentClassifierService.SHORT_LINK_DOMAINS) {
      if (content.toLowerCase().includes(d)) return true;
    }
    if (IntentClassifierService.RE_BARE_DOMAIN.test(content)) return true;
    if (IntentClassifierService.RE_CN_PHONE.test(content)) return true;
    if (IntentClassifierService.RE_INTL_PHONE.test(content)) return true;
    if (IntentClassifierService.RE_LANDLINE.test(content)) return true;
    if (IntentClassifierService.RE_ID_CARD.test(content)) return true;
    if (IntentClassifierService.RE_CODE.test(content)) return true;
    if (IntentClassifierService.RE_QR.test(content)) return true;
    if (IntentClassifierService.RE_TRANSFER_AMOUNT.test(content)) return true;
    if (IntentClassifierService.RE_SOCIAL_HANDLE.test(content)) return true;
    // 银行卡：候选 + Luhn
    const cardCandidates = content.match(IntentClassifierService.RE_CARD_CANDIDATE);
    if (cardCandidates) {
      for (const c of cardCandidates) {
        if (this.luhnValid(c)) return true;
      }
    }
    return false;
  }

  // ====================================================================
  // 第 2 层：help_request 关键词
  // ====================================================================
  private static readonly HELP_KEYWORDS_ZH = [
    '被骗了', '被骗', '上当了', '上当', '被骗子骗', '中招了',
    '钱被转', '钱被划', '钱被骗', '钱被划走', '钱被骗走', '钱给他了', '钱给她了',
    '已经转', '转账了', '转走了', '转给他', '转给她', '转给骗子',
    '怎么追回', '追回', '挽回', '挽回损失',
    '报警', '报案', '96110', '打 110', '拨打反诈', '反诈电话',
    '账号被盗', '卡被盗', '卡盗刷', '刷我卡',
    '信息泄露', '身份证泄露', '银行卡泄露',
    '救我', '救救我', '求救', 'SOS', '帮帮我', 'help me',
    '我完了', '完蛋了',
    '急急急', '紧急',
  ];
  private static readonly HELP_KEYWORDS_EN = [
    'got scammed', 'been scammed', 'was scammed', 'tricked me',
    'transferred', 'sent money', 'paid the scammer',
    'how to recover', 'get my money back',
    'report fraud', 'call 911', 'help me', 'sos', 'urgent',
    'identity theft', 'account hacked', 'card stolen',
  ];

  private matchesHelp(lower: string, content: string): boolean {
    for (const kw of IntentClassifierService.HELP_KEYWORDS_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.HELP_KEYWORDS_EN) {
      if (lower.includes(kw)) return true;
    }
    return false;
  }

  // ====================================================================
  // 第 3 层：scam_detection 关键词
  // ====================================================================
  // 3.1 直接询问真假
  private static readonly SCAM_ASK_ZH = [
    '是不是骗子', '是不是骗局', '是不是诈骗', '是不是套路', '是不是真的',
    '是真的吗', '是假的吗', '真的假的', '真假',
    '可信吗', '可不可信', '能不能信', '该不该信',
    '靠谱吗', '靠不靠谱', '有没有问题', '有问题吗',
    '安全吗', '安不安全', '有没有风险', '危险吗',
    '可疑吗', '可不可疑', '正不正规', '正规吗',
    '合法吗', '合不合法',
    '帮我看', '帮我查', '帮我判断', '帮我识别', '帮我鉴定',
    '看下', '查下', '鉴定一下', '确认一下',
    '是 AI 吗', '是AI吗', '是 AI 生成', '是不是合成', '是 deepfake', '是不是 ai',
  ];
  private static readonly SCAM_ASK_EN = [
    'is this scam', 'is this fake', 'is this real', 'is it legit',
    'is this safe', 'is this phishing', 'is this trustworthy',
    'help me check', 'can you verify', 'is this ai generated', 'is this deepfake',
  ];

  // 3.3 冒充话术
  private static readonly SCAM_IMPERSONATE_ZH = [
    '涉嫌洗钱', '涉嫌违法', '涉嫌犯罪', '协助调查',
    '我是 公安', '我是公安', '我是警察', '我是警官', '我是法官', '我是检察官',
    '我是 XX 客服', '我是客服', '我是银行', '我是国家反诈',
    '安全账户', '资金清查', '资金审查', '信用修复',
    '冻结账户', '账户冻结', '解冻账户',
    '您的快递异常', '快递异常', '包裹异常', '包裹有问题',
    '退款', '退订', '退费', '退保',
    '中奖', '抽中', '奖品', '兑换奖金',
    '退税', '补贴', '助学金', '医保返款', '社保补贴',
    '高息', '高回报', '保本保收益', '保本高收益', '内部消息', '涨停板', '老师带单',
    '代刷', '刷单', '兼职日结', '在家赚钱', '轻松日赚',
    '微粒贷', '京东金条', '注销账号', '关闭利率',
    '扫码领红包', '红包加微信',
    // V4 暴利/躺赚类诱饵
    '暴利', '暴富', '一夜暴富', '稳赚不赔', '稳赚', '躺赚', '躺着赚',
    '日入过万', '日入上千', '日入数千', '月入十万', '月入百万', '月赚几万',
    '零投资', '零成本高回报', '一天几千', '一天赚几千',
    '跟单稳赚', '跟单', '老师带飞', '群里大佬', '私募内幕', '内幕跟单',
    '推荐项目', '推荐投资', '推荐稳赚', '收益翻倍', '本金翻倍',
  ];

  // 3.4 第三方指代
  private static readonly SCAM_THIRD_PARTY_ZH = [
    '对方说', '他说', '她说', '老板说', '朋友说',
    // V4 不点名第三方介绍
    '有人说', '有人介绍', '有人推荐', '有人喊', '有人加我', '有人发我',
    '群里有人', '群里说', '群主说', '群里推荐',
    '对方要我', '他要我', '她要我', '让我转', '让我付',
    '让我加微信', '让我加 QQ', '让我加qq', '让我下载', '让我打开', '让我点',
    '老师让我', '客服让我', '群里让我',
  ];

  // 3.5 平台 + 退款异常
  private static readonly SCAM_PLATFORM_ZH = [
    '淘宝退款', '京东退款', '拼多多退款', '抖音退款', '美团退款',
    '银行短信', '银行电话', '支付宝异常', '微信异常', '风控',
    '顺丰异常', '快递改签', '物流异常',
  ];

  private matchesScamKeywords(lower: string, content: string): boolean {
    for (const kw of IntentClassifierService.SCAM_ASK_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.SCAM_ASK_EN) {
      if (lower.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.SCAM_IMPERSONATE_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.SCAM_THIRD_PARTY_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.SCAM_PLATFORM_ZH) {
      if (content.includes(kw)) return true;
    }
    return false;
  }

  // ====================================================================
  // 第 4 层：knowledge_query 关键词
  // ====================================================================
  // 4.1 定义型
  private static readonly KNOWLEDGE_DEFINE_ZH = [
    '什么是', '什么叫', '什么意思', '是什么', '指的是什么',
  ];
  // 4.2 方法型
  private static readonly KNOWLEDGE_HOW_ZH = [
    '怎么识别', '如何识别', '如何辨别', '怎么辨别',
    '怎么防', '如何防', '如何避免', '怎样预防',
    '怎么举报', '如何举报', '在哪举报',
    '怎么报警', '如何报警', '报警流程',
    '怎么追回', '如何追回', '追回流程',
  ];
  // 4.3 信息型 / 术语
  private static readonly KNOWLEDGE_INFO_ZH = [
    '反诈中心', '反诈 App', '反诈APP', '国家反诈',
    '96110', '110', '报警电话',
    '有几种', '有哪些', '有什么类型', '多少种', '几种',
    '法律责任', '量刑', '判多久',
  ];
  // 4.4 教育意图触发词
  private static readonly KNOWLEDGE_TRIGGER_ZH = [
    '教我', '告诉我', '想了解', '想知道', '学一下', '学习',
    '看看', '科普一下', '讲讲', '说说',
  ];
  // 4.5 术语本身（无前后文也算）
  private static readonly KNOWLEDGE_TERMS = [
    '杀猪盘', '网恋诈骗', '钓鱼网站', '钓鱼链接',
    '公检法诈骗', '冒充公检法', '兼职刷单', '理财骗局',
    '裸贷', '套路贷', '杀鸽盘',
    'AI 诈骗', 'AI诈骗', 'AI 换脸', '深伪', 'Deepfake',
    '猫池', '黑产', '灰产',
  ];
  // 4.6 英文
  private static readonly KNOWLEDGE_EN = [
    'what is', 'what are', 'how to identify', 'how to avoid',
    'how to report', 'how to recover', 'fraud hotline',
    'anti-fraud', 'explain', 'tell me about', 'teach me',
    'ponzi', 'phishing scheme', 'pig butchering', 'romance scam',
  ];

  private matchesKnowledge(lower: string, content: string): boolean {
    for (const kw of IntentClassifierService.KNOWLEDGE_DEFINE_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.KNOWLEDGE_HOW_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.KNOWLEDGE_INFO_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.KNOWLEDGE_TRIGGER_ZH) {
      if (content.includes(kw)) return true;
    }
    // 术语本身（含大小写不敏感）
    for (const term of IntentClassifierService.KNOWLEDGE_TERMS) {
      if (content.includes(term) || lower.includes(term.toLowerCase())) return true;
    }
    for (const kw of IntentClassifierService.KNOWLEDGE_EN) {
      if (lower.includes(kw)) return true;
    }
    return false;
  }

  // ====================================================================
  // 第 5 层：general_chat 关键词
  // ====================================================================
  private static readonly CHAT_GREETING_ZH = [
    '你好', '您好', '早', '早上好', '晚上好', '中午好', '在吗', '还在吗', '在不在',
    '再见', '拜拜', '走了', '886', '回头见',
    '晚安', '好梦', '早点睡',
  ];
  private static readonly CHAT_GREETING_EN = [
    'hi', 'hello', 'hey', 'good morning', 'good evening', 'good night',
    'bye', 'goodbye', 'see ya', 'cya',
  ];
  private static readonly CHAT_THANKS_ZH = [
    '谢谢', '感谢', '多谢', '3q', '不客气', '没事', '辛苦了',
    '666', '厉害', '收到',
  ];
  private static readonly CHAT_THANKS_EN = [
    'thanks', 'thank you', 'thx', 'thnx', 'cheers', 'appreciate',
  ];
  private static readonly CHAT_EMOTION_ZH = [
    '哈哈', '呵呵', '嗯嗯',
    '难受', '烦', '累', '不开心', '郁闷', '开心', '高兴',
  ];
  private static readonly CHAT_ABOUT_BOT_ZH = [
    '你是谁', '你叫啥', '你叫什么', '你是什么',
    '你能干啥', '你能做啥', '你会什么', '你能帮我',
    '怎么用', '使用方法',
  ];
  private static readonly CHAT_NOT_DETECT_ZH = [
    '不是问真假', '我就是聊聊', '就闲聊', '随便问问', '随便聊',
    '跟我聊天', '陪我聊', '陪我说话',
  ];

  private matchesGeneralChat(lower: string, content: string): boolean {
    for (const kw of IntentClassifierService.CHAT_GREETING_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_GREETING_EN) {
      if (lower.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_THANKS_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_THANKS_EN) {
      if (lower.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_EMOTION_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_ABOUT_BOT_ZH) {
      if (content.includes(kw)) return true;
    }
    for (const kw of IntentClassifierService.CHAT_NOT_DETECT_ZH) {
      if (content.includes(kw)) return true;
    }
    return false;
  }

  // ====================================================================
  // 第 6 层：长度 / 字符兜底
  // ====================================================================
  private isTooShortOrTrivial(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.length === 0) return true;
    // ≤2 字符（含汉字按 1 个算）
    if (trimmed.length <= 2) return true;
    // 仅 emoji（粗略：去掉 emoji 后为空）
    const noEmoji = trimmed.replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu, '');
    if (noEmoji.trim().length === 0) return true;
    // 仅标点 / 数字（无中文 / 英文字母）
    const hasLetters = /[一-龥a-zA-Z]/.test(trimmed);
    if (!hasLetters) return true;
    // 重复字符（"啊啊啊啊"）
    if (trimmed.length >= 3 && /^(.)\1+$/u.test(trimmed)) return true;
    return false;
  }

  // ====================================================================
  // 第 7 层：AI 兜底分类
  // ====================================================================
  private async aiClassify(content: string): Promise<Intent> {
    const system =
      '你是意图分类器。把用户消息归到 4 个类别中之一，' +
      '只返回 1 个英文 key，禁止任何额外文字。' +
      '类别：scam_detection (辨别真假) / general_chat (闲聊) / ' +
      'knowledge_query (问反诈知识) / help_request (紧急求助)';
    const user = `用户消息：「${content.slice(0, 500)}」\n类别：`;
    try {
      // F2: AiProviderService.analyze 返回 AiCallResult{raw,...}，不是 {content/text}
      const r = await this.aiProvider.analyze(user, system);
      const text = (r?.raw ?? '').toLowerCase().trim();
      if (text.includes('scam_detection')) return 'scam_detection';
      if (text.includes('help_request')) return 'help_request';
      if (text.includes('knowledge_query')) return 'knowledge_query';
      if (text.includes('general_chat')) return 'general_chat';
      return 'general_chat';
    } catch (err: any) {
      this.logger.warn(`[Intent] AI fallback failed: ${err?.message ?? err}`);
      return 'general_chat';
    }
  }

  // ====================================================================
  // 主入口
  // ====================================================================
  async classify(content: string, ctx: IntentContext = {}): Promise<{
    intent: Intent;
    via: 'rule_short' | 'rule_strong' | 'rule_help' | 'rule_scam'
      | 'rule_knowledge' | 'rule_chat' | 'rule_ctx' | 'ai' | 'ai_fail';
  }> {
    // 附件文本并入（OCR / 语音转写）
    const merged = ctx.attachmentText
      ? `${content}\n${ctx.attachmentText}`
      : content;
    const lower = merged.toLowerCase();

    // 附件 → 强提示 scam_detection（图片/语音上传几乎不会是闲聊）
    if (ctx.hasAttachment) {
      return { intent: 'scam_detection', via: 'rule_strong' };
    }

    // F1：第 1 层强信号必须先于 Layer 6 trivial
    // 否则 "13800138000" / 纯卡号 等无字母内容会被 isTooShortOrTrivial 视为 trivial → general_chat
    if (this.hasStrongSignal(merged)) {
      return { intent: 'scam_detection', via: 'rule_strong' };
    }

    // 第 6 层（避免无意义短句跑完全部规则）
    if (this.isTooShortOrTrivial(content)) {
      // 但是上下文继承优先
      if (ctx.lastIntent && content.length < 20) {
        return { intent: ctx.lastIntent, via: 'rule_ctx' };
      }
      return { intent: 'general_chat', via: 'rule_short' };
    }

    // 第 2 层
    if (this.matchesHelp(lower, merged)) {
      return { intent: 'help_request', via: 'rule_help' };
    }

    // 第 3 层
    if (this.matchesScamKeywords(lower, merged)) {
      return { intent: 'scam_detection', via: 'rule_scam' };
    }

    // 第 4 层
    if (this.matchesKnowledge(lower, merged)) {
      return { intent: 'knowledge_query', via: 'rule_knowledge' };
    }

    // 第 5 层
    if (this.matchesGeneralChat(lower, merged)) {
      return { intent: 'general_chat', via: 'rule_chat' };
    }

    // 上下文继承（前 6 层都没命中 + 有 lastIntent + 较短）
    if (ctx.lastIntent && content.length < 30) {
      return { intent: ctx.lastIntent, via: 'rule_ctx' };
    }

    // 第 7 层 AI 兜底
    const ai = await this.aiClassify(content);
    return { intent: ai, via: 'ai' };
  }
}
