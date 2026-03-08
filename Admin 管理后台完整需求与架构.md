# IsItSafe Admin 管理后台完整需求与架构

目标：
为 IsItSafe 风险判断系统提供一个完整的后台管理系统，用于：
- 用户管理
- AI分析记录管理
- 举报管理
- 风险数据库管理
- 知识库 / 案例库管理
- AI模型与Key管理
- 系统配置管理
- 数据统计与风控监控

后台通过 Server API 与数据库交互，不直接访问数据库。

技术建议：
admin/
React + Ant Design
或
Vue3 + Element Plus

所有请求统一走 Server API。

================================================================

一、后台总体模块

后台包含以下核心模块：

1 用户管理
2 查询记录管理
3 举报管理
4 风险数据库管理
5 知识库管理
6 AI模型与Key管理
7 系统配置管理
8 数据统计与分析
9 管理员权限管理

================================================================

二、用户管理模块

菜单：
Users

功能：

查看用户列表

字段：
id
phone
email
country
role
created_at
last_login
subscription_status

支持：

搜索
手机号搜索
国家筛选
注册时间筛选

操作：

禁用用户
解封用户
查看用户查询记录

API：

GET /api/admin/users
PUT /api/admin/users/:id/status

================================================================

三、查询记录管理

菜单：
AI Queries

查看用户所有分析请求

字段：

query_id
user_id
input_type
content
risk_level
confidence
ai_provider
created_at

支持筛选：

日期
风险等级
关键词
AI模型

功能：

查看详情
查看AI返回JSON
查看命中案例
查看数据库匹配结果

API：

GET /api/admin/queries
GET /api/admin/queries/:id

================================================================

四、举报管理

菜单：
Reports

字段：

report_id
user_id
type
content
status
created_at

状态：

pending
handled
rejected

功能：

查看举报
标记处理
添加备注
导出数据

API：

GET /api/admin/reports
PUT /api/admin/reports/:id/status

================================================================

五、风险数据库管理（核心）

菜单：
Risk Database

用于维护诈骗数据

数据库表：
risk_data

字段：

id
type
content
risk_level
risk_category
source
tags
created_at

type：

phone
url
company
wallet
keyword

功能：

新增风险数据
编辑
删除
批量导入
CSV导入

支持搜索：

电话号码
网址
公司名

API：

GET /api/admin/risk-data
POST /api/admin/risk-data
PUT /api/admin/risk-data/:id
DELETE /api/admin/risk-data/:id

================================================================

六、知识库 / 案例库管理（RAG数据）

菜单：
Knowledge Base

数据库：

knowledge_cases

字段：

id
title
category
content
tags
source
language
created_at

category：

诈骗
投资骗局
兼职骗局
黑灰产
老年人骗局
假客服

功能：

新增案例
编辑案例
删除案例
批量导入CSV
搜索

API：

GET /api/admin/knowledge
POST /api/admin/knowledge
PUT /api/admin/knowledge/:id
DELETE /api/admin/knowledge/:id

================================================================

七、AI模型与Key管理（非常重要）

菜单：
AI Settings

后台必须支持配置：

AI_PROVIDER

支持：

openai
doubao
future_model

字段：

provider
api_key
base_url
model_name
enabled

数据库：

ai_providers

字段：

id
provider
api_key
base_url
model_name
enabled
updated_at

功能：

新增AI配置
切换默认模型
修改Key
启用/禁用

Server 读取配置优先顺序：

1 数据库 settings
2 .env 备用

API：

GET /api/admin/ai/providers
POST /api/admin/ai/providers
PUT /api/admin/ai/providers/:id
PUT /api/admin/ai/providers/activate/:id

================================================================

八、系统配置管理

菜单：
System Settings

数据库：

settings

字段：

key
value
updated_at

配置项示例：

AI_PROVIDER
CACHE_TTL
MAX_AI_REQUEST_PER_MIN
MAX_QUERY_LENGTH

功能：

修改配置
实时生效

API：

GET /api/admin/settings
PUT /api/admin/settings

================================================================

九、数据统计与监控

菜单：
Analytics

统计内容：

每日查询量
AI调用量
风险等级分布
高风险案例
用户增长

展示：

图表
趋势图

API：

GET /api/admin/analytics/overview
GET /api/admin/analytics/risk-stats
GET /api/admin/analytics/daily-queries

================================================================

十、管理员权限管理

菜单：
Admin Users

角色：

super_admin
admin

权限：

super_admin

管理AI配置
管理系统设置
管理管理员

admin

用户管理
举报管理
案例管理

数据库：

admin_users

字段：

id
email
password_hash
role
created_at

API：

GET /api/admin/admin-users
POST /api/admin/admin-users
PUT /api/admin/admin-users/:id

================================================================

十一、权限控制

后台所有接口必须验证：

JWT token
role

admin接口：

/api/admin/*

权限校验：

admin
super_admin

================================================================

十二、后台UI结构

左侧菜单：

Dashboard
Users
AI Queries
Reports
Risk Database
Knowledge Base
AI Settings
System Settings
Analytics
Admin Users

右侧：

表格 + 筛选 + 编辑弹窗

================================================================

十三、关键目标

后台必须支持：

AI Key配置
AI Provider切换
风险数据库维护
RAG知识库维护
案例上传
用户管理
查询记录查看
系统配置调整

这样未来：

AI模型
风险规则
知识库

都可以在后台直接维护。

================================================================

十四、当前Server架构是否支持

当前Server架构：

NestJS
Prisma
PostgreSQL
Redis
AI Providers

基本可以支持。

但需要新增模块：

admin
settings
analytics
ai-providers

================================================================

十五、最终后台结构

admin/

pages/
dashboard
users
queries
reports
risk-database
knowledge-base
ai-settings
system-settings
analytics
admin-users

services/
api.js

components/
table
filters
forms
