<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { SignupStats } from '~/types/signup'

/**
 * 统计页：招新整体进度。
 *
 * 数字来自 /api/admin/signups/stats（全库汇总），和名单页的筛选无关。
 * 图表上的每一行都可以点，点了会带着条件跳到名单页，省得再手动选一遍。
 */

useHead({ title: '统计 · 报名管理 · ITEx' })

const { authed } = useAdminSession()
const { say } = useAdminToast()

const stats = ref<SignupStats>()
const loading = ref(false)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await $fetch<{ stats: SignupStats }>('/api/admin/signups/stats', {
      query: { tz: adminTzOffset() }
    })
    stats.value = result.stats
  } catch (error) {
    if (adminErrorStatus(error) === 401) {
      authed.value = false
      say('登录已失效，请重新登录', 'err')
      return
    }
    loadError.value = adminErrorMessage(error)
  } finally {
    loading.value = false
  }
}

/** 点图表 → 带着对应筛选条件进名单页。 */
function openRoster(query: Record<string, string | number>) {
  void navigateTo({ path: '/admin/roster', query })
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="admin-main">
    <div class="admin-page-head">
      <div>
        <p class="admin-kicker">OVERVIEW · 全量统计</p>
        <h2 class="admin-page-title">招新统计</h2>
        <p class="admin-page-sub">数字始终按全部报名记录计算，不受名单页的筛选影响。</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="admin-button" :disabled="loading" @click="load()">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
        <a class="admin-button" href="/api/admin/signups/export" download>导出全部 CSV</a>
        <NuxtLink class="admin-button is-primary" to="/admin/roster">去名单 →</NuxtLink>
      </div>
    </div>

    <p v-if="loadError" class="admin-banner is-err">
      {{ loadError }}
      <button type="button" class="admin-link" @click="load()">重试</button>
    </p>

    <AdminStatsPanel
      :stats="stats"
      :loading="loading"
      @filter-direction="openRoster({ direction: $event })"
      @filter-level="openRoster({ level: $event })"
      @filter-grade="openRoster({ grade: $event })"
    />

    <p class="admin-foot">
      统计口径：<code>stats</code> 由服务端一次查询算出，包含四个流转状态的人数、近 7 天与近 14 天提交量、
      方向分布、能力分布和年级分布（年级取班级前两位）。点分布图里的任意一行可直接跳到名单页。
    </p>
  </main>
</template>
