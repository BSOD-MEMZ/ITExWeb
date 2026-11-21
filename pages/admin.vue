<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { directions, levels } from '~/data/apply'
import {
  SIGNUP_STATUSES,
  SIGNUP_STATUS_META,
  type SignupDirectionId,
  type SignupListResponse,
  type SignupRecord,
  type SignupSort,
  type SignupStatus
} from '~/types/signup'

useHead({
  title: '报名管理 · ITEx',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'description', content: 'ITEx 报名名单管理后台（仅社内使用）。' }
  ]
})

type Draft = { adminNote: string; contact: string; note: string }

type ApiError = {
  statusCode?: number
  message?: string
  data?: { statusCode?: number; statusMessage?: string; message?: string; data?: { message?: string } }
}

const PAGE_SIZE = 20

const checking = ref(true)
const enabled = ref(true)
const authed = ref(false)

const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

const filters = reactive({
  q: '',
  status: 'all' as SignupStatus | 'all',
  direction: 'all' as SignupDirectionId | 'all',
  level: 'all' as number | 'all',
  sort: 'newest' as SignupSort
})
const page = ref(1)

const list = ref<SignupListResponse | null>(null)
const loading = ref(false)
const loadError = ref('')
const expanded = ref('')
const pendingDelete = ref('')
const savingId = ref('')
const drafts = reactive<Record<string, Draft>>({})
const toast = ref<{ text: string; tone: 'ok' | 'err' } | null>(null)

let loadTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let deleteTimer: ReturnType<typeof setTimeout> | null = null

const items = computed(() => list.value?.items ?? [])
const stats = computed(() => list.value?.stats)
const pageCount = computed(() => list.value?.pageCount ?? 1)

const exportUrl = computed(() => {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.direction !== 'all') params.set('direction', filters.direction)
  if (filters.level !== 'all') params.set('level', String(filters.level))
  const query = params.toString()
  return `/api/admin/signups/export${query ? `?${query}` : ''}`
})

function errorStatus(error: unknown) {
  const err = error as ApiError
  return err?.statusCode ?? err?.data?.statusCode ?? 0
}

function errorMessage(error: unknown) {
  const err = error as ApiError
  // 业务文案优先，其次是 h3 的默认 message；statusMessage 只作为旧版本的兜底。
  return err?.data?.data?.message || err?.data?.message || err?.data?.statusMessage || err?.message || '请求失败，请稍后再试'
}

function say(text: string, tone: 'ok' | 'err' = 'ok') {
  toast.value = { text, tone }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2600)
}

function handleError(error: unknown) {
  if (errorStatus(error) === 401) {
    authed.value = false
    list.value = null
    loginError.value = '登录已失效，请重新登录'
    return
  }
  say(errorMessage(error), 'err')
}

function scheduleLoad(delay = 0) {
  if (loadTimer) clearTimeout(loadTimer)
  loadTimer = setTimeout(() => {
    loadTimer = null
    void load()
  }, delay)
}

/** 只给「还没有草稿」的记录建草稿，避免刷新时冲掉正在编辑的内容。 */
function syncDrafts() {
  const current = items.value
  const ids = new Set(current.map((record) => record.id))
  for (const id of Object.keys(drafts)) {
    if (!ids.has(id)) delete drafts[id]
  }
  for (const record of current) {
    if (!drafts[record.id]) {
      drafts[record.id] = { adminNote: record.adminNote, contact: record.contact, note: record.note }
    }
  }
}

async function loadSession() {
  checking.value = true
  try {
    const result = await $fetch<{ enabled: boolean; authenticated: boolean }>('/api/admin/session')
    enabled.value = result.enabled
    authed.value = result.authenticated
  } catch {
    enabled.value = true
    authed.value = false
  } finally {
    checking.value = false
  }
  if (authed.value) await load()
}

async function login() {
  if (loggingIn.value || !password.value) return
  loginError.value = ''
  loggingIn.value = true
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    password.value = ''
    authed.value = true
    page.value = 1
    await load()
  } catch (error) {
    loginError.value = errorMessage(error)
  } finally {
    loggingIn.value = false
  }
}

async function logout() {
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
  } catch {
    // 退出失败也把界面切回登录态，cookie 过期后服务端本来就不认。
  }
  authed.value = false
  list.value = null
  expanded.value = ''
  password.value = ''
}

async function load() {
  if (!authed.value) return
  loading.value = true
  loadError.value = ''
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: PAGE_SIZE, sort: filters.sort }
    if (filters.q.trim()) query.q = filters.q.trim()
    if (filters.status !== 'all') query.status = filters.status
    if (filters.direction !== 'all') query.direction = filters.direction
    if (filters.level !== 'all') query.level = filters.level

    list.value = await $fetch<SignupListResponse>('/api/admin/signups', { query })
    syncDrafts()
  } catch (error) {
    if (errorStatus(error) === 401) {
      authed.value = false
      list.value = null
      loginError.value = '登录已失效，请重新登录'
      return
    }
    loadError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

async function patchRecord(record: SignupRecord, patch: Record<string, unknown>, reload = false) {
  savingId.value = record.id
  try {
    const result = await $fetch<{ record: SignupRecord }>(`/api/admin/signups/${encodeURIComponent(record.id)}`, {
      method: 'PATCH',
      body: patch
    })
    if (!reload) {
      const index = items.value.findIndex((item) => item.id === record.id)
      if (index >= 0) items.value[index] = result.record
      drafts[record.id] = { adminNote: result.record.adminNote, contact: result.record.contact, note: result.record.note }
    }
    say('已保存')
    if (reload) await load()
    return result.record
  } catch (error) {
    handleError(error)
    return null
  } finally {
    savingId.value = ''
  }
}

function changeStatus(record: SignupRecord, event: Event) {
  const status = (event.target as HTMLSelectElement).value as SignupStatus
  if (status === record.status) return
  // 状态会影响统计和「只看待处理」这类筛选，改完重新拉一次列表。
  void patchRecord(record, { status }, true)
}

function isDirty(record: SignupRecord) {
  const draft = drafts[record.id]
  if (!draft) return false
  return draft.adminNote !== record.adminNote || draft.contact !== record.contact || draft.note !== record.note
}

async function saveDraft(record: SignupRecord) {
  const draft = drafts[record.id]
  if (!draft || !isDirty(record)) return
  const updated = await patchRecord(record, { adminNote: draft.adminNote, contact: draft.contact, note: draft.note })
  if (!updated) return
  drafts[record.id] = { adminNote: updated.adminNote, contact: updated.contact, note: updated.note }
}

function resetDraft(record: SignupRecord) {
  drafts[record.id] = { adminNote: record.adminNote, contact: record.contact, note: record.note }
}

function toggleRow(record: SignupRecord) {
  expanded.value = expanded.value === record.id ? '' : record.id
  if (!drafts[record.id]) {
    drafts[record.id] = { adminNote: record.adminNote, contact: record.contact, note: record.note }
  }
}

async function remove(record: SignupRecord) {
  // 第一次点只是进入确认态，4 秒内再点一次才真的删。
  if (pendingDelete.value !== record.id) {
    pendingDelete.value = record.id
    if (deleteTimer) clearTimeout(deleteTimer)
    deleteTimer = setTimeout(() => {
      if (pendingDelete.value === record.id) pendingDelete.value = ''
    }, 4000)
    return
  }

  pendingDelete.value = ''
  try {
    await $fetch(`/api/admin/signups/${encodeURIComponent(record.id)}`, { method: 'DELETE' })
    if (expanded.value === record.id) expanded.value = ''
    say('已删除')
    await load()
  } catch (error) {
    handleError(error)
  }
}

function goto(next: number) {
  const target = Math.min(Math.max(1, next), pageCount.value)
  if (target !== page.value) page.value = target
}

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function directionLabels(record: SignupRecord) {
  return record.directions.map((id) => {
    const label = directions.find((item) => item.id === id)?.label ?? id
    return id === 'custom' && record.custom ? `${label}：${record.custom}` : label
  })
}

watch(
  () => [filters.q, filters.status, filters.direction, filters.level, filters.sort],
  () => {
    page.value = 1
    scheduleLoad(filters.q ? 280 : 0)
  }
)

watch(page, () => scheduleLoad(0))

onMounted(loadSession)

onUnmounted(() => {
  if (loadTimer) clearTimeout(loadTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (deleteTimer) clearTimeout(deleteTimer)
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

        <form v-else class="admin-login-form" @submit.prevent="login">
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
        <div class="admin-bar-actions">
          <button type="button" class="admin-button" :disabled="loading" @click="load()">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
          <a class="admin-button" :href="exportUrl" download>导出 CSV</a>
          <NuxtLink class="admin-button is-ghost" to="/">返回首页</NuxtLink>
          <button type="button" class="admin-button is-ghost" @click="logout">退出</button>
        </div>
      </header>

      <main class="admin-main">
        <ul class="admin-stats">
          <li class="stat-yellow"><b>{{ stats?.total ?? 0 }}</b><span>全部报名</span></li>
          <li class="stat-red"><b>{{ stats?.pending ?? 0 }}</b><span>待处理</span></li>
          <li class="stat-blue"><b>{{ stats?.contacted ?? 0 }}</b><span>已联系</span></li>
          <li class="stat-green"><b>{{ stats?.accepted ?? 0 }}</b><span>已入社</span></li>
          <li class="stat-ink"><b>{{ stats?.last7Days ?? 0 }}</b><span>近 7 天</span></li>
        </ul>

        <div class="admin-toolbar">
          <label class="admin-search">
            <span class="sr-only">搜索</span>
            <input v-model="filters.q" type="search" placeholder="搜姓名 / 班级 / 联系方式 / 编号 / 备注">
          </label>
          <label class="admin-select">
            <span>状态</span>
            <select v-model="filters.status">
              <option value="all">全部</option>
              <option v-for="status in SIGNUP_STATUSES" :key="status" :value="status">{{ SIGNUP_STATUS_META[status].label }}</option>
            </select>
          </label>
          <label class="admin-select">
            <span>方向</span>
            <select v-model="filters.direction">
              <option value="all">全部</option>
              <option v-for="item in directions" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label class="admin-select">
            <span>能力</span>
            <select v-model="filters.level">
              <option value="all">全部</option>
              <option v-for="level in levels" :key="level.value" :value="level.value">{{ level.name }} · {{ level.cn }}</option>
            </select>
          </label>
          <label class="admin-select">
            <span>排序</span>
            <select v-model="filters.sort">
              <option value="newest">最新提交</option>
              <option value="oldest">最早提交</option>
              <option value="level">能力高→低</option>
              <option value="name">按姓名</option>
            </select>
          </label>
        </div>

        <p v-if="loadError" class="admin-banner is-err">
          {{ loadError }}
          <button type="button" class="admin-link" @click="load()">重试</button>
        </p>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <p>报名名单 <i>{{ list?.total ?? 0 }} 条 · 第 {{ list?.page ?? 1 }} / {{ pageCount }} 页</i></p>
            <p class="admin-panel-tip">点「详情」改状态、补备注</p>
          </div>

          <div v-if="!items.length && !loading" class="admin-empty">
            <p>{{ filters.q || filters.status !== 'all' || filters.direction !== 'all' || filters.level !== 'all' ? '没有符合条件的报名' : '还没有收到报名' }}</p>
            <span>报名表地址：/signup</span>
          </div>

          <div v-else class="admin-table-wrap" :class="{ 'is-loading': loading }">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>编号</th>
                  <th>姓名</th>
                  <th>班级</th>
                  <th>能力</th>
                  <th>想参与</th>
                  <th>联系方式</th>
                  <th>提交时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="record in items" :key="record.id">
                  <tr class="admin-row" :class="{ 'is-open': expanded === record.id }">
                    <td class="col-id" data-label="编号">{{ record.id }}</td>
                    <td class="col-name" data-label="姓名">{{ record.name }}</td>
                    <td data-label="班级">{{ record.className }}</td>
                    <td data-label="能力">
                      <span class="admin-level" :class="`lv-${record.level}`">{{ levels[record.level]?.name }}</span>
                    </td>
                    <td class="col-dirs" data-label="想参与">
                      <span v-for="label in directionLabels(record)" :key="label">{{ label }}</span>
                    </td>
                    <td class="col-contact" data-label="联系方式">{{ record.contact }}</td>
                    <td class="col-time" data-label="提交时间">{{ formatTime(record.createdAt) }}</td>
                    <td data-label="状态">
                      <select
                        class="admin-status"
                        :class="`tone-${SIGNUP_STATUS_META[record.status].tone}`"
                        :value="record.status"
                        :disabled="savingId === record.id"
                        @change="changeStatus(record, $event)"
                      >
                        <option v-for="status in SIGNUP_STATUSES" :key="status" :value="status">{{ SIGNUP_STATUS_META[status].label }}</option>
                      </select>
                    </td>
                    <td class="col-actions" data-label="操作">
                      <button type="button" class="admin-mini" @click="toggleRow(record)">
                        {{ expanded === record.id ? '收起' : '详情' }}
                      </button>
                      <button type="button" class="admin-mini is-danger" @click="remove(record)">
                        {{ pendingDelete === record.id ? '确认删除' : '删除' }}
                      </button>
                    </td>
                  </tr>

                  <tr v-if="expanded === record.id" class="admin-detail-row">
                    <td colspan="9">
                      <div class="admin-detail">
                        <dl class="admin-detail-list">
                          <div><dt>编号</dt><dd>{{ record.id }}</dd></div>
                          <div><dt>能力自评</dt><dd>{{ levels[record.level]?.name }} · {{ levels[record.level]?.cn }}</dd></div>
                          <div><dt>想参与的方向</dt><dd>{{ directionLabels(record).join(' / ') }}</dd></div>
                          <div><dt>提交时间</dt><dd>{{ formatTime(record.createdAt) }}</dd></div>
                          <div><dt>最近更新</dt><dd>{{ formatTime(record.updatedAt) }}</dd></div>
                        </dl>

                        <div class="admin-detail-edit">
                          <label class="admin-field">
                            <span>联系方式 <i>CONTACT</i></span>
                            <input v-model="drafts[record.id].contact" type="text" maxlength="64">
                          </label>
                          <label class="admin-field">
                            <span>其它信息 <i>NOTE</i></span>
                            <textarea v-model="drafts[record.id].note" rows="3" maxlength="500" />
                          </label>
                          <label class="admin-field">
                            <span>内部备注 <i>ADMIN ONLY</i></span>
                            <textarea v-model="drafts[record.id].adminNote" rows="3" maxlength="500" placeholder="跟进情况、面试结论等，只有后台能看到" />
                          </label>
                          <div class="admin-detail-actions">
                            <button type="button" class="admin-button is-primary" :disabled="!isDirty(record) || savingId === record.id" @click="saveDraft(record)">
                              {{ savingId === record.id ? '保存中…' : '保存修改' }}
                            </button>
                            <button type="button" class="admin-button" :disabled="!isDirty(record)" @click="resetDraft(record)">撤销</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div v-if="pageCount > 1" class="admin-pager">
            <button type="button" class="admin-button" :disabled="page <= 1" @click="goto(page - 1)">上一页</button>
            <span>{{ page }} / {{ pageCount }}</span>
            <button type="button" class="admin-button" :disabled="page >= pageCount" @click="goto(page + 1)">下一页</button>
          </div>
        </section>

        <p class="admin-foot">
          数据存放于服务端 <code>.data/signups.db</code>（SQLite，可用 <code>ITEX_DATA_DIR</code> 改目录，已在 .gitignore 中忽略）。
          删除操作不可恢复，建议定期导出 CSV 备份。
        </p>
      </main>
    </template>

    <div v-if="toast" class="admin-toast" :class="`is-${toast.tone}`">{{ toast.text }}</div>
  </div>
</template>
