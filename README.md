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
├─ components/          # 首屏、导航、项目卡片、页尾等组件（AdminStatsPanel / AdminSignupEditor 是后台的统计与编辑块）
├─ data/site.ts         # 社团方向与理念等内容数据
├─ data/apply.ts        # 报名表的能力等级与活动类别
├─ types/signup.ts      # 报名数据结构与状态枚举（页面、接口、后台共用）
├─ pages/index.vue      # 官网首页
├─ pages/signup.vue     # 入社报名表（独立页面，首页只在页脚留入口）
├─ pages/admin.vue      # 报名名单管理后台（不加入口，只能直接访问 /admin）
├─ server/api/          # 报名提交接口与 /api/admin/* 管理接口
├─ server/utils/        # signupStore（报名持久化）、adminSession（后台会话）、apiError（统一错误）
├─ utils/signupOffline.ts # 提交失败时的本机待补交队列
├─ public/fonts/        # Cubic（正文与等宽）、Nano（标题）字体文件
├─ public/images/       # 水原雫等公开站点素材
├─ app.vue              # Nuxt 根组件
└─ nuxt.config.ts       # Nuxt 配置（含后台密码、/admin 的 noindex 规则）
```

## 内容维护

- 调整社团实践方向：编辑 `data/site.ts` 中的 `projects`。
- 调整首页文案、奖项和联动信息：编辑 `pages/index.vue`。
- 调整报名表的能力等级、活动类别：编辑 `data/apply.ts`（方向 id 同时被 `types/signup.ts` 的白名单校验使用）。
- 调整报名后台的列表与统计：编辑 `pages/admin.vue`、`components/AdminStatsPanel.vue`、`components/AdminSignupEditor.vue` 与 `assets/css/admin.css`。
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
- **编号规则**：形如 `ITEX-2026-0021`。`0000–0020` 是预留段（留给社内手工录入），自动编号从 **0021** 起，每年重新计数。分配时取「已用最大值 +1」和「当年计数器 +1」的较大者：计数器（`signup_counters` 表）只增不减，所以删掉最大号之后也不会把号码分给别人——否则已经发出去的凭证会和后台新记录撞号，回收站里的同号记录也就永远恢复不了。
- **回收站**：后台删除不是真删，整条记录以 JSON 存进 `signup_trash`，30 天内可以恢复；超过 30 天的会在下次打开列表时自动清理。恢复时编号被新记录占用会返回 409（正常流程下不会发生，靠的就是上面那个只增不减的计数器）。
- **旧数据迁移**：首次启动时如果发现同目录下有旧的 `signups.json`，会自动导入（`INSERT OR IGNORE`，重复执行安全），导入成功后把旧文件改名成 `signups.json.imported-<时间戳>` 存档。
- `better-sqlite3` 是原生模块：`npm install` 时需要允许它跑安装脚本（`package.json` 的 `allowScripts` 已经放行）。换机器 / 换 Node 大版本后如果报 `Could not locate the bindings file`，执行 `npm rebuild better-sqlite3`。

### 提交失败时

- 服务端返回 4xx（比如漏填姓名）：报名页把提示放回对应字段并高亮，不会假装成功。
- 断网或服务端 5xx：这份报名先写进浏览器 `localStorage` 的 `itex:signup:pending` 队列，凭证标记 `LOCAL`；下次打开报名页时自动补交，补交成功才从队列里删掉，失败则继续留着。
- 静态部署（`npm run generate`）没有接口，所有提交都会走本机队列，页面顶部细条会提示「本机有 N 份待补交」。想真正收集报名，请部署到带 Node 的环境。

页面按「展台模式」设计：同一台电脑摆在那里，同学们轮流上来填，所以**不做任何本机草稿**（不提示"你已经提交过一份"），提交完点「再填一份」就清空表单交给下一个人。能力自评的四个等级各有自己的颜色（Basic 绿 / Advanced 黄 / Expert 红 / Master 紫），滑块与方块的四档位置分别在 25% / 50% / 75% / 100%。

正文中文字体是 `public/fonts/Cubic_11.woff2`（像素字体，不做子集化，约 400 KB），标题用 `font-source/` 里的 Nano（丙戌黑体像素体，经 `npm run fonts:subset` 子集化）。等宽标签的字体栈是 `Consolas, "Courier New", Cubic, "Segoe UI Symbol", monospace`：拉丁用 Consolas，中文用 Cubic，`↗` `‹` `›` 之类符号落 Segoe UI Symbol。正文栈是 `Cubic, "Microsoft YaHei", sans-serif`，Cubic 缺的字（如部分生僻字）落微软雅黑。

原来的 Lemi（乐米像素体）已经退役，源文件与网页子集都已从项目中删除，字形由 Cubic 接管：Cubic 覆盖更全（10303 个字形，Lemi 只有 3671 个，且缺「雫」字），也省掉了一次额外的字体下载。要恢复 Lemi，从 git 历史里取回 `font-source/lemi-xiang-su-ti.woff2` 即可。

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

**看整体进度**
- 五张总量卡：全部、待处理、已联系、已入社、近 7 天（始终基于全部记录，不受筛选影响）。
- 四张分布卡：方向分布（一人可选多个方向，可点击直接筛选）、能力自评（点击按等级筛选）、近 14 天提交趋势、年级分布（点击按年级筛选）。悬停柱子能看到具体数字。

**找到想找的人**
- 关键字搜索：姓名 / 班级 / 联系方式 / 编号 / 备注 / 自定义方向。
- 下拉筛选：状态、方向、能力、年级（班级前两位，带各年级人数）、提交日期区间。
- 快捷筛选：待处理 / 已入社 / 今天 / 近 7 天 / 疑似重复。
- 五种排序：最新提交、最早提交、最近改动、能力高→低、按姓名（拼音序）。
- 筛选条件会写回 URL，刷新页面、把链接发给自己都能复原同一视图。

**改数据**
- 展开「详情」可以改**全部字段**：姓名、班级、能力自评、方向（多选）、自定义说明、联系方式、其它信息、内部备注。有「未保存」标记，可一键撤销。
- 状态流转有四个色标按钮（待处理 / 已联系 / 已入社 / 已归档），行内也有下拉框可以快速改。
- 批量操作：勾选多条后统一改状态或移入回收站（一次最多 500 条）。
- 同名同班的记录会标红「重复?」，配合「疑似重复」快捷筛选能快速发现重复提交。

**导出与删除**
- 导出 CSV：带 BOM，Excel 直接打开中文不乱码；导出当前筛选结果，含状态与内部备注，`= + - @` 开头的内容会转义防公式注入。
- 删除先进回收站（30 天），可以恢复；也可在回收站里彻底删除。单条删除需要点两次确认。

### 接口

| 方法与路径 | 说明 |
| --- | --- |
| `POST /api/signup` | 报名提交（公开） |
| `GET /api/admin/session` | 后台是否启用 / 当前是否已登录 |
| `POST /api/admin/login` | 登录，body `{ password }` |
| `POST /api/admin/logout` | 退出登录（清 cookie） |
| `GET /api/admin/signups` | 名单，支持 `q` / `status` / `direction` / `level` / `grade` / `from` / `to` / `duplicate` / `sort` / `page` / `pageSize` / `tz` |
| `PATCH /api/admin/signups/:id` | 改状态、内部备注或任意表单字段 |
| `DELETE /api/admin/signups/:id` | 删除一条（进回收站） |
| `POST /api/admin/signups/bulk` | 批量操作，body `{ action, ids, status? }`，`action` 为 `status` / `delete` / `restore` / `purge` |
| `GET /api/admin/signups/trash` | 回收站列表 |
| `GET /api/admin/signups/export` | 导出 CSV（接受同样的筛选参数） |

`from` / `to` 是本地日期（`YYYY-MM-DD`，含当天），`tz` 是客户端时区偏移分钟数（东八区为 `480`），服务端据此把 UTC 时间戳折算成使用者眼里的日历日；不传按东八区处理。

`grade` 是年级，取班级前两位（`2601` → `26`），传 `26` 即筛出该年级全部班级；CSV 导出也带一列「年级」。

## 字体子集化

字体压缩不是实时自动完成的。每次新增或修改会显示在网站上的文字后，在发布前执行一次：

```bash
python -m pip install -r requirements-dev.txt
npm run fonts:subset
npm run generate
```

脚本会从 `font-source/` 的原始字体生成 `public/fonts/` 中的网页子集字体。原始字体保留在项目内，避免新增文字时丢失字形。

目前只有 Nano 走子集化；Cubic 直接使用 400 KB 原文件，不参与这个流程。

## 参与原则

ITEx 不以竞赛刷题为唯一目标。欢迎不同基础、不同兴趣的同学参与；同时请尊重校园设备管理制度，仅在获授权的设备和场景中进行维护、测试与创作。
