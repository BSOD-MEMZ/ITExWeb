<script setup lang="ts">
import { computed, reactive } from 'vue'
import { directions, levels } from '~/data/apply'
import { SIGNUP_STATUSES, SIGNUP_STATUS_META, type SignupDirectionId, type SignupStatus } from '~/types/signup'

/**
 * 后台手工新建一条报名。
 *
 * 场景：纸质表、线下口头报名、老师转来的名单——这些进不了公开报名表，只能由社内补录。
 * 字段校验和公开报名表一致（服务端仍是同一套 `normalizeSignupInput`），
 * 额外多出「初始状态」和「内部备注」两项，因为补录时往往已经知道对方的去向了。
 */

const props = defineProps<{ busy?: boolean }>()

const emit = defineEmits<{
  (event: 'submit', payload: Record<string, unknown>): void
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
  status: SignupStatus
}

const form = reactive<Draft>({
  name: '',
  className: '',
  level: 0,
  directions: [],
  custom: '',
  contact: '',
  note: '',
  adminNote: '',
  status: 'pending'
})

const hasCustom = computed(() => form.directions.includes('custom'))

/** 和 signupStore 的 normalizeSignupInput 保持同一套必填规则，避免提交后才报错。 */
const problem = computed(() => {
  if (!form.name.trim()) return '请填写姓名'
  if (!form.className.trim()) return '请填写班级'
  if (!form.contact.trim()) return '请填写联系方式'
  if (!form.directions.length) return '请至少选择一个想参与的方向'
  if (hasCustom.value && !form.custom.trim()) return '选了自定义方向，请写一句说明'
  return ''
})

function toggleDirection(id: SignupDirectionId) {
  const index = form.directions.indexOf(id)
  if (index >= 0) form.directions.splice(index, 1)
  else form.directions.push(id)
  // 与服务端白名单同序，预览和统计口径才不会因为顺序不同而显得奇怪。
  form.directions.sort((left, right) => directions.findIndex((d) => d.id === left) - directions.findIndex((d) => d.id === right))
}

function submit() {
  if (problem.value || props.busy) return
  emit('submit', {
    name: form.name.trim(),
    className: form.className.trim(),
    level: form.level,
    directions: [...form.directions],
    custom: hasCustom.value ? form.custom.trim() : '',
    contact: form.contact.trim(),
    note: form.note.trim(),
    adminNote: form.adminNote.trim(),
    status: form.status
  })
}
</script>

<template>
  <form class="admin-new" @submit.prevent="submit">
    <div class="admin-detail-grid">
      <label class="admin-field">
        <span>姓名 <i>NAME</i></span>
        <input v-model="form.name" type="text" maxlength="24" placeholder="必填">
      </label>
      <label class="admin-field">
        <span>班级 <i>CLASS</i></span>
        <input v-model="form.className" type="text" maxlength="24" placeholder="如 2601，前两位决定年级">
      </label>
      <label class="admin-field">
        <span>能力自评 <i>LEVEL</i></span>
        <select v-model.number="form.level">
          <option v-for="level in levels" :key="level.value" :value="level.value">{{ level.name }} · {{ level.cn }}</option>
        </select>
      </label>
      <label class="admin-field">
        <span>联系方式 <i>CONTACT</i></span>
        <input v-model="form.contact" type="text" maxlength="64" placeholder="手机号 / QQ / 微信，必填">
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
      <input v-model="form.custom" type="text" maxlength="60" placeholder="对方自己说的方向">
    </label>

    <div class="admin-detail-grid">
      <label class="admin-field">
        <span>初始状态 <i>STATUS</i></span>
        <select v-model="form.status">
          <option v-for="status in SIGNUP_STATUSES" :key="status" :value="status">{{ SIGNUP_STATUS_META[status].label }}</option>
        </select>
      </label>
      <label class="admin-field">
        <span>其它信息 <i>NOTE</i></span>
        <input v-model="form.note" type="text" maxlength="500" placeholder="对方补充说的话（可留空）">
      </label>
    </div>

    <label class="admin-field">
      <span>内部备注 <i>ADMIN ONLY</i></span>
      <textarea v-model="form.adminNote" rows="2" maxlength="500" placeholder="来源、介绍人、跟进情况等，只有后台能看到" />
    </label>

    <div class="admin-detail-actions">
      <button type="submit" class="admin-button is-primary" :disabled="!!problem || busy">
        {{ busy ? '正在新建…' : '新建报名' }}
      </button>
      <button type="button" class="admin-button" :disabled="busy" @click="emit('close')">收起</button>
      <span v-if="problem" class="admin-new-hint">{{ problem }}</span>
      <span v-else class="admin-new-hint is-ok">编号由服务端自动分配，补录不会占用预留段</span>
    </div>
  </form>
</template>
