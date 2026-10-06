/**
 * 2026-10-06：本 App 自己生成的家庭邀请文案（InviteFamilySheet.shareText）被用户粘进来检测时，
 * 大模型不认识 starlensai.com，把「邀请码 + 链接」判成「诱导注册，中风险」——自家产品打自家脸。
 *
 * 这里做确定性识别、不走大模型：只有【整段文本】严格等于我们的分享模板（或只是一条我们的邀请链接）才命中。
 * 混入任何其他文字/链接（例如诈骗者借我们的链接再附上「请先转账」）都不命中，照常交给大模型完整分析。
 */
import type { AnalyzeResult } from './ai.service';

/** 邀请码字母表与 FamilyService.randomInviteCode 一致（BASE32 去掉 0 O 1 I） */
const CODE = '[A-HJ-NP-Z2-9]{6}';
const URL = `https?://(?:www\\.)?(?:starlensai\\.com|starlens\\.ai)/i(?:\\?code=${CODE}|/${CODE})/?`;

const PATTERNS: RegExp[] = [
  // 中文分享模板（带链接 / 不带链接）
  new RegExp(`^我邀请你加入\\s*StarLens AI\\s*家庭组。\\s*邀请码[:：]\\s*${CODE}。(?:\\s*链接[:：]\\s*${URL})?$`, 'i'),
  // 英文分享模板
  new RegExp(`^Join my family on StarLens AI\\s*[—-]\\s*invite code:\\s*${CODE}\\.(?:\\s*Open link:\\s*${URL})?$`, 'i'),
  // 只有一条我们的邀请链接
  new RegExp(`^${URL}$`, 'i'),
];

export function isOwnFamilyInvite(content: string | null | undefined): boolean {
  const text = (content ?? '').trim();
  if (!text || text.length > 300) return false;
  return PATTERNS.some((re) => re.test(text));
}

export function ownFamilyInviteResult(language: 'zh' | 'en'): AnalyzeResult {
  const zh = language !== 'en';
  return {
    intent: 'scam_detection',
    verdict: 'safe',
    risk_level: 'low',
    score: 10,
    confidence: 95,
    risk_type: [],
    risk_db_hit: false,
    summary: zh
      ? '这是星识安全助手（StarLens AI）官方生成的家庭组邀请，链接 starlensai.com 是本 App 的官方网站。'
      : 'This is an official StarLens AI family group invitation. starlensai.com is the official website of this app.',
    reasons: zh
      ? [
          '链接域名 starlensai.com 是星识安全助手的官方域名，不是仿冒网站。',
          '邀请码只用于加入家庭组，加入后家人之间可以互相提醒风险，不涉及任何付款。',
          '加入家庭组不需要提供验证码、密码或银行卡信息。',
        ]
      : [
          'starlensai.com is the official domain of StarLens AI, not a look-alike site.',
          'The invite code is only used to join a family group so family members can alert each other. No payment is involved.',
          'Joining a family group never requires a verification code, password or bank card details.',
        ],
    advice: zh
      ? [
          '先确认发邀请的是你认识的家人，不确定可以打电话问一下。',
          '已安装 App 的话，打开「家庭」页输入邀请码即可加入。',
          '如果有人以「家庭邀请」为由索要验证码或要求转账，那不是我们的流程，请直接拒绝。',
        ]
      : [
          'Make sure the invitation comes from a family member you know. If unsure, give them a call.',
          'If you already have the app, open the Family tab and enter the invite code to join.',
          'If anyone asks for a verification code or money in the name of a "family invite", that is not our process. Refuse.',
        ],
  };
}
