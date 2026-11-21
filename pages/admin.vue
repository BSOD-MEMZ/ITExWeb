<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * 管理后台的外壳：登录闸门 + 顶栏 + 页面切换。
 *
 * 真正的两页在 `pages/admin/stats.vue`（统计）和 `pages/admin/roster.vue`（名单），
 * 这里只负责「未登录先登录」和两页共用的顶栏，登录状态放在 useAdminSession 里共享，
 * 所以切页不会重新验一次密码。
 */

useHead({
  title: '报名管理 · ITEx',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'description', content: 'ITEx 报名名单管理后台（仅社内使用）。' }
  ]
})

const { checking, enabled, authed, loginError, loggingIn, loadSession, login, logout } = useAdminSession()
// 提示条由外壳统一渲染，两页都通过 useAdminToast().say() 往里塞文字。
const { toast } = useAdminToast()

const password = ref('')

async function submitLogin() {
  const ok = await login(password.value)
  if (ok) password.value = ''
}

onMounted(() => {
  void loadSession()
})
</script>

<template>
  <div class="admin-page">
    <div class="noise" aria-hidden="true" />

    <div v-if="checking" class="admin-boot">
      <span>ITEx / ADMIN</span>
      <b>CHECKING SESSION…</b>
    </div>

    <section v-else-if="!authed" class="admin-login">
      <div class="admin-login-card">
        <p class="admin-kicker">ITEx / ADMIN · 仅社内使用</p>
        <h1>报名<br>管理后台</h1>

        <p v-if="!enabled" class="admin-hint is-warn">
          服务端还没有配置管理密码，后台目前是停用状态。请在部署环境里设置 <code>NUXT_ADMIN_PASSWORD</code> 后重启服务。
        </p>

        <form v-else class="admin-login-form" @submit.prevent="submitLogin">
          <p class="admin-hint">输入社团管理密码。密码由部署时通过 <code>NUXT_ADMIN_PASSWORD</code> 设置，不会存在浏览器里。</p>
          <label class="admin-field">
            <span>管理密码 <i>PASSWORD</i></span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              :disabled="loggingIn"
            >
          </label>
          <p v-if="loginError" class="admin-error">{{ loginError }}</p>
          <button type="submit" class="admin-submit" :disabled="loggingIn || !password">
            {{ loggingIn ? '正在验证…' : '进入后台' }}
          </button>
        </form>

        <p class="admin-login-foot">
          <NuxtLink to="/">← 返回首页</NuxtLink>
          <NuxtLink to="/signup">报名表</NuxtLink>
        </p>
      </div>
    </section>

    <template v-else>
      <header class="admin-bar">
        <div class="admin-brand">
          <span class="admin-mark">ITEx</span>
          <p>报名管理 <i>SIGNUP CONSOLE</i></p>
        </div>

        <nav class="admin-tabs" aria-label="后台页面">
          <NuxtLink to="/admin/stats" class="admin-tab" active-class="is-active">
            统计 <i>STATS</i>
          </NuxtLink>
          <NuxtLink to="/admin/roster" class="admin-tab" active-class="is-active">
            名单 <i>ROSTER</i>
          </NuxtLink>
        </nav>

        <div class="admin-bar-actions">
          <NuxtLink class="admin-button is-ghost" to="/">返回首页</NuxtLink>
          <button type="button" class="admin-button is-ghost" @click="logout">退出</button>
        </div>
      </header>

      <NuxtPage />
    </template>

    <div v-if="toast" class="admin-toast" :class="`is-${toast.tone}`">{{ toast.text }}</div>
  </div>
</template>
