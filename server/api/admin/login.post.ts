import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')

  if (!isAdminEnabled(event)) {
    throw createError({ statusCode: 503, statusMessage: '管理后台未启用：请在服务端配置 NUXT_ADMIN_PASSWORD' })
  }

  assertLoginAllowed(event)

  const body = (await readBody<{ password?: unknown }>(event).catch(() => null)) ?? {}
  if (!verifyAdminPassword(event, body.password)) {
    recordLoginFailure(event)
    throw createError({ statusCode: 401, statusMessage: '密码不正确' })
  }

  clearLoginFailures(event)
  startAdminSession(event)
  return { ok: true as const }
})
