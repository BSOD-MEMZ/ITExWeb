import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { directions, levels } from '../../data/apply'
import {
  SIGNUP_DIRECTION_IDS,
  SIGNUP_LEVELS,
  SIGNUP_STATUS_META,
  isSignupDirectionId,
  isSignupStatus,
  type SignupDirectionId,
  type SignupInput,
  type SignupListQuery,
  type SignupListResponse,
  type SignupRecord,
  type SignupSort,
  type SignupStats,
  type SignupStatus
} from '../../types/signup'

/**
 * 报名记录的持久层（服务端唯一读写入口）。
 *
 * 为什么还是 JSON 文件：社团一年的报名量在几十到几百条，单文件足够；
 * 换成数据库只需替换这一层，接口和页面都不用动。
 *
 * 相比最初的实现，这里补上的几件事：
 * 1. 写入是「临时文件 + rename」的原子替换，进程被 kill 也不会留下写了一半的名单；
 * 2. 所有「读 → 改 → 写」都过一个进程内队列，并发提交不会互相覆盖；
 * 3. 文件带 version / updatedAt，旧版（纯数组）读取时补默认字段，下次写入自动升级；
 * 4. 文件损坏时先备份为 signups.corrupt-*.json 再重建，不静默丢数据；
 * 5. 一条记录除了表单字段，还带 status / adminNote / updatedAt，供管理后台使用。
 *
 * 已知边界：队列只在单进程内有效。如果以后用 PM2 cluster 或多实例部署，
 * 需要把这层换成数据库（或加文件锁），否则仍可能丢写。
 */

const FILE_VERSION = 2
const ID_PREFIX = 'ITEX'
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

/** 允许用 ITEX_DATA_DIR 指定数据目录，默认项目根目录下的 .data（已在 .gitignore 中忽略）。 */
const DATA_DIR = (process.env.ITEX_DATA_DIR || '').trim() || join(process.cwd(), '.data')
const DATA_FILE = join(DATA_DIR, 'signups.json')

type StoreFile = {
  version?: number
  updatedAt?: string
  records?: unknown
}

export type SignupPatch = Partial<SignupInput> & {
  status?: SignupStatus
  adminNote?: string
}

// ---------------------------------------------------------------------------
// 进程内串行队列
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve()

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

// ---------------------------------------------------------------------------
// 字段清洗与校验
// ---------------------------------------------------------------------------

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** 备注类字段保留换行，方便管理后台阅读。 */
function multiline(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim().slice(0, max) : ''
}

function pickLevel(value: unknown): number {
  const level = Number(value)
  return Number.isInteger(level) && (SIGNUP_LEVELS as readonly number[]).includes(level) ? level : 0
}

function pickDirections(value: unknown): SignupDirectionId[] {
  const picked = Array.isArray(value) ? value : []
  return SIGNUP_DIRECTION_IDS.filter((id) => picked.includes(id))
}

/**
 * 把请求体（或管理后台的局部修改）整理成规范的报名字段。
 * 传 base 表示局部更新：缺省的字段沿用原记录，但仍然做一次完整校验。
 */
export function normalizeSignupInput(body: unknown, base?: SignupRecord): SignupInput {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const fallback = base as Partial<SignupInput> | undefined
  const has = (key: string) => Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined

  const name = has('name') ? text(source.name, 24) : fallback?.name ?? ''
  const className = has('className') ? text(source.className, 24) : fallback?.className ?? ''
  const contact = has('contact') ? text(source.contact, 64) : fallback?.contact ?? ''
  const custom = has('custom') ? text(source.custom, 60) : fallback?.custom ?? ''
  const note = has('note') ? multiline(source.note, 500) : fallback?.note ?? ''
  const level = has('level') ? pickLevel(source.level) : fallback?.level ?? 0
  const pickedDirections = has('directions') ? pickDirections(source.directions) : fallback?.directions ?? []

  const fail = (field: keyof SignupInput, message: string): never => {
    throw apiError(400, message, { field })
  }

  if (!name) fail('name', '请填写姓名')
  if (!className) fail('className', '请填写班级')
  if (!contact) fail('contact', '请填写联系方式')
  if (!pickedDirections.length) fail('directions', '请至少选择一个想参与的方向')
  if (pickedDirections.includes('custom') && !custom) fail('custom', '选了自定义方向，请写一句说明')

  return {
    name,
    className,
    level,
    directions: [...pickedDirections],
    // 没选「自定义」时不留脏数据。
    custom: pickedDirections.includes('custom') ? custom : '',
    contact,
    note
  }
}

// ---------------------------------------------------------------------------
// 文件读写
// ---------------------------------------------------------------------------

function normalizeStoredRecord(value: unknown): SignupRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = text(raw.id, 40)
  if (!id) return null

  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date(0).toISOString()
  return {
    id,
    name: text(raw.name, 24),
    className: text(raw.className, 24),
    level: pickLevel(raw.level),
    directions: pickDirections(raw.directions),
    custom: text(raw.custom, 60),
    contact: text(raw.contact, 64),
    note: multiline(raw.note, 500),
    // 旧记录的 status / adminNote / updatedAt 在这里补齐，不用手动迁移。
    status: isSignupStatus(raw.status) ? raw.status : 'pending',
    adminNote: multiline(raw.adminNote, 500),
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : createdAt
  }
}

async function quarantineCorruptFile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  try {
    await fs.rename(DATA_FILE, join(DATA_DIR, `signups.corrupt-${stamp}.json`))
  } catch (error) {
    console.error('[signupStore] 备份损坏的报名数据文件失败：', error)
  }
}

async function readStore(): Promise<SignupRecord[]> {
  let raw: string
  try {
    raw = await fs.readFile(DATA_FILE, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return []
    throw error
  }
  if (!raw.trim()) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    await quarantineCorruptFile()
    console.error('[signupStore] signups.json 不是合法 JSON，已备份并重建：', error)
    return []
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as StoreFile)?.records)
      ? ((parsed as StoreFile).records as unknown[])
      : null

  if (!list) {
    await quarantineCorruptFile()
    console.error('[signupStore] signups.json 结构异常（既不是数组也没有 records），已备份并重建。')
    return []
  }

  return list.map(normalizeStoredRecord).filter((record): record is SignupRecord => record !== null)
}

/** Windows 上 rename 可能撞上杀毒软件或另一个读句柄，短暂重试几次。 */
async function replaceFile(tempFile: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(tempFile, DATA_FILE)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      const retriable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!retriable || attempt >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
    }
  }
}

async function writeStore(records: SignupRecord[]) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const payload: StoreFile & { records: SignupRecord[] } = {
    version: FILE_VERSION,
    updatedAt: new Date().toISOString(),
    records
  }
  const tempFile = `${DATA_FILE}.${process.pid}-${Date.now()}.tmp`
  try {
    await fs.writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    await replaceFile(tempFile)
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => undefined)
    throw error
  }
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

function normalizeSort(sort: unknown): SignupSort {
  return sort === 'oldest' || sort === 'name' || sort === 'level' ? sort : 'newest'
}

function sortRecords(records: SignupRecord[], sort: SignupSort): SignupRecord[] {
  const list = [...records]
  if (sort === 'oldest') return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  if (sort === 'level') return list.sort((a, b) => b.level - a.level || b.createdAt.localeCompare(a.createdAt))
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function filterRecords(records: SignupRecord[], query: SignupListQuery): SignupRecord[] {
  const keyword = (query.q ?? '').trim().toLowerCase()
  const status = query.status && query.status !== 'all' ? query.status : ''
  const direction = query.direction && query.direction !== 'all' ? query.direction : ''
  const level = typeof query.level === 'number' ? query.level : null

  return records.filter((record) => {
    if (status && record.status !== status) return false
    if (direction && !record.directions.includes(direction)) return false
    if (level !== null && record.level !== level) return false
    if (!keyword) return true
    return [record.id, record.name, record.className, record.contact, record.note, record.custom, record.adminNote]
      .join('\n')
      .toLowerCase()
      .includes(keyword)
  })
}

function buildStats(records: SignupRecord[]): SignupStats {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  let pending = 0
  let contacted = 0
  let accepted = 0
  let archived = 0
  let last7Days = 0

  for (const record of records) {
    if (record.status === 'pending') pending += 1
    else if (record.status === 'contacted') contacted += 1
    else if (record.status === 'accepted') accepted += 1
    else archived += 1

    const created = Date.parse(record.createdAt)
    if (Number.isFinite(created) && created >= since) last7Days += 1
  }

  return { total: records.length, pending, contacted, accepted, archived, last7Days }
}

function clampPageSize(value: unknown): number {
  const size = Math.trunc(Number(value))
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(size, 5), MAX_PAGE_SIZE)
}

async function snapshot(query: SignupListQuery) {
  const records = await readStore()
  return {
    all: records,
    filtered: sortRecords(filterRecords(records, query), normalizeSort(query.sort))
  }
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/** 把 `/api/admin/*` 的 query string 整理成列表参数（列表与导出两个路由共用）。 */
export function parseSignupListQuery(raw: Record<string, unknown>): SignupListQuery {
  const level = Number(raw.level)
  const sort = raw.sort
  return {
    q: typeof raw.q === 'string' ? raw.q : '',
    // 认不出来的筛选值一律当「全部」，不让手改 URL 的请求 500。
    status: isSignupStatus(raw.status) ? raw.status : 'all',
    direction: isSignupDirectionId(raw.direction) ? raw.direction : 'all',
    level: Number.isInteger(level) && level >= 0 && level <= 3 ? level : 'all',
    sort: sort === 'oldest' || sort === 'name' || sort === 'level' ? sort : 'newest',
    page: Number(raw.page) || 1,
    pageSize: Number(raw.pageSize) || 20
  }
}

export async function createSignup(input: SignupInput): Promise<SignupRecord> {
  return withLock(async () => {
    const records = await readStore()
    const now = new Date()

    // 取已用编号最大值 +1，而不是按条数 +1：删除记录后条数会倒退，
    // 用条数会让新编号和已经发出去的凭证撞号。
    const prefix = `${ID_PREFIX}-${now.getFullYear()}-`
    const maxSequence = records.reduce((max, record) => {
      if (!record.id.startsWith(prefix)) return max
      const sequence = Number.parseInt(record.id.slice(prefix.length), 10)
      return Number.isInteger(sequence) && sequence > max ? sequence : max
    }, 0)

    const record: SignupRecord = {
      ...input,
      id: `${prefix}${String(maxSequence + 1).padStart(4, '0')}`,
      status: 'pending',
      adminNote: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }

    records.push(record)
    await writeStore(records)
    return record
  })
}

export async function listSignups(query: SignupListQuery = {}): Promise<SignupListResponse> {
  const { all, filtered } = await snapshot(query)
  const pageSize = clampPageSize(query.pageSize)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(Math.max(1, Math.trunc(Number(query.page)) || 1), pageCount)

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    stats: buildStats(all)
  }
}

/** 导出用：按同样的筛选与排序取出全部记录（不分页）。 */
export async function collectSignups(query: SignupListQuery = {}): Promise<SignupRecord[]> {
  const { filtered } = await snapshot(query)
  return filtered
}

export async function updateSignup(id: string, patch: SignupPatch): Promise<SignupRecord> {
  return withLock(async () => {
    const records = await readStore()
    const index = records.findIndex((record) => record.id === id)
    if (index < 0) throw apiError(404, '找不到这条报名记录')

    const current = records[index]
    const has = (key: string) => Object.prototype.hasOwnProperty.call(patch, key) && (patch as Record<string, unknown>)[key] !== undefined

    const source: Record<string, unknown> = {}
    for (const key of ['name', 'className', 'level', 'directions', 'custom', 'contact', 'note'] as const) {
      if (has(key)) source[key] = (patch as Record<string, unknown>)[key]
    }

    const input = normalizeSignupInput(source, current)
    const status = has('status') ? patch.status : current.status
    if (!isSignupStatus(status)) throw apiError(400, '未知的报名状态')

    const next: SignupRecord = {
      ...current,
      ...input,
      status,
      adminNote: has('adminNote') ? multiline(patch.adminNote, 500) : current.adminNote,
      updatedAt: new Date().toISOString()
    }

    records[index] = next
    await writeStore(records)
    return next
  })
}

export async function deleteSignup(id: string): Promise<void> {
  return withLock(async () => {
    const records = await readStore()
    const next = records.filter((record) => record.id !== id)
    if (next.length === records.length) throw apiError(404, '找不到这条报名记录')
    await writeStore(next)
  })
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function levelLabel(value: number): string {
  const level = levels.find((item) => item.value === value)
  return level ? `${level.name}（${level.cn}）` : String(value)
}

function directionLabel(id: SignupDirectionId): string {
  return directions.find((item) => item.id === id)?.label ?? id
}

/** Excel 会把 = + - @ 开头的内容当公式执行，这里先加个单引号。 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function signupsToCsv(records: SignupRecord[]): string {
  const header = [
    '编号',
    '姓名',
    '班级',
    '能力自评',
    '想参与的方向',
    '自定义方向',
    '联系方式',
    '其它信息',
    '状态',
    '内部备注',
    '提交时间',
    '更新时间'
  ]

  const rows = records.map((record) => [
    record.id,
    record.name,
    record.className,
    levelLabel(record.level),
    record.directions.map(directionLabel).join(' / '),
    record.custom,
    record.contact,
    record.note,
    `${SIGNUP_STATUS_META[record.status].label}（${record.status}）`,
    record.adminNote,
    record.createdAt,
    record.updatedAt
  ])

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
