export default defineNuxtConfig({
  css: ['~/assets/css/main.css', '~/assets/css/skills.css'],
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
  devtools: { enabled: true }
})
