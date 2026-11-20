/**
 * 管理后台用它判断「要不要显示登录框」以及「后台是否已启用」。
 * 这里不要求登录，只返回两个布尔值。
 */
export default defineEventHandler((event) => {
  setHeader(event, 'cache-control', 'no-store')
  const enabled = isAdminEnabled(event)
  return { enabled, authenticated: enabled && hasAdminSession(event) }
})
