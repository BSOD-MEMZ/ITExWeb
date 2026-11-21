# ITEx · 南方中学信息拓展社

学生自主维护的社团官网。ITEx 倡导在安全、负责与获授权的边界内，探索设备维护、硬件开发、软件开发、网页前端、音视频创作等多元技术方向。

> 本站为学生社团页面，不代表学校官方立场。

## 访问与加入

- QQ 群：`1076741511`
- 加群链接：[https://qm.qq.com/q/Ypgmr1rfyI](https://qm.qq.com/q/Ypgmr1rfyI)
- 联动平台：[南方中学电教委员交流网站](https://smart.zznfzx.com)

## 技术栈

- [Nuxt 3](https://nuxt.com/)
- Vue 3
- 原生 CSS，采用新粗野风视觉系统

## 本地开发

要求：Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

开发服务默认运行于 `http://localhost:3000`。想用报名管理后台的话，先复制一份环境变量文件并设置后台密码（见 [报名管理后台](#报名管理后台)）：

```bash
cp .env.example .env
# 编辑 .env，把 NUXT_ADMIN_PASSWORD 填成一个足够长的密码
```

### 常用命令

```bash
# 生产构建
npm run build

# 生成静态站点
npm run generate

# 根据当前文案重新压缩网页字体
npm run fonts:subset

# 本地预览生产构建
npm run preview
```

## 目录说明

```text
ITEx/
├─ assets/css/          # 全局视觉样式与响应式规则（admin.css 是报名后台）
├─ components/          # 首屏、导航、项目卡片、页尾等组件
├─ data/site.ts         # 社团方向与理念等内容数据
├─ data/apply.ts        # 报名表的能力等级与活动类别
├─ types/signup.ts      # 报名数据结构与状态枚举（页面、接口、后台共用）
├─ pages/index.vue      # 官网首页
├─ pages/signup.vue     # 入社报名表（独立页面，首页只在页脚留入口）
├─ pages/admin.vue      # 报名名单管理后台（不加入口，只能直接访问 /admin）
├─ server/api/          # 报名提交接口与 /api/admin/* 管理接口
├─ server/utils/        # signupStore（报名持久化）、adminSession（后台会话）
├─ utils/signupOffline.ts # 提交失败时的本机待补交队列
├─ public/fonts/        # Cubic（正文）、Nano、Lemi 字体文件
├─ public/images/       # 水原雫等公开站点素材
├─ app.vue              # Nuxt 根组件
└─ nuxt.config.ts       # Nuxt 配置（含后台密码、/admin 的 noindex 规则）
```

## 内容维护

- 调整社团实践方向：编辑 `data/site.ts` 中的 `projects`。
- 调整首页文案、奖项和联动信息：编辑 `pages/index.vue`。
- 调整报名表的能力等级、活动类别：编辑 `data/apply.ts`（方向 id 同时被 `types/signup.ts` 的白名单校验使用）。
- 调整报名后台的列表与统计：编辑 `pages/admin.vue` 与 `assets/css/admin.css`。
- 调整布局与视觉：优先编辑 `assets/css/skills.css`；报名页样式在 `assets/css/signup.css`；基础设计 token 位于 `assets/css/main.css`。
- 水原雫（Shizuku Mizuhara）立绘署名：由 2511 ScreenRain 绘制。

## 报名表

地址：`/signup`。首页导航里刻意不放，只在首页页脚最右侧的版权行里留了一个不显眼的「报名表」链接；需要时也可以直接分享这个地址。报名页自身没有导航和页脚，只在顶部细条留了返回首页的链接。

「想参与的活动类别」里的 `自定义` 会多要求一句说明，提交时作为 `custom` 字段一起存下来。

### 数据存在哪里

`server/utils/signupStore.ts` 是唯一的读写入口，数据存在 **SQLite** 里：`<ITEX_DATA_DIR>/signups.db`，默认项目根目录下的 `.data/`（已在 `.gitignore` 中忽略）。

- 用 [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)（原生模块，同步 API）。单文件数据库、不需要额外的常驻服务；开了 WAL + `busy_timeout=5000`，多进程部署也不会丢写。
- 表 `signups` 一条记录一行，`directions` 存成 `code,web` 这样的逗号串，筛选用 `,id,` 做边界匹配。
- 每条记录包含表单字段、编号、`status`（`pending` / `contacted` / `accepted` / `archived`）、`adminNote`（仅后台可见）、`createdAt`、`updatedAt`。
- **编号规则**：形如 `ITEX-2026-0021`。取当年已用最大值 +1，不会因为删记录而撞号；`0000–0020` 是预留段（留给社内手工录入），自动编号从 **0021** 起，每年重新计数。
- **旧数据迁移**：首次启动时如果发现同目录下有旧的 `signups.json`，会自动导入（`INSERT OR IGNORE`，重复执行安全），导入成功后把旧文件改名成 `signups.json.imported-<时间戳>` 存档。
- `better-sqlite3` 是原生模块：`npm install` 时需要允许它跑安装脚本（`package.json` 的 `allowScripts` 已经放行）。换机器 / 换 Node 大版本后如果报 `Could not locate the bindings file`，执行 `npm rebuild better-sqlite3`。

### 提交失败时

- 服务端返回 4xx（比如漏填姓名）：报名页把提示放回对应字段并高亮，不会假装成功。
- 断网或服务端 5xx：这份报名先写进浏览器 `localStorage` 的 `itex:signup:pending` 队列，凭证标记 `LOCAL`；下次打开报名页时自动补交，补交成功才从队列里删掉，失败则继续留着。
- 静态部署（`npm run generate`）没有接口，所有提交都会走本机队列，页面顶部细条会提示「本机有 N 份待补交」。想真正收集报名，请部署到带 Node 的环境。

页面按「展台模式」设计：同一台电脑摆在那里，同学们轮流上来填，所以**不做任何本机草稿**（不提示"你已经提交过一份"），提交完点「再填一份」就清空表单交给下一个人。能力自评的四个等级各有自己的颜色（Basic 绿 / Advanced 黄 / Expert 红 / Master 紫），滑块与方块的四档位置分别在 25% / 50% / 75% / 100%。

正文中文字体仍是 `font-source/` 里的 Lemi（乐米像素体）；`public/fonts/Cubic_11.woff2`（像素字体，未做子集化，约 400 KB）用在**所有等宽标签**里代替原来的新宋体（`monospace` 下中文会落到 NSimSun）——字体栈是 `Consolas, "Courier New", Cubic, Lemi, "Segoe UI Symbol", monospace`：拉丁用 Consolas，中文用 Cubic，Cubic 缺的字落 Lemi，`↗` 之类符号落 Segoe UI Symbol。

## 报名管理后台

地址：`/admin`。不加入口、不预渲染、带 `X-Robots-Tag: noindex`，只能靠知道地址访问。

### 启用方式

后台密码只从服务端环境变量读，没配置就整体停用（登录接口返回 503，不会出现默认密码）：

```bash
# 开发：复制 .env.example 为 .env 并填写
NUXT_ADMIN_PASSWORD=换成一个足够长的密码

# 生产：运行时环境变量，改密码不需要重新 build
NUXT_ADMIN_PASSWORD=... NUXT_ADMIN_SESSION_SECRET=... node .output/server/index.mjs
```

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NUXT_ADMIN_PASSWORD` | 是 | 后台登录密码。留空 = 后台停用。 |
| `NUXT_ADMIN_SESSION_SECRET` | 否 | 会话签名密钥；不填则从密码派生，改密码会让所有已登录会话立即失效。 |
| `ITEX_DATA_DIR` | 否 | 报名数据目录（存放 `signups.db`），默认 `./.data`。 |

登录成功后下发 `httpOnly` + `SameSite=Lax` 的签名 cookie，有效期 8 小时，服务端不用存 session；登录失败按 IP 限流（10 分钟内最多错 10 次，之后每次再错冷却 60 秒）。**静态托管（`npm run generate`）跑不了后台**，需要 Node 环境（`npm run build` + `node .output/server/index.mjs`，或支持 Node 的托管平台）。

### 能做什么

- 名单分页，关键字搜索（姓名 / 班级 / 联系方式 / 编号 / 备注），按状态、方向、能力筛选，四种排序。
- 顶部统计：全部、待处理、已联系、已入社、近 7 天（统计基于全部记录，不受筛选影响）。
- 点开任意一行看详情：改状态、改联系方式与其它信息、写内部备注（仅后台可见，深色标签 `ADMIN ONLY`）。
- 导出 CSV（带 BOM，Excel 直接打开中文不乱码；导出的是当前筛选结果，含状态与内部备注，`= + - @` 开头的内容会被转义防公式注入）。
- 删除报名：需要点两次确认，不可恢复，建议定期导出备份。

### 接口

| 方法与路径 | 说明 |
| --- | --- |
| `POST /api/signup` | 报名提交（公开） |
| `GET /api/admin/session` | 后台是否启用 / 当前是否已登录 |
| `POST /api/admin/login` | 登录，body `{ password }` |
| `POST /api/admin/logout` | 退出登录（清 cookie） |
| `GET /api/admin/signups` | 名单，支持 `q` / `status` / `direction` / `level` / `sort` / `page` / `pageSize` |
| `PATCH /api/admin/signups/:id` | 改状态、内部备注或表单字段 |
| `DELETE /api/admin/signups/:id` | 删除一条报名 |
| `GET /api/admin/signups/export` | 导出 CSV（接受同样的筛选参数） |

## 字体子集化

字体压缩不是实时自动完成的。每次新增或修改会显示在网站上的文字后，在发布前执行一次：

```bash
python -m pip install -r requirements-dev.txt
npm run fonts:subset
npm run generate
```

脚本会从 `font-source/` 的原始字体生成 `public/fonts/` 中的网页子集字体。原始字体保留在项目内，避免新增文字时丢失字形。

## 参与原则

ITEx 不以竞赛刷题为唯一目标。欢迎不同基础、不同兴趣的同学参与；同时请尊重校园设备管理制度，仅在获授权的设备和场景中进行维护、测试与创作。
