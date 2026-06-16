-- V4-P3 关怀提醒静音表加 group FK + cascade
-- 上一版（20260615100000）没建 FK，group 解散后会留孤儿 mute 记录

-- 1) 先清掉可能存在的孤儿（如果上线后已经有解散的 group）
DELETE FROM "family_care_mutes" m
WHERE NOT EXISTS (
    SELECT 1 FROM "family_groups" g WHERE g.id = m.group_id
);

-- 2) 加 FK + ON DELETE CASCADE
ALTER TABLE "family_care_mutes"
    ADD CONSTRAINT "family_care_mutes_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "family_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
