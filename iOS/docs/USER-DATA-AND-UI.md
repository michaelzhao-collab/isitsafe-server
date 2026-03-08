# 用户数据与 UI 说明

## 当前服务端用户数据（GET /api/auth/userinfo）

接口返回字段（与 `UserInfoResponse` 一致，未改接口与 Model）：

| 字段       | 类型    | 说明           |
|------------|---------|----------------|
| id         | String  | 用户 ID        |
| phone      | String? | 手机号         |
| email      | String? | 邮箱           |
| country    | String? | 国家/地区      |
| role       | String  | 角色           |
| last_login | String? | 最后登录时间   |
| createdAt  | String? | **注册时间**   |

当前**没有**：头像、昵称、性别。若需由服务端存储并返回，需服务端扩展接口与数据库字段。

## 本次 UI 中的处理方式

- **注册时间**：使用现有 `user.createdAt` 在「我的」页展示。
- **头像、昵称、性别**：在「我的」与「个人资料修改」中仅做**本地展示与编辑**，使用 `LocalProfileStore`（UserDefaults）存储，不修改 `UserInfoResponse` 与任何接口。后续若服务端增加头像/昵称/性别字段，可再单独做一版接口与 Model 扩展。

## 若服务端要增加用户字段

建议在用户表与 `GET /api/auth/userinfo` 中增加：

- 头像：如 `avatar_url: String?` 或 `avatar_key: String?`
- 昵称：`nickname: String?`
- 性别：`gender: String?`（如 "male" / "female" / "other"）

再在 iOS 端扩展 `UserInfoResponse` 与个人资料编辑的保存接口（如 `PATCH /api/auth/userinfo`）。
