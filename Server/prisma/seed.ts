/**
 * IsItSafe 种子数据：risk_data、knowledge_cases 示例，便于本地测试
 * 执行：npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ---------- risk_data 示例 ----------
  await prisma.riskData.upsert({
    where: { id: 'seed-risk-1' },
    create: {
      id: 'seed-risk-1',
      type: 'phone',
      content: '+86 13800138000',
      riskLevel: 'high',
      riskCategory: '诈骗',
      tags: ['诈骗', '假客服'],
      source: 'seed',
      evidence: '用户举报多次',
    },
    update: {},
  });
  await prisma.riskData.upsert({
    where: { id: 'seed-risk-2' },
    create: {
      id: 'seed-risk-2',
      type: 'url',
      content: 'https://fake-bank-login.com',
      riskLevel: 'high',
      riskCategory: '钓鱼网站',
      tags: ['钓鱼', '仿冒银行'],
      source: 'seed',
      evidence: '仿冒某银行登录页',
    },
    update: {},
  });
  await prisma.riskData.upsert({
    where: { id: 'seed-risk-3' },
    create: {
      id: 'seed-risk-3',
      type: 'company',
      content: '某某高收益理财平台',
      riskLevel: 'medium',
      riskCategory: '投资骗局',
      tags: ['投资骗局', '高收益'],
      source: 'seed',
    },
    update: {},
  });
  await prisma.riskData.upsert({
    where: { id: 'seed-risk-4' },
    create: {
      id: 'seed-risk-4',
      type: 'keyword',
      content: '刷单兼职日结',
      riskLevel: 'medium',
      riskCategory: '兼职骗局',
      tags: ['兼职骗局', '刷单'],
      source: 'seed',
    },
    update: {},
  });

  // ---------- knowledge_cases 示例 ----------
  await prisma.knowledgeCase.upsert({
    where: { id: 'seed-kb-1' },
    create: {
      id: 'seed-kb-1',
      title: '假冒银行短信钓鱼案例',
      category: '钓鱼网站',
      content: '用户收到冒充银行的短信，内含链接诱导输入银行卡号与密码，造成资金损失。特征：链接非官网、要求填写敏感信息。',
      tags: ['钓鱼', '银行', '短信', '仿冒'],
      language: 'zh',
      source: 'seed',
    },
    update: {},
  });
  await prisma.knowledgeCase.upsert({
    where: { id: 'seed-kb-2' },
    create: {
      id: 'seed-kb-2',
      title: '刷单兼职诈骗',
      category: '兼职骗局',
      content: '以“刷单返利”“日结工资”为诱饵，先让受害人垫付资金，随后以各种理由拒绝返款或拉黑。',
      tags: ['兼职', '刷单', '诈骗', '垫付'],
      language: 'zh',
      source: 'seed',
    },
    update: {},
  });
  await prisma.knowledgeCase.upsert({
    where: { id: 'seed-kb-3' },
    create: {
      id: 'seed-kb-3',
      title: '假客服退款诈骗',
      category: '假客服',
      content: '冒充电商或快递客服，以“订单异常”“退款”为由要求受害人点击链接或提供验证码，进而盗取账户或资金。',
      tags: ['假客服', '退款', '验证码', '电商'],
      language: 'zh',
      source: 'seed',
    },
    update: {},
  });
  await prisma.knowledgeCase.upsert({
    where: { id: 'seed-kb-4' },
    create: {
      id: 'seed-kb-4',
      title: '高收益投资骗局',
      category: '投资骗局',
      content: '承诺高额回报、保本保息的理财或投资平台，初期可提现建立信任，后期卷款跑路。',
      tags: ['投资', '高收益', '理财', '跑路'],
      language: 'zh',
      source: 'seed',
    },
    update: {},
  });
  await prisma.knowledgeCase.upsert({
    where: { id: 'seed-kb-5' },
    create: {
      id: 'seed-kb-5',
      title: '老年人保健品诈骗',
      category: '老年人骗局',
      content: '针对老年人推销高价保健品、医疗器械，夸大疗效，或以“免费体检”“讲座”名义套取信息、推销产品。',
      tags: ['老年人', '保健品', '虚假医疗', '讲座'],
      language: 'zh',
      source: 'seed',
    },
    update: {},
  });

  // ---------- settings 默认一条（MVP 可读 env，预留后台改）----------
  const existing = await prisma.settings.findFirst();
  if (!existing) {
    await prisma.settings.create({
      data: {
        defaultProvider: 'doubao',
        doubaoKey: null,
        openaiKey: null,
        aiBaseUrl: null,
      },
    });
  }

  console.log('Seed completed: risk_data, knowledge_cases, settings.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
