<script setup lang="ts">
import { computed } from 'vue'
import { directions, levels } from '~/data/apply'
import type { SignupStats } from '~/types/signup'

/**
 * 统计面板：顶部五个总量卡 + 下面四张分布卡（方向 / 能力 / 近 14 天趋势 / 班级）。
 * 数据全部来自服务端的 `stats`，不受当前筛选影响，用来回答「招新整体到什么程度了」。
 */

const props = defineProps<{ stats?: SignupStats; loading?: boolean }>()

const emit = defineEmits<{
  (event: 'filter-direction', id: string): void
  (event: 'filter-level', level: number): void
}>()

const total = computed(() => props.stats?.total ?? 0)

function percent(count: number, base: number) {
  if (!base) return 0
  return Math.round((count / base) * 100)
}

const headline = computed(() => [
  { key: 'total', label: '全部报名', en: 'TOTAL', value: props.stats?.total ?? 0, tone: 'yellow' },
  { key: 'pending', label: '待处理', en: 'PENDING', value: props.stats?.pending ?? 0, tone: 'red' },
  { key: 'contacted', label: '已联系', en: 'CONTACTED', value: props.stats?.contacted ?? 0, tone: 'blue' },
  { key: 'accepted', label: '已入社', en: 'ACCEPTED', value: props.stats?.accepted ?? 0, tone: 'green' },
  { key: 'last7Days', label: '近 7 天', en: 'LAST 7D', value: props.stats?.last7Days ?? 0, tone: 'ink' }
])

/** 方向分布按人数降序，一眼看出哪个方向最热门。 */
const directionRows = computed(() =>
  directions
    .map((direction) => ({
      id: direction.id,
      label: direction.label,
      en: direction.en,
      count: props.stats?.directions?.[direction.id] ?? 0
    }))
    .sort((left, right) => right.count - left.count)
)

const levelRows = computed(() =>
  levels.map((level) => ({
    value: level.value,
    name: level.name,
    cn: level.cn,
    count: props.stats?.levels?.[level.value] ?? 0
  }))
)

/** 趋势图最高的那一天当作满格，避免只有个位数时柱子贴着底看不出差别。 */
const trendMax = computed(() => Math.max(1, ...(props.stats?.trend ?? []).map((point) => point.count)))
const trendTotal = computed(() => (props.stats?.trend ?? []).reduce((sum, point) => sum + point.count, 0))

const classRows = computed(() => (props.stats?.classes ?? []).slice(0, 6))

function dayLabel(date: string) {
  return date.slice(5).replace('-', '/')
}
</script>

<template>
  <section class="admin-dashboard" :class="{ 'is-loading': loading }" aria-label="报名统计">
    <ul class="admin-stats">
      <li v-for="card in headline" :key="card.key" :class="`stat-${card.tone}`">
        <b>{{ card.value }}</b>
        <span>{{ card.label }}</span>
        <i>{{ card.en }}</i>
      </li>
    </ul>

    <div class="admin-charts">
      <article class="admin-chart">
        <header>
          <p>想参与的方向 <i>DIRECTIONS</i></p>
          <small>一人可选多个</small>
        </header>
        <ul class="chart-bars">
          <li v-for="row in directionRows" :key="row.id">
            <button type="button" class="chart-bar-label" :title="`只看「${row.label}」的报名`" @click="emit('filter-direction', row.id)">
              {{ row.label }}
            </button>
            <span class="chart-bar-track">
              <span class="chart-bar-fill" :style="{ width: `${percent(row.count, total)}%` }" />
            </span>
            <b>{{ row.count }}</b>
          </li>
        </ul>
      </article>

      <article class="admin-chart">
        <header>
          <p>能力自评 <i>LEVELS</i></p>
          <small>点一下按等级筛选</small>
        </header>
        <ul class="chart-bars">
          <li v-for="row in levelRows" :key="row.value">
            <button type="button" class="chart-bar-label" :title="`只看 ${row.name}`" @click="emit('filter-level', row.value)">
              {{ row.name }} · {{ row.cn }}
            </button>
            <span class="chart-bar-track">
              <span class="chart-bar-fill" :class="`lv-${row.value}`" :style="{ width: `${percent(row.count, total)}%` }" />
            </span>
            <b>{{ row.count }}</b>
          </li>
        </ul>
      </article>

      <article class="admin-chart is-trend">
        <header>
          <p>近 14 天提交 <i>TREND</i></p>
          <small>共 {{ trendTotal }} 条</small>
        </header>
        <!-- 用 div 而不是 ol/li：main.css 里有全局的 ol li 网格规则（100px 1fr 190px、gap 20px），
             会把趋势图的每一列压成三段，日期标签被挤到第二格里。 -->
        <div class="chart-trend">
          <div v-for="point in stats?.trend ?? []" :key="point.date" class="trend-day">
            <span class="trend-bar" :style="{ height: `${Math.max(4, Math.round((point.count / trendMax) * 100))}%` }" :title="`${point.date}：${point.count} 条`">
              <b v-if="point.count">{{ point.count }}</b>
            </span>
            <i>{{ dayLabel(point.date) }}</i>
          </div>
        </div>
      </article>

      <article class="admin-chart">
        <header>
          <p>班级分布 <i>CLASSES</i></p>
          <small>{{ stats?.classes?.length ?? 0 }} 个班级</small>
        </header>
        <ul class="chart-bars">
          <li v-for="row in classRows" :key="row.name">
            <span class="chart-bar-label is-static">{{ row.name }}</span>
            <span class="chart-bar-track">
              <span class="chart-bar-fill is-class" :style="{ width: `${percent(row.count, total)}%` }" />
            </span>
            <b>{{ row.count }}</b>
          </li>
          <li v-if="!classRows.length" class="chart-empty">还没有数据</li>
        </ul>
      </article>
    </div>
  </section>
</template>
