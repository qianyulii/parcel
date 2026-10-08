# 包裹地图 Parcel Globe 开发计划 v1

> 开源、自托管的个人物流地图。每个人部署自己的实例、填自己的 key。
> 文档核实日期：2026-10-07。标 ⚠️ 的是没能从官方文档确认、需要第 1 周用真 key 实测的地方。

## 0. 先说最大的风险（会改变 MVP 范围）

**USPS 从 2026-04-01 起收紧了 Tracking API 的访问。** 官方 API Access 页面把调用方分三类：自己打单的发货人（用自己的 Mailer ID）免费；平台和集货商需发货人授权；「服务商和其他人」要签 IP 协议、按单号付月费。第三方开发者普遍反馈：现在用 API 查**不是你自己寄出的** USPS 包裹，基本拿不到数据。作为收件人查快递，正好落在这个限制里。

另外，旧的 Tracking 3.0 已不对新用户开放（2027-07-31 退役），新用户只能用 Tracking 3.2。

**结论：** MVP 以 UPS + FedEx 为主力。USPS 适配器照写，但标为「实验性」，第 1 周用你自己的 key 和真实单号实测：
- 能查到 → 正常纳入；
- 返回 401/403 → USPS 包裹走「手动补点」模式（输入发货城市，或粘贴 usps.com 页面上的轨迹文字，由本地解析），README 里写清楚原因。

## 1. 产品范围

### MVP（v0.1）
- 输入单号：单条或批量粘贴，自动识别承运商，可手动改；可加备注（「键盘」「妈妈寄的」）。
- 设置家的位置（ZIP 或城市，只存本地）。
- 通过 serverless 函数查 UPS / FedEx（USPS 实验性），统一成一种事件格式。
- 暗色 3D 地球：每个包裹是「发货地 → 中转站 → 家」的发光弧线。
  - 在途：弧线上有流动的光点（彗星效果）。
  - 已签收：弧线随时间慢慢变暗。
- 列表面板：状态、最新事件、预计送达；点一条，镜头飞到它的路线。
- 刷新：打开时刷新所有未签收的；可手动刷新；已签收的不再查。
- 访问口令，key 只在服务器上。
- Vercel 一键部署按钮和 README。

### v0.2
- 「年度回顾」：收件数、总里程、最远的一件、最常见的中转站、各承运商占比、每月热力条。一键导出 PNG（1080×1350 竖版，适合发社交平台）。
- 2D 平面地图模式（美国本土的路线在地球上太短，2D 更好看）。
- PWA，可加到手机主屏。

### v0.3+
- Gmail 导入：读发货邮件，提取单号（下面第 11 节）。
- 可选云同步：Upstash Redis 或 Turso，多设备共享；也让定时刷新成为可能。
- 更多承运商：DHL、顺丰（需要手机号后四位）。
- 分享单个包裹的路线动画（GIF 或 MP4）。

### 明确不做
- 不接 17TRACK、Ship24 等聚合平台。
- 不做多用户账号系统，一个部署对应一个人。
- 不做推送通知（serverless 没有常驻进程，放到同步版以后再说）。

## 2. 技术栈和理由

| 层 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite + TypeScript | 启动快；类型系统能约束三家 API 的数据形状 |
| UI | React + Tailwind | 面板和列表写起来快；地球单独放一个组件 |
| 3D 地球 | globe.gl（基于 three.js） | 见第 8 节 |
| 本地存储 | IndexedDB，用 Dexie 封装 | 事件历史可能很多，localStorage 只有约 5MB 且是同步读写 |
| 后端 | Vercel Functions，`/api/*`，Node 运行时 | 藏 key、绕开 CORS，和前端同一个仓库一键部署 |
| 校验 | zod | 防止承运商返回意外结构时把应用搞崩 |
| 测试 | Vitest + Playwright | 单元测试和冒烟测试 |
| 包管理 | pnpm | |

## 3. 架构

```
浏览器（React + globe.gl）
  ├─ IndexedDB：shipments, events, geocache, settings
  ├─ 本地离线地名表（US ZIP 和城市中心点，静态 JSON，按需加载）
  └─ fetch /api/track  （带 HttpOnly 会话 cookie）
          │
Vercel Functions
  ├─ /api/login         校验口令，签发 cookie
  ├─ /api/track         POST {items:[{carrier, number}]}，按承运商分组
  │     ├─ ups.ts    → onlinetools.ups.com
  │     ├─ fedex.ts  → apis.fedex.com（最多 30 个一批）
  │     └─ usps.ts   → apis.usps.com（实验性）
  └─ lib/tokenCache     函数实例内存缓存 token；可选接 Upstash
```

- 归一化在**服务器端**完成，前端只看到统一格式。原始 JSON 在开发模式下可以选择一起返回，方便调试。
- 服务器不存任何包裹数据，所有状态都在浏览器。
- token 缓存：warm 实例里用内存缓存，提前 5 分钟过期。冷启动会重新取 token。FedEx 对取 token 有 IP 级阈值（见第 4 节），所以 README 建议：刷新频繁的话配 Upstash 免费层做共享 token 缓存（可选）。

## 4. 三家 API 接入细节

### UPS（已核实）
- **注册：** developer.ups.com → 登录 UPS 账号 → Create App → 选「I want to integrate UPS technology into my business」→ 关联一个 UPS 账号号码 → 拿到 Client ID 和 Secret。⚠️ 创建 App 需要关联一个 UPS 托运人账号（免费注册，但可能要求绑卡），需实测。
- **OAuth：** `POST https://onlinetools.ups.com/security/v1/oauth/token`（测试环境 `wwwcie.ups.com`）。用 HTTP Basic（`client_id:client_secret`），表单 `grant_type=client_credentials`。官方 Postman 示例 `expires_in` 是 14399 秒（约 4 小时）。
- **Tracking：** `GET https://onlinetools.ups.com/api/track/v1/details/{inquiryNumber}?locale=en_US&returnMilestones=false`。必需的 header：`Authorization: Bearer`、`transId`（每次请求唯一）、`transactionSrc`（如 `parcel-globe`）。一次查一个号。
- **位置字段：** `trackResponse.shipment[].package[].activity[]`（最新的排在最前），每条有 `location.address.{city, stateProvince, postalCode, countryCode}`、`date`（YYYYMMDD）、`time`（HHMMSS）、`gmtDate/gmtTime/gmtOffset`、`status.{type, code, description}`。另有 `packageAddress[]`，`type` 为 ORIGIN/DESTINATION，适合拿来补起终点。
- **其他：** 数据保留 120 天。⚠️ 限流官方没公开具体数字，按 429 做退避。

### FedEx（已核实）
- **注册：** developer.fedex.com → 创建 Organization → 创建 Project，选 Basic Integrated Visibility（Track）→ 拿到 API Key（client_id）和 Secret Key。⚠️ 生产 key 可能需要关联 FedEx 账号号码，需实测。
- **OAuth：** `POST https://apis.fedex.com/oauth/token`，表单 `grant_type=client_credentials&client_id=…&client_secret=…`，token 有效 60 分钟。⚠️ 沙箱域名是 `apis-sandbox.fedex.com`（我凭经验写的，文档页里没直接看到）。
- **Tracking：** `POST https://apis.fedex.com/track/v1/trackingnumbers`，body 大致是 `{includeDetailedScans:true, trackingInfo:[{trackingNumberInfo:{trackingNumber}}]}`，**一次最多 30 个号**。
- **限流（官方）：** 每个项目 1,400 次 / 10 秒；Track 能力默认每项目每天 100K 次；取 token 有 IP 阈值：突发 3 次/秒持续 5 秒，或平均 1 次/秒持续 2 分钟，超了封 10 分钟（返回 403）。所以 token 必须缓存。
- **位置字段：** ⚠️ 下面这些来自 FedEx JSON 集合的常见结构，第 1 周用沙箱响应核对：`output.completeTrackResults[].trackResults[].scanEvents[]`，每条有 `date`、`eventType`、`eventDescription`、`derivedStatusCode`、`scanLocation.{city, stateOrProvinceCode, postalCode, countryCode}`；另有 `shipperInformation.address`、`recipientInformation.address`、`latestStatusDetail`。
- **其他（官方）：** 签收后 90 天内可查；新单号最长 24 小时后才出现；官方建议批量查询时剔除已签收的。FedEx 会复用单号，查询时可以带日期范围。FedEx Authenticated Delivery 的包裹查不到，会返回 `TRACKING.AUTHENTICATEDDELIVERY.ERROR`。

### USPS（已核实，但有访问限制，见第 0 节）
- **注册：** developers.usps.com → Add App → 拿 Consumer Key 和 Consumer Secret。条款要在 Business Portal（cop.usps.com）里接受。默认产品包里含 Tracking。
- **OAuth：** `POST https://apis.usps.com/oauth2/v3/token`，JSON body `{client_id, client_secret, grant_type:"client_credentials"}`；测试环境是 `apis-tem.usps.com`。token 有效 8 小时。
- **Tracking：** 旧版 3.0 是 `GET /tracking/v3/tracking/{trackingNumber}?expand=DETAIL`，新用户已不可用。新版 3.2 是现行版本。⚠️ 3.2 的准确路径和字段需要登录开发者门户看 OpenAPI 文件确认。
- **位置字段（3.0 的规范，3.2 预计相近 ⚠️）：** `trackingEvents[]`，每条有 `eventType`、`eventTimestamp`、`GMTTimestamp`、`GMTOffset`、`eventCity`、`eventState`、`eventZIP`、`eventCountry`；还有 `statusCategory`。
- **限流：** ⚠️ 第三方普遍说默认约每小时 60 次，提额要提交申请，官方页面没写数字。

## 5. 统一事件数据模型

```ts
type Carrier = 'ups' | 'fedex' | 'usps';
type Status = 'PRE_TRANSIT' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
            | 'DELIVERED' | 'EXCEPTION' | 'RETURNED' | 'UNKNOWN';

interface Place {
  city?: string; state?: string; postalCode?: string; country?: string; // ISO-2
  lat?: number; lng?: number;
  geoKey?: string;          // 归一化后的缓存键，如 "US|60601" 或 "US|IL|CHICAGO"
  geoSource?: 'zip' | 'gazetteer' | 'remote' | 'manual';
}

interface TrackEvent {
  id: string;               // hash(carrier, number, ts, code, place)，用来去重
  ts: string;               // ISO 8601 UTC；拿不到时区时标记 tsApprox
  tsApprox?: boolean;
  status: Status;
  description: string;      // 承运商原文
  carrierCode?: string;
  place?: Place;
}

interface Shipment {
  id: string;
  carrier: Carrier;
  trackingNumber: string;
  label?: string;
  addedAt: string;
  status: Status;
  origin?: Place;           // 发货地址或第一条有位置的事件
  destination?: Place;      // 收件地址，没有的话用「家」
  events: TrackEvent[];     // 按时间升序
  eta?: string;
  deliveredAt?: string;
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}
```

**路线推导：** 取有位置的事件 → 按 geoKey 合并相邻的重复城市 → 前面接 origin、后面接 destination → 得到 `legs[]`。每一段算大圆距离，加总就是这件的里程。

**状态映射：** 每家一张映射表（UPS 的 `status.type` M/P/I/X/D、FedEx 的 `derivedStatusCode`、USPS 的 `statusCategory`），没识别出来的一律 UNKNOWN 并记日志。

## 6. 单号自动识别规则

先去掉空格和连字符，转大写，再按顺序匹配：

| 规则 | 承运商 | 信心 |
|---|---|---|
| `^1Z[0-9A-Z]{16}$` | UPS | 高 |
| `^T\d{10}$`、`^\d{9}$`（UPS Freight/Mail Innovations） | UPS | 低，需要确认 |
| `^(94\|93\|92\|95)\d{18,20}$`（IMpb） | USPS | 中 |
| `^420\d{5}(\d{4})?(9[1-5]\d{18,20})$`（带 ZIP 前缀的 IMpb） | USPS，去掉前缀 | 中 |
| `^[A-Z]{2}\d{9}US$`（S10 国际） | USPS | 高 |
| `^\d{12}$` 或 `^\d{15}$` | FedEx | 中 |
| `^96\d{20}$` 或 `^\d{20}$` | FedEx Ground | 中，和 USPS 重叠 |
| `^DT\d{12}$` | FedEx 门贴号 | 高 |

- **校验位：** UPS 1Z 用 mod-10 变体，USPS IMpb 用 3/1 加权 mod-10，FedEx 12 位用 mod-11。⚠️ 我建议直接用开源的 `tracking_number_data` 规则库（MIT，JSON 格式），实现前核实许可证和规则是否最新。
- **歧义处理：** 多家都匹配时按校验位通过的排序，在 UI 上显示「看起来像 FedEx，点这里改」。
- **FedEx Ground Economy（原 SmartPost）** 最后一程交给 USPS，号码可能是 92 开头。识别为 USPS 时，如果查询失败，自动用 FedEx 再试一次。

## 7. 地理编码和缓存

**重要：** OSM 的公共 Nominatim 使用政策明确写着，包裹追踪这类以地理编码为主要功能的应用必须自己搭服务，并且上限是每秒 1 次。所以**不能把公共 Nominatim 作为默认方案**。

分三层：
1. **离线 ZIP 表（主力）：** 美国人口普查局 ZCTA Gazetteer（公共领域）→ 预处理成 `zip → [lat,lng]`，约 33k 条，压缩后几百 KB，首次使用时懒加载。三家都经常给邮编，命中率最高。
2. **离线城市表：** GeoNames `cities1000`（CC-BY 4.0，需署名），截取 US 和常见中转国家，按 `country|state|city` 建索引。处理 `ONTARIO, CA, US` 这种和加拿大安大略的歧义：州代码和国家都要匹配。
3. **远程兜底（可选）：** 用户自己配 Mapbox 或 LocationIQ 的 key，走 `/api/geocode` 代理。没配的话，就把这一点标成「未定位」，让用户手动点地图补上。

**缓存：** IndexedDB 的 `geocache` 表，按 geoKey 永久缓存，手动修正的记录优先级最高。同一个城市在所有包裹之间共享缓存。

## 8. 可视化方案：选 globe.gl

**理由：** 它自带 `arcsLayer`（渐变色、虚线动画 `arcDashAnimateTime`，直接就是「流动光点」）、`ringsLayer`（家的位置可以做脉冲光环）、`pointsLayer`（中转站）、`labelsLayer`，还能直接拿到底层的 three.js 场景，以后加辉光后处理也方便。几十行代码就能做出成品效果，最符合「快、视觉冲击强」。

对比过的：
- **deck.gl：** GlobeView 还是实验性的，弧线动画要自己写 shader。
- **MapLibre v5 globe + deck.gl ArcLayer：** 2D 街区级缩放更好，但配置多、地图瓦片需要 key 或自己托管。作为 v0.2 的 2D 模式备选。
- **纯 three.js：** 效果上限最高，但工作量大好几倍。

**做法：**
- 每段 leg 一条弧线；`arcAltitudeAutoScale` 让长距离的弧更高。
- 在途：`arcDashLength≈0.05`、`arcDashGap≈1`、动画时长 2–3 秒，看起来就是一颗光点在跑；最后一段（当前位置 → 家）用虚线表示「还没走的路」。
- 已签收：完整实线，透明度按签收后的天数衰减，`alpha = max(0.12, 1 - days/45)`。
- 当前位置：小亮点，加一圈 ring 脉冲。
- 家：一圈持续的暖色 ring。
- 性能：几百条弧线完全没问题；超过 1,000 条时，已签收的合并成静态线。

## 9. 视觉设计方向

- **基调：** 深空黑（`#05070D`）+ NASA Black Marble 夜景地球贴图（公共领域）+ 淡淡的大气层辉光。
- **承运商配色：** UPS 琥珀金、FedEx 紫到橙渐变、USPS 冰蓝。在途的饱和度更高，已签收的偏灰。
- **界面：** 左侧半透明玻璃面板放列表；单号用等宽字体；状态用小胶囊标签。顶部一行大数字：「在途 3 · 本月 12 件 · 累计 48,210 km」。
- **动效：** 点击包裹，镜头 1.2 秒飞到路线中点；第一次加载时，地球从远处转进来。
- **年度回顾卡：** 竖版，大字号数字配一张所有弧线叠加的地球截图（用 `renderer.preserveDrawingBuffer` 截图，再用 canvas 合成文字）。

## 10. 安全

- 所有 key 只放 Vercel 环境变量：`UPS_CLIENT_ID/SECRET`、`FEDEX_CLIENT_ID/SECRET`、`USPS_CLIENT_ID/SECRET`、`APP_PASSCODE`、`SESSION_SECRET`。前端代码里一个都没有，构建时也不注入。
- **口令：** `/api/login` 用常量时间比较口令，成功后签发 HMAC 签名的 cookie（HttpOnly、Secure、SameSite=Strict，30 天）。所有 `/api/track` 请求都校验 cookie，否则返回 401。
- **防滥用：** 登录失败按 IP 指数退避（内存级，尽力而为；配了 Upstash 就做成持久的）。每次请求最多 50 个单号。只接受同源请求，不开 CORS。
- **日志：** 不记录完整单号（只记后 4 位），不记录收件人姓名。
- **可选：** 打开 Vercel Deployment Protection 再加一层。
- **README 提醒：** 包裹数据存在浏览器里，换设备不会同步；不要把部署地址和口令公开。

## 11. Gmail 导入（v0.3）

- 每个部署者在自己的 Google Cloud 项目里建 OAuth 客户端，scope 用 `gmail.readonly`，保持在「测试」状态，只把自己加为测试用户，这样不用过 Google 的受限 scope 审核。⚠️ 测试状态的 refresh token 有效期较短（大约 7 天），需要实测。
- 搜索语句：`from:(ups.com OR fedex.com OR usps.com OR amazon.com OR shipment) newer_than:30d`，用第 6 节的规则从正文里抽单号，去重后让用户勾选导入。
- 整个过程在浏览器里用 Google Identity Services 完成，token 不经过服务器。

## 12. 开源仓库结构

```
parcel-globe/
├─ api/
│  ├─ login.ts
│  ├─ track.ts
│  └─ geocode.ts            # 可选
├─ server/
│  ├─ carriers/{ups,fedex,usps}.ts   # 取 token、请求、归一化
│  ├─ carriers/types.ts
│  ├─ auth.ts  tokenCache.ts  rateLimit.ts
├─ src/
│  ├─ components/{Globe,ShipmentList,AddDialog,YearInReview,Settings}.tsx
│  ├─ lib/{detect.ts, route.ts, geo.ts, db.ts, distance.ts}
│  └─ styles/
├─ public/data/{zcta.json.gz, cities.json.gz}, textures/
├─ scripts/build-gazetteer.ts   # 从 Census / GeoNames 生成离线表
├─ tests/{unit,fixtures,e2e}/
├─ docs/{carriers-setup.md, architecture.md, screenshots/}
├─ .env.example  vercel.json  LICENSE (MIT)  README.md
```

## 13. README 和部署说明

1. 一张动图（地球 + 弧线）。
2. 一键部署按钮：`https://vercel.com/new/clone?repository-url=…&env=APP_PASSCODE,SESSION_SECRET,UPS_CLIENT_ID,UPS_CLIENT_SECRET,FEDEX_CLIENT_ID,FEDEX_CLIENT_SECRET&envDescription=…`，USPS 的变量是可选的。
3. 三家申请 key 的分步截图教程（放在 `docs/carriers-setup.md`），包括 USPS 访问限制的说明。
4. 本地开发：`pnpm i && vercel dev`。
5. 常见问题：为什么 USPS 查不到、为什么某个城市没定位、怎么换设备。
6. 署名：OpenStreetMap / GeoNames / NASA 贴图 / globe.gl。
7. 免责：本项目和 UPS、FedEx、USPS 没有关系，使用需遵守各家 API 条款。

## 14. 测试计划

- **单元测试（Vitest）：** 单号识别（每条规则都有正例、反例和校验位用例）、三家归一化（用第 1 周录制并脱敏的真实响应作 fixture）、状态映射、路线去重、大圆距离、地名匹配的歧义用例（Ontario CA/US、Portland OR/ME）。
- **API 契约测试：** `pnpm test:live`，只有设置了环境变量才跑，分别打三家的沙箱，检查响应还能通过 zod 校验。
- **函数测试：** 没 cookie 返回 401、口令错误时退避、token 缓存命中、429 时重试。
- **E2E（Playwright）：** 登录 → 添加 3 个单号（用 mock API）→ 列表出现 → 地球 canvas 渲染 → 刷新 → 年度回顾导出 PNG。
- **人工视觉检查：** 在 Chrome、Safari 和 iPhone Safari 上看弧线、光点、渐暗效果；测 200 条弧线时的帧率。

## 15. 按周里程碑（6 周，每周约 8–10 小时）

| 周 | 目标 | 完成标准 |
|---|---|---|
| 1 | **验证访问（决定 MVP 范围）** + 仓库脚手架 | 三家 key 申请完；用 curl 拿到 token；用自己的真实单号各查一次；录制 fixture；USPS 能不能用有明确结论 |
| 2 | 服务器端：`/api/track`、UPS 和 FedEx 适配器、归一化、口令和 cookie | 单元测试通过；`vercel dev` 能返回统一格式 |
| 3 | 单号识别、IndexedDB、列表 UI、离线地名表、路线推导 | 加单号 → 能看到带坐标的 legs |
| 4 | globe.gl 地球：弧线、流动光点、渐暗、家的光环、镜头飞行 | 视觉效果达到可以截图发出去的程度 |
| 5 | 年度回顾和 PNG 导出、USPS（或手动补点）、错误状态、空状态 | 端到端流程跑通 |
| 6 | README、部署按钮、E2E、修 bug、发布 v0.1 | 一个新用户 15 分钟内能从零部署成功 |

之后：v0.2（2D 模式、PWA）和 v0.3（Gmail、同步、DHL、顺丰）。

## 16. 风险和未知项

| 风险 | 影响 | 应对 |
|---|---|---|
| USPS 收件人查询被 Access Control 拦住 | 高：美国很多包裹是 USPS | 第 1 周实测；不行就做手动补点和粘贴解析，README 说明 |
| 申请 UPS / FedEx 生产 key 可能需要绑定托运人账号 | 中：提高了部署门槛 | 第 1 周实测，把步骤写进教程 |
| UPS 限流没有公开数字 | 低 | 按 429 指数退避；已签收的不再查 |
| FedEx 取 token 的 IP 阈值，加上 serverless 冷启动 | 中 | token 缓存；可选 Upstash；单次请求批量 30 个 |
| FedEx 响应字段名和我写的不一致 | 低 | 第 1 周用沙箱核对，zod 校验 |
| 城市重名、国外地名拼写 | 中 | ZIP 优先；州加国家联合匹配；手动修正 |
| 公共 Nominatim 不允许这类用途 | 已规避 | 用离线表，远程兜底由用户自配 key |
| 承运商条款变化（USPS 今年已经改过一次） | 中 | 适配器隔离；README 写清「自带 key、个人使用」 |
| 数据保留期（UPS 120 天、FedEx 签收后 90 天） | 中：影响年度回顾 | 本地永久保存事件，签收后就不依赖 API |
| 顺丰开放平台的接入门槛 | 未知 | ⚠️ 没核实，放到 v0.3 再调研 |

## 来源（2026-10-07 读过）
- USPS：developers.usps.com/Oauth，/getting-started，/apis（Tracking 3.0 Legacy、Tracking 3.2），tracking_v3.yaml；usps.com/business/api-access.htm；USPS APIs Onboarding Guide（token 8 小时）
- UPS：github.com/UPS-API/api-documentation（OAuthClientCredentials.yaml、Tracking.yaml）；developer.ups.com/get-started
- FedEx：developer.fedex.com 上的 Quotas & rate limits guide、Authorization docs、Basic Integrated Visibility docs、Best practices
- OSM Nominatim Usage Policy
