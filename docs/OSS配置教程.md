# 阿里云 OSS 配置教程（IsItSafe 头像/文件上传）

本文档说明如何配置 **阿里云对象存储 OSS**，使 Server 的**头像上传、意见反馈图片、截图上传**等功能可用。配置完成后，在 Railway 的 Server 服务中填入 4 个环境变量即可。

---

## 一、OSS 在本项目中的用途

| 功能         | 说明                     | 接口/类型     |
|--------------|--------------------------|---------------|
| 头像上传     | 个人资料更换头像         | `POST /api/upload/avatar`，type=avatar |
| 意见反馈图片 | 用户提交反馈时可选一张图 | `POST /api/upload/file`，type=screenshot 等 |
| 截图/其他    | AI 分析截图、举报图等    | `POST /api/upload/file`，type 见下表 |

Server 使用 **ali-oss** 将文件上传到 OSS，并返回**可公网访问的 URL**（用于 APP/Admin 展示）。  
**必填环境变量**：`OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`。  
**可选**：`CDN_DOMAIN`（若使用自定义 CDN 域名，否则用 OSS 外网地址）。

---

## 二、开通阿里云 OSS

1. 打开 [阿里云官网](https://www.aliyun.com)，登录账号（没有则注册）。
2. 进入 **产品** → **对象存储 OSS**，或直接访问 [OSS 控制台](https://oss.console.aliyun.com/)。
3. 首次使用需按提示**开通 OSS 服务**（按量付费，存储与流量费用较低，新用户常有免费额度）。

---

## 三、创建 Bucket

1. 在 OSS 控制台左侧点击 **Bucket 列表**，再点击 **创建 Bucket**。
2. 按下面建议填写：

   | 配置项       | 建议值 |
   |--------------|--------|
   | **Bucket 名称** | 全局唯一，例如 `isitsafe-upload` 或 `你的项目名-oss` |
   | **地域**     | 选择离你用户或 Railway 较近的，如 **华东1（杭州）**；记下该地域的 **Region 英文名**（见下）。 |
   | **存储类型** | **标准存储** 即可。 |
   | **读写权限** | **公共读**（这样返回的 URL 可直接在 APP/网页中显示图片；若需私有请用签名 URL，当前项目为公共读）。 |
   | **版本控制** | 关闭即可。 |

3. 其他选项保持默认，点击 **确定** 完成创建。

**Region 英文名对照（填到 `OSS_REGION`）**  
在 Bucket 列表或 Bucket 详情页可以看到「地域」对应的英文标识，例如：

- 华东1（杭州）→ **oss-cn-hangzhou**
- 华东2（上海）→ **oss-cn-shanghai**
- 华北2（北京）→ **oss-cn-beijing**
- 华南1（深圳）→ **oss-cn-shenzhen**

若不确定，可在 [OSS 地域与 Endpoint 文档](https://help.aliyun.com/document_detail/31837.html) 中按你的地域查找 **Region** 列。

---

## 四、获取 AccessKey（RAM 子账号，推荐）

不要使用主账号的 AccessKey，建议为 OSS 单独建一个 **RAM 子用户**，只授予该 Bucket 的读写权限。

### 4.1 创建 RAM 用户

1. 打开 [RAM 访问控制控制台](https://ram.console.aliyun.com/users)。
2. 左侧 **身份管理** → **用户** → **创建用户**。
3. **登录名称**、**显示名称** 自定（如 `oss-isitsafe`），**访问方式** 勾选 **OpenAPI 调用访问**（不需要控制台登录）。
4. 点击 **确定**，在列表中为该用户点击 **添加权限**：
   - 选择 **自定义策略** 或 **系统策略**；
   - 若选系统策略，可搜 **AliyunOSSFullAccess**（授予所有 OSS 的完整权限）；  
     若希望仅限当前 Bucket，选 **自定义策略**，策略内容示例（将 `isitsafe-upload` 换成你的 Bucket 名）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:GetObject", "oss:ListObjects"],
      "Resource": ["acs:oss:*:*:isitsafe-upload", "acs:oss:*:*:isitsafe-upload/*"]
    }
  ]
}
```

5. 保存后，在该用户右侧点击 **创建 AccessKey**；按提示完成验证后，会得到 **AccessKey ID** 和 **AccessKey Secret**。  
   - **Secret 只显示一次**，请立即复制保存；若丢失需重新创建新 Key。

---

## 五、确认 Bucket 与权限

1. 回到 **OSS 控制台** → **Bucket 列表** → 点击你创建的 Bucket。
2. **概览** 里确认 **Bucket 名称**、**地域（Region）** 与上面记录一致。
3. **读写权限** 为 **公共读** 时，生成的对象 URL 可直接在浏览器或 APP 中访问；若为私有，需在代码里改为使用签名 URL（当前项目默认公共读即可）。

**跨域 CORS（可选）**  
本项目中，上传是由 **Server（NestJS）** 直连 OSS，不经过浏览器；因此一般**不需要**在 OSS 控制台配置 CORS。若以后改为浏览器直传 OSS，再在 Bucket 的 **数据安全** → **跨域设置** 中按需添加来源与方法。

---

## 六、CDN 域名（可选）

Server 返回给客户端的图片地址格式为：**`{CDN_DOMAIN}/{目录}/{文件名}`**。  
例如：`https://cdn.isitsafe.com/avatar/user123-1234567890.jpg`。

- **不配置 CDN**：在 Server 环境变量中**不填** `CDN_DOMAIN`，代码里会使用默认值（如 `https://cdn.isitsafe.com`）；若你希望直接用 OSS 外网地址，可把 `CDN_DOMAIN` 设为：**`https://你的Bucket名.oss-cn-地域.aliyuncs.com`**（在 Bucket 概览页可看到该外网 Endpoint）。
- **配置 CDN**：在阿里云 CDN 控制台绑定你的域名（如 `cdn.你的网站.com`）并回源到该 OSS Bucket，然后把 **`CDN_DOMAIN`** 设为 **`https://cdn.你的网站.com`**（不要末尾斜杠）。

---

## 七、在 Railway 中配置 Server 环境变量

1. 打开 Railway 项目 → 点击 **Server** 服务 → **Variables** 标签。
2. 点击 **+ New Variable**，逐个添加以下变量（名称必须一致）：

| 变量名                   | 说明           | 示例值（仅作格式参考） |
|--------------------------|----------------|------------------------|
| **OSS_REGION**           | 地域英文标识   | `oss-cn-hangzhou`      |
| **OSS_BUCKET**           | Bucket 名称    | `isitsafe-upload`      |
| **OSS_ACCESS_KEY_ID**    | AccessKey ID   | `LTAI5t...`            |
| **OSS_ACCESS_KEY_SECRET**| AccessKey Secret | `xxxxxxxx`           |
| **CDN_DOMAIN**           | 可选，返回的图片根域名 | `https://你的Bucket.oss-cn-hangzhou.aliyuncs.com` 或 `https://cdn.你的网站.com` |

3. 保存后，Railway 会重新部署 Server。部署完成后，头像上传、意见反馈图片等应可正常使用。

---

## 八、验证是否生效

1. **看日志**  
   在 Railway Server 的 **Deployments** → **Logs** 中，不应再出现：  
   `[Upload] OSS client is null (missing OSS_REGION, OSS_BUCKET, ...)`  
   若仍出现，说明 4 个必填变量中有未配置或拼写错误。

2. **实际传图**  
   - 在 APP 中进入 **个人资料** → **更换头像**，选择图片并确认上传；若成功，应不再提示「头像上传功能暂未配置」。  
   - 或在 **意见反馈** 中带图提交，Admin 后台 **用户反馈** 列表中应能显示该图片。

3. **返回 URL**  
   上传成功后，接口返回的 `url` 应能在浏览器中直接打开（公共读时）；格式类似：  
   `https://你的CDN或Bucket域名/avatar/userId-时间戳.jpg`。

---

## 九、常见错误与排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 客户端提示「头像上传功能暂未配置」 | 4 个 OSS 变量未填或未生效 | 在 Railway Server Variables 中确认 `OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET` 已保存并触发重新部署。 |
| Server 日志：`InvalidAccessKeyId` / `SignatureDoesNotMatch` | AccessKey 错误或权限不足 | 检查 ID/Secret 是否复制完整、无多余空格；确认该 RAM 用户已授予对应 Bucket 的 PutObject 等权限。 |
| 上传超时 | 网络或 OSS 地域过远 | 将 Bucket 地域选在离部署区域较近的；必要时在客户端或 Server 适当调大上传超时时间。 |
| 返回的 URL 打不开 | Bucket 为私有或 CDN 未配置好 | 若用公共读，确认 Bucket 读写权限为「公共读」；若用 CDN，确认 CDN 域名已解析并回源到该 Bucket。 |

---

## 十、与《Railway 部署教程》的衔接

在 **《Railway部署教程-Server与Admin.md》** 的 **3.3 为 Server 配置环境变量** 中，已有说明：

- （可选）若使用 **阿里云 OSS**：添加 **`OSS_REGION`**、**`OSS_BUCKET`**、**`OSS_ACCESS_KEY_ID`**、**`OSS_ACCESS_KEY_SECRET`**、**`CDN_DOMAIN`**。

具体如何获取上述变量的值，按本教程 **二～六** 步在阿里云控制台完成即可；**第七步** 即在 Railway 中填入这些变量。
