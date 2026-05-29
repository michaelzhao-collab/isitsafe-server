/**
 * V3-S3-6 region_code → IANA 时区映射
 *
 * 输入：ISO 3166-2（如 "CN-11", "US-CA"）或 ISO 3166-1 alpha-2（"CN", "US"）
 * 输出：IANA tz 标识，找不到时 fallback "UTC"
 *
 * 设计：
 *  - 国家级映射覆盖 V3 一期目标市场（CN/HK/TW/US/JP/KR/SG/MY/TH/VN/IN/AU/GB/CA/DE/FR）
 *  - 美国按州细分（CA/WA/OR → PT；NY/FL → ET；TX/IL → CT）；其余州 fallback America/Los_Angeles
 *  - 中国大陆全部 Asia/Shanghai（无 dst，单一 tz）；HK / TW 用各自 tz
 *
 * 不在白名单内的 region：返 'UTC'，cron 仍能正常跑但用户体验上跟服务器时钟一致。
 */

const COUNTRY_TZ: Record<string, string> = {
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  MO: 'Asia/Macau',
  US: 'America/Los_Angeles', // 默认西海岸；州级细分见下
  CA: 'America/Toronto',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  IN: 'Asia/Kolkata',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
};

const US_STATE_TZ: Record<string, string> = {
  CA: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  NV: 'America/Los_Angeles',
  NY: 'America/New_York',
  NJ: 'America/New_York',
  MA: 'America/New_York',
  PA: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  TX: 'America/Chicago',
  IL: 'America/Chicago',
  MN: 'America/Chicago',
  CO: 'America/Denver',
  AZ: 'America/Phoenix',
  HI: 'Pacific/Honolulu',
  AK: 'America/Anchorage',
};

const CA_PROV_TZ: Record<string, string> = {
  BC: 'America/Vancouver',
  AB: 'America/Edmonton',
  SK: 'America/Regina',
  ON: 'America/Toronto',
  QC: 'America/Toronto',
};

export function regionToTimezone(regionCode: string | null | undefined): string {
  if (!regionCode) return 'UTC';
  const code = regionCode.trim().toUpperCase();
  // 含 '-' 的二级区码：US-CA / CN-11
  if (code.includes('-')) {
    const [country, sub] = code.split('-', 2);
    if (country === 'US' && US_STATE_TZ[sub]) return US_STATE_TZ[sub];
    if (country === 'CA' && CA_PROV_TZ[sub]) return CA_PROV_TZ[sub];
    return COUNTRY_TZ[country] || 'UTC';
  }
  return COUNTRY_TZ[code] || 'UTC';
}

/**
 * 给定一个 UTC 时间戳和 tz，返回该 tz 内的 YYYY-MM-DD 字符串
 */
export function localDateString(date: Date, tz: string): string {
  // en-CA locale → ISO YYYY-MM-DD 输出
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * 给定 tz，返回该 tz 当前时间的小时（0-23）
 */
export function localHour(date: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return parseInt(h, 10);
}

/**
 * 按 tz 边界计算 fromDate → toDate 的整数天数差。
 * 同一天 = 0；昨天 → 今天 = 1。
 */
export function daysDiffInTz(fromDate: Date, toDate: Date, tz: string): number {
  const from = localDateString(fromDate, tz);
  const to = localDateString(toDate, tz);
  // 把 YYYY-MM-DD 解释为 UTC 0:00，再算 ms 差 → 整数天
  const fromUtc = Date.parse(from + 'T00:00:00Z');
  const toUtc = Date.parse(to + 'T00:00:00Z');
  return Math.round((toUtc - fromUtc) / (24 * 3600 * 1000));
}
