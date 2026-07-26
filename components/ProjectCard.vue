<script setup lang="ts">
defineProps<{ project: { number: string, tag: string, title: string, description: string, tone: string, decoration: string } }>()
</script>

<template>
  <article class="project" :class="project.tone">
    <span class="number">{{ project.number }}</span><span class="tag">{{ project.tag }}</span>
    <h3>{{ project.title }}</h3><p>{{ project.description }}</p><a href="#join">查看方向 <b>→</b></a>
    <div class="project-decoration" :class="`decoration-${project.tone}`">{{ project.decoration }}</div>
  </article>
</template>
