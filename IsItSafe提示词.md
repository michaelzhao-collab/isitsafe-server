项目名称：IsItSafe

目标：
目标：
生成一个完整的 AI 风险判断助手项目（IsItSafe），包括三个模块：
1. iOS App（SwiftUI）
2. Node.js NestJS 后端 API
3. 后台管理系统 Admin Panel（Web 前端，React + Ant Design 或 Vue3 + Element）
4. PostgreSQL 数据库 + Redis 缓存

核心功能：
1. AI调用模块：
   - 支持文本、截图、电话、链接分析
   - 国内使用豆包，海外使用 OpenAI
2. 登录系统：
   - 国内：手机号 + 验证码、微信快捷、短信快捷登录
   - 海外：Firebase 登录
3. 订阅系统：
   - iOS Apple IAP（周订阅 / 月订阅）
   - Android / 未来 Google Play Billing
   - 后端统一管理订阅状态
4. 核心功能覆盖：
   - AI问答（文本、截图、电话、链接）
   - 截图识别（OCR）
   - 电话查询
   - 链接/网站查询
   - 公司/投资平台风险查询
   - 用户历史记录
   - 举报中心
   - 风险知识库（诈骗、黑灰产、老年人骗局、投资/兼职/医疗风险）
5. 数据交互：
   - 所有模块通过 JSON + HTTPS
   - iOS App 和 Admin Panel 均调用 Server API
   - 部署后通过域名访问
6. 后端权限控制：
   - Admin Panel 支持普通管理员 / 超级管理员
   - Server 校验权限
7. 架构要求：
   - 模块化、可扩展，未来支持 Android / Web / 浏览器插件
   - AI分析、数据存储、登录、订阅、权限管理独立模块化
8. iOS App 功能：
   - 调用 Server API 展示 AI分析结果、历史记录、举报、知识库、订阅状态
   - UI现代简洁、支持深色模式
9. Admin Panel 功能：
   - 管理用户信息、查询记录、举报内容、案例/知识库、订阅状态、AI日志
   - 支持搜索、筛选、导出、批量上传/编辑知识库

附加要求：
- AI模块对国内用户使用豆包模型，对海外用户使用 OpenAI
- 登录与订阅功能区分国内/海外
- 数据交互必须安全，通过 HTTPS + 域名访问
- 后端模块化，便于扩展和维护

---

# 目录结构

1. server/  → Node.js NestJS 后端 API
2. ios/     → iOS App (SwiftUI)
3. admin/   → 后台管理系统 (React + Ant Design 或 Vue3 + Element)


---


# 一、服务器模块 (Node.js + NestJS)

文件夹：server/

技术栈：
- Node.js + NestJS
- PostgreSQL
- Redis
- Prisma ORM
- AI调用模块（支持豆包 / OpenAI / 可扩展到其他模型）
- 后端可在配置文件切换模型和配置 Key
- 部署后通过域名提供 HTTPS 接口

---

# 二、模块划分

## 1. auth
- 国内：
  - 手机号 + 验证码登录
  - 微信快捷登录
  - 短信快捷登录
- 海外：
  - Firebase 登录
- JWT token 管理 + Refresh Token
- 登录失败次数限制 & 防刷机制
- 登录历史记录（用户ID、IP、设备、时间）
- API:
  - POST /api/auth/login
  - POST /api/auth/logout
  - GET /api/auth/userinfo
  - POST /api/auth/refresh-token
  - GET /api/auth/login-history (Admin)

---

## 2. ai
- 接收用户问题：
  - 文本
  - 截图
  - 电话
  - 链接
- AI多模型支持：
  - 模型类型可配置（豆包 / OpenAI / 自定义模型）
  - 可在后端配置 Key / Token / API 地址
  - 请求队列 & 并发控制
  - 多语言支持（中文/英文）
- JSON 输出：json
{
  "risk_level": "high/medium/low",
  "confidence": 80,
  "confidence_level": "高/中/低",
  "reasons": ["原因1","原因2"],
  "advice": "建议文字",
  "timestamp": "2026-03-05T00:00:00Z",
  "model_source": "doubao/openai"
}
- OCR截图识别
- 电话/链接/公司/投资平台查询
- API:
  - POST /api/ai/analyze
  - POST /api/ai/analyze/screenshot
  - POST /api/ai/analyze/batch (批量分析)
  - GET /api/ai/templates (前端系统提示词)

3. query
  - 电话查询模块
  - 链接/网址查询模块
  - 公司/投资平台查询模块
  - 黑灰产数据库查询
  - Redis 缓存常用查询
  - 支持批量查询
  - API:
    - POST /api/query/phone
    - POST /api/query/url
    - POST /api/query/company
    - POST /api/query/batch
    - GET /api/query/tags (返回风险标签)




4. subscription
  - iOS：Apple IAP 周/月订阅
  - Android/未来 Google Play Billing
  - 周订阅/月订阅
  - subscription状态管理
  - 数据库存储订阅状态
  - 记录订阅历史（开始/续费/取消）
  - API:
    - POST /api/subscription/verify
    - GET /api/subscription/status
    - POST /api/subscription/refresh
    - GET /api/subscription/logs (Admin)



5. report
  - 用户举报中心
  - 举报内容存储
  - 举报状态：待处理 / 已处理 / 驳回
  - 关联查询 ID 和 AI分析结果
  - 支持批量操作 / 导出
  - 后台管理接口
  - API:
    - POST /api/report
    - GET /api/report/list (管理员)
    - PUT /api/report/:id/status
    - GET /api/report/stats




6. knowledge
  - 风险知识库接口
  - 每日案例上传（文本/图片/文件）
  - 分类：诈骗、黑灰产、老年人骗局、投资/兼职/医疗风险
  - 批量上传/导入 Excel/CSV
  - 支持版本管理（新增/编辑/删除历史）
  - API:
    - GET /api/knowledge
    - GET /api/knowledge/:id
    - POST /api/knowledge/upload (批量上传)
    - PUT /api/knowledge/:id
    - DELETE /api/knowledge/:id

7. admin
  - Admin Panel 权限验证
  - 普通管理员 / 超级管理员
  - JWT + role 权限控制
  - 所有 Admin API 调用前校验权限



三、数据库表设计
users：
  id
  phone
  email
  country
  role (user / admin / superadmin)
  last_login
  created_at

queries:
  id
  user_id
  question
  source (text / screenshot / phone / link)
  result(JSON)
  ai_model (doubao / openai / other)
  status (success / fail / pending)

reports:
  id
  user_id
  type
  content
  status (pending / handled / rejected)
  related_query_id
  handled_by (admin_id)
  handled_at
  created_at

subscriptions:
  user_id
  product_id
  status
  expire_time
  history_log (JSON记录订阅状态变化)
  payment_method (Apple/Google)

risk_data:
  type (phone / url / company / platform / case)
  content
  risk_level
  tags (数组)
  language
  source
  created_at

admin_users:
  id
  username
  password_hash
  role (superadmin / admin)
  last_login
  permissions (JSON)

knowledge_upload_log:
  id
  uploaded_by (admin_id)
  file_name
  upload_time
  status (success / fail)



# 四、iOS App模块 (SwiftUI)

文件夹：ios/

目标：
生成一个完整的 iOS App，用于 AI 风险判断助手 (IsItSafe)，支持文本/截图/电话/链接问题分析、历史记录、举报、知识库、订阅管理和用户登录。界面现代简洁，支持深色模式，所有数据通过 Server API 获取，安全通过 HTTPS + 域名。

---

# TabBar 结构与功能

## 1. Home
功能：
- 文本输入问题
- 上传截图进行分析 (OCR)
- 查询电话
- 查询链接/网址
- 调用 AI 分析接口：
  - POST /api/ai/analyze
  - POST /api/ai/analyze/screenshot
- 展示 AI 返回结果：
  - 风险等级 (high/medium/low)
  - 可信度 (百分比)
  - 原因列表
  - 建议
- 状态显示：
  - 分析中 / 分析完成 / 分析失败
- UI 特性：
  - 聊天气泡样式展示结果
  - 支持复制结果文本
  - 风险等级用颜色或图标可视化
- 可扩展：
  - 支持多语言 (中文/英文)

---

## 2. History
功能：
- 展示用户查询历史记录
- 点击记录查看详细分析结果
- 分页加载历史
- API 调用：
  - GET /api/queries
- 支持按日期、风险等级、关键词筛选
- 可选：导出历史（CSV/JSON）

---

## 3. Report
功能：
- 用户举报入口
- 上传举报内容：
  - 截图 / 文本 / 电话 / 链接
- 提交举报：
  - POST /api/report
- 状态显示：
  - 待处理 / 已处理 / 驳回
- 可选：
  - 支持举报分类选择
  - 显示举报提交成功提示

---

## 4. Knowledge
功能：
- 风险知识库展示
- 分类：
  - 诈骗
  - 黑灰产
  - 老年人骗局
  - 投资/兼职/医疗风险
- 支持搜索功能
- 查看单条知识详情
- API 调用：
  - GET /api/knowledge
  - GET /api/knowledge/:id
- UI 特性：
  - 分类标签
  - 可折叠/展开详情
  - 支持分页或滚动加载

---

## 5. Profile
功能：
- 登录/登出
  - 国内：手机号+验证码、微信快捷、短信快捷
  - 海外：Firebase 登录
  - JWT token 管理
- 订阅管理：
  - iOS Apple IAP (周订阅/ 月订阅)
  - 后端状态同步
  - 查看有效期、续订状态
  - API: /api/subscription/*
- 设置：
  - 通知开关
  - 语言切换 (中/英)
  - 地区选择
- API 调用：
  - /api/auth/* (登录/登出/用户信息)
  - /api/subscription/* (订阅管理)
- UI特性：
  - 简洁界面，深色模式支持
  - 状态显示清晰
  - 提供刷新按钮更新用户信息和订阅状态

---

# 网络与数据交互
- 所有请求通过 **HTTPS + 域名**
- JSON 格式数据交互
- 错误处理：
  - 网络异常
  - AI分析失败
  - API返回错误
- 请求状态提示：
  - 分析中 / 成功 / 失败
- 支持离线缓存历史记录 (可选)
- 支持未来扩展 Android/Web 调用同一 API

---

# UI / 用户体验要求
- 现代简洁风格，类似 ChatGPT 风格
- TabBar 导航，操作直观
- 交互响应及时
- 支持深色模式
- 每个页面状态清晰、操作反馈及时
- 所有功能模块可单独调用 Server API

---

# 扩展性
- 可增加 Android/Web 客户端调用同一 Server API
- 可增加国际化多语言
- AI模块可以切换模型 (豆包/ OpenAI) 通过 Server 配置 Key
- 支持未来增加新功能模块，例如浏览器插件、AI电话助手


# 五、功能需求点（iOS + Server 数据交互）

## 1. 登录系统
- 国内用户：
  - 手机号 + 验证码登录
  - 微信快捷登录
  - 短信快捷登录
- 海外用户：
  - Firebase 登录
- 功能：
  - JWT token 管理 (含 Refresh Token)
  - 登录状态保存
  - 防刷机制（限制登录失败次数）
  - 登录历史记录（可供 Admin 查看）
- API：
  - POST /api/auth/login
  - POST /api/auth/logout
  - GET /api/auth/userinfo
  - POST /api/auth/refresh-token
  - GET /api/auth/login-history (Admin)

---

## 2. 订阅管理
- iOS：
  - Apple IAP 周订阅 / 月订阅
- Android / 未来：
  - Google Play Billing
- 功能：
  - 后端收据验证
  - 数据库存储订阅状态
  - 前端显示有效/过期状态
  - 记录订阅历史（开始/续费/取消时间）
- API：
  - POST /api/subscription/verify
  - GET /api/subscription/status
  - POST /api/subscription/refresh
  - GET /api/subscription/logs (Admin)

---

## 3. AI 问答模块
- 支持输入类型：
  - 文本
  - 截图（OCR）
  - 语音
  - 电话 / 链接
- JSON 解析展示：
  - 风险等级 (high/medium/low)
  - 可信度 (百分比)
  - 原因列表
  - 建议文字
  - AI 模型来源 (豆包 / OpenAI / 可配置)
- 提供进度状态：
  - 分析中 / 完成 / 失败
- API：
  - POST /api/ai/analyze
  - POST /api/ai/analyze/screenshot
  - POST /api/ai/analyze/batch
  - GET /api/ai/templates (前端系统提示词)

---

## 4. 电话 / 链接 / 公司查询
- 功能：
  - POST 接口调用
  - 返回风险概率、风险等级标签、历史记录
  - 高风险内容提醒
- API：
  - POST /api/query/phone
  - POST /api/query/url
  - POST /api/query/company
  - POST /api/query/batch (批量查询)
  - GET /api/query/tags (风险标签列表)

---

## 5. 历史记录
- 展示用户查询历史
- 点击记录查看详细分析结果
- 支持分页加载
- 支持搜索和筛选（日期/风险等级/关键词）
- API：
  - GET /api/queries

---

## 6. 举报中心
- 用户可上传：
  - 截图
  - 文本
  - 电话
  - 链接
- 可选择举报类型
- 后端支持后台管理查询与处理
- API：
  - POST /api/report
  - GET /api/report/list (管理员)
  - PUT /api/report/:id/status
  - GET /api/report/stats

---

## 7. 风险知识库
- 分类展示：
  - 诈骗
  - 黑灰产
  - 老年人骗局
  - 投资/兼职/医疗风险
- 搜索功能
- 查看知识详情页
- 支持分页加载
- 支持批量上传/编辑/导入 Excel / CSV
- API：
  - GET /api/knowledge
  - GET /api/knowledge/:id
  - POST /api/knowledge/upload (管理员)
  - PUT /api/knowledge/:id
  - DELETE /api/knowledge/:id

---

## 8. 界面与用户体验
- 现代简洁风格
- TabBar 导航
- AI分析结果可视化（颜色/图标）
- 支持深色模式
- 操作反馈及时，状态提示清晰

---

## 9. 网络与数据交互
- 所有 iOS 请求 API 均通过 **域名访问**
- 使用 HTTPS + JSON
- 错误处理：
  - 网络异常
  - AI分析失败
  - API返回错误
- 前端支持请求状态显示：
  - 分析中 / 成功 / 失败

---

## 10. 扩展性
- Android / Web 可直接调用同一 Server API
- Server 模块化，方便增加新功能
- AI模块可切换模型和 Key (豆包 / OpenAI / 其他)
- 支持未来添加新的查询类型、知识库分类、分析功能



# 六、admin/ (React + Ant Design / Vue3 + Element)

目标：
生成一个完整的后台管理系统 (IsItSafe Admin)，支持用户管理、查询管理、举报管理、知识库/案例管理、AI日志分析和系统设置。所有数据通过 Server API 调用，安全使用 HTTPS + JSON，权限控制基于 JWT + 角色。

---

# 模块划分与功能

## 1. 用户管理
- 查看用户列表
- 用户信息展示：
  - 用户ID
  - 手机号 / 邮箱
  - 国家
  - 注册时间
  - 最后登录时间
  - 订阅状态
- 支持搜索、筛选（按国家/注册时间/订阅状态）
- 支持禁用或封禁用户
- API：
  - GET /api/admin/users
  - PUT /api/admin/users/:id/status
  - GET /api/admin/users/login-history

---

## 2. 查询管理
- 查看用户提交的查询记录
- 查询详情：
  - 用户ID
  - 问题内容
  - AI返回结果
  - 查询时间
- 支持按日期、风险等级、关键词筛选
- 支持导出 CSV/Excel
- API：
  - GET /api/admin/queries
  - GET /api/admin/queries/:id

---

## 3. 举报管理
- 查看用户举报内容
- 举报详情：
  - 举报类型（电话/链接/文本/截图）
  - 用户ID
  - 举报时间
- 标记处理状态：待处理 / 已处理 / 驳回
- 支持批量操作和导出
- API：
  - GET /api/admin/reports
  - PUT /api/admin/reports/:id/status
  - GET /api/admin/reports/stats

---

## 4. 知识库 & 案例管理
- 上传每日案例（文本/图片/文件）
- 分类管理（诈骗/黑灰产/老年人骗局/投资/兼职/医疗风险）
- 支持搜索、筛选、分页
- 支持批量上传 Excel/CSV
- 支持导出
- API：
  - GET /api/admin/knowledge
  - POST /api/admin/knowledge/upload
  - PUT /api/admin/knowledge/:id
  - DELETE /api/admin/knowledge/:id

---

## 5. AI日志与分析
- 日查询量统计
- 风险等级分布统计
- 高风险问题列表
- 支持报表导出
- API：
  - GET /api/admin/ai/logs
  - GET /api/admin/ai/stats

---

## 6. 系统设置
- 权限管理：
  - 普通管理员 / 超级管理员
- AI Key 配置
- 域名 / API 配置
- IAP验证参数
- API：
  - GET /api/admin/settings
  - PUT /api/admin/settings

---

# 数据交互
- 所有前端请求调用 Server API
- 使用 HTTPS + JSON
- 权限验证：
  - JWT + Role
- 支持批量操作和数据导出

---

# UI设计与交互
- 左侧菜单 + 主体表格展示
- 表格支持搜索 / 筛选 / 分页
- 弹窗支持上传 / 编辑 / 批量操作
- 风格：
  - 蓝白简洁风格
  - 表格清晰，信息可视化
- 响应式布局，支持全屏及不同分辨率
- 状态提示：
  - 成功 / 失败 / 处理中
  - 上传、编辑、导出操作反馈及时

---

# 扩展性
- 模块化设计，方便增加新功能
- 可集成其他 Admin 功能，如数据分析仪表盘或用户活跃统计
- 可扩展支持 Android / Web / 插件调用同一 Server API



七、# Cursor 执行说明

项目结构：
- server/  → 后端 Node.js NestJS 服务
- ios/     → iOS App (SwiftUI)
- admin/   → 管理后台 (React + Ant Design / Vue3 + Element)

---

# 执行顺序

1. **Server 生成**
   - 先生成 server/ 文件夹及所有模块：
     - modules/auth.ts
     - modules/ai.ts
     - modules/query.ts
     - modules/subscription.ts
     - modules/report.ts
     - modules/knowledge.ts
     - modules/admin.ts (权限管理)
   - 数据库表结构生成
   - Redis 缓存配置
   - AI 多模型切换配置 (豆包/ OpenAI / 自定义)
   - 执行顺序：
     1. 安装依赖 `npm install`
     2. 配置数据库连接、Redis
     3. 配置 AI Key / 模型
     4. 启动服务 `npm run start:dev`
   - 确保 API 可以通过域名访问，供 iOS 和 Admin 调用

2. **iOS 生成**
   - 生成 ios/ 文件夹及所有页面：
     - Views/HomeView.swift
     - Views/HistoryView.swift
     - Views/ReportView.swift
     - Views/KnowledgeView.swift
     - Views/ProfileView.swift
   - 配置网络请求指向 server 域名
   - 状态管理与 UI 绑定
   - 执行顺序：
     1. 打开 Xcode
     2. 配置 BundleID
     3. 运行模拟器或真机调试
   - 支持深色模式和多语言

3. **Admin Panel 生成**
   - 生成 admin/ 文件夹及页面：
     - pages/UserManagement.jsx
     - pages/QueryManagement.jsx
     - pages/ReportManagement.jsx
     - pages/KnowledgeManagement.jsx
     - pages/Analytics.jsx
     - components/TableWithSearch.jsx
   - 配置 API 指向 server 域名
   - 权限控制：JWT + Role
   - 执行顺序：
     1. 安装依赖 `npm install`
     2. 启动开发服务器 `npm start` 或 `npm run dev`
   - UI 支持搜索/筛选/分页/导出/批量操作

---

# 注意事项

- **顺序生成**：
  1. Server
  2. iOS
  3. Admin
- **配置 Key**：
  - Server 需要先配置 AI Key、数据库、Redis
- **API 域名**：
  - iOS 和 Admin 的请求都必须指向部署的 Server 域名
- **模块化生成**：
  - 每个模块单独生成文件，避免 Cursor 同时生成时覆盖
- **状态和交互**：
  - iOS App 和 Admin 都要显示操作状态（成功/失败/处理中）
- **扩展性**：
  - Server 模块化便于未来增加 Android/Web 或插件客户端