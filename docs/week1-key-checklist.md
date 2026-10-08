# 第 1 周：申请 key 和验证访问清单

准备：手边放 3–5 个自己最近的真实单号（UPS、FedEx、USPS 各至少 1 个，最好有一个在途中的）。

## UPS
- [ ] 在 ups.com 注册账号（有的话直接登录）
- [ ] developer.ups.com → Create App，选 "I want to integrate UPS technology into my business"
- [ ] 关联一个 UPS 账号号码；如果没有，记录申请托运人账号需要哪些信息（会不会要求绑卡）→ 写进 README 教程
- [ ] 产品里勾选 Tracking，拿到 Client ID 和 Client Secret
- [ ] curl 取 token：POST https://onlinetools.ups.com/security/v1/oauth/token（Basic auth，grant_type=client_credentials）
- [ ] curl 查一个真实单号：GET /api/track/v1/details/{号}，带上 transId 和 transactionSrc 两个 header
- [ ] 存下响应 → tests/fixtures/ups-*.json（脱敏姓名和地址）

## FedEx
- [ ] developer.fedex.com 注册 → 创建 Organization → 创建 Project，选 Basic Integrated Visibility（Track）
- [ ] 记录：生产 key 是否必须关联 FedEx 账号号码
- [ ] 拿到测试 key 和生产 key（API Key 和 Secret Key）
- [ ] 确认沙箱域名（应该是 apis-sandbox.fedex.com）
- [ ] curl 取 token：POST /oauth/token（表单 client_id 和 client_secret）
- [ ] POST /track/v1/trackingnumbers 查 1–3 个真实单号（includeDetailedScans: true）
- [ ] 核对 scanEvents[].scanLocation 的字段名 → 存 fixture

## USPS（决定 USPS 能不能进 MVP）
- [ ] developers.usps.com 注册 → Add App → 拿到 Consumer Key 和 Secret
- [ ] cop.usps.com → My Apps → Developer Apps → Manage → 接受新条款
- [ ] 在门户里找到 Tracking 3.2 的 OpenAPI 文件，记下准确路径和字段名
- [ ] 取 token：POST https://apis.usps.com/oauth2/v3/token
- [ ] 查一个**别人寄给你的** USPS 单号 → 记录是 200 还是 401/403
- [ ] 记录默认配额（门户或响应 header 里有没有）
- [ ] 结论：✅ 纳入 MVP / ❌ 改走手动补点

## 收尾
- [ ] 所有 key 放进 .env.local（已在 .gitignore 里），绝不提交
- [ ] 把结论更新到 PLAN.md 第 4 节和第 16 节，去掉已经确认的 ⚠️
