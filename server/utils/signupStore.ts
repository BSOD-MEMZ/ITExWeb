import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as Db } from 'better-sqlite3'
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
 * 存储：SQLite（better-sqlite3，同步 API）。选它的理由：
 * - 单文件数据库，不需要额外的常驻服务，2GB 内存的机器上不占资源；
 * - 有事务和约束，多进程 / 多实例部署也不会丢写（WAL + busy_timeout），
 *   这正好补上了原来 JSON 方案「只能在单进程里靠队列串行」的短板；
 * - 服务器上已有 sqlite3 3.46 与 gcc/make/python3，原生模块装得上。
 *
 * 首次启动时会自动把旧的 .data/signups.json 导入（导入后改名存档，不会重复导入）。
 *
 * 数据库文件：<ITEX_DATA_DIR>/signups.db，默认项目根目录下的 .data/（已在 .gitignore 中忽略）。
 */

const ID_PREFIX = 'ITEX'
/**
 * 编号 0000–0020 是预留段（留给社内手工录入 / 特殊凭证），自动编号必须从 0021 起。
 * 每年重新计数，所以 2027 年的第一份自动报名也是 ITEX-2027-0021。
 */
const RESERVED_SEQUENCE_MAX = 20
const FIRST_AUTO_SEQUENCE = RESERVED_SEQUENCE_MAX + 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200
const DB_FILE_NAME = 'signups.db'
const LEGACY_FILE_NAME = 'signups.json'

const DATA_DIR = (process.env.ITEX_DATA_DIR || '').trim() || join(process.cwd(), '.data')
const DB_FILE = join(DATA_DIR, DB_FILE_NAME)

export type SignupPatch = Partial<SignupInput> & {
  status?: SignupStatus
  adminNote?: string
}

// ---------------------------------------------------------------------------
// 连接与建表
// ---------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS signups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  class_name  TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 0,
  -- 方向 id 以逗号连接（如 'code,web'），配 ',<id>,' LIKE 做精确筛选
  directions  TEXT NOT NULL DEFAULT '',
  custom      TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  admin_note  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signups_status ON signups(status);
CREATE INDEX IF NOT EXISTS idx_signups_level ON signups(level);
`

type DbRow = {
  id: string
  name: string
  class_name: string
  level: number
  directions: string
  custom: string
  contact: string
  note: string
  status: string
  admin_note: string
  created_at: string
  updated_at: string
}

/** 放进 globalThis，避免 dev 热重载 / 多个 Nitro worker 反复打开同一个文件。 */
const CACHE_KEY = Symbol.for('itex.signupDb')

type DbCache = { db: Db }

function openDatabase(): Db {
  const cached = (globalThis as unknown as Record<symbol, DbCache | undefined>)[CACHE_KEY]
  if (cached) return cached.db

  mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(DB_FILE)
  // WAL：读写不互相阻塞；busy_timeout 让并发写入自动排队而不是直接报 SQLITE_BUSY。
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  ;(globalThis as unknown as Record<symbol, DbCache>)[CACHE_KEY] = { db }
  return db
}

function getDb(): Db {
  const db = openDatabase()
  ensureLegacyImported(db)
  return db
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
// 行 <-> 对象
// ---------------------------------------------------------------------------

function rowToRecord(row: DbRow): SignupRecord {
  const picked = String(row.directions ?? '')
    .split(',')
    .filter((id): id is SignupDirectionId => isSignupDirectionId(id))
  return {
    id: row.id,
    name: row.name,
    className: row.class_name,
    level: pickLevel(row.level),
    directions: picked,
    custom: row.custom ?? '',
    contact: row.contact,
    note: row.note ?? '',
    // 库里理论上不会有非法值，兜底成 pending，避免后台整页崩掉。
    status: isSignupStatus(row.status) ? row.status : 'pending',
    adminNote: row.admin_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function recordToParams(record: SignupRecord) {
  return {
    id: record.id,
    name: record.name,
    class_name: record.className,
    level: record.level,
    directions: record.directions.join(','),
    custom: record.custom,
    contact: record.contact,
    note: record.note,
    status: record.status,
    admin_note: record.adminNote,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }
}

// ---------------------------------------------------------------------------
// 旧 JSON 数据一次性导入
// ---------------------------------------------------------------------------

let legacyChecked = false

function ensureLegacyImported(db: Db) {
  if (legacyChecked) return
  legacyChecked = true

  const legacyFile = join(DATA_DIR, LEGACY_FILE_NAME)
  if (!existsSync(legacyFile)) return

  const count = (db.prepare('SELECT COUNT(*) AS n FROM signups').get() as { n: number }).n
  if (count > 0) {
    // 库里已经有数据，说明迁移早就做完了，只是旧文件没来得及改名。
    archiveLegacyFile(legacyFile, 'stale')
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(legacyFile, 'utf8'))
  } catch (error) {
    console.error('[signupStore] 旧 signups.json 无法解析，保持原样未导入：', error)
    return
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { records?: unknown })?.records)
      ? ((parsed as { records: unknown[] }).records as unknown[])
      : null

  if (!list) {
    console.error('[signupStore] 旧 signups.json 结构异常，保持原样未导入。')
    return
  }

  const records = list
    .map((item) => normalizeLegacyRecord(item))
    .filter((record): record is SignupRecord => record !== null)

  if (!records.length) {
    console.warn('[signupStore] 旧 signups.json 里没有可用记录。')
    return
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO signups
       (id, name, class_name, level, directions, custom, contact, note, status, admin_note, created_at, updated_at)
     VALUES
       (@id, @name, @class_name, @level, @directions, @custom, @contact, @note, @status, @admin_note, @created_at, @updated_at)`
  )

  const importAll = db.transaction((items: SignupRecord[]) => {
    for (const record of items) insert.run(recordToParams(record))
  })
  importAll(records)

  console.log(`[signupStore] 已从 signups.json 导入 ${records.length} 条报名记录。`)
  archiveLegacyFile(legacyFile, 'imported')
}

function archiveLegacyFile(file: string, reason: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = join(DATA_DIR, `${LEGACY_FILE_NAME}.${reason}-${stamp}`)
  try {
    renameSync(file, target)
    console.log(`[signupStore] 旧数据文件已存档为 ${target}`)
  } catch (error) {
    console.error('[signupStore] 存档旧数据文件失败（不影响运行）：', error)
  }
}

function normalizeLegacyRecord(value: unknown): SignupRecord | null {
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
    status: isSignupStatus(raw.status) ? raw.status : 'pending',
    adminNote: multiline(raw.adminNote, 500),
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : createdAt
  }
}

// ---------------------------------------------------------------------------
// 查询条件
// ---------------------------------------------------------------------------

type Where = { sql: string; params: Record<string, unknown> }

function buildWhere(query: SignupListQuery): Where {
  const clauses: string[] = []
  const params: Record<string, unknown> = {}

  const status = query.status && query.status !== 'all' ? query.status : ''
  if (status) {
    clauses.push('status = @status')
    params.status = status
  }

  const direction = query.direction && query.direction !== 'all' ? query.direction : ''
  if (direction) {
    // 用 ',code,web,' 这种带边界的形式做精确匹配，避免 'code' 命中 'codex'。
    clauses.push("(',' || directions || ',') LIKE @direction")
    params.direction = `%,${direction},%`
  }

  if (typeof query.level === 'number') {
    clauses.push('level = @level')
    params.level = query.level
  }

  const keyword = (query.q ?? '').trim()
  if (keyword) {
    clauses.push(
      `(id LIKE @kw OR name LIKE @kw OR class_name LIKE @kw OR contact LIKE @kw
        OR note LIKE @kw OR custom LIKE @kw OR admin_note LIKE @kw)`
    )
    params.kw = `%${keyword}%`
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

/** SQL 能直接表达的顺序；name 需要拼音排序，交给 JS。 */
const SQL_ORDER: Record<Exclude<SignupSort, 'name'>, string> = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  level: 'level DESC, created_at DESC'
}

function buildStats(db: Db): SignupStats {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) AS contacted,
         SUM(CASE WHEN status = 'accepted'  THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN status = 'archived'  THEN 1 ELSE 0 END) AS archived,
         SUM(CASE WHEN created_at >= @since THEN 1 ELSE 0 END) AS last7Days
       FROM signups`
    )
    .get({ since }) as Record<string, number | null>

  return {
    total: Number(row.total ?? 0),
    pending: Number(row.pending ?? 0),
    contacted: Number(row.contacted ?? 0),
    accepted: Number(row.accepted ?? 0),
    archived: Number(row.archived ?? 0),
    last7Days: Number(row.last7Days ?? 0)
  }
}

function clampPageSize(value: unknown): number {
  const size = Math.trunc(Number(value))
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(size, 5), MAX_PAGE_SIZE)
}

function normalizeSort(sort: unknown): SignupSort {
  return sort === 'oldest' || sort === 'name' || sort === 'level' ? sort : 'newest'
}

/** 取某个筛选条件下的全部记录（导出 / 按姓名排序时用，数据量在几百条量级足够）。 */
function selectAll(db: Db, query: SignupListQuery): SignupRecord[] {
  const where = buildWhere(query)
  const sort = normalizeSort(query.sort)
  const order = sort === 'name' ? 'created_at DESC' : SQL_ORDER[sort]
  const rows = db
    .prepare(`SELECT * FROM signups ${where.sql} ORDER BY ${order}`)
    .all(where.params) as DbRow[]
  const records = rows.map(rowToRecord)
  // localeCompare('zh-Hans-CN') 才有拼音顺序，SQLite 的默认排序对中文没有意义。
  if (sort === 'name') records.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return records
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
  const db = getDb()
  const insert = db.prepare(
    `INSERT INTO signups
       (id, name, class_name, level, directions, custom, contact, note, status, admin_note, created_at, updated_at)
     VALUES
       (@id, @name, @class_name, @level, @directions, @custom, @contact, @note, @status, @admin_note, @created_at, @updated_at)`
  )
  const maxSequence = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(id, @offset) AS INTEGER)), 0) AS m
       FROM signups WHERE id LIKE @prefix || '%'`
  )

  // 编号：取已用最大值 +1，而不是按条数 +1——删记录后条数会倒退，
  // 用条数会让新编号和已经发出去的凭证撞号。
  // 0000–0020 为预留段，自动编号从 0021 起（已存在的预留记录也要算进最大值，避免撞号）。
  const allocate = db.transaction((): SignupRecord => {
    const now = new Date()
    const prefix = `${ID_PREFIX}-${now.getFullYear()}-`
    const { m } = maxSequence.get({ offset: prefix.length + 1, prefix }) as { m: number }
    const nextSequence = Math.max(Number(m) + 1, FIRST_AUTO_SEQUENCE)
    const record: SignupRecord = {
      ...input,
      id: `${prefix}${String(nextSequence).padStart(4, '0')}`,
      status: 'pending',
      adminNote: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    insert.run(recordToParams(record))
    return record
  })

  // 并发下两个请求可能算出同一个编号，PK 冲突时重试即可（事务已回滚，不会留下半条数据）。
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return allocate()
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code !== 'SQLITE_CONSTRAINT_PRIMARYKEY' && code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error
      lastError = error
    }
  }
  throw lastError
}

export async function listSignups(query: SignupListQuery = {}): Promise<SignupListResponse> {
  const db = getDb()
  const pageSize = clampPageSize(query.pageSize)
  const sort = normalizeSort(query.sort)

  // 按姓名排序需要 JS 参与，干脆整份取出后在内存里分页；其余排序交给 SQL。
  if (sort === 'name') {
    const all = selectAll(db, { ...query, sort })
    const pageCount = Math.max(1, Math.ceil(all.length / pageSize))
    const page = Math.min(Math.max(1, Math.trunc(Number(query.page)) || 1), pageCount)
    return {
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
      page,
      pageSize,
      pageCount,
      stats: buildStats(db)
    }
  }

  const where = buildWhere(query)
  const { n: total } = db
    .prepare(`SELECT COUNT(*) AS n FROM signups ${where.sql}`)
    .get(where.params) as { n: number }
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Math.trunc(Number(query.page)) || 1), pageCount)

  const rows = db
    .prepare(`SELECT * FROM signups ${where.sql} ORDER BY ${SQL_ORDER[sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...where.params, limit: pageSize, offset: (page - 1) * pageSize }) as DbRow[]

  return {
    items: rows.map(rowToRecord),
    total,
    page,
    pageSize,
    pageCount,
    stats: buildStats(db)
  }
}

/** 导出用：按同样的筛选与排序取出全部记录（不分页）。 */
export async function collectSignups(query: SignupListQuery = {}): Promise<SignupRecord[]> {
  return selectAll(getDb(), query)
}

export async function updateSignup(id: string, patch: SignupPatch): Promise<SignupRecord> {
  const db = getDb()
  const current = db.prepare('SELECT * FROM signups WHERE id = ?').get(id) as DbRow | undefined
  if (!current) throw apiError(404, '找不到这条报名记录')

  const existing = rowToRecord(current)
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(patch, key) && (patch as Record<string, unknown>)[key] !== undefined

  const source: Record<string, unknown> = {}
  for (const key of ['name', 'className', 'level', 'directions', 'custom', 'contact', 'note'] as const) {
    if (has(key)) source[key] = (patch as Record<string, unknown>)[key]
  }

  const input = normalizeSignupInput(source, existing)
  const status = has('status') ? patch.status : existing.status
  if (!isSignupStatus(status)) throw apiError(400, '未知的报名状态')

  const next: SignupRecord = {
    ...existing,
    ...input,
    status,
    adminNote: has('adminNote') ? multiline(patch.adminNote, 500) : existing.adminNote,
    updatedAt: new Date().toISOString()
  }

  db.prepare(
    `UPDATE signups SET
       name = @name, class_name = @class_name, level = @level, directions = @directions,
       custom = @custom, contact = @contact, note = @note, status = @status,
       admin_note = @admin_note, updated_at = @updated_at
     WHERE id = @id`
  ).run(recordToParams(next))

  return next
}

export async function deleteSignup(id: string): Promise<void> {
  const result = getDb().prepare('DELETE FROM signups WHERE id = ?').run(id)
  if (result.changes === 0) throw apiError(404, '找不到这条报名记录')
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
