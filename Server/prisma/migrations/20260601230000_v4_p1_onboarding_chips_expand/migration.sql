-- V4-P1 chips 池扩充：原 4 条 → 14 条
-- iOS 端每次新对话从池中随机抽 4 个展示，多样性更高
-- 覆盖：通用/电话号码/网购退款/仿冒身份/视频语音/工作/红包 7 大类

INSERT INTO "onboarding_chips" ("id", "order_idx", "label_zh", "label_en", "icon_type", "action_type", "action_payload_zh", "action_payload_en", "status", "updated_at") VALUES
  -- 通用诈骗类
  (gen_random_uuid()::text, 5,
   '这条短信里的链接能点吗？', 'Is the link in this SMS safe to click?',
   'envelope.badge', 'text',
   '这条短信里的链接能点吗？', 'Is the link in this SMS safe to click?',
   'active', CURRENT_TIMESTAMP),
  -- 电话/号码类
  (gen_random_uuid()::text, 6,
   '陌生号码打来说我中奖了', 'A stranger called saying I won a prize',
   'phone.fill', 'text',
   '陌生号码打来说我中奖了', 'A stranger called saying I won a prize',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 7,
   '+86 开头的国际电话靠谱吗？', 'Is this international call number trustworthy?',
   'phone.down.fill', 'text',
   '+86 开头的国际电话靠谱吗？', 'Is this international call number trustworthy?',
   'active', CURRENT_TIMESTAMP),
  -- 网购/退款类
  (gen_random_uuid()::text, 8,
   '快递说包裹有问题要赔我钱', 'Courier says my package has a problem and wants to refund me',
   'shippingbox.fill', 'text',
   '快递说包裹有问题要赔我钱', 'Courier says my package has a problem and wants to refund me',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 9,
   '客服让我先付一笔保证金', 'Customer service wants me to pay a "deposit" first',
   'creditcard.fill', 'text',
   '客服让我先付一笔保证金', 'Customer service wants me to pay a "deposit" first',
   'active', CURRENT_TIMESTAMP),
  -- 仿冒身份类
  (gen_random_uuid()::text, 10,
   '自称银行客服让我转账到"安全账户"', '"Bank rep" wants me to transfer to a "safe account"',
   'person.badge.shield.checkmark', 'text',
   '自称银行客服让我转账到"安全账户"', '"Bank rep" wants me to transfer to a "safe account"',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 11,
   '亲戚突然借钱说很急，怎么核实？', 'A relative suddenly asks to borrow money urgently — how to verify?',
   'person.crop.circle.badge.exclamationmark', 'text',
   '亲戚突然借钱说很急，怎么核实？', 'A relative suddenly asks to borrow money urgently — how to verify?',
   'active', CURRENT_TIMESTAMP),
  -- 视频/语音/AI 类
  (gen_random_uuid()::text, 12,
   '电话里声音像家人但感觉怪怪的', 'Phone caller sounds like family but feels off',
   'waveform', 'text',
   '电话里声音像家人但感觉怪怪的', 'Phone caller sounds like family but feels off',
   'active', CURRENT_TIMESTAMP),
  -- 工作/兼职类
  (gen_random_uuid()::text, 13,
   '兼职刷单先垫付能做吗？', 'Is "task-rebate" side gig with upfront payment legit?',
   'briefcase.fill', 'text',
   '兼职刷单先垫付能做吗？', 'Is "task-rebate" side gig with upfront payment legit?',
   'active', CURRENT_TIMESTAMP),
  -- 红包/中奖类
  (gen_random_uuid()::text, 14,
   '扫码领红包要填身份证', 'QR code to claim a gift asks for my ID number',
   'gift.fill', 'text',
   '扫码领红包要填身份证', 'QR code to claim a gift asks for my ID number',
   'active', CURRENT_TIMESTAMP);
