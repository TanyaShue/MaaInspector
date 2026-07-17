<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { Check, ChevronDown } from 'lucide-vue-next'
  import FloatingDropdownMenu from '@/components/Flow/Common/FloatingDropdownMenu.vue'
  import { useAppConfigStore } from '@/stores/appConfig'
  import type { JsonSchemaRule } from '@/services/api'
  import {
    createDefaultCustomParams,
    getSchemaType,
    parseCustomFieldValue,
    stringifyCustomFieldValue,
  } from '@/utils/customCompletion'

  const props = defineProps<{
    kind: 'action' | 'recognition'
    modelValue: string
    paramValue?: unknown
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'update:paramValue', value: unknown): void
  }>()

  const appConfig = useAppConfigStore()
  const nameDropdownRef = ref<HTMLDivElement | null>(null)
  const isNameDropdownOpen = ref(false)
  const rules = computed(() => appConfig.resource.customCompletions[props.kind] || [])
  const selectedRule = computed(() => rules.value.find((rule) => rule.value === props.modelValue))
  const filteredRules = computed(() => {
    const query = props.modelValue.trim().toLowerCase()
    if (!query || selectedRule.value) return rules.value
    return rules.value.filter((rule) =>
      `${rule.value} ${rule.title || ''}`.toLowerCase().includes(query)
    )
  })
  const properties = computed(() => selectedRule.value?.param_schema?.properties || {})
  const requiredFields = computed(() => new Set(selectedRule.value?.param_schema?.required || []))
  const params = computed<Record<string, unknown>>(() =>
    props.paramValue && typeof props.paramValue === 'object' && !Array.isArray(props.paramValue)
      ? (props.paramValue as Record<string, unknown>)
      : {}
  )

  const getInputValue = (event: Event) =>
    (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? ''
  const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false

  const updateName = (value: string) => {
    emit('update:modelValue', value)
    const rule = rules.value.find((item) => item.value === value)
    if (!rule) return
    const defaults = createDefaultCustomParams(rule)
    emit('update:paramValue', Object.keys(defaults).length > 0 ? defaults : undefined)
  }

  const selectName = (value: string) => {
    updateName(value)
    isNameDropdownOpen.value = false
  }

  const handleNameInput = (value: string) => {
    emit('update:modelValue', value)
    isNameDropdownOpen.value = rules.value.length > 0
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (nameDropdownRef.value && !nameDropdownRef.value.contains(event.target as Node)) {
      isNameDropdownOpen.value = false
    }
  }

  onMounted(() => document.addEventListener('click', handleClickOutside))
  onUnmounted(() => document.removeEventListener('click', handleClickOutside))

  const updateParam = (key: string, value: unknown) => {
    const next = { ...params.value }
    if (value === undefined || value === '') delete next[key]
    else next[key] = value
    emit('update:paramValue', Object.keys(next).length > 0 ? next : undefined)
  }

  const fieldType = (schema: JsonSchemaRule) => getSchemaType(schema)
  const fieldValue = (key: string, schema: JsonSchemaRule) =>
    stringifyCustomFieldValue(params.value[key], schema)
</script>

<template>
  <div class="space-y-2.5">
    <div class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">
        自定义{{ kind === 'action' ? '动作' : '识别' }}名
      </label>
      <div ref="nameDropdownRef" class="relative w-full">
        <div
          class="w-full bg-white border border-slate-200 rounded-lg text-slate-600 outline-none transition-all shadow-sm flex items-center"
          :class="{
            'border-indigo-300 ring-2 ring-indigo-50': isNameDropdownOpen,
            'hover:border-slate-300': !isNameDropdownOpen,
          }"
        >
          <input
            :value="modelValue"
            class="min-w-0 flex-1 bg-transparent py-1.5 pl-2 pr-1 text-xs outline-none placeholder:text-slate-400"
            :placeholder="rules.length ? '输入或选择 Schema 提供的实现' : '未加载补全规则，可手动输入'"
            @focus="isNameDropdownOpen = rules.length > 0"
            @input="handleNameInput(getInputValue($event))"
            @change="updateName(getInputValue($event))"
            @keydown.escape="isNameDropdownOpen = false"
          />
          <button
            v-if="rules.length"
            type="button"
            class="self-stretch px-2 text-slate-400 hover:text-slate-600 flex items-center"
            title="选择自定义实现"
            @click="isNameDropdownOpen = !isNameDropdownOpen"
          >
            <ChevronDown
              :size="12"
              class="transition-transform"
              :class="{ 'rotate-180': isNameDropdownOpen }"
            />
          </button>
        </div>

        <FloatingDropdownMenu
          :open="isNameDropdownOpen"
          :anchor="nameDropdownRef"
          :max-height="240"
        >
          <div class="flex flex-col py-1">
              <button
                v-for="rule in filteredRules"
                :key="rule.value"
                type="button"
                class="w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2"
                :class="
                  rule.value === modelValue
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                "
                @click="selectName(rule.value)"
              >
                <span class="min-w-0">
                  <span class="block truncate">{{ rule.title || rule.value }}</span>
                  <span v-if="rule.title" class="block truncate text-[10px] text-slate-400 font-mono">
                    {{ rule.value }}
                  </span>
                </span>
                <Check
                  v-if="rule.value === modelValue"
                  :size="14"
                  class="shrink-0 text-indigo-600"
                />
              </button>
              <div v-if="filteredRules.length === 0" class="px-3 py-2 text-xs text-slate-400">
                无匹配项，可继续手动输入
              </div>
          </div>
        </FloatingDropdownMenu>
      </div>
      <p v-if="selectedRule?.description" class="text-[10px] leading-relaxed text-slate-400">
        {{ selectedRule.description }}
      </p>
    </div>

    <div
      v-if="Object.keys(properties).length"
      class="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2"
    >
      <div v-for="(schema, key) in properties" :key="key" class="space-y-1">
        <label class="text-[10px] font-semibold text-slate-500">
          {{ schema.title || key
          }}<span v-if="requiredFields.has(key)" class="text-red-400"> *</span>
        </label>
        <select
          v-if="schema.enum?.length"
          :value="fieldValue(key, schema)"
          class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
          @change="updateParam(key, parseCustomFieldValue(getInputValue($event), schema))"
        >
          <option value="">未设置</option>
          <option v-for="option in schema.enum" :key="String(option)" :value="String(option)">
            {{ option }}
          </option>
        </select>
        <label
          v-else-if="fieldType(schema) === 'boolean'"
          class="flex items-center gap-2 text-xs text-slate-600"
        >
          <input
            type="checkbox"
            :checked="params[key] === true"
            @change="updateParam(key, getChecked($event))"
          />
          {{ params[key] === true ? 'true' : 'false' }}
        </label>
        <textarea
          v-else-if="fieldType(schema) === 'json'"
          :value="fieldValue(key, schema)"
          class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono h-14 resize-y"
          placeholder="JSON 值"
          @change="updateParam(key, parseCustomFieldValue(getInputValue($event), schema))"
        />
        <input
          v-else
          :type="['integer', 'number'].includes(fieldType(schema)) ? 'number' : 'text'"
          :min="schema.minimum"
          :max="schema.maximum"
          :value="fieldValue(key, schema)"
          class="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
          @change="updateParam(key, parseCustomFieldValue(getInputValue($event), schema))"
        />
        <p v-if="schema.description" class="text-[10px] leading-relaxed text-slate-400">
          {{ schema.description }}
        </p>
      </div>
    </div>

    <div v-else class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
      <textarea
        :value="paramValue == null ? '' : JSON.stringify(paramValue)"
        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono h-14 resize-none"
        :placeholder="selectedRule ? '此实现没有声明参数' : 'JSON'"
        @change="emit('update:paramValue', parseCustomFieldValue(getInputValue($event)))"
      />
    </div>
  </div>
</template>
