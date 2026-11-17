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

开发服务默认运行于 `http://localhost:3000`。

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
├─ assets/css/          # 全局视觉样式与响应式规则
├─ components/          # 首屏、导航、项目卡片、页尾等组件
├─ data/site.ts         # 社团方向与理念等内容数据
├─ data/apply.ts        # 报名表的能力等级与活动类别
├─ pages/index.vue      # 官网首页
├─ pages/signup.vue     # 入社报名表（独立页面，首页不放入口）
├─ server/api/          # 报名表提交接口（node 部署时可用）
├─ public/fonts/        # Cubic（正文）、Nano、Lemi 字体文件
├─ public/images/       # 水原雫等公开站点素材
├─ app.vue              # Nuxt 根组件
└─ nuxt.config.ts       # Nuxt 配置
```

## 内容维护

- 调整社团实践方向：编辑 `data/site.ts` 中的 `projects`。
- 调整首页文案、奖项和联动信息：编辑 `pages/index.vue`。
- 调整报名表的能力等级、活动类别：编辑 `data/apply.ts`。
- 调整布局与视觉：优先编辑 `assets/css/skills.css`；报名页样式在 `assets/css/signup.css`；基础设计 token 位于 `assets/css/main.css`。
- 水原雫（Shizuku Mizuhara）立绘署名：由 2511 Imgreenhand 绘制。

## 报名表

地址：`/signup`（不放进首页导航，需要时直接分享链接；页面没有导航和页脚，只在顶部细条留了一个返回首页的链接）。

「想参与的活动类别」里的 `自定义` 会多要求一句说明，提交时作为 `custom` 字段一起存下来。

提交后的存储方式分两种，代码会自动选择：
1. **node 部署 / `npm run dev`**：提交走 `server/api/signup.post.ts`，写入项目根目录的 `.data/signups.json`（已在 `.gitignore` 中忽略），返回编号形如 `ITEX-2026-0001`。
2. **静态部署（`npm run generate`）**：静态托管没有接口，提交会退回浏览器 `localStorage`，编号形如 `ITEX-2026-LXXXX`，凭证上标记 `LOCAL`。想在这种情况下也真正收集报名，需要把站点部署到带服务端的运行环境，或换成第三方表单 / 数据库接口。

页面按「展台模式」设计：同一台电脑摆在那里，同学们轮流上来填，所以**不做任何本机记录**（不存草稿、不提示"你已经提交过一份"），提交完点「再填一份」就清空表单交给下一个人。能力自评的四个等级各有自己的颜色（Basic 绿 / Advanced 黄 / Expert 红 / Master 紫），滑块与方块的四档位置分别在 25% / 50% / 75% / 100%。

正文中文字体仍是 `font-source/` 里的 Lemi（乐米像素体）；`public/fonts/Cubic_11.woff2`（像素字体，未做子集化，约 400 KB）用在**所有等宽标签**里代替原来的新宋体（`monospace` 下中文会落到 NSimSun）——字体栈是 `Consolas, "Courier New", Cubic, Lemi, "Segoe UI Symbol", monospace`：拉丁用 Consolas，中文用 Cubic，Cubic 缺的字落 Lemi，`↗` 之类符号落 Segoe UI Symbol。

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
