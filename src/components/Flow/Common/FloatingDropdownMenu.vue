<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  anchor?: HTMLElement | null
  maxHeight?: number
}>(), {
  anchor: null,
  maxHeight: 240
})

const position = ref<Record<string, string>>({ visibility: 'hidden' })
const menuStyle = computed(() => position.value)

const updatePosition = () => {
  if (!props.open || !props.anchor) return
  const rect = props.anchor.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight
  const margin = 8
  const gap = 4
  const spaceBelow = viewportHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const openAbove = spaceBelow < Math.min(props.maxHeight, 120) && spaceAbove > spaceBelow
  const availableHeight = Math.max(48, (openAbove ? spaceAbove : spaceBelow) - gap)
  const maxHeight = Math.min(props.maxHeight, availableHeight)
  const width = Math.min(Math.max(rect.width, 120), viewportWidth - margin * 2)
  const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin)

  position.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
    visibility: 'visible',
    ...(openAbove
      ? { bottom: `${viewportHeight - rect.top + gap}px` }
      : { top: `${rect.bottom + gap}px` })
  }
}

watch(
  () => [props.open, props.anchor] as const,
  async ([open]) => {
    if (!open) return
    position.value = { visibility: 'hidden' }
    await nextTick()
    updatePosition()
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('resize', updatePosition)
  document.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePosition)
  document.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed z-[200] overflow-y-auto overscroll-contain bg-white border border-slate-200 rounded-lg shadow-xl custom-scrollbar-dark"
        :style="menuStyle"
        @wheel.stop
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
