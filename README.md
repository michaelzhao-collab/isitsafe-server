# IsItSafe - AI 风险判断助手

包含服务端 API、iOS App、管理后台三个部分，实现 AI 风险分析、登录订阅、举报与知识库等功能。

## 项目结构

```
IsItSafe/
├── server/     # NestJS 后端 API（PostgreSQL + Redis + 豆包/OpenAI）
├── ios/        # iOS App（SwiftUI）
├── admin/      # 管理后台（React + Ant Design）
└── IsItSafe提示词.md
```

## 快速开始

1. **后端**（需先准备 PostgreSQL、Redis 与 .env）  
   ```bash
   cd server && npm install && npx prisma generate && npx prisma migrate dev
   npx prisma db seed   # 可选：创建管理员 admin / admin123
   npm run start:dev
   ```

2. **管理后台**  
   ```bash
   cd admin && cp .env.example .env && npm install && npm run dev
   ```
   浏览器打开后使用管理员账号登录。

3. **iOS**  
   用 Xcode 新建 App 工程，将 `ios/IsItSafe` 下源码加入工程，在 `APIConfig.swift` 中配置 API 地址后运行。

## 文档

- [Server 说明](Server/README.md)
- [iOS 说明](iOS/README.md)
- [Admin 说明](admin/README.md)
- [统一文件上传说明](docs/统一文件上传说明.md)
- [部署指南（Server 与 Admin）](docs/部署指南-Server与Admin.md)

## 注意事项

- 生产环境请使用 HTTPS 与正式域名，并配置好 AI Key（豆包/OpenAI）、JWT 密钥与数据库连接。
- 国内/海外登录与 AI 模型切换见提示词文档与 Server 配置。
