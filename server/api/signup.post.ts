import { promises as fs } from 'node:fs'
import { join } from 'node:path'

type Payload = {
  name?: unknown
  className?: unknown
  level?: unknown
  directions?: unknown
  custom?: unknown
  contact?: unknown
  note?: unknown
}

type SignupRecord = {
  id: string
  name: string
  className: string
  level: number
  directions: string[]
  custom: string
  contact: string
  note: string
  createdAt: string
}

const DIRECTION_IDS = ['code', 'hardware', 'media', 'web', 'repair', 'custom', 'unsure']
const DATA_DIR = join(process.cwd(), '.data')
const DATA_FILE = join(DATA_DIR, 'signups.json')

// 串行化写入，避免并发请求互相覆盖同一个 JSON 文件。
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

async function readAll(): Promise<SignupRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SignupRecord[]) : []
  } catch {
    return []
  }
}

async function writeAll(records: SignupRecord[]) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), 'utf8')
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Payload>(event).catch(() => ({}) as Payload)

  const name = text(body.name, 24)
  const className = text(body.className, 24)
  const contact = text(body.contact, 64)
  const note = text(body.note, 500)
  const custom = text(body.custom, 60)

  const rawLevel = Number(body.level)
  const level = Number.isInteger(rawLevel) && rawLevel >= 0 && rawLevel <= 3 ? rawLevel : 0

  const picked = Array.isArray(body.directions) ? body.directions : []
  const pickedDirections = DIRECTION_IDS.filter((id) => picked.includes(id))

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '请填写姓名' })
  }
  if (!className) {
    throw createError({ statusCode: 400, statusMessage: '请填写班级' })
  }
  if (!contact) {
    throw createError({ statusCode: 400, statusMessage: '请填写联系方式' })
  }
  if (!pickedDirections.length) {
    throw createError({ statusCode: 400, statusMessage: '请至少选择一个想参与的方向' })
  }
  if (pickedDirections.includes('custom') && !custom) {
    throw createError({ statusCode: 400, statusMessage: '选了自定义方向，请写一句说明' })
  }

  const record = await enqueue(async () => {
    const records = await readAll()
    const year = new Date().getFullYear()
    const prefix = `ITEX-${year}-`
    const sequence = records.filter((item) => item.id.startsWith(prefix)).length + 1

    const entry: SignupRecord = {
      id: `${prefix}${String(sequence).padStart(4, '0')}`,
      name,
      className,
      level,
      directions: pickedDirections,
      custom: pickedDirections.includes('custom') ? custom : '',
      contact,
      note,
      createdAt: new Date().toISOString()
    }

    records.push(entry)
    await writeAll(records)
    return entry
  })

  return { ok: true, id: record.id, createdAt: record.createdAt }
})
