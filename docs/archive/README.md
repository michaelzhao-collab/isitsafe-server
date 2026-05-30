# 已归档文档

本目录下的文档是历史方案存档，**不再适用于当前架构**。

## 现状（2026-05）

- `WEB/` 静态落地页 → Cloudflare Pages（不再用 Railway）
- `admin/` React SPA → Cloudflare Pages（不再用 Railway）
- `Server/` NestJS API → 仍在 Railway

迁移完整流程见 [`../Cloudflare-Pages迁移-WEB与admin.md`](../Cloudflare-Pages迁移-WEB与admin.md)。

## 为什么保留

- 万一以后要回滚或参考 Railway 部署细节
- 写作时 Railway 上的环境变量 / 配置截图都还在里面
