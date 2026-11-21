/**
 * 联系方式的类型识别。
 *
 * 报名表只要求「留一个能找到你的联系方式」，填进来的东西就五花八门：手机号、QQ 号、
 * 邮箱，还有「微信 abc123」这类。后台名单里一串数字很难一眼分清是手机号还是 QQ 号，
 * 所以显示时统一打个类型标签。
 *
 * 这里只判断「看起来像什么」，不验证号码是否真实存在，也不改动存下来的原值；
 * 拿不准的一律算「其他」——把邮箱标成 QQ 号比标成「其他」更糟。
 */

export type ContactKind = 'phone' | 'email' | 'qq' | 'other'

/** 标签文案。`other` 是兜底：微信号、陌生写法，以及实在认不出来的内容。 */
export const CONTACT_KIND_META: Record<ContactKind, { label: string; title: string }> = {
  phone: { label: '手机号', title: '识别为手机号，可以发短信或打电话' },
  email: { label: '邮箱', title: '识别为邮箱，可以发邮件' },
  qq: { label: 'QQ 号', title: '识别为 QQ 号，可以在 QQ 里搜到' },
  other: { label: '其他', title: '不是手机号 / 邮箱 / QQ 号，多半是微信号或别的写法' }
}

/** 全角数字、全角 @ 和冒号折成半角，省得「１３８…」这种写法漏判。 */
function tidy(value: string): string {
  return (value ?? '').normalize('NFKC').trim()
}

/** 「QQ：」「微信号 」「手机号」这类前缀只是说明，判断号码本身时不需要。 */
const LABEL_PREFIX = /^(?:qq号码|qq号|qq|微信号|微信|weixin|wechat|vx|wx|微博|weibo|电子邮箱|邮箱|e-?mail|mail|手机号码|手机号|手机|联系电话|电话|tel|phone|企鹅号|企鹅)\s*[:：]?\s*/i

/** 尾巴上的括号补充（「（微信同号）」「(备用)」）也不参与判断。 */
const NOTE_SUFFIX = /(?:\s*[（(【\[]\s*[^）)】\]]*?\s*[）)】\]])+$/

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i
const MOBILE = /^(?:\+?86)?1[3-9]\d{9}$/
/** 座机：区号 0 开头，整体 10–12 位（0731-12345678）。学生少用，但老师留的可能就是它。 */
const LANDLINE = /^0\d{9,11}$/
/** QQ 号是 5–11 位、不以 0 开头；更长的数字串不猜。 */
const QQ = /^[1-9]\d{4,10}$/

/** 空格和连字符常用来分组（138 0013 8000、138-0013-8000），判断号码前先去掉。 */
function withoutSeparators(value: string): string {
  return value.replace(/[\s\-‐‑‒–—]/g, '')
}

export function detectContactKind(value: string): ContactKind {
  const text = tidy(value)
  if (!text) return 'other'

  const bare = text.replace(LABEL_PREFIX, '').replace(NOTE_SUFFIX, '').trim()
  if (EMAIL.test(bare)) return 'email'

  const numbers = withoutSeparators(bare)
  if (MOBILE.test(numbers) || LANDLINE.test(numbers)) return 'phone'
  if (QQ.test(numbers)) return 'qq'

  // 号码夹在文字里（「微信 abc123」「备用 13800138000」）时再宽松找一遍。
  // 顺序是邮箱 → 手机号 → QQ：越具体的形状越先判，11 位手机号不会被当成 QQ 号。
  if (/[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i.test(text)) return 'email'
  const loose = withoutSeparators(text)
  if (/(?:\+?86)?1[3-9]\d{9}/.test(loose)) return 'phone'
  if (/(?:^|\D)0\d{9,11}(?!\d)/.test(loose)) return 'phone'
  if (/(?:^|\D)[1-9]\d{4,10}(?!\d)/.test(loose)) return 'qq'

  return 'other'
}
