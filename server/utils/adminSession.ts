import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, getRequestIP, getRequestProtocol, setCookie, type H3Event } from 'h3'

/**
 * 管理后台的会话。
 *
 * - 密码只从服务端环境变量读（NUXT_ADMIN_PASSWORD，映射到 runtimeConfig.adminPassword），
 *   没有配置就当作后台未启用：宁可 503，也不留一个默认密码。
 * - 登录成功下发一个 httpOnly 的签名 cookie，内容是「过期时间.HMAC」，服务端不需要存 session。
 * - 改密码（或改 NUXT_ADMIN_SESSION_SECRET）会让所有旧 cookie 立即失效。
 * - 登录失败按 IP 限流，挡住随手猜密码的脚本。
 */

const COOKIE_NAME = 'itex_admin'
const SESSION_TTL_SECONDS = 8 * 60 * 60
/** 10 分钟内最多错 10 次；超了之后每次再错都锁 60 秒，不至于把共用出口 IP 的人锁死十分钟。 */
const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 10 * 60 * 1000
const LOCK_MS = 60 * 1000

const failures = new Map<string, number[]>()

function settings(event: H3Event) {
  const config = useRuntimeConfig(event)
  return {
    password: String(config.adminPassword ?? '').trim(),
    secret: String(config.adminSessionSecret ?? '').trim()
  }
}

export function isAdminEnabled(event: H3Event) {
  return settings(event).password.length > 0
}

/** 没有单独配密钥时从密码派生，保证「改密码 = 旧会话全部失效」。 */
function signingKey(event: H3Event) {
  const { password, secret } = settings(event)
  return secret || createHash('sha256').update(`itex-admin-session:${password}`).digest('hex')
}

function sign(event: H3Event, expiresAt: number) {
  return createHmac('sha256', signingKey(event)).update(`itex-admin-session:${expiresAt}`).digest('hex')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, 'utf8')
  const b = Buffer.from(right, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyAdminPassword(event: H3Event, input: unknown) {
  const { password } = settings(event)
  if (!password) return false
  // 比较的是摘要，长度恒定，别用 === 直接比密码。
  const provided = createHash('sha256').update(typeof input === 'string' ? input : '').digest('hex')
  const expected = createHash('sha256').update(password).digest('hex')
  return safeEqual(provided, expected)
}

export function startAdminSession(event: H3Event) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  setCookie(event, COOKIE_NAME, `${expiresAt}.${sign(event, expiresAt)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure: getRequestProtocol(event) === 'https'
  })
}

export function endAdminSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function hasAdminSession(event: H3Event) {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return false

  const [rawExpires, signature] = token.split('.')
  const expiresAt = Number(rawExpires)
  if (!signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false

  return safeEqual(signature, sign(event, expiresAt))
}

/** 所有 /api/admin/* 的第一行：未启用、未登录都在这里挡掉。 */
export function requireAdmin(event: H3Event) {
  if (!isAdminEnabled(event)) {
    throw apiError(503, '管理后台未启用：请在服务端配置 NUXT_ADMIN_PASSWORD')
  }
  if (!hasAdminSession(event)) {
    throw apiError(401, '登录已失效，请重新登录')
  }
}

function clientKey(event: H3Event) {
  // 只用来做限流，不落盘也不进日志。这里信任 X-Forwarded-For，方便放在 Nginx / Cloudflare 后面时按真实 IP 计数。
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

function recentFailures(key: string, now: number) {
  const list = (failures.get(key) ?? []).filter((at) => now - at < FAILURE_WINDOW_MS)
  if (list.length) failures.set(key, list)
  else failures.delete(key)
  return list
}

function pruneFailures(now: number) {
  if (failures.size < 500) return
  for (const [key, list] of failures) {
    if (!list.some((at) => now - at < FAILURE_WINDOW_MS)) failures.delete(key)
  }
}

export function assertLoginAllowed(event: H3Event) {
  const now = Date.now()
  const list = recentFailures(clientKey(event), now)
  if (list.length < MAX_FAILURES) return

  // 从最后一次失败算起，冷却期内直接拒绝，避免无成本地连续猜密码。
  const retryAfter = Math.ceil((list[list.length - 1] + LOCK_MS - now) / 1000)
  if (retryAfter > 0) {
    throw apiError(429, `密码错误次数过多，请 ${retryAfter} 秒后再试`, { retryAfter })
  }
}

export function recordLoginFailure(event: H3Event) {
  const now = Date.now()
  const key = clientKey(event)
  const list = recentFailures(key, now)
  list.push(now)
  failures.set(key, list)
  pruneFailures(now)
}

export function clearLoginFailures(event: H3Event) {
  failures.delete(clientKey(event))
}
