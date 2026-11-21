<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { directions, levels } from '~/data/apply'
import { SIGNUP_STATUSES, SIGNUP_STATUS_META, type SignupDirectionId, type SignupRecord, type SignupStatus } from '~/types/signup'

/**
 * 单条报名的编辑区（表格展开行里的内容）。
 *
 * 报名者填错名字、班级、方向是常事，后台要能直接改；
 * 但改动会污染原始报名记录，所以这里要求「显式保存」，未保存时右上角有标记，可以一键撤销。
 */

const props = defineProps<{ record: SignupRecord; saving?: boolean; duplicate?: boolean }>()

const emit = defineEmits<{
  (event: 'save', patch: Record<string, unknown>): void
  (event: 'close'): void
}>()

type Draft = {
  name: string
  className: string
  level: number
  directions: SignupDirectionId[]
  custom: string
  contact: string
  note: string
  adminNote: string
}

const form = reactive<Draft>({ ...snapshot(props.record) })

function snapshot(record: SignupRecord): Draft {
  return {
    name: record.name,
    className: record.className,
    level: record.level,
    directions: [...record.directions],
    custom: record.custom,
    contact: record.contact,
    note: record.note,
    adminNote: record.adminNote
  }
}

// 保存成功后父组件会换掉 record 对象，这里跟着重置草稿；
// 也顺带解决了「翻页回来还是上次没保存的内容」。
watch(
  () => props.record,
  (record) => Object.assign(form, snapshot(record))
)

const dirty = computed(() => {
  const base = props.record
  return (
    form.name !== base.name ||
    form.className !== base.className ||
    form.level !== base.level ||
    form.contact !== base.contact ||
    form.note !== base.note ||
    form.adminNote !== base.adminNote ||
    form.custom !== base.custom ||
    form.directions.join(',') !== base.directions.join(',')
  )
})

const hasCustom = computed(() => form.directions.includes('custom'))

function toggleDirection(id: SignupDirectionId) {
  const index = form.directions.indexOf(id)
  if (index >= 0) form.directions.splice(index, 1)
  else form.directions.push(id)
  // 保持与服务端白名单一致的顺序，避免「只换了顺序」也被判成有改动。
  form.directions.sort((left, right) => directions.findIndex((d) => d.id === left) - directions.findIndex((d) => d.id === right))
}

function reset() {
  Object.assign(form, snapshot(props.record))
}

function submit() {
  if (!dirty.value || props.saving) return
  emit('save', {
    name: form.name,
    className: form.className,
    level: form.level,
    directions: [...form.directions],
    custom: hasCustom.value ? form.custom : '',
    contact: form.contact,
    note: form.note,
    adminNote: form.adminNote
  })
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
</script>

<template>
  <div class="admin-detail">
    <div class="admin-detail-side">
      <dl class="admin-detail-list">
        <div><dt>编号</dt><dd class="is-mono">{{ record.id }}</dd></div>
        <div><dt>提交时间</dt><dd>{{ formatTime(record.createdAt) }}</dd></div>
        <div><dt>最近更新</dt><dd>{{ formatTime(record.updatedAt) }}</dd></div>
      </dl>

      <div class="admin-detail-status">
        <span>流转状态</span>
        <div class="admin-status-pills">
          <button
            v-for="status in SIGNUP_STATUSES"
            :key="status"
            type="button"
            class="admin-pill"
            :class="[`tone-${SIGNUP_STATUS_META[status].tone}`, { 'is-active': record.status === status }]"
            :disabled="saving"
            @click="record.status !== status && emit('save', { status })"
          >
            {{ SIGNUP_STATUS_META[status].label }}
          </button>
        </div>
      </div>

      <p v-if="duplicate" class="admin-detail-warn">
        这个姓名 + 班级还有别的报名记录，可能重复提交了。
      </p>

      <button type="button" class="admin-mini" @click="emit('close')">收起详情</button>
    </div>

    <form class="admin-detail-edit" @submit.prevent="submit">
      <div class="admin-detail-grid">
        <label class="admin-field">
          <span>姓名 <i>NAME</i></span>
          <input v-model="form.name" type="text" maxlength="24">
        </label>
        <label class="admin-field">
          <span>班级 <i>CLASS</i></span>
          <input v-model="form.className" type="text" maxlength="24">
        </label>
        <label class="admin-field">
          <span>能力自评 <i>LEVEL</i></span>
          <select v-model.number="form.level">
            <option v-for="level in levels" :key="level.value" :value="level.value">{{ level.name }} · {{ level.cn }}</option>
          </select>
        </label>
        <label class="admin-field">
          <span>联系方式 <i>CONTACT</i></span>
          <input v-model="form.contact" type="text" maxlength="64">
        </label>
      </div>

      <div class="admin-field">
        <span>想参与的方向 <i>DIRECTIONS</i></span>
        <div class="admin-chip-picker">
          <button
            v-for="direction in directions"
            :key="direction.id"
            type="button"
            class="admin-chip"
            :class="{ 'is-active': form.directions.includes(direction.id) }"
            @click="toggleDirection(direction.id)"
          >
            {{ direction.label }}
          </button>
        </div>
      </div>

      <label v-if="hasCustom" class="admin-field">
        <span>自定义方向说明 <i>CUSTOM</i></span>
        <input v-model="form.custom" type="text" maxlength="60" placeholder="报名者自己写的方向">
      </label>

      <label class="admin-field">
        <span>其它信息 <i>NOTE</i></span>
        <textarea v-model="form.note" rows="2" maxlength="500" placeholder="报名者填写的补充内容" />
      </label>

      <label class="admin-field">
        <span>内部备注 <i>ADMIN ONLY</i></span>
        <textarea v-model="form.adminNote" rows="3" maxlength="500" placeholder="跟进情况、面试结论等，只有后台能看到" />
      </label>

      <div class="admin-detail-actions">
        <button type="submit" class="admin-button is-primary" :disabled="!dirty || saving">
          {{ saving ? '保存中…' : dirty ? '保存修改' : '没有改动' }}
        </button>
        <button type="button" class="admin-button" :disabled="!dirty || saving" @click="reset">撤销改动</button>
        <span v-if="dirty" class="admin-dirty-flag">未保存</span>
      </div>
    </form>
  </div>
</template>
