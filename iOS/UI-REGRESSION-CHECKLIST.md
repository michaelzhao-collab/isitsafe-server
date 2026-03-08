# iOS UI 调整 — 接口回归检查清单

**使用说明**：每次完成 UI 调整后，请填写本表并保留一份「接口回归检查结果」记录。

---

## 1. 本次修改范围

| 项目 | 内容 |
|------|------|
| 本次修改的 UI 文件 | （列出路径，如 Views/Home/HomeView.swift） |
| 是否修改了 Networking 层 | 是 / 否 |
| 是否修改了 Models 层 | 是 / 否 |
| 是否修改了 Repositories 层 | 是 / 否 |
| 是否修改了 Services 层 | 是 / 否 |
| 是否修改了 ViewModel 中接口逻辑 | 是 / 否 |

---

## 2. 接口与配置一致性检查

逐项确认以下内容**未被误改**：

| 检查项 | 结果 |
|--------|------|
| 接口路径是否变化 | 是 / 否 |
| 请求方法（GET/POST 等）是否变化 | 是 / 否 |
| 请求参数字段名是否变化 | 是 / 否 |
| 返回模型字段名是否变化 | 是 / 否 |
| token 注入逻辑是否变化 | 是 / 否 |
| baseURL 配置是否变化 | 是 / 否 |
| 分页参数（page / pageSize）是否变化 | 是 / 否 |
| 订阅验证接口调用链是否变化 | 是 / 否 |
| Home 不同输入类型对应的接口分流逻辑是否变化 | 是 / 否 |

---

## 3. 核心功能接口确认

确认以下功能**仍然**调用对应接口：

| 功能 | 应调用的接口 | 是否仍一致 |
|------|----------------|------------|
| 文本分析 | POST /api/ai/analyze | 是 / 否 |
| 截图分析 | POST /api/ai/analyze/screenshot | 是 / 否 |
| 电话查询 | POST /api/query/phone | 是 / 否 |
| 链接查询 | POST /api/query/url | 是 / 否 |
| 公司查询 | POST /api/query/company | 是 / 否 |
| 历史记录 | GET /api/queries | 是 / 否 |
| 举报 | POST /api/report | 是 / 否 |
| 知识库列表 | GET /api/knowledge | 是 / 否 |
| 知识库详情 | GET /api/knowledge/:id | 是 / 否 |
| 登录 | POST /api/auth/login | 是 / 否 |
| 用户信息 | GET /api/auth/userinfo | 是 / 否 |
| 登出 | POST /api/auth/logout | 是 / 否 |
| 订阅验证 | POST /api/subscription/verify | 是 / 否 |
| 订阅状态 | GET /api/subscription/status | 是 / 否 |

---

## 4. 结论

| 项目 | 结果 |
|------|------|
| 所有核心接口是否仍保持一致 | 是 / 否 |
| 是否可以继续联调测试 | 是 / 否 |

---

**检查人/日期**：________________  
**备注**：（若有仅 UI 层面的例外或说明可写在此）
