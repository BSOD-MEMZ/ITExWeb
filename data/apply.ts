export const levels = [
  { value: 0, name: 'Basic', cn: '入门', note: '看过教程、跟着做过一点，愿意从零开始。' },
  { value: 1, name: 'Advanced', cn: '进阶', note: '独立完成过小项目，遇到报错会自己查。' },
  { value: 2, name: 'Expert', cn: '熟练', note: '能带别人一起把东西做出来，也讲得清楚。' },
  { value: 3, name: 'Master', cn: '大师', note: '能主导一个方向，也能解决别人卡住的问题。' }
]

export const directions = [
  { id: 'code', label: '软件开发', en: 'CODE', hint: 'Python / C++ / 小工具', tone: 'red' },
  { id: 'hardware', label: '硬件开发', en: 'HARDWARE', hint: '单片机 / 电路 / 3D 打印', tone: 'blue' },
  { id: 'media', label: '音视频创作', en: 'MEDIA', hint: '拍摄 / 剪辑 / 配音', tone: 'yellow' },
  { id: 'web', label: '网页前端', en: 'WEB', hint: 'HTML/CSS / Vue / Nuxt', tone: 'blue' },
  { id: 'repair', label: '设备维护', en: 'REPAIR', hint: '一体机 / 校园电教', tone: 'yellow' },
  { id: 'custom', label: '自定义', en: 'CUSTOM', hint: '说说你想做的事', tone: 'red' },
  { id: 'unsure', label: '还没想好', en: 'UNDECIDED', hint: '先来听听看也行', tone: 'ink' }
] as const

export type DirectionId = (typeof directions)[number]['id']
