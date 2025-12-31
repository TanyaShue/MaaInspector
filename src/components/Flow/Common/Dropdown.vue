<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

export interface DropdownOption {
  label: string
  value: any
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: any
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
  (e: 'update:modelValue', value: any): void
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
  <div ref="dropdownRef" class="relative w-full">
    <!-- 触发按钮 -->
    <button
      type="button"
      @click="toggleDropdown"
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
    >
      <span class="truncate" :class="{'text-slate-400': !selectedOption}">
        {{ displayText }}
      </span>
      <ChevronDown
        :size="sizeClasses.icon"
        class="text-slate-400 transition-transform flex-shrink-0 ml-2"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- 下拉菜单 -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        :class="sizeClasses.dropdown"
      >
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            @click="selectOption(option)"
            :disabled="option.disabled"
            class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between"
            :class="{
              'bg-indigo-50 text-indigo-700': option.value === modelValue,
              'text-slate-600 hover:bg-slate-50': option.value !== modelValue && !option.disabled,
              'text-slate-400 cursor-not-allowed': option.disabled
            }"
          >
            <span class="truncate">{{ option.label }}</span>
            <Check
              v-if="option.value === modelValue"
              :size="14"
              class="text-indigo-600 flex-shrink-0 ml-2"
            />
          </button>
        </div>
      </div>
    </Transition>
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

