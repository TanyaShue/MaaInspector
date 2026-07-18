import { ref, computed, watch } from 'vue'
import type { FlowBusinessData, FlowNodeMeta } from '@/utils/flowTypes'
import { toPipelineV1Node, toPipelineV2Node } from '@/utils/pipelineTransform'
import { DEFAULTS, focusEventTypes } from '@/utils/node-config'

interface UseNodeFormProps {
  visible: boolean
  nodeData?: FlowNodeMeta | null
  pipelineVersion?: 'V1' | 'V2'
}

export interface UseNodeFormEmit {
  (e: 'update-data', data: FlowBusinessData): void
  (e: 'update-json', json: string): void
}

export function useNodeForm(props: UseNodeFormProps, emit: UseNodeFormEmit) {
  const formData = ref<FlowBusinessData>({})
  const jsonStr = ref('')
  const jsonError = ref('')

  const updateJsonFromForm = () => {
    try {
      const pipelineVersion = props.pipelineVersion || 'V1'
      const previewData = pipelineVersion === 'V2'
        ? toPipelineV2Node(formData.value as FlowBusinessData)
        : formData.value
      jsonStr.value = JSON.stringify(previewData, null, 2)
      jsonError.value = ''
    } catch (_e) { jsonError.value = 'JSON serialization failed' }
  }

  const emitUpdateData = () => {
    updateJsonFromForm()
    emit('update-data', { ...(formData.value || {}) })
  }

  const getValue = <T = unknown>(key: string, defaultVal?: T): T => {
    const val = (formData.value as Record<string, unknown>)[key]
    return (val !== undefined ? val : (defaultVal ?? (DEFAULTS as Record<string, unknown>)[key])) as T
  }

  const assignValue = (key: string, value: unknown) => {
    const defaults = DEFAULTS as Record<string, unknown>
    if (key === 'target' && value === true) {
      delete (formData.value as Record<string, unknown>)[key]
    } else if (value === defaults[key] || value === '' || value === null) {
      delete (formData.value as Record<string, unknown>)[key]
    } else {
      (formData.value as Record<string, unknown>)[key] = value as never
    }
  }

  const setValue = (key: string, value: unknown) => {
    assignValue(key, value)
    emitUpdateData()
  }

  const setValues = (values: Record<string, unknown>) => {
    Object.entries(values).forEach(([key, value]) => assignValue(key, value))
    emitUpdateData()
  }

  const getArrayValue = (key: string) => {
    const val = (formData.value as Record<string, unknown>)[key]
    return Array.isArray(val) ? val.join(', ') : (val || '')
  }

  const getArrayList = (key: string) => {
    const val = (formData.value as Record<string, unknown>)[key]
    if (Array.isArray(val)) return [...val] as string[]
    if (val === undefined || val === null || val === '') return []
    return [val as string]
  }

  const setArrayValue = (key: string, value: string) => {
    if (!value || value.trim() === '') delete (formData.value as Record<string, unknown>)[key]
    else (formData.value as Record<string, unknown>)[key] = value.split(',').map(s => s.trim()).filter(Boolean)
    emitUpdateData()
  }

  const assignArrayList = (key: string, arr: string[]) => {
    const cleaned = (arr || []).map(v => typeof v === 'string' ? v.trim() : v).filter(Boolean)
    if (!cleaned.length) delete (formData.value as Record<string, unknown>)[key]
    else (formData.value as Record<string, unknown>)[key] = cleaned
  }

  const setArrayList = (key: string, arr: string[]) => {
    assignArrayList(key, arr)
    emitUpdateData()
  }

  const setArrayLists = (values: Record<string, string[]>) => {
    Object.entries(values).forEach(([key, arr]) => assignArrayList(key, arr))
    emitUpdateData()
  }

  const getJsonValue = (key: string) => {
    const val = getValue<unknown>(key, null)
    return (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val))
  }

  const setJsonValue = (key: string, rawVal: string, forceString = false) => {
    if (!rawVal || !rawVal.trim()) { setValue(key, null); return }
    try {
      if (rawVal.startsWith('[') || rawVal.startsWith('{')) setValue(key, JSON.parse(rawVal))
      else {
        if (forceString) { setValue(key, rawVal); return }
        const num = Number(rawVal); setValue(key, isNaN(num) ? rawVal : num)
      }
    } catch (_e) { setValue(key, rawVal) }
  }

  const getTargetValue = (key: string) => {
    const val = (formData.value as Record<string, unknown>)[key]
    return (val === true || val === undefined) ? '' : (Array.isArray(val) ? JSON.stringify(val) : (val as string || ''))
  }

  const setTargetValue = (key: string, rawVal: string) => {
    if (rawVal === '' || rawVal.toLowerCase() === 'true') { setValue(key, true); return }
    try {
      const parsed = JSON.parse(rawVal)
      if (Array.isArray(parsed)) { setValue(key, parsed); return }
    } catch (e) { console.warn('Failed to set target value:', e) }
    setValue(key, rawVal)
  }

  const handleJsonInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement | null
    const newVal = target?.value ?? ''
    jsonStr.value = newVal
    try {
      const parsed = JSON.parse(newVal)
      jsonError.value = ''
      const pipelineVersion = props.pipelineVersion || 'V1'
      const normalized = pipelineVersion === 'V2'
        ? toPipelineV1Node(parsed as FlowBusinessData)
        : parsed
      formData.value = normalized as FlowBusinessData
      emitUpdateData()
    } catch (e) { jsonError.value = (e as Error).message }
  }

  const focusData = computed(() => (typeof (formData.value as Record<string, unknown>).focus === 'object' && (formData.value as Record<string, unknown>).focus !== null)
    ? (formData.value as Record<string, unknown>).focus as Record<string, string>
    : {})
  const availableFocusEvents = computed(() => focusEventTypes.filter(type => !Object.keys(focusData.value).includes(type)))

  const ensureFocusRecord = () => {
    if (!formData.value.focus || typeof formData.value.focus !== 'object') {
      (formData.value as Record<string, unknown>).focus = {}
    }
    return formData.value.focus as Record<string, string>
  }

  const addFocusParam = (type: string) => {
    const focus = ensureFocusRecord()
    focus[type] = ''
    emitUpdateData()
  }

  const removeFocusParam = (key: string) => {
    const focus = (formData.value as Record<string, unknown>).focus as Record<string, string> | undefined
    if (focus) {
      delete focus[key]
      if (Object.keys(focus).length === 0) delete (formData.value as Record<string, unknown>).focus
      emitUpdateData()
    }
  }

  const updateFocusParam = (key: string, value: string) => {
    const focus = ensureFocusRecord()
    focus[key] = value
    emitUpdateData()
  }

  watch(() => props.visible, (val) => {
    if (val) {
      formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {})) as FlowBusinessData
      updateJsonFromForm()
      jsonError.value = ''
    }
  }, { immediate: true })

  watch(() => props.nodeData?.data, (newData) => {
    if (props.visible && newData) {
      formData.value = JSON.parse(JSON.stringify(newData)) as FlowBusinessData
      updateJsonFromForm()
    }
  }, { deep: true })

  return {
    formData, jsonStr, jsonError, getValue, setValue, setValues, getArrayValue, setArrayValue,
    getArrayList, setArrayList, setArrayLists, getJsonValue, setJsonValue, getTargetValue, setTargetValue, handleJsonInput,
    updateJsonFromForm,
    focusData, availableFocusEvents, addFocusParam, removeFocusParam, updateFocusParam
  }
}

export type NodeFormMethods = ReturnType<typeof useNodeForm>
