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
├─ pages/index.vue      # 官网首页
├─ public/fonts/        # Nano 与 Lemi 字体文件
├─ public/images/       # 水原雫等公开站点素材
├─ app.vue              # Nuxt 根组件
└─ nuxt.config.ts       # Nuxt 配置
```

## 内容维护

- 调整社团实践方向：编辑 `data/site.ts` 中的 `projects`。
- 调整首页文案、奖项和联动信息：编辑 `pages/index.vue`。
- 调整布局与视觉：优先编辑 `assets/css/skills.css`；基础设计 token 位于 `assets/css/main.css`。
- 水原雫（Shizuku Mizuhara）立绘署名：由 2511 Imgreenhand 绘制。

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
