-- =====================================================
-- V3-015 家庭成员命名（S5-12）
--
-- 需求：
--   1) 每个成员可在该家庭内给"自己"起家庭内称呼（family_members.display_name）
--      - 全员可见，但仅自己可改
--      - NULL → 回退到 users.nickname
--   2) 任一成员可以给同家庭其他成员起"私人备注"（family_member_aliases）
--      - 仅备注创建者本人可见
--      - 不影响 APP 全局 user.nickname
--
-- 业务说明：
--   - 命名只影响家庭页显示，不改 user 主表
--   - 用户 A 在家庭 X 改自己的 display_name，家庭 Y 不受影响
-- =====================================================

-- 1) family_members 加自我命名字段
ALTER TABLE "family_members"
  ADD COLUMN "display_name" VARCHAR(64);

-- 2) 新表：私人备注
CREATE TABLE IF NOT EXISTS "family_member_aliases" (
  "id"                 TEXT NOT NULL,
  "family_member_id"   TEXT NOT NULL,
  "creator_user_id"    TEXT NOT NULL,
  "alias"              VARCHAR(64) NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_member_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "family_member_aliases_member_creator_unique"
  ON "family_member_aliases"("family_member_id", "creator_user_id");

CREATE INDEX "family_member_aliases_creator_idx"
  ON "family_member_aliases"("creator_user_id");

ALTER TABLE "family_member_aliases"
  ADD CONSTRAINT "family_member_aliases_family_member_id_fkey"
  FOREIGN KEY ("family_member_id") REFERENCES "family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_member_aliases"
  ADD CONSTRAINT "family_member_aliases_creator_user_id_fkey"
  FOREIGN KEY ("creator_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
