import { computed, readonly, ref } from 'vue'

/**
 * 自动播放（演示模式）的共享状态。
 *
 * 页脚的入口按钮和首页的 PresentationDeck 组件共用这一份状态：
 * 点击入口只改这里的 `active`，真正的全屏、翻页和测量都由 deck 组件负责。
 * 所有状态在服务端渲染期间保持初始值，只在客户端改动。
 */

/** 每一页停留的时间：15 秒。 */
export const SLIDE_DURATION_MS = 15_000

const active = ref(false)
const paused = ref(false)
const current = ref(0)
const total = ref(0)

const canGoNext = computed(() => total.value > 1)

function enterFullscreen() {
  if (!import.meta.client || document.fullscreenElement) {
    return
  }

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void
  }

  try {
    // 全屏必须在用户手势里发起，所以放在点击入口的同一次调用栈中。
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root)
    if (!request) {
      return
    }
    const pending = request()
    // 浏览器拒绝全屏（比如 iframe 权限、移动端 Safari）时，演示模式仍在视口内可用。
    if (pending && typeof (pending as Promise<void>).catch === 'function') {
      (pending as Promise<void>).catch(() => {})
    }
  } catch {
    // 同上：全屏失败不影响演示模式本身。
  }
}

function exitFullscreen() {
  if (!import.meta.client || !document.fullscreenElement) {
    return
  }
  try {
    const pending = document.exitFullscreen()
    if (pending && typeof pending.catch === 'function') {
      pending.catch(() => {})
    }
  } catch {
    // 已经退出全屏时忽略。
  }
}

export function usePresentation() {
  function start() {
    // 没有幻灯片就不进演示模式：避免哪天把页脚放到别的页面时点出一个空全屏。
    if (!import.meta.client || active.value || total.value === 0) {
      return
    }
    paused.value = false
    current.value = 0
    active.value = true
    enterFullscreen()
  }

  function stop() {
    if (!active.value) {
      return
    }
    active.value = false
    paused.value = false
    exitFullscreen()
  }

  function togglePause() {
    if (active.value) {
      paused.value = !paused.value
    }
  }

  /** 由 deck 组件登记当前页面一共有几页。 */
  function setTotal(count: number) {
    total.value = Math.max(0, count)
    if (current.value >= total.value) {
      current.value = 0
    }
  }

  function goTo(index: number) {
    if (total.value === 0) {
      return
    }
    const wrapped = ((index % total.value) + total.value) % total.value
    current.value = wrapped
  }

  function next() {
    if (canGoNext.value) {
      goTo(current.value + 1)
    }
  }

  function prev() {
    if (canGoNext.value) {
      goTo(current.value - 1)
    }
  }

  return {
    active: readonly(active),
    paused: readonly(paused),
    current: readonly(current),
    total: readonly(total),
    slideDuration: SLIDE_DURATION_MS,
    start,
    stop,
    togglePause,
    setTotal,
    goTo,
    next,
    prev
  }
}
