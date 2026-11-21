import type { SignupBulkAction } from '../../../../types/signup'

/**
 * 批量操作：改状态 / 删除 / 恢复 / 彻底删除。
 *
 * 走一个入口是为了让前端只有一套「先选中、再执行」的逻辑；
 * 具体动作在服务端再分派，非法动作直接 400。
 */
export default defineEventHandler(async (event): Promise<{ ok: true; action: SignupBulkAction; changed: number }> => {
  requireAdmin(event)

  const body = (await readBody<{ action?: unknown; ids?: unknown; status?: unknown }>(event).catch(() => ({}))) ?? {}
  const action = body.action
  const ids = body.ids

  setHeader(event, 'cache-control', 'no-store')

  if (action === 'status') {
    return { ok: true, action: 'status', changed: await bulkUpdateStatus(ids, body.status) }
  }
  if (action === 'delete') {
    return { ok: true, action: 'delete', changed: await bulkDeleteSignup(ids) }
  }
  if (action === 'restore') {
    return { ok: true, action: 'restore', changed: await restoreSignups(ids) }
  }
  if (action === 'purge') {
    return { ok: true, action: 'purge', changed: await purgeTrash(ids) }
  }

  throw apiError(400, '未知的批量操作')
})
