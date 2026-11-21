import { isSignupStatus } from '../../../../types/signup'

/**
 * 后台手工新建一条报名（纸质表、线下补录、老师推荐的名单都会走这里）。
 *
 * 表单字段的清洗和公开报名表共用 `normalizeSignupInput`，所以两边校验规则一模一样；
 * 这里的差别只有两点：可以直接指定流转状态和内部备注。
 * 编号仍然由 store 统一分配，手工录入不会占用预留段 0000–0020。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const body = await readBody<Record<string, unknown>>(event).catch(() => null)
  const input = normalizeSignupInput(body)

  const source = (body ?? {}) as Record<string, unknown>
  const record = await createSignup(input, {
    status: isSignupStatus(source.status) ? source.status : 'pending',
    adminNote: typeof source.adminNote === 'string' ? source.adminNote : ''
  })

  setHeader(event, 'cache-control', 'no-store')
  return { record }
})
