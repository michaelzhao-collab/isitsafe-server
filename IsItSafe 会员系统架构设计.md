IsItSafe 会员系统架构设计
版本：V1
目标：在不破坏现有系统架构的情况下，为系统增加完整会员体系与后台会员配置系统。
技术架构：

Server:
NestJS
Prisma ORM
PostgreSQL
Redis

Client:
iOS SwiftUI

Admin:
React + Ant Design

------------------------------------------------------------

一、会员系统设计目标

1. 用户可以通过 Apple IAP 订阅会员
2. Server 统一管理会员状态
3. iOS 不保存会员逻辑，只读取 Server 数据
4. Admin 后台可以查看用户会员状态
5. Admin 可以管理会员套餐
6. 会员套餐价格与文案不写死在客户端
7. 会员套餐展示顺序后台可控制
8. 支持会员推荐套餐
9. 尽量减少对现有代码的影响

------------------------------------------------------------

二、数据库设计

1.User 表

model User {

  id String @id @default(uuid())

  phone String?
  email String?

  avatar String?
  nickname String?
  gender String @default("unknown")
  birthday DateTime?

  subscriptionStatus String @default("free")
  subscriptionExpire DateTime?

  createdAt DateTime @default(now())
}

字段说明：

subscriptionStatus
free
premium

subscriptionExpire
会员到期时间

会员判断逻辑：

if subscriptionExpire > now
    premium
else
    free

------------------------------------------------------------

2.Subscription 表

用于记录用户订阅历史。

model Subscription {

  id String @id @default(uuid())

  userId String
  user User @relation(fields: [userId], references: [id])

  productId String
  planType String

  status String
  expireTime DateTime

  transactionId String?

  createdAt DateTime @default(now())
}

planType：

weekly
monthly
yearly

status：

active
expired
cancelled

------------------------------------------------------------

3.会员套餐配置表

model MembershipPlan {

  id String @id @default(uuid())

  name String
  productId String

  price Float
  currency String

  period String

  description String?

  isActive Boolean @default(true)

  sortOrder Int @default(0)

  isRecommended Boolean @default(false)

  createdAt DateTime @default(now())
}

字段说明：

name
套餐名称

productId
Apple IAP productId

price
价格

period
weekly
monthly
yearly

isActive
是否展示

sortOrder
显示顺序

isRecommended
是否推荐套餐

------------------------------------------------------------

三、Server API 设计

1.获取会员套餐

GET /api/membership/plans

返回：

[
 {
  "name":"Weekly",
  "productId":"isitsafe_weekly",
  "price":9.99,
  "currency":"USD",
  "period":"weekly",
  "isRecommended":false
 },
 {
  "name":"Monthly",
  "productId":"isitsafe_monthly",
  "price":19.99,
  "currency":"USD",
  "period":"monthly",
  "isRecommended":false
 },
 {
  "name":"Yearly",
  "productId":"isitsafe_yearly",
  "price":129.99,
  "currency":"USD",
  "period":"yearly",
  "isRecommended":true
 }
]

说明：

iOS 通过此接口动态展示会员套餐。

------------------------------------------------------------

2.获取用户信息

GET /api/auth/userinfo

返回：

{
  "id": "",
  "nickname": "",
  "avatar": "",

  "subscriptionStatus": "premium",
  "subscriptionExpire": "2026-03-01"
}

iOS 根据该信息判断用户是否会员。

------------------------------------------------------------

3.订阅验证

POST /api/subscription/verify

请求：

{
 "receipt": "",
 "productId": "isitsafe_yearly"
}

Server逻辑：

1 调用 Apple receipt verify API
2 创建 subscription 记录
3 更新 user.subscriptionExpire
4 更新 user.subscriptionStatus

------------------------------------------------------------

4.查询订阅状态

GET /api/subscription/status

返回：

{
 "isPremium": true,
 "expireTime": "2026-03-01",
 "planType": "yearly"
}

------------------------------------------------------------

四、Server 自动过期机制

使用 NestJS Cron。

@Cron('0 * * * *')

每小时执行。

逻辑：

查询所有用户：

if subscriptionExpire < now

更新：

subscriptionStatus = free

------------------------------------------------------------

五、iOS 端逻辑

User Model

struct User {

 id: String

 avatar: String?
 nickname: String?

 subscriptionStatus: String
 subscriptionExpire: String?
}

------------------------------------------------------------

会员判断

var isPremium: Bool {

 return subscriptionStatus == "premium"

}

------------------------------------------------------------

获取会员套餐

iOS 启动或进入会员页面时调用：

GET /api/membership/plans

用于展示会员套餐。

------------------------------------------------------------

iOS 订阅流程

用户点击订阅
        │
        ▼
Apple IAP
        │
        ▼
返回 receipt
        │
        ▼
POST /api/subscription/verify
        │
        ▼
Server更新会员状态
        │
        ▼
iOS刷新 userinfo

------------------------------------------------------------

六、Admin 后台

新增菜单：

Membership Management

包含：

会员套餐管理

------------------------------------------------------------

会员套餐管理页面

表格字段：

Name
ProductID
Price
Period
Recommended
Status
SortOrder
Actions

操作：

新增套餐
编辑套餐
启用/禁用套餐
排序
推荐套餐

------------------------------------------------------------

Admin API

获取套餐：

GET /api/admin/membership/plans

新增套餐：

POST /api/admin/membership/plans

编辑套餐：

PUT /api/admin/membership/plans/:id

删除套餐：

DELETE /api/admin/membership/plans/:id

------------------------------------------------------------

七、Admin 用户管理

用户列表新增字段：

subscriptionStatus
subscriptionExpire

示例：

UserID
Nickname
Phone
Membership
ExpireTime
CreatedAt

------------------------------------------------------------

八、AI接口权限控制

接口：

POST /api/ai/analyze

Server逻辑：

if premium

unlimited

else

limit 5/day

------------------------------------------------------------

Redis限制

key：

ai:query:{userId}:{date}

免费用户：

max = 5

会员用户：

无限制

------------------------------------------------------------

九、Apple IAP Product ID

isitsafe_weekly
isitsafe_monthly
isitsafe_yearly

------------------------------------------------------------

十、最终会员系统架构

User
 │
 ├ Subscription
 │
 ├ MembershipPlan
 │
 └ Apple IAP

------------------------------------------------------------

系统职责：

Server
统一管理会员状态

iOS
展示会员信息
发起订阅

Admin
管理会员套餐
查看用户会员状态