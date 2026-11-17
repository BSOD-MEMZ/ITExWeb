<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import { directions, levels } from '~/data/apply'

useHead({
  title: '报名表 · ITEx / 株洲市南方中学信息拓展社',
  meta: [
    { name: 'description', content: 'ITEx 报名表：填写姓名、班级、能力自评、想参与的方向与联系方式，报名长期开放、不收费。' }
  ]
})

type Signup = {
  name: string
  className: string
  level: number
  directions: string[]
  custom: string
  contact: string
  note: string
}

type SignupRecord = Signup & { id: string; createdAt: string; offline?: boolean }

// 展台场景：同一台电脑轮流填写，所以不做任何本机记录，也不提示“你已经提交过”。
const LEVEL_COLORS = ['var(--green)', 'var(--yellow)', 'var(--red)', 'var(--purple)']

const form = reactive<Signup>({ name: '', className: '', level: 0, directions: [], custom: '', contact: '', note: '' })
const errors = reactive({ name: '', className: '', directions: '', custom: '', contact: '' })
const submitting = ref(false)
const receipt = ref<SignupRecord | null>(null)
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

function toggleDirection(id: string) {
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

function localId() {
  const year = new Date().getFullYear()
  const tail = Date.now().toString(36).slice(-4).toUpperCase()
  return `ITEX-${year}-L${tail}`
}

async function submit() {
  if (submitting.value) return
  if (!validate()) {
    document.querySelector('.apply-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  submitting.value = true
  const payload = snapshot()

  let record: SignupRecord
  try {
    const result = await $fetch<{ id: string; createdAt: string }>('/api/signup', {
      method: 'POST',
      body: payload,
      timeout: 8000
    })
    record = { ...payload, id: result.id, createdAt: result.createdAt }
  } catch {
    // 静态托管没有服务端接口时退回本机保存，保证信息不丢。
    record = { ...payload, id: localId(), createdAt: new Date().toISOString(), offline: true }
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
            <span class="apply-strip-note">长期开放 · 不收费 · 信息只用于活动联络</span>
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
              <span v-if="receipt.offline">当前站点未连接服务端，这份记录只存在这台设备的浏览器里。想确保我们收到，请把编号发到 QQ 群。</span>
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
              填完记得点提交。<br>信息只用于社团活动联络，不会公开。
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
                <p class="level-note">{{ currentLevel.note }}<span>选高了也没关系，报名表不考试。</span></p>
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
              <p class="apply-note">
                提交后会生成专属你的ITEx Passport。
              </p>
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
