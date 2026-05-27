-- V3-006：给 breach_targets 加 (user_id, target_value_lookup) 唯一约束
-- 防止并发 addTarget 时同一用户重复加同一邮箱。
-- 已存在的 duplicate 会让此迁移失败；上线前应人工清理（实际生产中此表新建未使用，几乎无数据）。

-- 先清理可能已存在的重复（保留 created_at 最早一条）
DELETE FROM breach_targets
WHERE id NOT IN (
  SELECT MIN(id)
  FROM breach_targets
  GROUP BY user_id, target_value_lookup
);

CREATE UNIQUE INDEX "breach_targets_user_id_target_value_lookup_key"
  ON "breach_targets"("user_id", "target_value_lookup");
