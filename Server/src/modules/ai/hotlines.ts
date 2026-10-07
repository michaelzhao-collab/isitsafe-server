/**
 * 按地区的反诈 / 报案热线（2026-10-07 复核 P2-23）。
 *
 * 之前：英文一律「Call 911」（911 是美国急救号，不是反诈热线），中文一律 96110（海外打不通）。
 * 现在：按客户端传来的 country（ISO 3166-1 alpha-2 / alpha-3 / 常见英文名）查表，语言只决定措辞。
 * 没有可拨号码的地区（含未知地区）不给号码，只给「联系银行 + 当地警方」的文字，避免编造。
 *
 * 号码来源（2026-10 核对）：
 *   CN 96110 国家反诈专线 / 110；HK 18222 防骗易；TW 165 反詐騙諮詢專線；SG 1799 ScamShield；MY 997 NSRC；
 *   US 1-877-382-4357 FTC（reportfraud.ftc.gov）；GB 0300 123 2040 Action Fraud / 101；CA 1-888-495-8501 CAFC；
 *   AU 1800 595 160 IDCARE（Scamwatch 本身无电话）。
 */
export interface RegionHotline {
  /** 可直接拨打的号码（无则不给按钮） */
  dial?: string;
  /** 按钮文案 */
  label: string;
  /** 建议里的一句话 */
  text: string;
  /** 该地区允许出现在结果里的全部号码（去掉非数字后比较） */
  allowedDigits: string[];
}

const TABLE: Record<string, { dial?: string; name: { zh: string; en: string }; extra: string[]; alt?: string }> = {
  CN: { dial: '96110', name: { zh: '96110 全国反诈专线', en: '96110 (China anti-fraud hotline)' }, extra: ['110'], alt: '110' },
  HK: { dial: '18222', name: { zh: '18222 防骗易热线', en: '18222 Anti-Scam Helpline' }, extra: ['999'], alt: '999' },
  TW: { dial: '165', name: { zh: '165 反诈骗咨询专线', en: '165 Anti-Fraud Hotline' }, extra: ['110'], alt: '110' },
  SG: { dial: '1799', name: { zh: '1799 ScamShield 反诈热线', en: '1799 ScamShield Helpline' }, extra: ['999'], alt: '999' },
  MY: { dial: '997', name: { zh: '997 国家反诈中心（NSRC）', en: '997 National Scam Response Centre' }, extra: ['999'], alt: '999' },
  US: { dial: '1-877-382-4357', name: { zh: '1-877-382-4357 美国 FTC 举报热线', en: '1-877-382-4357 (FTC fraud line)' }, extra: ['911'], alt: '911' },
  GB: { dial: '0300 123 2040', name: { zh: '0300 123 2040 Action Fraud', en: '0300 123 2040 (Action Fraud)' }, extra: ['101', '999'], alt: '101' },
  CA: { dial: '1-888-495-8501', name: { zh: '1-888-495-8501 加拿大反诈中心', en: '1-888-495-8501 (Canadian Anti-Fraud Centre)' }, extra: ['911'], alt: '911' },
  AU: { dial: '1800 595 160', name: { zh: '1800 595 160 IDCARE 反诈援助', en: '1800 595 160 (IDCARE)' }, extra: ['000'], alt: '000' },
};

const ALIASES: Record<string, string> = {
  CHN: 'CN', CHINA: 'CN', HKG: 'HK', HONGKONG: 'HK', TWN: 'TW', TAIWAN: 'TW', SGP: 'SG', SINGAPORE: 'SG',
  MYS: 'MY', MALAYSIA: 'MY', USA: 'US', GBR: 'GB', UK: 'GB', CAN: 'CA', AUS: 'AU',
};

export function normalizeCountry(country: string | undefined | null): string {
  const c = (country ?? '').trim().toUpperCase().replace(/[\s_-]/g, '');
  if (!c) return '';
  return ALIASES[c] ?? c;
}

export function getRegionHotline(country: string | undefined | null, language: 'zh' | 'en'): RegionHotline {
  const code = normalizeCountry(country);
  const row = TABLE[code];
  const zh = language === 'zh';
  if (!row) {
    return {
      label: zh ? '联系当地警方' : 'Contact local police',
      text: zh
        ? '如已受骗，请立即联系你的银行冻结 / 止付，并向当地警方或反诈机构报案'
        : 'If you have been defrauded, call your bank to freeze the payment and report to your local police or anti-fraud authority',
      allowedDigits: [],
    };
  }
  const name = zh ? row.name.zh : row.name.en;
  const alt = row.alt ? (zh ? `或拨打 ${row.alt} 报警` : ` or call ${row.alt} for emergency police`) : '';
  return {
    dial: row.dial,
    label: zh ? `一键拨打 ${row.dial}` : `Call ${row.dial}`,
    text: zh ? `如已受骗，请立即拨打 ${name}${alt}` : `If you have been defrauded, call ${name}${alt}`,
    allowedDigits: [row.dial, ...row.extra].filter(Boolean).map((s) => String(s).replace(/\D/g, '')),
  };
}

/** 所有地区热线号码的数字形式（白名单，供结果抹号时放行） */
export const ALL_HOTLINE_DIGITS: string[] = Array.from(
  new Set(
    Object.values(TABLE).flatMap((r) => [r.dial, ...r.extra].filter(Boolean).map((s) => String(s).replace(/\D/g, ''))),
  ),
);
