import type { Ref } from 'vue'

/**
 * 管理后台两个页面（统计 / 名单）共用的状态与工具函数。
 *
 * 为什么用 `useState` 而不是模块级 ref：后台会话是敏感状态，模块级 ref 在服务端
 * 是**跨请求共享**的，一个管理员登录后同进程里的所有访客都会拿到已登录状态。
 * `useState` 在服务端是按请求隔离的，客户端导航时又能保持同一份。
 */

/** 提示条停留时长（毫秒）。 */
const TOAST_MS = 3000

/**
 * 提示条的计时器。只有浏览器的点击处理会走到这里，所以放模块作用域够用；
 * 服务端渲染期间不会创建定时器。
 */
let toastTimer: ReturnType<typeof setTimeout> | null = null

export type AdminToast = { text: string; tone: 'ok' | 'err' }

// ---------------------------------------------------------------------------
// 会话
// ---------------------------------------------------------------------------

export type AdminSession = {
  checking: Ref<boolean>
  enabled: Ref<boolean>
  authed: Ref<boolean>
  loginError: Ref<string>
  loggingIn: Ref<boolean>
  loadSession: () => Promise<void>
  login: (secret: string) => Promise<boolean>
  logout: () => Promise<void>
}

export function useAdminSession(): AdminSession {
  const checking = useState('admin.checking', () => true)
  const enabled = useState('admin.enabled', () => true)
  const authed = useState('admin.authed', () => false)
  const loginError = useState('admin.loginError', () => '')
  const loggingIn = useState('admin.loggingIn', () => false)

  async function loadSession() {
    checking.value = true
    try {
      const result = await $fetch<{ enabled: boolean; authenticated: boolean }>('/api/admin/session')
      enabled.value = result.enabled
      authed.value = result.authenticated
    } catch {
      // 连不上服务端时按「停用 + 未登录」处理，界面会停在登录页而不是空白。
      enabled.value = true
      authed.value = false
    } finally {
      checking.value = false
    }
  }

  async function login(secret: string): Promise<boolean> {
    if (loggingIn.value || !secret) return false
    loginError.value = ''
    loggingIn.value = true
    try {
      await $fetch('/api/admin/login', { method: 'POST', body: { password: secret } })
      authed.value = true
      return true
    } catch (error) {
      loginError.value = adminErrorMessage(error)
      return false
    } finally {
      loggingIn.value = false
    }
  }

  async function logout() {
    try {
      await $fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // 退出失败也把界面切回登录态：cookie 过期后服务端本来就不认了。
    }
    authed.value = false
    loginError.value = ''
  }

  return { checking, enabled, authed, loginError, loggingIn, loadSession, login, logout }
}

// ---------------------------------------------------------------------------
// 提示条
// ---------------------------------------------------------------------------

export function useAdminToast() {
  const toast = useState<AdminToast | null>('admin.toast', () => null)

  function say(text: string, tone: 'ok' | 'err' = 'ok') {
    toast.value = { text, tone }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
      toastTimer = null
    }, TOAST_MS)
  }

  return { toast, say }
}

// ---------------------------------------------------------------------------
// 错误信息
// ---------------------------------------------------------------------------

type ApiError = {
  statusCode?: number
  message?: string
  data?: { statusCode?: number; statusMessage?: string; message?: string; data?: { message?: string } }
}

export function adminErrorStatus(error: unknown): number {
  const err = error as ApiError
  return err?.statusCode ?? err?.data?.statusCode ?? 0
}

/** 业务文案优先，其次是 h3 的默认 message；statusMessage 只作为旧版本的兜底。 */
export function adminErrorMessage(error: unknown): string {
  const err = error as ApiError
  return err?.data?.data?.message || err?.data?.message || err?.data?.statusMessage || err?.message || '请求失败，请稍后再试'
}

// ---------------------------------------------------------------------------
// 时间与日期
// ---------------------------------------------------------------------------

/**
 * 浏览器时区偏移（分钟，东八区 = 480）。
 * 服务端据此把 UTC 时间戳折算成用户眼里的「本地日历日」，统计和日期筛选才对得上。
 */
export function adminTzOffset(): number {
  return -new Date().getTimezoneOffset()
}

export function adminFormatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
