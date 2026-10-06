-- 2026-10-06：生产 CDN_DOMAIN 误配为 https://cdn.isitsafe.com（不是我们的域名，DNS 也解析不了），
-- 此前上传的图片/语音/头像都按这个前缀拼了地址存进库，全部打不开。
-- R2 绑定自定义域名 cdn.starlensai.com 后，把库里存量地址的前缀统一换掉。对象 key 不变，只换域名。
-- 只做前缀替换，不删除任何数据；只更新仍含旧前缀的行，重复执行无副作用。

-- 字符串列
UPDATE "users"           SET "avatar"      = replace("avatar",      'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "avatar"      LIKE 'https://cdn.isitsafe.com/%';
UPDATE "queries"         SET "image_url"   = replace("image_url",   'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "image_url"   LIKE 'https://cdn.isitsafe.com/%';
UPDATE "user_feedback"   SET "image_url"   = replace("image_url",   'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "image_url"   LIKE 'https://cdn.isitsafe.com/%';
UPDATE "deepfake_checks" SET "file_url"    = replace("file_url",    'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "file_url"    LIKE 'https://cdn.isitsafe.com/%';
UPDATE "intel_alerts"    SET "cover_image" = replace("cover_image", 'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "cover_image" LIKE 'https://cdn.isitsafe.com/%';
UPDATE "knowledge_cases" SET "cover_image" = replace("cover_image", 'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/') WHERE "cover_image" LIKE 'https://cdn.isitsafe.com/%';

-- JSONB 列（群聊图片/语音 payload、事件卡片、正文块、投稿附件）
UPDATE "family_messages"   SET "payload"        = replace("payload"::text,        'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "payload"::text        LIKE '%https://cdn.isitsafe.com/%';
UPDATE "family_events"     SET "payload"        = replace("payload"::text,        'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "payload"::text        LIKE '%https://cdn.isitsafe.com/%';
UPDATE "intel_alerts"      SET "content_blocks" = replace("content_blocks"::text, 'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "content_blocks"::text LIKE '%https://cdn.isitsafe.com/%';
UPDATE "intel_alert_i18n"  SET "content_blocks" = replace("content_blocks"::text, 'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "content_blocks"::text LIKE '%https://cdn.isitsafe.com/%';
UPDATE "knowledge_cases"   SET "content_blocks" = replace("content_blocks"::text, 'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "content_blocks"::text LIKE '%https://cdn.isitsafe.com/%';
UPDATE "intel_submissions" SET "attachments"    = replace("attachments"::text,    'https://cdn.isitsafe.com/', 'https://cdn.starlensai.com/')::jsonb WHERE "attachments"::text    LIKE '%https://cdn.isitsafe.com/%';
