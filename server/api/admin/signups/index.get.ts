/**
 * 报名名单（分页 + 搜索 + 筛选 + 统计）。
 * 统计数字始终基于全部记录，不受当前筛选影响，方便看总体进度。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  setHeader(event, 'cache-control', 'no-store')

  const query = parseSignupListQuery(getQuery(event))
  return await listSignups(query)
})
