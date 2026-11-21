/**
 * 统计页的数据源。
 *
 * 和名单接口分开是因为统计永远看全库：名单页带上筛选条件时，`stats` 仍然算全量，
 * 但统计页连分页参数都不需要，单独一个接口比「拿 pageSize=1 空跑一次列表」干净。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  setHeader(event, 'cache-control', 'no-store')

  const query = parseSignupListQuery(getQuery(event))
  // 只有时区影响统计（按本地日历日切分近 7 天 / 14 天趋势），其余筛选一律不生效。
  const stats = await getSignupStats({ tz: query.tz })

  return { stats }
})
