/**
 * 导出 CSV（导出当前筛选条件下的全部记录，不分页）。
 * 带 BOM，Excel 直接双击打开中文不乱码；内部备注和状态一并导出，方便线下跟进。
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = parseSignupListQuery(getQuery(event))
  const records = await collectSignups(query)
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="itex-signups-${stamp}.csv"`)
  setHeader(event, 'cache-control', 'no-store')

  return `\ufeff${signupsToCsv(records)}`
})
