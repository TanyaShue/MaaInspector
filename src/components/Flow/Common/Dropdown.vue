<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'
import type { DropdownOption } from './types'
import FloatingDropdownMenu from './FloatingDropdownMenu.vue'

const props = withDefaults(defineProps<{
  modelValue: PropertyKey
  options: DropdownOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
}>(), {
  placeholder: '请选择',
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: PropertyKey): void
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const displayText = computed(() => {
  return selectedOption.value?.label || props.placeholder
})

const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

const selectOption = (option: DropdownOption) => {
  if (!option.disabled) {
    emit('update:modelValue', option.value)
    isOpen.value = false
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const sizeClasses = computed(() => {
  if (props.size === 'xs') {
    return {
      button: 'py-1 px-2 text-[10px]',
      icon: 10,
      dropdown: 'mt-0.5',
      option: 'px-2 py-1 text-[10px]'
    }
  }
  if (props.size === 'sm') {
    return {
      button: 'py-1.5 px-2 text-xs',
      icon: 12,
      dropdown: 'mt-1',
      option: 'px-3 py-2 text-xs'
    }
  }
  return {
    button: 'py-2 px-3 text-xs',
    icon: 14,
    dropdown: 'mt-2',
    option: 'px-3 py-2 text-xs'
  }
})
</script>

<template>
  <div
    ref="dropdownRef"
    class="relative w-full"
  >
    <!-- 触发按钮 -->
    <button
      type="button"
      :disabled="disabled"
      class="w-full bg-white border border-slate-200 rounded-lg text-slate-600 outline-none transition-all shadow-sm flex items-center justify-between"
      :class="[
        sizeClasses.button,
        {
          'border-indigo-300 ring-2 ring-indigo-50': isOpen,
          'hover:border-slate-300': !disabled && !isOpen,
          'opacity-50 cursor-not-allowed': disabled,
          'cursor-pointer': !disabled
        }
      ]"
      @click="toggleDropdown"
    >
      <span
        class="truncate"
        :class="{'text-slate-400': !selectedOption}"
      >
        {{ displayText }}
      </span>
      <ChevronDown
        :size="sizeClasses.icon"
        class="text-slate-400 transition-transform flex-shrink-0 ml-2"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <FloatingDropdownMenu :open="isOpen" :anchor="dropdownRef" :max-height="240">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :disabled="option.disabled"
        class="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors"
        :class="{
          'bg-indigo-50 text-indigo-700': option.value === modelValue,
          'text-slate-600 hover:bg-slate-50': option.value !== modelValue && !option.disabled,
          'cursor-not-allowed text-slate-400': option.disabled
        }"
        @click="selectOption(option)"
      >
        <span class="truncate">{{ option.label }}</span>
        <Check
          v-if="option.value === modelValue"
          :size="14"
          class="ml-2 flex-shrink-0 text-indigo-600"
        />
      </button>
    </FloatingDropdownMenu>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(203 213 225) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgb(203 213 225);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgb(148 163 184);
}
</style>

