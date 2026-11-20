import { createError } from 'h3'

/**
 * 统一的接口错误构造。
 *
 * h3 正在改变 statusMessage 的语义：非 ASCII 的 statusMessage 会被 sanitize（中文会被丢掉），
 * 所以业务文案统一放 `message`，再复制一份到 `data.message`——这样无论 Nuxt 之后怎么升级，
 * 前端都能稳定拿到中文提示（包括生产环境的 5xx）。
 * statusMessage 只保留标准的英文短语，保证 HTTP 状态行可读、也不会触发 h3 的告警。
 *
 * 前端读取顺序：`error.data.data.message` → `error.data.message` → `error.data.statusMessage`。
 */

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable'
}

export function apiError(statusCode: number, message: string, data: Record<string, unknown> = {}) {
  return createError({
    statusCode,
    statusMessage: STATUS_TEXT[statusCode] ?? 'Error',
    message,
    data: { ...data, message }
  })
}
