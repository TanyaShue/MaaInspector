<script setup lang="ts">
import { Bug, CheckCircle, Sparkles } from 'lucide-vue-next'
import { computed } from 'vue'
import type { ChangelogSection } from './types'

const props = defineProps<{
  section: ChangelogSection
}>()

const sectionConfig = {
  features: {
    label: '新功能',
    icon: Sparkles,
    headingClass: 'text-violet-600',
    bulletClass: 'text-violet-400'
  },
  improvements: {
    label: '优化',
    icon: CheckCircle,
    headingClass: 'text-blue-600',
    bulletClass: 'text-blue-400'
  },
  fixes: {
    label: '修复',
    icon: Bug,
    headingClass: 'text-emerald-600',
    bulletClass: 'text-emerald-400'
  }
} as const

const config = computed(() => sectionConfig[props.section.kind])
</script>

<template>
  <section class="space-y-1.5">
    <h4
      class="flex items-center gap-1.5 text-[11px] font-bold uppercase"
      :class="config.headingClass"
    >
      <component
        :is="config.icon"
        :size="12"
      />
      {{ config.label }}
    </h4>
    <ul class="space-y-1">
      <li
        v-for="item in section.items"
        :key="item"
        class="flex items-start gap-2 pl-3 text-xs text-slate-600"
      >
        <span
          class="mt-0.5"
          :class="config.bulletClass"
        >•</span>
        <span>{{ item }}</span>
      </li>
    </ul>
  </section>
</template>
