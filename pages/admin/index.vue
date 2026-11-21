<script setup lang="ts">
/**
 * `/admin` 本身没有内容：默认进统计页。
 * 这样收藏 `.../admin` 的老链接、以及退出后重新登录都能落到一个真实的页面上。
 */
definePageMeta({ redirect: '/admin/stats' })
</script>

<template>
  <div class="admin-boot">
    <span>ITEx / ADMIN</span>
    <b>REDIRECTING…</b>
  </div>
</template>
