/**
 * 报名提交。
 *
 * 校验与清洗统一在 server/utils/signupStore.ts 的 normalizeSignupInput 里做，
 * 编号生成、并发写入、落盘格式也都交给 store，这里只负责收请求和回执。
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')

  const body = await readBody<unknown>(event).catch(() => null)
  const input = normalizeSignupInput(body)
  const record = await createSignup(input)

  return { ok: true as const, id: record.id, createdAt: record.createdAt }
})
