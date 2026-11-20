import { createError } from 'h3'

/** 删除一条报名（管理后台二次确认后才会调到这里）。 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少报名编号' })

  const decoded = decodeURIComponent(id)
  await deleteSignup(decoded)

  setHeader(event, 'cache-control', 'no-store')
  return { ok: true as const, id: decoded }
})
