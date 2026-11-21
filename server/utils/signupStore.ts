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
  type SignupStatus,
  type SignupTrashEntry
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
/** 删除先落回收站，30 天后才真正消失，误删有救。 */
const TRASH_RETENTION_DAYS = 30
/** 一次批量操作最多处理多少条，防止手滑全选后一个请求改掉整库。 */
const MAX_BULK_IDS = 500
/** 趋势图看最近多少天。 */
const TREND_DAYS = 14
/** 默认按东八区切分日期（没有客户端时区信息时的兜底）。 */
const DEFAULT_TZ_OFFSET = 480

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
CREATE INDEX IF NOT EXISTS idx_signups_name ON signups(name, class_name);

-- 回收站：整条记录以 JSON 存着，恢复时原样塞回 signups，不需要跟着改主表结构。
CREATE TABLE IF NOT EXISTS signup_trash (
  id          TEXT PRIMARY KEY,
  payload     TEXT NOT NULL,
  deleted_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_trash_deleted_at ON signup_trash(deleted_at DESC);

-- 每年一个编号计数器。只增不减：删掉最大号之后再报名也不会复用这个号，
-- 否则发出去的凭证会和后台里的新记录撞号（回收站里的同号记录也就永远恢复不了）。
CREATE TABLE IF NOT EXISTS signup_counters (
  year          TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL
);
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

const INSERT_SQL = `INSERT OR IGNORE INTO signups
   (id, name, class_name, level, directions, custom, contact, note, status, admin_note, created_at, updated_at)
 VALUES
   (@id, @name, @class_name, @level, @directions, @custom, @contact, @note, @status, @admin_note, @created_at, @updated_at)`

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

  const insert = db.prepare(INSERT_SQL)
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
// 时区辅助：库里全是 UTC ISO 字符串，日期筛选与趋势图按使用者本地日历切分
// ---------------------------------------------------------------------------

function tzOffsetOf(value: unknown): number {
  const offset = Number(value)
  // 只接受 ±14 小时以内的偏移，乱传的值当东八区处理。
  if (!Number.isFinite(offset) || Math.abs(offset) > 14 * 60) return DEFAULT_TZ_OFFSET
  return Math.trunc(offset)
}

/** 把 UTC 时间戳折算成该时区下的 YYYY-MM-DD。 */
function dayKey(iso: string, offsetMinutes: number): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return new Date(time + offsetMinutes * 60 * 1000).toISOString().slice(0, 10)
}

/** 本地日期 → 该日期 0 点的 UTC 瞬间。 */
function dayStartUtc(day: string, offsetMinutes: number): number {
  const [year, month, date] = day.split('-').map((part) => Number(part))
  return Date.UTC(year, month - 1, date) - offsetMinutes * 60 * 1000
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function normalizeDay(value: unknown): string {
  const day = typeof value === 'string' ? value.trim() : ''
  const matched = DAY_PATTERN.exec(day)
  if (!matched) return ''
  const [, year, month, date] = matched
  const time = Date.UTC(Number(year), Number(month) - 1, Number(date))
  // 2026-02-31 能过正则但不是真日期，用回读比对挡掉。
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== day ? '' : day
}

const GRADE_PATTERN = /^\d{2}$/

/**
 * 年级 = 班级的前两位（`2601` → `26`，`2026级3班` 这种取不到就当空）。
 * 统一在服务端算，避免筛选、统计、导出的口径不一致。
 */
export function gradeOf(className: string): string {
  const matched = /^(\d{2})/.exec(String(className ?? '').trim())
  return matched ? matched[1] : ''
}

function normalizeGrade(value: unknown): string {
  const grade = typeof value === 'string' ? value.trim() : ''
  return GRADE_PATTERN.test(grade) ? grade : ''
}

// ---------------------------------------------------------------------------
// 查询条件
// ---------------------------------------------------------------------------

type Where = { sql: string; params: Record<string, unknown> }

/** 同名同班出现多次的组合——管理后台用来提示「可能重复报名」。 */
const DUPLICATE_KEYS_SQL = `SELECT name, class_name FROM signups GROUP BY name, class_name HAVING COUNT(*) > 1`

function buildWhere(query: SignupListQuery): Where {
  const clauses: string[] = []
  const params: Record<string, unknown> = {}
  const offset = tzOffsetOf(query.tz)

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

  if (query.grade) {
    // 年级是班级的前两位，用 SUBSTR 取前两位再比较，和 gradeOf() 的口径一致。
    clauses.push('SUBSTR(class_name, 1, 2) = @grade')
    params.grade = query.grade
  }

  // 日期范围：把本地日历日换算成 UTC 边界再比较，字符串比较即可命中 created_at 索引。
  const from = normalizeDay(query.from)
  if (from) {
    clauses.push('created_at >= @from')
    params.from = new Date(dayStartUtc(from, offset)).toISOString()
  }
  const to = normalizeDay(query.to)
  if (to) {
    clauses.push('created_at < @to')
    params.to = new Date(dayStartUtc(to, offset) + 24 * 60 * 60 * 1000).toISOString()
  }

  if (query.duplicate) {
    clauses.push('(name, class_name) IN (' + DUPLICATE_KEYS_SQL + ')')
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
  updated: 'updated_at DESC',
  level: 'level DESC, created_at DESC'
}

function countBy(db: Db, sql: string, params?: Record<string, unknown>): number {
  const row = db.prepare(sql).get(params ?? {}) as { n: number | null } | undefined
  return Number(row?.n ?? 0)
}

function buildStats(db: Db, offsetMinutes: number): SignupStats {
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

  // 方向分布：一人可选多个，逐行数出来（几百条量级，比拆字符串到 SQL 里干净）。
  const directionCounts = Object.fromEntries(SIGNUP_DIRECTION_IDS.map((id) => [id, 0])) as Record<SignupDirectionId, number>
  for (const item of db.prepare('SELECT directions FROM signups').all() as { directions: string }[]) {
    for (const id of String(item.directions ?? '').split(',')) {
      if (isSignupDirectionId(id)) directionCounts[id] += 1
    }
  }

  const levelCounts = SIGNUP_LEVELS.map(() => 0)
  for (const item of db.prepare('SELECT level, COUNT(*) AS n FROM signups GROUP BY level').all() as { level: number; n: number }[]) {
    const level = pickLevel(item.level)
    levelCounts[level] += Number(item.n)
  }

  // 年级分布：班级前两位。班级本身格式不统一（有 2610 也有 26-01），
  // 所以取前两位后在 JS 里聚，保证和筛选用的 gradeOf() 完全同一口径。
  const gradeTally = new Map<string, number>()
  for (const item of db.prepare('SELECT class_name FROM signups').all() as { class_name: string }[]) {
    const grade = gradeOf(item.class_name)
    if (!grade) continue
    gradeTally.set(grade, (gradeTally.get(grade) ?? 0) + 1)
  }
  const grades = [...gradeTally.entries()]
    .map(([name, count]) => ({ name, count }))
    // 年级从高到低（28 届比 26 届高），同人数时按年级排。
    .sort((left, right) => right.name.localeCompare(left.name))

  // 涉及重复报名的记录总条数（同一条只算一次），0 表示没有可疑提交。
  const duplicates = countBy(
    db,
    `SELECT COALESCE(SUM(n), 0) AS n FROM (
       SELECT COUNT(*) AS n FROM signups GROUP BY name, class_name HAVING COUNT(*) > 1
     )`
  )

  // 趋势：先按本地日期把窗口内的提交分桶，再补零成连续的 14 天。
  const trend: { date: string; count: number }[] = []
  const today = dayKey(new Date().toISOString(), offsetMinutes)
  const startUtc = new Date(dayStartUtc(today, offsetMinutes) - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString()
  const buckets = new Map<string, number>()
  for (const item of db.prepare('SELECT created_at FROM signups WHERE created_at >= @start').all({ start: startUtc }) as {
    created_at: string
  }[]) {
    const key = dayKey(item.created_at, offsetMinutes)
    if (key) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  for (let index = TREND_DAYS - 1; index >= 0; index -= 1) {
    const key = dayKey(new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(), offsetMinutes)
    trend.push({ date: key, count: buckets.get(key) ?? 0 })
  }

  return {
    total: Number(row.total ?? 0),
    pending: Number(row.pending ?? 0),
    contacted: Number(row.contacted ?? 0),
    accepted: Number(row.accepted ?? 0),
    archived: Number(row.archived ?? 0),
    last7Days: Number(row.last7Days ?? 0),
    duplicates,
    directions: directionCounts,
    levels: levelCounts,
    grades,
    trend
  }
}

function clampPageSize(value: unknown): number {
  const size = Math.trunc(Number(value))
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(size, 5), MAX_PAGE_SIZE)
}

function normalizeSort(sort: unknown): SignupSort {
  return sort === 'oldest' || sort === 'name' || sort === 'level' || sort === 'updated' ? sort : 'newest'
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
  const flag = (value: unknown) => value === true || value === '1' || value === 'true'
  return {
    q: typeof raw.q === 'string' ? raw.q : '',
    // 认不出来的筛选值一律当「全部」，不让手改 URL 的请求 500。
    status: isSignupStatus(raw.status) ? raw.status : 'all',
    direction: isSignupDirectionId(raw.direction) ? raw.direction : 'all',
    level: Number.isInteger(level) && level >= 0 && level <= 3 ? level : 'all',
    grade: normalizeGrade(raw.grade),
    from: normalizeDay(raw.from),
    to: normalizeDay(raw.to),
    duplicate: flag(raw.duplicate),
    tz: tzOffsetOf(raw.tz),
    sort: normalizeSort(sort),
    page: Number(raw.page) || 1,
    pageSize: Number(raw.pageSize) || 20
  }
}

export async function createSignup(input: SignupInput): Promise<SignupRecord> {
  const db = getDb()
  const insert = db.prepare(INSERT_SQL)

  // 编号分配：
  // 1. 计数器只增不减（见 signup_counters 注释），删记录不会让号被复用；
  // 2. 计数器落后于实际数据时（比如手工往库里塞过预留号），取「已用最大值 +1」兜底；
  // 3. 下限是 0021，给预留段 0000–0020 让路。
  const usedMax = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(id, @offset) AS INTEGER)), 0) AS m
       FROM signups WHERE id LIKE @prefix || '%'`
  )
  const readCounter = db.prepare('SELECT last_sequence FROM signup_counters WHERE year = ?')
  const writeCounter = db.prepare(
    `INSERT INTO signup_counters (year, last_sequence) VALUES (@year, @sequence)
     ON CONFLICT(year) DO UPDATE SET last_sequence = excluded.last_sequence`
  )

  const allocate = db.transaction((): SignupRecord => {
    const now = new Date()
    const year = String(now.getFullYear())
    const prefix = `${ID_PREFIX}-${year}-`

    const { m } = usedMax.get({ offset: prefix.length + 1, prefix }) as { m: number }
    const counter = (readCounter.get(year) as { last_sequence: number } | undefined)?.last_sequence ?? 0
    const nextSequence = Math.max(Number(m) + 1, Number(counter) + 1, FIRST_AUTO_SEQUENCE)

    writeCounter.run({ year, sequence: nextSequence })
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

/**
 * 当前页里哪些记录与别人同名同班（用来在表格里打「疑似重复」标记）。
 * 用一句 GROUP BY 取全库的重复组合再和本页求交集，比逐条 COUNT 更省事。
 */
function duplicateIdSet(db: Db, records: SignupRecord[]): Set<string> {
  if (!records.length) return new Set()
  const duplicated = new Set(
    (
      db
        .prepare('SELECT name, class_name FROM signups GROUP BY name, class_name HAVING COUNT(*) > 1')
        .all() as { name: string; class_name: string }[]
    ).map((row) => `${row.name}\u0000${row.class_name}`)
  )
  const ids = new Set<string>()
  for (const record of records) {
    if (duplicated.has(`${record.name}\u0000${record.className}`)) ids.add(record.id)
  }
  return ids
}

export async function listSignups(query: SignupListQuery = {}): Promise<SignupListResponse> {
  const db = getDb()
  // 顺手清掉回收站里过期的记录：后台一打开名单就会走到这里，不需要额外定时任务。
  purgeExpiredTrash(db)
  const pageSize = clampPageSize(query.pageSize)
  const sort = normalizeSort(query.sort)
  const offset = tzOffsetOf(query.tz)

  // 按姓名排序需要 JS 参与，干脆整份取出后在内存里分页；其余排序交给 SQL。
  if (sort === 'name') {
    const all = selectAll(db, { ...query, sort })
    const pageCount = Math.max(1, Math.ceil(all.length / pageSize))
    const page = Math.min(Math.max(1, Math.trunc(Number(query.page)) || 1), pageCount)
    const items = all.slice((page - 1) * pageSize, page * pageSize)
    return {
      items,
      total: all.length,
      page,
      pageSize,
      pageCount,
      stats: buildStats(db, offset),
      duplicateIds: [...duplicateIdSet(db, items)]
    }
  }

  const where = buildWhere(query)
  const total = countBy(db, `SELECT COUNT(*) AS n FROM signups ${where.sql}`, where.params)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Math.trunc(Number(query.page)) || 1), pageCount)

  const rows = db
    .prepare(`SELECT * FROM signups ${where.sql} ORDER BY ${SQL_ORDER[sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...where.params, limit: pageSize, offset: (page - 1) * pageSize }) as DbRow[]
  const items = rows.map(rowToRecord)

  return {
    items,
    total,
    page,
    pageSize,
    pageCount,
    stats: buildStats(db, offset),
    duplicateIds: [...duplicateIdSet(db, items)]
  }
}

/** 导出用：按同样的筛选与排序取出全部记录（不分页）。 */
export async function collectSignups(query: SignupListQuery = {}): Promise<SignupRecord[]> {
  return selectAll(getDb(), query)
}

export async function updateSignup(id: string, patch: SignupPatch): Promise<SignupRecord> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM signups WHERE id = ?').get(id) as DbRow | undefined
  if (!row) throw apiError(404, '找不到这条报名记录')

  const existing = rowToRecord(row)
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

// ---------------------------------------------------------------------------
// 批量操作
// ---------------------------------------------------------------------------

function cleanIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : []
  const ids = [...new Set(list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
  if (!ids.length) throw apiError(400, '请先选择报名记录')
  if (ids.length > MAX_BULK_IDS) throw apiError(400, `一次最多处理 ${MAX_BULK_IDS} 条，请分批操作`)
  return ids
}

/** 批量改状态：只动状态和更新时间，不碰报名者填写的内容。 */
export async function bulkUpdateStatus(value: unknown, status: unknown): Promise<number> {
  if (!isSignupStatus(status)) throw apiError(400, '未知的报名状态')
  const ids = cleanIds(value)
  const placeholders = ids.map(() => '?').join(', ')
  const result = getDb()
    .prepare(`UPDATE signups SET status = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .run(status, new Date().toISOString(), ...ids)
  return result.changes
}

/** 软删除：整条记录进回收站，30 天内可以恢复。 */
export async function deleteSignup(id: string): Promise<void> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM signups WHERE id = ?').get(id) as DbRow | undefined
  if (!row) throw apiError(404, '找不到这条报名记录')
  moveToTrash(db, [rowToRecord(row)])
}

export async function bulkDeleteSignup(value: unknown): Promise<number> {
  const ids = cleanIds(value)
  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT * FROM signups WHERE id IN (${placeholders})`).all(...ids) as DbRow[]
  if (!rows.length) throw apiError(404, '选中的报名记录都不存在了，请刷新后重试')
  moveToTrash(db, rows.map(rowToRecord))
  return rows.length
}

function moveToTrash(db: Db, records: SignupRecord[]) {
  const stampTrash = db.prepare('INSERT OR REPLACE INTO signup_trash (id, payload, deleted_at) VALUES (?, ?, ?)')
  const remove = db.prepare('DELETE FROM signups WHERE id = ?')
  const deletedAt = new Date().toISOString()
  db.transaction((items: SignupRecord[]) => {
    for (const record of items) {
      stampTrash.run(record.id, JSON.stringify(record), deletedAt)
      remove.run(record.id)
    }
  })(records)
}

export async function listTrash(): Promise<SignupTrashEntry[]> {
  const db = getDb()
  purgeExpiredTrash(db)
  const rows = db.prepare('SELECT id, payload, deleted_at FROM signup_trash ORDER BY deleted_at DESC').all() as {
    id: string
    payload: string
    deleted_at: string
  }[]
  const entries: SignupTrashEntry[] = []
  for (const row of rows) {
    try {
      const record = normalizeLegacyRecord(JSON.parse(row.payload))
      if (record) entries.push({ record, deletedAt: row.deleted_at })
    } catch {
      // 单条坏了不影响整个回收站能打开。
      console.error('[signupStore] 回收站记录无法解析，已跳过：', row.id)
    }
  }
  return entries
}

/** 恢复：把记录原样塞回主表（编号被新记录占了就跳过，避免覆盖别人）。 */
export async function restoreSignups(value: unknown): Promise<number> {
  const ids = cleanIds(value)
  const db = getDb()
  const insert = db.prepare(INSERT_SQL)
  const read = db.prepare('SELECT payload FROM signup_trash WHERE id = ?')
  const remove = db.prepare('DELETE FROM signup_trash WHERE id = ?')

  const restore = db.transaction((targets: string[]): number => {
    let restored = 0
    for (const id of targets) {
      const row = read.get(id) as { payload: string } | undefined
      if (!row) continue
      let record: SignupRecord | null = null
      try {
        record = normalizeLegacyRecord(JSON.parse(row.payload))
      } catch {
        record = null
      }
      // 记录内容已经坏了就留在回收站里，让维护者自己判断。
      if (!record) continue
      const result = insert.run(recordToParams(record))
      if (result.changes > 0) {
        remove.run(id)
        restored += 1
      }
    }
    return restored
  })

  const restored = restore(ids)
  if (!restored) throw apiError(409, '恢复失败：编号可能已经被新报名占用，请先处理和它冲突的记录')
  return restored
}

/** 彻底删除：只对回收站里的记录生效。 */
export async function purgeTrash(value: unknown): Promise<number> {
  const db = getDb()
  if (value === 'all') return db.prepare('DELETE FROM signup_trash').run().changes
  const ids = cleanIds(value)
  const placeholders = ids.map(() => '?').join(', ')
  return db.prepare(`DELETE FROM signup_trash WHERE id IN (${placeholders})`).run(...ids).changes
}

function purgeExpiredTrash(db: Db) {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  try {
    const result = db.prepare('DELETE FROM signup_trash WHERE deleted_at < ?').run(cutoff)
    if (result.changes > 0) console.log(`[signupStore] 回收站清理了 ${result.changes} 条超过 ${TRASH_RETENTION_DAYS} 天的记录。`)
  } catch (error) {
    console.error('[signupStore] 回收站清理失败（不影响运行）：', error)
  }
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
    '年级',
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
    gradeOf(record.className),
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
