<script setup lang="ts">
const route = useRoute()
const navItems = [
  { hash: '#about', label: '我们是谁' },
  { hash: '#work', label: '正在发生' },
  { hash: '#join', label: '加入我们' }
]

// 首页用页内锚点；其它页面回到首页对应的锚点。
const toAnchor = (hash: string) => (route.path === '/' ? hash : `/${hash}`)
</script>

<template>
  <div class="ticker" aria-label="欢迎访问南中科创局，了解更多校园官方活动资讯"><a href="https://pat.weaxi.cn/" target="_blank" rel="noopener">欢迎访问<b>南中科创局</b>，了解更多校园官方活动资讯</a></div>
  <header class="site-header">
    <NuxtLink to="/" class="brand" aria-label="返回首页"><span class="brand-logo"><img src="/images/itex-logo.png"
          alt="ITEx 社团 Logo" /></span><span class="brand-word"><b>IT</b><span>Ex</span></span></NuxtLink>
    <nav aria-label="主导航"><NuxtLink v-for="item in navItems" :key="item.hash" :to="toAnchor(item.hash)">{{
      item.label }}</NuxtLink></nav>
    <a class="header-cta" href="https://qm.qq.com/q/Ypgmr1rfyI" target="_blank" rel="noopener">加入 QQ 群 ↗</a>
  </header>
</template>
