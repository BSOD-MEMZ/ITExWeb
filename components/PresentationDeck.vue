<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePresentation } from '~/composables/usePresentation'

/**
 * 自动播放（演示模式）的「片场」。
 *
 * 首页的每个 <main> > <section> 都是一页幻灯片：进入后隐藏页头页脚、
 * 只显示当前页，按 15 秒自动翻页并带进出动画；页脚的入口按钮只负责触发，
 * 具体测量、计时、全屏和键盘操作都在这里。
 */

const { active, paused, current, total, slideDuration, stop, togglePause, next, prev, setTotal, goTo } =
  usePresentation()

type Direction = 'next' | 'prev' | 'none'

const hudEl = ref<HTMLElement | null>(null)
const progressEl = ref<HTMLElement | null>(null)
const labels = ref<string[]>([])

const SLIDE_ANIMATION_MS = 640
const LEAVE_ANIMATION_MS = 520

let slides: HTMLElement[] = []
let shownIndex = -1
let booted = false
let hudHeight = 62
let frame = 0
let elapsed = 0
let lastFrameAt = 0
let enterTimer = 0
let leaveTimer = 0
let previousFocus: HTMLElement | null = null
let hadMotionReady = false

const counter = computed(() => `${String(current.value + 1).padStart(2, '0')} / ${String(total.value).padStart(2, '0')}`)
const label = computed(() => labels.value[current.value] ?? '')

/** 首页的每个 section 都是一页；没有标记的也收进来，避免出现「隐形页」。 */
function collectSlides() {
  slides = Array.from(document.querySelectorAll<HTMLElement>('main > section'))
  labels.value = slides.map((element) => element.dataset.slide ?? '')
  setTotal(slides.length)
}

/** 按视口把当前页整体缩放到合适大小，居中放在底部控制条上方。 */
function fitSlide(element: HTMLElement) {
  if (!active.value) {
    return
  }
  const stageHeight = window.innerHeight - hudHeight
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) {
    return
  }
  const scale = Math.min(1.2, (window.innerWidth - 24) / width, (stageHeight - 20) / height)
  const x = (window.innerWidth - width * scale) / 2
  const y = (stageHeight - height * scale) / 2
  element.style.setProperty('--deck-x', `${x}px`)
  element.style.setProperty('--deck-y', `${y}px`)
  element.style.setProperty('--deck-scale', `${scale}`)
}

function clearTimers() {
  window.clearTimeout(enterTimer)
  window.clearTimeout(leaveTimer)
}

function showSlide(index: number, direction: Direction) {
  const target = slides[index]
  if (!target || shownIndex === index) {
    return
  }

  const leaving = shownIndex >= 0 ? slides[shownIndex] : null
  // 快速连翻时，上一次的退场页可能还没播完；先统一收掉，避免留下半透明的幽灵页。
  slides.forEach((element) => {
    if (element !== leaving) {
      element.classList.remove('is-leaving', 'deck-out-next', 'deck-out-prev')
    }
  })
  if (leaving && leaving !== target) {
    leaving.classList.remove('is-current', 'deck-in-next', 'deck-in-prev')
    leaving.classList.add('is-leaving', direction === 'next' ? 'deck-out-next' : 'deck-out-prev')
    window.clearTimeout(leaveTimer)
    leaveTimer = window.setTimeout(() => {
      leaving.classList.remove('is-leaving', 'deck-out-next', 'deck-out-prev')
    }, LEAVE_ANIMATION_MS)
  }

  target.classList.remove('is-leaving', 'deck-out-next', 'deck-out-prev')
  target.classList.add('is-current')
  if (direction !== 'none') {
    // 先摘掉动画类再触发一次重排，连续翻到同一页时动画也能重放。
    target.classList.remove('deck-in-next', 'deck-in-prev')
    void target.offsetWidth
    target.classList.add(direction === 'next' ? 'deck-in-next' : 'deck-in-prev')
    window.clearTimeout(enterTimer)
    enterTimer = window.setTimeout(() => {
      target.classList.remove('deck-in-next', 'deck-in-prev')
    }, SLIDE_ANIMATION_MS)
  }

  shownIndex = index
  elapsed = 0
  lastFrameAt = 0
  window.requestAnimationFrame(() => fitSlide(target))
}

function paintProgress() {
  if (!progressEl.value) {
    return
  }
  progressEl.value.style.transform = `scaleX(${Math.min(1, elapsed / slideDuration)})`
}

function loop(now: number) {
  if (!active.value) {
    return
  }
  // 切后台或休眠后 rAF 会停；把单帧步长封顶，避免回来一口气跳好几页。
  const delta = lastFrameAt ? Math.min(now - lastFrameAt, 120) : 0
  lastFrameAt = now
  if (!paused.value) {
    elapsed += delta
  }
  paintProgress()
  if (elapsed >= slideDuration) {
    elapsed = 0
    next()
  }
  frame = window.requestAnimationFrame(loop)
}

function resolveDirection(value: number, previous: number): Direction {
  if (total.value > 1 && Math.abs(value - previous) === total.value - 1) {
    // 首尾循环时，视觉上仍然是同一方向，不要突然反向飞。
    return value > previous ? 'prev' : 'next'
  }
  return value > previous ? 'next' : 'prev'
}

function onKeydown(event: KeyboardEvent) {
  if (!active.value || event.altKey || event.ctrlKey || event.metaKey) {
    return
  }
  // 焦点在控制条按钮上时，空格 / 回车归按钮自己，别让翻页抢走。
  const onControl =
    event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')
  if (onControl && (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter')) {
    return
  }
  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
    case 'Spacebar':
      event.preventDefault()
      next()
      break
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault()
      prev()
      break
    case 'p':
    case 'P':
      event.preventDefault()
      togglePause()
      break
    case 'Escape':
      event.preventDefault()
      stop()
      break
  }
}

function syncHudHeight() {
  hudHeight = hudEl.value?.offsetHeight ?? hudHeight
  document.documentElement.style.setProperty('--deck-hud', `${hudHeight}px`)
}

function onResize() {
  const element = slides[current.value]
  if (!element) {
    return
  }
  syncHudHeight()
  window.requestAnimationFrame(() => fitSlide(element))
}

function onFullscreenChange() {
  // 用户按 Esc / 点系统按钮退出全屏时，演示模式一起收掉。
  if (!document.fullscreenElement && active.value) {
    stop()
  }
}

function resetDom() {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (frame) {
    window.cancelAnimationFrame(frame)
    frame = 0
  }
  clearTimers()
  document.documentElement.classList.remove('is-presenting')
  document.documentElement.style.removeProperty('--deck-hud')
  if (hadMotionReady) {
    document.documentElement.classList.add('motion-ready')
    hadMotionReady = false
  }
  slides.forEach((element) => {
    element.classList.remove(
      'deck-slide',
      'is-current',
      'is-leaving',
      'deck-in-next',
      'deck-in-prev',
      'deck-out-next',
      'deck-out-prev'
    )
    element.style.removeProperty('--deck-x')
    element.style.removeProperty('--deck-y')
    element.style.removeProperty('--deck-scale')
  })
  shownIndex = -1
  booted = false
  elapsed = 0
  lastFrameAt = 0
}

async function enter() {
  collectSlides()
  if (!slides.length) {
    stop()
    return
  }

  booted = false
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  // 首页的滚动进场动画（motion-ready）会给每个区块加 transform，和这里的缩放打架；
  // 演示模式期间先关掉它，退出时再还原。同时把已出现的区块标记好，避免退出后重新隐藏。
  hadMotionReady = document.documentElement.classList.contains('motion-ready')
  document.documentElement.classList.remove('motion-ready')
  document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'))
  slides.forEach((element) => element.classList.add('deck-slide'))
  document.documentElement.classList.add('is-presenting')

  // 永远从封面开始，像放 PPT 一样从头轮播。
  goTo(0)
  await nextTick()

  syncHudHeight()
  await nextTick()

  showSlide(current.value, 'none')
  booted = true

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  hudEl.value?.focus({ preventScroll: true })
  frame = window.requestAnimationFrame(loop)
}

async function leave() {
  const lastSlide = slides[current.value]
  resetDom()
  await nextTick()

  if (lastSlide?.isConnected) {
    const top = lastSlide.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: Math.max(0, top - 78), behavior: 'auto' })
  }

  previousFocus?.focus?.({ preventScroll: true })
  previousFocus = null
}

watch(active, (on) => {
  if (on) {
    void enter()
  } else {
    void leave()
  }
})

watch(current, (value, previous) => {
  if (!booted || shownIndex === value) {
    return
  }
  showSlide(value, resolveDirection(value, previous))
})

watch(paused, () => {
  lastFrameAt = 0
})

onMounted(() => {
  collectSlides()
})

onBeforeUnmount(() => {
  if (active.value) {
    stop()
  }
  resetDom()
})
</script>

<template>
  <div v-if="active" class="deck" :class="{ 'is-paused': paused }" role="region" aria-label="自动播放">
    <div ref="hudEl" class="deck-hud" tabindex="-1">
      <div class="deck-progress" aria-hidden="true"><i ref="progressEl" /></div>
      <div class="deck-status">
        <span class="deck-live"><i class="deck-dot" aria-hidden="true" />AUTO PLAY</span>
        <span class="deck-counter">{{ counter }}</span>
        <span v-if="label" class="deck-title">{{ label }}</span>
      </div>
      <p class="deck-hint">空格 / → 下一张 · P 暂停 · Esc 退出</p>
      <div class="deck-controls">
        <button type="button" class="deck-btn" @click="prev">‹ 上一张</button>
        <button type="button" class="deck-btn deck-btn--toggle" :aria-pressed="paused" @click="togglePause">
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button type="button" class="deck-btn" @click="next">下一张 ›</button>
        <button type="button" class="deck-btn deck-btn--exit" @click="stop">退出 ✕</button>
      </div>
    </div>
  </div>
</template>
