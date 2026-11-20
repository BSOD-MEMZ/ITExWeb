export default defineNuxtConfig({
  css: ['~/assets/css/main.css', '~/assets/css/skills.css', '~/assets/css/signup.css', '~/assets/css/admin.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'ITEx / 株洲市南方中学信息拓展社',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '株洲市南方中学信息拓展社——学生自主的技术、创作与协作空间。' }
      ]
    }
  },
  runtimeConfig: {
    // 服务端私有的后台配置，分别对应环境变量 NUXT_ADMIN_PASSWORD / NUXT_ADMIN_SESSION_SECRET。
    // 密码留空时管理后台整体停用（返回 503），不会出现默认密码。
    adminPassword: '',
    adminSessionSecret: ''
  },
  routeRules: {
    // 后台只给社内用：不参与静态预渲染，也不要被搜索引擎收录。
    '/admin': { prerender: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/api/admin/**': { headers: { 'cache-control': 'no-store' } }
  },
  devtools: { enabled: true }
})
