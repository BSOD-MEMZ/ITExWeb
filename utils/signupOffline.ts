import type { SignupInput } from '~/types/signup'

/**
 * 报名提交的「本机待补交」队列。
 *
 * 站点如果部署在没有服务端的静态托管，或者展台机器临时断网，`/api/signup` 是拿不到的。
 * 原实现只编一个 LOCAL 编号给同学看，数据其实没有落在任何地方；这里先写进 localStorage，
 * 下次打开报名页时自动重试补交，补交成功才从队列里删掉。
 */

const STORAGE_KEY = 'itex:signup:pending'
const MAX_ENTRIES = 30

export type PendingSignup = SignupInput & {
  localId: string
  createdAt: string
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Safari 隐私模式等场景下访问 localStorage 会直接抛错。
    return null
  }
}

function isPendingSignup(value: unknown): value is PendingSignup {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.localId === 'string' && typeof entry.name === 'string' && Array.isArray(entry.directions)
}

export function readPendingSignups(): PendingSignup[] {
  const store = storage()
  if (!store) return []
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPendingSignup) : []
  } catch {
    return []
  }
}

function writePendingSignups(entries: PendingSignup[]) {
  const store = storage()
  if (!store) return
  try {
    if (!entries.length) store.removeItem(STORAGE_KEY)
    else store.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // 配额满或被禁用时忽略：至少不影响已经提交成功的那份。
  }
}

/** 把一份没送出去的报名存到本机，返回带 LOCAL 编号的凭证内容。 */
export function queuePendingSignup(input: SignupInput): PendingSignup {
  const entry: PendingSignup = {
    ...input,
    localId: `ITEX-${new Date().getFullYear()}-L${Date.now().toString(36).slice(-4).toUpperCase()}`,
    createdAt: new Date().toISOString()
  }
  writePendingSignups([...readPendingSignups(), entry])
  return entry
}

/** 逐条补交：成功的从队列里删掉，失败的留着等下一次打开页面。 */
export async function flushPendingSignups(
  send: (payload: SignupInput) => Promise<unknown>
): Promise<{ synced: number; remaining: number }> {
  const entries = readPendingSignups()
  if (!entries.length) return { synced: 0, remaining: 0 }

  const rest: PendingSignup[] = []
  let synced = 0

  for (const entry of entries) {
    const payload: SignupInput = {
      name: entry.name,
      className: entry.className,
      level: entry.level,
      directions: entry.directions,
      custom: entry.custom,
      contact: entry.contact,
      note: entry.note
    }
    try {
      await send(payload)
      synced += 1
    } catch {
      rest.push(entry)
    }
  }

  writePendingSignups(rest)
  return { synced, remaining: rest.length }
}
