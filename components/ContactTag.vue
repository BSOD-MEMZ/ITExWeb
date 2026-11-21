<script setup lang="ts">
import { computed } from 'vue'
import { CONTACT_KIND_META, detectContactKind } from '~/utils/contact'

/**
 * 联系方式旁边的小标签：一眼看出该发短信、发邮件，还是在 QQ 里搜。
 * 只负责显示，识别规则全在 `utils/contact.ts`。
 */

const props = defineProps<{ contact: string }>()

const kind = computed(() => detectContactKind(props.contact))
const meta = computed(() => CONTACT_KIND_META[kind.value])
</script>

<template>
  <span class="contact-tag" :class="`is-${kind}`" :title="meta.title">{{ meta.label }}</span>
</template>
