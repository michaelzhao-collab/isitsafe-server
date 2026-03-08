# iOS UI 调整 — 接口回归检查结果

**检查日期**：按本次 UI 改版完成时填写。

---

## 1. 本次修改范围

| 项目 | 内容 |
|------|------|
| 本次修改的 UI 文件 | Views/Root/MainTabView.swift、Views/Home/HomeContainerView.swift（新增）、Views/Home/HomeView.swift、Views/Home/AnalyzeInputBar.swift、Views/Profile/ProfileView.swift、Views/Profile/ProfileEditView.swift（新增）、Views/Profile/SettingsView.swift（新增）、Views/Knowledge/KnowledgeView.swift、Views/Components/PhotoLibraryPicker.swift（新增）、Utils/AppTheme.swift（新增）、Storage/LocalProfileStore.swift（新增）、ViewModels/Home/HomeViewModel.swift（仅 reset() 内增加清空 inputText） |
| 是否修改了 Networking 层 | **否** |
| 是否修改了 Models 层 | **否**（未改 UserInfoResponse 及任何 Codable/CodingKeys） |
| 是否修改了 Repositories 层 | **否** |
| 是否修改了 Services 层 | **否** |
| 是否修改了 ViewModel 中接口逻辑 | **否**（仅 HomeViewModel.reset() 多清空 inputText，未改任何 API 调用） |

---

## 2. 接口与配置一致性检查

| 检查项 | 结果 |
|--------|------|
| 接口路径是否变化 | **否** |
| 请求方法（GET/POST 等）是否变化 | **否** |
| 请求参数字段名是否变化 | **否** |
| 返回模型字段名是否变化 | **否** |
| token 注入逻辑是否变化 | **否** |
| baseURL 配置是否变化 | **否** |
| 分页参数（page / pageSize）是否变化 | **否** |
| 订阅验证接口调用链是否变化 | **否** |
| Home 不同输入类型对应的接口分流逻辑是否变化 | **否** |

---

## 3. 核心功能接口确认

| 功能 | 应调用的接口 | 是否仍一致 |
|------|----------------|------------|
| 文本分析 | POST /api/ai/analyze | **是** |
| 截图分析 | POST /api/ai/analyze/screenshot | **是** |
| 电话查询 | POST /api/query/phone | **是** |
| 链接查询 | POST /api/query/url | **是** |
| 公司查询 | POST /api/query/company | **是** |
| 历史记录 | GET /api/queries | **是**（侧滑抽屉历史列表复用 HistoryViewModel，未改接口） |
| 举报 | POST /api/report | **是**（入口改为从其他入口进入，接口未改） |
| 知识库列表 | GET /api/knowledge | **是** |
| 知识库详情 | GET /api/knowledge/:id | **是** |
| 登录 | POST /api/auth/login | **是** |
| 用户信息 | GET /api/auth/userinfo | **是** |
| 登出 | POST /api/auth/logout | **是** |
| 订阅验证 | POST /api/subscription/verify | **是** |
| 订阅状态 | GET /api/subscription/status | **是** |

---

## 4. 结论

| 项目 | 结果 |
|------|------|
| 所有核心接口是否仍保持一致 | **是** |
| 是否可以继续联调测试 | **是** |

**备注**：头像、昵称、性别仅在本地（LocalProfileStore）展示与编辑，未新增或修改任何用户相关接口。用户数据库当前字段说明见 `docs/USER-DATA-AND-UI.md`。
