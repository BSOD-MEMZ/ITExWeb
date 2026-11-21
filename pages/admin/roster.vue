<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { directions, levels } from '~/data/apply'
import {
  SIGNUP_STATUSES,
  SIGNUP_STATUS_META,
  type SignupDirectionId,
  type SignupListResponse,
  type SignupRecord,
  type SignupSort,
  type SignupStatus,
  type SignupTrashEntry
} from '~/types/signup'

/**
 * 名单页：筛选 + 批量操作 + 逐条编辑 + 手工新建 + 回收站。
 * 统计数字（年级下拉、快捷筛选上的计数）仍然跟着列表接口一起回来，避免多打一次请求。
 */

useHead({ title: '名单 · 报名管理 · ITEx' })

const { authed } = useAdminSession()
const { say } = useAdminToast()
const route = useRoute()
const router = useRouter()

const PAGE_SIZES = [20, 50, 100] as const

// ---------- 筛选 ----------

const filters = reactive({
  q: '',
  status: 'all' as SignupStatus | 'all',
  direction: 'all' as SignupDirectionId | 'all',
  level: 'all' as number | 'all',
  grade: '',
  from: '',
  to: '',
  duplicate: false,
  sort: 'newest' as SignupSort,
  pageSize: 20 as number
})
const page = ref(1)

const list = ref<SignupListResponse | null>(null)
const loading = ref(false)
const loadError = ref('')
const expanded = ref('')
const savingId = ref('')
const pendingDelete = ref('')
const selected = ref<string[]>([])
const trash = ref<SignupTrashEntry[] | null>(null)
const trashOpen = ref(false)
const trashBusy = ref('')

// 新建
const newOpen = ref(false)
const creating = ref(false)
const newSeq = ref(0)

let loadTimer: ReturnType<typeof setTimeout> | null = null
let deleteTimer: ReturnType<typeof setTimeout> | null = null
let urlTimer: ReturnType<typeof setTimeout> | null = null

const items = computed(() => list.value?.items ?? [])
const stats = computed(() => list.value?.stats)
const pageCount = computed(() => list.value?.pageCount ?? 1)
const total = computed(() => list.value?.total ?? 0)
const duplicateIds = computed(() => new Set(list.value?.duplicateIds ?? []))
const selectedCount = computed(() => selected.value.length)
const allSelected = computed(() => items.value.length > 0 && selected.value.length === items.value.length)

/** 当前生效的筛选条数，用来提示「你看到的是筛选后的结果」。 */
const activeFilters = computed(() => {
  let count = 0
  if (filters.q.trim()) count += 1
  if (filters.status !== 'all') count += 1
  if (filters.direction !== 'all') count += 1
  if (filters.level !== 'all') count += 1
  if (filters.grade) count += 1
  if (filters.from || filters.to) count += 1
  if (filters.duplicate) count += 1
  return count
})

const exportUrl = computed(() => {
  const params = new URLSearchParams()
  const query = listQuery()
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'pageSize' || key === 'sort' || key === 'tz') continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return `/api/admin/signups/export${search ? `?${search}` : ''}`
})

// ---------- 工具 ----------

function handleError(error: unknown) {
  if (adminErrorStatus(error) === 401) {
    authed.value = false
    list.value = null
    selected.value = []
    say('登录已失效，请重新登录', 'err')
    return
  }
  say(adminErrorMessage(error), 'err')
}

function todayKey(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// ---------- 请求 ----------

/** 组装 /api/admin/signups 的 query（列表与导出共用同一套筛选）。 */
function listQuery() {
  const query: Record<string, string | number> = { sort: filters.sort, tz: adminTzOffset() }
  if (filters.q.trim()) query.q = filters.q.trim()
  if (filters.status !== 'all') query.status = filters.status
  if (filters.direction !== 'all') query.direction = filters.direction
  if (filters.level !== 'all') query.level = filters.level
  if (filters.grade) query.grade = filters.grade
  if (filters.from) query.from = filters.from
  if (filters.to) query.to = filters.to
  if (filters.duplicate) query.duplicate = 1
  return query
}

async function load() {
  if (!authed.value) return
  loading.value = true
  loadError.value = ''
  try {
    list.value = await $fetch<SignupListResponse>('/api/admin/signups', {
      query: { ...listQuery(), page: page.value, pageSize: filters.pageSize }
    })
    // 选择只对当前页有效，翻页 / 换筛选后清空，避免误改看不见的记录。
    const visible = new Set(items.value.map((record) => record.id))
    selected.value = selected.value.filter((id) => visible.has(id))
  } catch (error) {
    handleError(error)
    if (adminErrorStatus(error) !== 401) loadError.value = adminErrorMessage(error)
  } finally {
    loading.value = false
  }
  syncUrl()
}

function scheduleLoad(delay = 0) {
  if (loadTimer) clearTimeout(loadTimer)
  loadTimer = setTimeout(() => {
    loadTimer = null
    void load()
  }, delay)
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
    }
    say('已保存')
    // 状态和字段都会影响统计与筛选结果，统一重新拉一次保证数字对得上。
    if (reload || 'status' in patch) await load()
    return result.record
  } catch (error) {
    handleError(error)
    return null
  } finally {
    savingId.value = ''
  }
}

// ---------- 新建 ----------

async function createRecord(payload: Record<string, unknown>) {
  if (creating.value) return
  creating.value = true
  try {
    const result = await $fetch<{ record: SignupRecord }>('/api/admin/signups', { method: 'POST', body: payload })
    // 带着筛选时新建的记录可能压根不满足条件，直接在提示里说清楚，免得以为没建成。
    const hidden = activeFilters.value ? '（当前筛选下可能看不到它）' : ''
    say(`已新建 ${result.record.id} · ${result.record.name}${hidden}`)
    // 表单换 key 重新挂载，清空上一次输入，方便连着补录好几条。
    newSeq.value += 1
    if (page.value > 1) {
      // 新建的记录按默认排序在最前面，跳回第一页才看得见（page 的 watcher 会触发重新加载）。
      page.value = 1
    } else {
      await load()
    }
  } catch (error) {
    handleError(error)
  } finally {
    creating.value = false
  }
}

// ---------- 批量 ----------

async function bulk(payload: { action: 'status' | 'delete' | 'restore' | 'purge'; ids?: string[]; status?: SignupStatus }) {
  const result = await $fetch<{ ok: true; changed: number }>('/api/admin/signups/bulk', { method: 'POST', body: payload })
  return result.changed
}

async function applyBulkStatus(event: Event) {
  const select = event.target as HTMLSelectElement
  const status = select.value as SignupStatus
  select.value = ''
  if (!status || !selectedCount.value) return
  const count = selectedCount.value
  try {
    const changed = await bulk({ action: 'status', ids: [...selected.value], status })
    selected.value = []
    say(`${changed} 条已改为「${SIGNUP_STATUS_META[status].label}」`)
    await load()
    if (count !== changed) say(`只有 ${changed} 条被更新，可能有记录已被删除`, 'err')
  } catch (error) {
    handleError(error)
  }
}

async function removeSelected() {
  if (!selectedCount.value) return
  const ids = [...selected.value]
  try {
    const changed = await bulk({ action: 'delete', ids })
    selected.value = []
    if (expanded.value && ids.includes(expanded.value)) expanded.value = ''
    say(`${changed} 条已移入回收站`)
    await load()
  } catch (error) {
    handleError(error)
  }
}

async function removeOne(record: SignupRecord) {
  // 第一次点只是进入确认态，4 秒内再点一次才真的删（删除后可在回收站恢复）。
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
    say(`${record.name} 已移入回收站`)
    await load()
    if (trashOpen.value) await loadTrash()
  } catch (error) {
    handleError(error)
  }
}

// ---------- 回收站 ----------

async function loadTrash() {
  try {
    const result = await $fetch<{ items: SignupTrashEntry[] }>('/api/admin/signups/trash')
    trash.value = result.items
  } catch (error) {
    handleError(error)
  }
}

async function toggleTrash() {
  trashOpen.value = !trashOpen.value
  if (trashOpen.value) await loadTrash()
}

async function restoreEntry(entry: SignupTrashEntry) {
  trashBusy.value = entry.record.id
  try {
    await bulk({ action: 'restore', ids: [entry.record.id] })
    say(`${entry.record.name} 已恢复`)
    await loadTrash()
    await load()
  } catch (error) {
    handleError(error)
  } finally {
    trashBusy.value = ''
  }
}

async function purgeEntry(entry: SignupTrashEntry) {
  trashBusy.value = entry.record.id
  try {
    await bulk({ action: 'purge', ids: [entry.record.id] })
    say('已彻底删除')
    await loadTrash()
  } catch (error) {
    handleError(error)
  } finally {
    trashBusy.value = ''
  }
}

// ---------- 选择 ----------

function isSelected(id: string) {
  return selected.value.includes(id)
}

function toggleSelect(id: string) {
  const index = selected.value.indexOf(id)
  if (index >= 0) selected.value.splice(index, 1)
  else selected.value.push(id)
}

function toggleSelectAll() {
  selected.value = allSelected.value ? [] : items.value.map((record) => record.id)
}

// ---------- 筛选操作 ----------

function clearFilters() {
  Object.assign(filters, {
    q: '',
    status: 'all',
    direction: 'all',
    level: 'all',
    grade: '',
    from: '',
    to: '',
    duplicate: false,
    sort: 'newest'
  })
}

function setDayRange(days: number) {
  filters.from = todayKey(-(days - 1))
  filters.to = todayKey(0)
}

function pickStatus(status: SignupStatus) {
  filters.status = filters.status === status ? 'all' : status
}

function goto(next: number) {
  const target = Math.min(Math.max(1, next), pageCount.value)
  if (target !== page.value) page.value = target
}

// ---------- URL 同步 ----------
//
// 刷新、收藏、把链接发给同学都要能复原同样的筛选，所以筛选写在 query 里。
// 写 URL 用 router.replace 而不是 history.replaceState：后者改了地址栏但 vue-router
// 不知道，之后再点「统计 / 名单」时它还会拿着旧 query 做比较，容易出诡异行为。

function syncUrl() {
  if (urlTimer) clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const query: Record<string, string> = {}
    if (filters.q.trim()) query.q = filters.q.trim()
    if (filters.status !== 'all') query.status = filters.status
    if (filters.direction !== 'all') query.direction = filters.direction
    if (filters.level !== 'all') query.level = String(filters.level)
    if (filters.grade) query.grade = filters.grade
    if (filters.from) query.from = filters.from
    if (filters.to) query.to = filters.to
    if (filters.duplicate) query.duplicate = '1'
    if (filters.sort !== 'newest') query.sort = filters.sort
    if (page.value > 1) query.page = String(page.value)
    void router.replace({ query })
  }, 220)
}

/** 从 URL（可能是统计页图表点过来的）恢复筛选，只在挂载时跑一次。 */
function restoreUrl() {
  const source = route.query
  const one = (key: string) => {
    const value = source[key]
    return typeof value === 'string' ? value : Array.isArray(value) ? String(value[0] ?? '') : ''
  }

  const status = one('status')
  const direction = one('direction')
  const sort = one('sort')
  if (status && (SIGNUP_STATUSES as readonly string[]).includes(status)) filters.status = status as SignupStatus
  if (direction && directions.some((item) => item.id === direction)) filters.direction = direction as SignupDirectionId
  // 注意先判空：Number(null) 是 0，直接转会把「没传 level」误认成「等级 0」。
  const level = one('level')
  if (level) {
    const parsed = Number(level)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 3) filters.level = parsed
  }
  if (sort === 'oldest' || sort === 'name' || sort === 'level' || sort === 'updated') filters.sort = sort
  filters.q = one('q')
  filters.grade = one('grade')
  filters.from = one('from')
  filters.to = one('to')
  filters.duplicate = one('duplicate') === '1'
  page.value = Math.max(1, Number(one('page')) || 1)
}

// ---------- 展示辅助 ----------

function directionLabels(record: SignupRecord) {
  return record.directions.map((id) => {
    const label = directions.find((item) => item.id === id)?.label ?? id
    return id === 'custom' && record.custom ? `${label}：${record.custom}` : label
  })
}

// ---------- 监听 ----------

watch(
  () => [filters.q, filters.status, filters.direction, filters.level, filters.grade, filters.from, filters.to, filters.duplicate, filters.sort],
  () => {
    page.value = 1
    selected.value = []
    scheduleLoad(filters.q ? 280 : 0)
  }
)

watch(
  () => filters.pageSize,
  () => {
    page.value = 1
    scheduleLoad(0)
  }
)

watch(page, () => scheduleLoad(0))

onMounted(() => {
  restoreUrl()
  // 从统计页带着 grade / direction 之类的参数跳过来时，restoreUrl 已经填好了筛选，
  // 这里的 load 直接用这份筛选取数据。
  void load()
})

onUnmounted(() => {
  if (loadTimer) clearTimeout(loadTimer)
  if (deleteTimer) clearTimeout(deleteTimer)
  if (urlTimer) clearTimeout(urlTimer)
})
</script>

<template>
  <main class="admin-main">
    <div class="admin-page-head">
      <div>
        <p class="admin-kicker">ROSTER · 全部报名</p>
        <h2 class="admin-page-title">名单</h2>
        <p class="admin-page-sub">
          共 {{ total }} 条<template v-if="activeFilters">（已筛选 {{ activeFilters }} 项）</template>
        </p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="admin-button is-primary" @click="newOpen = !newOpen">
          {{ newOpen ? '收起新建' : '+ 新建报名' }}
        </button>
        <button type="button" class="admin-button" :disabled="loading" @click="load()">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
        <a class="admin-button" :href="exportUrl" download>导出 CSV</a>
        <button type="button" class="admin-button is-ghost" :class="{ 'is-active': trashOpen }" @click="toggleTrash">
          回收站<span v-if="trash?.length">（{{ trash.length }}）</span>
        </button>
      </div>
    </div>

    <div class="admin-quick">
      <button
        type="button"
        class="admin-quick-chip"
        :class="{ 'is-active': filters.status === 'pending' }"
        @click="pickStatus('pending')"
      >
        待处理 <b>{{ stats?.pending ?? 0 }}</b>
      </button>
      <button
        type="button"
        class="admin-quick-chip"
        :class="{ 'is-active': filters.status === 'accepted' }"
        @click="pickStatus('accepted')"
      >
        已入社 <b>{{ stats?.accepted ?? 0 }}</b>
      </button>
      <button type="button" class="admin-quick-chip" :class="{ 'is-active': filters.from === todayKey(0) && filters.to === todayKey(0) }" @click="setDayRange(1)">
        今天
      </button>
      <button type="button" class="admin-quick-chip" :class="{ 'is-active': filters.from === todayKey(-6) }" @click="setDayRange(7)">
        近 7 天
      </button>
      <button
        v-if="stats?.duplicates"
        type="button"
        class="admin-quick-chip is-warn"
        :class="{ 'is-active': filters.duplicate }"
        @click="filters.duplicate = !filters.duplicate"
      >
        疑似重复 <b>{{ stats.duplicates }}</b>
      </button>
      <span v-if="activeFilters" class="admin-quick-clear">
        已筛选 {{ activeFilters }} 项
        <button type="button" class="admin-link" @click="clearFilters">清除</button>
      </span>
    </div>

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
      <label v-if="stats?.grades?.length" class="admin-select">
        <span>年级</span>
        <select v-model="filters.grade">
          <option value="">全部</option>
          <option v-for="item in stats?.grades ?? []" :key="item.name" :value="item.name">{{ item.name }} 级（{{ item.count }}）</option>
        </select>
      </label>
      <label class="admin-select">
        <span>提交日期</span>
        <span class="admin-range">
          <input v-model="filters.from" type="date" :max="filters.to || todayKey(0)">
          <i>→</i>
          <input v-model="filters.to" type="date" :min="filters.from" :max="todayKey(0)">
        </span>
      </label>
      <label class="admin-select">
        <span>排序</span>
        <select v-model="filters.sort">
          <option value="newest">最新提交</option>
          <option value="oldest">最早提交</option>
          <option value="updated">最近改动</option>
          <option value="level">能力高→低</option>
          <option value="name">按姓名</option>
        </select>
      </label>
      <label class="admin-select">
        <span>每页</span>
        <select v-model.number="filters.pageSize">
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }} 条</option>
        </select>
      </label>
    </div>

    <section v-if="newOpen" class="admin-panel admin-new-panel">
      <div class="admin-panel-head">
        <p>
          新建报名
          <i>MANUAL ENTRY</i>
        </p>
        <p class="admin-panel-tip">纸质表 / 线下报名的补录入口，编号自动分配</p>
      </div>
      <AdminSignupNew
        :key="newSeq"
        :busy="creating"
        @submit="createRecord"
        @close="newOpen = false"
      />
    </section>

    <p v-if="loadError" class="admin-banner is-err">
      {{ loadError }}
      <button type="button" class="admin-link" @click="load()">重试</button>
    </p>

    <div v-if="selectedCount" class="admin-bulkbar">
      <span>已选 <b>{{ selectedCount }}</b> 条</span>
      <label class="admin-select">
        <span>改状态</span>
        <select :value="''" @change="applyBulkStatus">
          <option value="" disabled>选择状态…</option>
          <option v-for="status in SIGNUP_STATUSES" :key="status" :value="status">{{ SIGNUP_STATUS_META[status].label }}</option>
        </select>
      </label>
      <button type="button" class="admin-button is-danger" @click="removeSelected">移入回收站</button>
      <button type="button" class="admin-button is-ghost" @click="selected = []">取消选择</button>
    </div>

    <section class="admin-panel">
      <div class="admin-panel-head">
        <p>
          报名名单
          <i>
            {{ total }} 条<template v-if="activeFilters">（筛选后）</template> · 第 {{ list?.page ?? 1 }} / {{ pageCount }} 页
          </i>
        </p>
        <p class="admin-panel-tip">展开「详情」可改全部字段与内部备注</p>
      </div>

      <div v-if="!items.length && !loading" class="admin-empty">
        <p>{{ activeFilters ? '没有符合条件的报名' : '还没有收到报名' }}</p>
        <span v-if="activeFilters">试试清除筛选，或换个关键词</span>
        <span v-else>报名表地址：/signup，也可以点上面的「新建报名」手工补录</span>
      </div>

      <div v-else class="admin-table-wrap" :class="{ 'is-loading': loading }">
        <table class="admin-table">
          <thead>
            <tr>
              <th class="col-check">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  aria-label="全选本页"
                  @change="toggleSelectAll"
                >
              </th>
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
              <tr
                class="admin-row"
                :class="{ 'is-open': expanded === record.id, 'is-selected': isSelected(record.id) }"
              >
                <td class="col-check" data-label="选择">
                  <input
                    type="checkbox"
                    :checked="isSelected(record.id)"
                    :aria-label="`选择 ${record.name}`"
                    @change="toggleSelect(record.id)"
                  >
                </td>
                <td class="col-id" data-label="编号">
                  {{ record.id }}
                  <span v-if="duplicateIds.has(record.id)" class="admin-flag" title="同名同班出现多次">重复?</span>
                </td>
                <td class="col-name" data-label="姓名">{{ record.name }}</td>
                <td data-label="班级">{{ record.className }}</td>
                <td data-label="能力">
                  <span class="admin-level" :class="`lv-${record.level}`">{{ levels[record.level]?.name }}</span>
                </td>
                <td class="col-dirs" data-label="想参与">
                  <span v-for="label in directionLabels(record)" :key="label">{{ label }}</span>
                </td>
                <td class="col-contact" data-label="联系方式">{{ record.contact }}</td>
                <td class="col-time" data-label="提交时间">{{ adminFormatTime(record.createdAt) }}</td>
                <td data-label="状态">
                  <select
                    class="admin-status"
                    :class="`tone-${SIGNUP_STATUS_META[record.status].tone}`"
                    :value="record.status"
                    :disabled="savingId === record.id"
                    @change="patchRecord(record, { status: ($event.target as HTMLSelectElement).value }, true)"
                  >
                    <option v-for="status in SIGNUP_STATUSES" :key="status" :value="status">{{ SIGNUP_STATUS_META[status].label }}</option>
                  </select>
                </td>
                <td class="col-actions" data-label="操作">
                  <button type="button" class="admin-mini" @click="expanded = expanded === record.id ? '' : record.id">
                    {{ expanded === record.id ? '收起' : '详情' }}
                  </button>
                  <button type="button" class="admin-mini is-danger" @click="removeOne(record)">
                    {{ pendingDelete === record.id ? '确认删除' : '删除' }}
                  </button>
                </td>
              </tr>

              <tr v-if="expanded === record.id" class="admin-detail-row">
                <td colspan="10">
                  <AdminSignupEditor
                    :record="record"
                    :saving="savingId === record.id"
                    :duplicate="duplicateIds.has(record.id)"
                    @save="patchRecord(record, $event)"
                    @close="expanded = ''"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="pageCount > 1" class="admin-pager">
        <button type="button" class="admin-button" :disabled="page <= 1" @click="goto(1)">首页</button>
        <button type="button" class="admin-button" :disabled="page <= 1" @click="goto(page - 1)">上一页</button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button type="button" class="admin-button" :disabled="page >= pageCount" @click="goto(page + 1)">下一页</button>
        <button type="button" class="admin-button" :disabled="page >= pageCount" @click="goto(pageCount)">末页</button>
      </div>
    </section>

    <section v-if="trashOpen" class="admin-panel admin-trash">
      <div class="admin-panel-head">
        <p>回收站 <i>{{ trash?.length ?? 0 }} 条 · 保留 30 天</i></p>
        <button type="button" class="admin-mini" @click="trashOpen = false">关闭</button>
      </div>

      <div v-if="!trash?.length" class="admin-empty">
        <p>回收站是空的</p>
        <span>删除的报名会先放到这里，30 天后自动清除</span>
      </div>

      <ul v-else class="admin-trash-list">
        <li v-for="entry in trash" :key="entry.record.id">
          <div class="admin-trash-info">
            <b>{{ entry.record.name }}</b>
            <span>{{ entry.record.className }} · {{ entry.record.id }}</span>
            <i>删除于 {{ adminFormatTime(entry.deletedAt) }}</i>
          </div>
          <div class="admin-trash-actions">
            <button type="button" class="admin-mini" :disabled="trashBusy === entry.record.id" @click="restoreEntry(entry)">恢复</button>
            <button type="button" class="admin-mini is-danger" :disabled="trashBusy === entry.record.id" @click="purgeEntry(entry)">彻底删除</button>
          </div>
        </li>
      </ul>
    </section>

    <p class="admin-foot">
      数据存放于服务端 <code>.data/signups.db</code>（SQLite，可用 <code>ITEX_DATA_DIR</code> 改目录，已在 .gitignore 中忽略）。
      删除先进回收站，30 天后自动清除；建议定期导出 CSV 备份。
    </p>
  </main>
</template>
