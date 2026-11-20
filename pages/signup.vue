<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { directions, levels } from '~/data/apply'
import type { SignupDirectionId, SignupInput } from '~/types/signup'
import { flushPendingSignups, queuePendingSignup, readPendingSignups } from '~/utils/signupOffline'

useHead({
  title: '报名表 · ITEx / 株洲市南方中学信息拓展社',
  meta: [
    { name: 'description', content: 'ITEx 报名表：填写姓名、班级、能力自评、想参与的方向与联系方式，报名长期开放、不收费。' }
  ]
})

// 表单字段与服务端共用一份定义，方向 id 不再是裸 string。
type Signup = SignupInput
type SignupRecord = Signup & { id: string; createdAt: string; offline?: boolean }

async function postSignup(payload: SignupInput) {
  return await $fetch<{ id: string; createdAt: string }>('/api/signup', { method: 'POST', body: payload, timeout: 8000 })
}

// 展台场景：同一台电脑轮流填写，所以不存本机草稿、也不提示“你已经提交过”。
// 只有提交失败（断网 / 5xx）时，才会把这一份放进 utils/signupOffline.ts 的待补交队列。
const LEVEL_COLORS = ['var(--green)', 'var(--yellow)', 'var(--red)', 'var(--purple)']

const form = reactive<Signup>({ name: '', className: '', level: 0, directions: [], custom: '', contact: '', note: '' })
const errors = reactive({ name: '', className: '', directions: '', custom: '', contact: '' })
const submitting = ref(false)
const submitError = ref('')
const receipt = ref<SignupRecord | null>(null)
// 本机还有几份「当时没送出去」的报名。展台机器临时断网时会短暂 > 0。
const pendingCount = ref(0)
// 展台：凭证停在屏幕上的时间不宜太久，到点自动清空交给下一位。
const RESET_SECONDS = 90
const resetIn = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
  resetIn.value = 0
}

function startTicker() {
  stopTicker()
  resetIn.value = RESET_SECONDS
  ticker = setInterval(() => {
    resetIn.value -= 1
    if (resetIn.value <= 0) startOver()
  }, 1000)
}

const currentLevel = computed(() => levels.find((item) => item.value === form.level) ?? levels[0])
const levelColor = computed(() => LEVEL_COLORS[form.level] ?? LEVEL_COLORS[0])
// 四个等级分别落在轨道的 25% / 50% / 75% / 100%
const fillPercent = computed(() => ((form.level + 1) / levels.length) * 100)
const pickedDirections = computed(() => directions.filter((item) => form.directions.includes(item.id)))
const wantsCustom = computed(() => form.directions.includes('custom'))

function snapshot(): Signup {
  return {
    name: form.name,
    className: form.className,
    level: form.level,
    directions: [...form.directions],
    custom: form.custom,
    contact: form.contact,
    note: form.note
  }
}

function applyRecord(record: Partial<Signup>) {
  if (typeof record.name === 'string') form.name = record.name
  if (typeof record.className === 'string') form.className = record.className
  if (typeof record.level === 'number' && record.level >= 0 && record.level <= 3) form.level = record.level
  if (Array.isArray(record.directions)) {
    form.directions = directions.filter((item) => record.directions?.includes(item.id)).map((item) => item.id)
  }
  if (typeof record.custom === 'string') form.custom = record.custom
  if (typeof record.contact === 'string') form.contact = record.contact
  if (typeof record.note === 'string') form.note = record.note
}

function toggleDirection(id: SignupDirectionId) {
  const index = form.directions.indexOf(id)
  if (index >= 0) form.directions.splice(index, 1)
  else form.directions.push(id)
  errors.directions = ''
  if (!wantsCustom.value) errors.custom = ''
}

function validate() {
  errors.name = form.name.trim() ? '' : '请填写姓名'
  errors.className = form.className.trim() ? '' : '请填写班级'
  errors.contact = form.contact.trim() ? '' : '请留一个能找到你的联系方式'
  errors.directions = form.directions.length ? '' : '至少选择一个想参与的方向'
  errors.custom = wantsCustom.value && !form.custom.trim() ? '选了自定义，就写一句你想做的事' : ''
  return !errors.name && !errors.className && !errors.contact && !errors.directions && !errors.custom
}

async function submit() {
  if (submitting.value) return
  submitError.value = ''
  if (!validate()) {
    document.querySelector('.apply-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  submitting.value = true
  const payload = snapshot()

  let record: SignupRecord
  try {
    const result = await postSignup(payload)
    record = { ...payload, id: result.id, createdAt: result.createdAt }
  } catch (error) {
    const status =
      (error as { statusCode?: number })?.statusCode ??
      (error as { data?: { statusCode?: number } })?.data?.statusCode ??
      0

    // 表单内容被服务端拒绝（4xx）：把提示放回对应字段，不能假装提交成功。
    if (status >= 400 && status < 500) {
      const data = (error as { data?: { statusMessage?: string; message?: string; data?: { field?: keyof typeof errors } } })?.data
      const message = data?.statusMessage || data?.message || '提交失败，请检查填写内容'
      const field = data?.data?.field
      if (field && field in errors) errors[field] = message
      else submitError.value = message
      submitting.value = false
      await nextTick()
      document.querySelector('.apply-error, .apply-submit-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // 断网或服务端异常：先把这份存进本机待补交队列，再给一张 LOCAL 凭证。
    const queued = queuePendingSignup(payload)
    pendingCount.value = readPendingSignups().length
    record = { ...payload, id: queued.localId, createdAt: queued.createdAt, offline: true }
  }

  receipt.value = record
  submitting.value = false
  startTicker()
  await nextTick()
  document.querySelector('.apply-receipt')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function editAgain() {
  stopTicker()
  if (receipt.value) applyRecord(receipt.value)
  receipt.value = null
  nextTick(() => {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function startOver() {
  stopTicker()
  receipt.value = null
  Object.assign(form, { name: '', className: '', level: 0, directions: [], custom: '', contact: '', note: '' })
  ;(Object.keys(errors) as Array<keyof typeof errors>).forEach((key) => (errors[key] = ''))
  nextTick(() => {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

onMounted(async () => {
  pendingCount.value = readPendingSignups().length
  if (!pendingCount.value) return
  // 之前没送出去的报名，能连上服务端时自动补交。
  const result = await flushPendingSignups((pending) => postSignup(pending))
  pendingCount.value = result.remaining
})

onUnmounted(stopTicker)

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
</script>

<template>
  <div class="apply-page">
    <div class="noise" aria-hidden="true" />
    <main class="apply-main">
      <section class="apply-body">
        <div class="apply-strip">
          <p class="section-index">05 / APPLICATION · 入社报名</p>
          <span class="apply-strip-right">
            <span v-if="pendingCount" class="apply-strip-note">本机有 {{ pendingCount }} 份待补交</span>
            <NuxtLink class="apply-back" to="/">← ITEx 首页</NuxtLink>
          </span>
        </div>

        <div v-if="receipt" class="apply-receipt">
          <div class="receipt-card">
            <div class="receipt-top">
              <div>
                <p class="receipt-label">APPLICATION RECEIVED</p>
                <p class="receipt-id">{{ receipt.id }}</p>
              </div>
              <span class="receipt-stamp">{{ receipt.offline ? 'LOCAL' : 'FILED' }}</span>
            </div>

            <dl class="receipt-list">
              <div class="receipt-row"><dt>姓名 / NAME</dt><dd>{{ receipt.name }}</dd></div>
              <div class="receipt-row"><dt>班级 / CLASS</dt><dd>{{ receipt.className }}</dd></div>
              <div class="receipt-row">
                <dt>能力自评</dt>
                <dd>
                  <b class="receipt-level">{{ levels[receipt.level]?.name }}</b>
                  <span class="receipt-level-cn">{{ levels[receipt.level]?.cn }}</span>
                  <span class="receipt-bar" aria-hidden="true">
                    <i v-for="level in levels" :key="level.value"
                      :class="{ 'is-on': level.value <= receipt.level }"
                      :style="level.value <= receipt.level ? { background: LEVEL_COLORS[level.value] } : undefined" />
                  </span>
                </dd>
              </div>
              <div class="receipt-row">
                <dt>想参与</dt>
                <dd class="receipt-tags">
                  <span v-for="item in directions.filter((d) => receipt?.directions.includes(d.id))" :key="item.id">
                    {{ item.label }}<template v-if="item.id === 'custom' && receipt.custom"> · {{ receipt.custom }}</template>
                  </span>
                </dd>
              </div>
              <div class="receipt-row"><dt>联系方式</dt><dd>{{ receipt.contact }}</dd></div>
              <div v-if="receipt.note" class="receipt-row"><dt>其它信息</dt><dd>{{ receipt.note }}</dd></div>
              <div class="receipt-row"><dt>提交时间</dt><dd>{{ formatTime(receipt.createdAt) }}</dd></div>
            </dl>

            <div class="receipt-code" aria-hidden="true" />
            <p class="receipt-foot">
              <span v-if="receipt.offline">当前站点连不上服务端，这份报名先存在这台设备的浏览器里；网络恢复后重新打开本页会自动补交。稳妥起见，也可以把内容发到 QQ 群。</span>
              <span v-else>已经记到社团的报名名单里。后续活动时间和地点会在 QQ 群公布。</span>
              <a href="https://qm.qq.com/q/Ypgmr1rfyI" target="_blank" rel="noopener">QQ 群 · 1076741511 ↗</a>
            </p>

            <div class="receipt-actions">
              <button type="button" class="ghost-button" @click="editAgain">修改这份报名</button>
              <button type="button" class="ghost-button" @click="startOver">再填一份</button>
              <span class="receipt-tip">{{ resetIn }} 秒后返回</span>
            </div>
          </div>
        </div>

        <form v-else id="apply-form" class="apply-shell" novalidate @submit.prevent="submit">
          <aside class="apply-rail">
            <p class="rail-title">FORM / 04 SECTIONS</p>
            <ul class="rail-steps">
              <li><b>01</b><span>基本信息</span></li>
              <li><b>02</b><span>能力自评</span></li>
              <li><b>03</b><span>想做的事</span></li>
              <li><b>04</b><span>联系方式</span></li>
            </ul>
            <p class="rail-note">
              提交后我们将会联系你。<br>这些不会公开。
            </p>
            <p class="rail-mark" aria-hidden="true">ITEX<br>FORM</p>
          </aside>

          <div class="apply-fields">
            <section class="apply-block">
              <header class="block-head"><b>01</b><span>基本信息</span><em>BASIC INFO</em></header>
              <div class="apply-grid">
                <label class="apply-field">
                  <span class="apply-label">姓名 <i>NAME</i></span>
                  <input v-model="form.name" type="text" maxlength="24" placeholder="真名或常用昵称" autocomplete="name"
                    :class="{ 'is-error': errors.name }" @input="errors.name = ''">
                  <span v-if="errors.name" class="apply-error">{{ errors.name }}</span>
                </label>
                <label class="apply-field">
                  <span class="apply-label">班级 <i>CLASS</i></span>
                  <input v-model="form.className" type="text" maxlength="24" placeholder="如 2505"
                    :class="{ 'is-error': errors.className }" @input="errors.className = ''">
                  <span v-if="errors.className" class="apply-error">{{ errors.className }}</span>
                </label>
              </div>
            </section>

            <section class="apply-block">
              <header class="block-head"><b>02</b><span>能力自评</span><em>SKILL LEVEL</em></header>
              <div class="level-stage" :style="{ '--lv': levelColor }">
                <p class="level-readout">
                  <b>{{ currentLevel.name }}</b>
                  <span>{{ currentLevel.cn }}</span>
                  <em>{{ form.level + 1 }} / {{ levels.length }}</em>
                </p>
                <div class="level-track" :style="{ '--fill': `${fillPercent}%` }">
                  <div class="level-fill" />
                  <span class="level-knob" aria-hidden="true" />
                  <input v-model.number="form.level" class="level-range" type="range" min="0" max="3" step="1"
                    aria-label="能力自评等级：Basic、Advanced、Expert、Master">
                </div>
                <div class="level-ticks">
                  <button v-for="level in levels" :key="level.value" type="button" class="level-tick"
                    :class="{ 'is-active': form.level === level.value }"
                    :style="{ '--lv': LEVEL_COLORS[level.value] }" @click="form.level = level.value">
                    <b>{{ level.name }}</b><span>{{ level.cn }}</span>
                  </button>
                </div>
                <p class="level-note">{{ currentLevel.note }}<span>只会 VibeCoding 也没关系，我们都差不多。</span></p>
              </div>
            </section>

            <section class="apply-block">
              <header class="block-head"><b>03</b><span>想参与的活动类别</span><em>DIRECTIONS</em></header>
              <div class="dir-grid" :class="{ 'is-error': errors.directions }">
                <button v-for="item in directions" :key="item.id" type="button" class="dir-chip"
                  :class="[`tone-${item.tone}`, { 'is-active': form.directions.includes(item.id) }]"
                  :aria-pressed="form.directions.includes(item.id)" @click="toggleDirection(item.id)">
                  <i>{{ item.en }}</i>
                  <b>{{ item.label }}</b>
                  <span>{{ item.hint }}</span>
                </button>
              </div>
              <div v-if="wantsCustom" class="dir-custom">
                <label class="apply-field is-wide">
                  <span class="apply-label">自定义方向 <i>CUSTOM</i></span>
                  <input v-model="form.custom" type="text" maxlength="60"
                    placeholder="想做的事情"
                    :class="{ 'is-error': errors.custom }" @input="errors.custom = ''">
                  <span v-if="errors.custom" class="apply-error">{{ errors.custom }}</span>
                </label>
              </div>
              <p class="dir-hint">此题可以多选。</p>
              <span v-if="errors.directions" class="apply-error">{{ errors.directions }}</span>
            </section>

            <section class="apply-block">
              <header class="block-head"><b>04</b><span>联系方式与其它</span><em>CONTACT</em></header>
              <div class="apply-grid">
                <label class="apply-field is-wide">
                  <span class="apply-label">联系方式 <i>QQ / WECHAT / MAIL</i></span>
                  <input v-model="form.contact" type="text" maxlength="64" placeholder="QQ 号、微信号或邮箱"
                    :class="{ 'is-error': errors.contact }" @input="errors.contact = ''">
                  <span v-if="errors.contact" class="apply-error">{{ errors.contact }}</span>
                </label>
                <label class="apply-field is-wide">
                  <span class="apply-label">其它信息 <i>OPTIONAL</i></span>
                  <textarea v-model="form.note" rows="4" maxlength="500"
                    placeholder="做过什么、想学什么都可以写这里。" />
                  <span class="apply-counter">{{ form.note.length }} / 500</span>
                </label>
              </div>
            </section>

            <div class="apply-submit">
              <div class="apply-submit-copy">
                <p class="apply-note">
                  提交后会生成专属你的ITEx Passport。
                </p>
                <p v-if="submitError" class="apply-submit-error">{{ submitError }}</p>
              </div>
              <button type="submit" class="submit-button" :disabled="submitting">
                <span>{{ submitting ? '正在提交…' : '提交报名' }}</span>
                <b aria-hidden="true">↗</b>
              </button>
            </div>
          </div>
        </form>
      </section>

    </main>
  </div>
</template>
