-- AlterTable: 为 users 表增加 wechat_nickname（微信登录昵称），用于个人资料展示
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wechat_nickname" TEXT;
