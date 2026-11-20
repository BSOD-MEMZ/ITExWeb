import type { SignupPatch } from '../../../utils/signupStore'

/**
 * 局部修改一条报名：管理状态、内部备注，或纠正填错的表单字段。
 * 只传要改的字段，其余沿用原值；改完仍然走一次完整校验。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, '缺少报名编号')

  const body = (await readBody<SignupPatch>(event).catch(() => ({}))) as SignupPatch
  const record = await updateSignup(decodeURIComponent(id), body)

  setHeader(event, 'cache-control', 'no-store')
  return { record }
})
