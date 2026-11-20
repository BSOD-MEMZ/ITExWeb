<script setup lang="ts">
import { usePresentation } from '~/composables/usePresentation'

// 页脚是全站唯一的自动播放入口；真正的翻页由首页的 PresentationDeck 负责。
const { start } = usePresentation()
</script>

<template>
    <footer><span>ITEx / NANFANG INFO EXTENSION CLUB</span><span>株洲市南方中学信息拓展社</span><span>© 2026 湖南省株洲市xxt软件 技术支持 部分样式使用AI生成</span>
        <button class="footer-present" type="button" @click="start">自动播放 ▶</button>
    </footer>
</template>
