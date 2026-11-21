/**
 * 回收站：最近 30 天内在后台删掉的报名记录。
 * 恢复后编号不变；如果编号已经被新报名占用，会在批量接口里报 409。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  setHeader(event, 'cache-control', 'no-store')

  const items = await listTrash()
  return { items, total: items.length }
})
