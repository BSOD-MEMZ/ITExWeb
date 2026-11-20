import type { SignupDirectionId } from '~/types/signup'

export const levels = [
  { value: 0, name: 'Basic', cn: '基础', note: '愿意从零开始。' },
  { value: 1, name: 'Advanced', cn: '高级', note: '独立完成过小项目。' },
  { value: 2, name: 'Expert', cn: '专家', note: '能和别人一起把东西做出来。' },
  { value: 3, name: 'Master', cn: '大师', note: '能主导一个方向，解决别人卡住的问题。' }
]

// id 必须落在 SIGNUP_DIRECTION_IDS 里：服务端用它做白名单校验，管理后台用它做筛选。
export type Direction = {
  id: SignupDirectionId
  label: string
  en: string
  hint: string
  tone: 'red' | 'blue' | 'yellow' | 'ink'
}

export const directions: readonly Direction[] = [
  { id: 'code', label: '软件开发', en: 'CODE', hint: 'Python / C++ / 小工具', tone: 'red' },
  { id: 'hardware', label: '硬件开发', en: 'HARDWARE', hint: 'STM32 / ESP32 / 树莓派', tone: 'blue' },
  { id: 'media', label: '音频创作', en: 'MEDIA', hint: '作曲 / 编曲 / VOCALOID', tone: 'yellow' },
  { id: 'web', label: '网页前端', en: 'WEB', hint: 'HTML/CSS / Vue / Nuxt', tone: 'blue' },
  { id: 'repair', label: '设备维护', en: 'REPAIR', hint: '一体机 / 校园电教', tone: 'yellow' },
  { id: 'custom', label: '自定义', en: 'CUSTOM', hint: '说说你想做的事', tone: 'red' },
  { id: 'unsure', label: '还没想好', en: 'UNDECIDED', hint: '先来听听看也行', tone: 'ink' }
]

export type DirectionId = SignupDirectionId
