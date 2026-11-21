/**
 * 报名数据的唯一一份定义。
 *
 * 报名页（浏览器）、`/api/signup`（服务端）、`/admin`（管理后台）三处都从这里导入，
 * 枚举值不再各写一遍，避免「前端能选、后端不认」这类漂移。
 * 放在 `types/` 而不是 `data/` 是因为它同时被 Nuxt 应用端和 Nitro 服务端引用。
 */

/** 报名方向 ID，必须与 `data/apply.ts` 中 `directions` 的 id 一致。 */
export const SIGNUP_DIRECTION_IDS = ['code', 'hardware', 'media', 'web', 'repair', 'custom', 'unsure'] as const

export type SignupDirectionId = (typeof SIGNUP_DIRECTION_IDS)[number]

/** 能力自评：0 Basic / 1 Advanced / 2 Expert / 3 Master。 */
export const SIGNUP_LEVELS = [0, 1, 2, 3] as const

/** 报名单在管理后台的流转状态。 */
export const SIGNUP_STATUSES = ['pending', 'contacted', 'accepted', 'archived'] as const

export type SignupStatus = (typeof SIGNUP_STATUSES)[number]

export const SIGNUP_STATUS_META: Record<SignupStatus, { label: string; en: string; tone: 'yellow' | 'blue' | 'green' | 'ink' }> = {
  pending: { label: '待处理', en: 'PENDING', tone: 'yellow' },
  contacted: { label: '已联系', en: 'CONTACTED', tone: 'blue' },
  accepted: { label: '已入社', en: 'ACCEPTED', tone: 'green' },
  archived: { label: '已归档', en: 'ARCHIVED', tone: 'ink' }
}

/** 报名页填写的原始字段（服务端校验后的规范形态）。 */
export type SignupInput = {
  name: string
  className: string
  level: number
  directions: SignupDirectionId[]
  custom: string
  contact: string
  note: string
}

/** 落盘的一条报名记录：表单字段 + 编号 + 管理状态。 */
export type SignupRecord = SignupInput & {
  id: string
  createdAt: string
  updatedAt: string
  status: SignupStatus
  /** 社团内部备注，不会展示给报名者。 */
  adminNote: string
}

/** 趋势图的一个点：某个「本地日期」的提交量。 */
export type SignupTrendPoint = { date: string; count: number }

/** 年级分布。`name` 是班级前两位（如 `26` 表示 2026 级）。 */
export type SignupGradeCount = { name: string; count: number }

export type SignupStats = {
  total: number
  pending: number
  contacted: number
  accepted: number
  archived: number
  last7Days: number
  /** 同名同班的记录数（≥2 才算重复，这里统计的是完全重复的条数）。 */
  duplicates: number
  /** 各方向的人数；一人可选多个方向，所以合计可能大于 total。 */
  directions: Record<SignupDirectionId, number>
  /** 下标就是能力等级（0–3），值是该等级的人数。 */
  levels: number[]
  /** 年级分布，按年级从高到低。 */
  grades: SignupGradeCount[]
  /** 最近 14 天（含今天）的提交趋势，按本地日期切分。 */
  trend: SignupTrendPoint[]
}

export type SignupSort = 'newest' | 'oldest' | 'updated' | 'name' | 'level'

export type SignupListQuery = {
  q?: string
  status?: SignupStatus | 'all'
  direction?: SignupDirectionId | 'all'
  level?: number | 'all'
  /** 年级：班级的前两位（如 `26`）。 */
  grade?: string
  /** 本地日期（YYYY-MM-DD），含当天。 */
  from?: string
  to?: string
  /** 只看同名同班的重复报名。 */
  duplicate?: boolean
  /** 客户端时区（分钟，东半球为正），用于把 UTC 时间戳折算成用户眼里的日期。 */
  tz?: number
  sort?: SignupSort
  page?: number
  pageSize?: number
}

export type SignupListResponse = {
  items: SignupRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  stats: SignupStats
  /** 当前页里与别人同名同班的记录编号，界面据此打「疑似重复」标记。 */
  duplicateIds: string[]
}

/** 回收站里的一条：原始记录 + 删除时间。 */
export type SignupTrashEntry = {
  record: SignupRecord
  deletedAt: string
}

export type SignupBulkAction = 'status' | 'delete' | 'restore' | 'purge'

export type SignupBulkResult = {
  ok: true
  action: SignupBulkAction
  changed: number
}

export function isSignupStatus(value: unknown): value is SignupStatus {
  return typeof value === 'string' && (SIGNUP_STATUSES as readonly string[]).includes(value)
}

export function isSignupDirectionId(value: unknown): value is SignupDirectionId {
  return typeof value === 'string' && (SIGNUP_DIRECTION_IDS as readonly string[]).includes(value)
}
