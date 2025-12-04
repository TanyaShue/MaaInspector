// nodeLogic.js
import { ref, computed, watch } from 'vue'
import {
    Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, HelpCircle,
    Square, MousePointer, Hand, ArrowRight, Layers, Fingerprint, Move,
    Mouse, Keyboard, Type, Play, Terminal, Wand2,
    Loader2, AlertCircle, Ban, CheckCircle2
} from 'lucide-vue-next'

// ================= 常量定义 & UI 配置 =================

// 1. 识别类型 (合并了 CustomNode.vue 中的样式配置)
export const RECOGNITION_CONFIG = [
    { key: 'DirectHit', label: '直接命中', icon: Target, color: 'text-blue-600', bg: 'bg-blue-500', border: 'border-blue-200' },
    { key: 'TemplateMatch', label: '模板匹配', icon: Image, color: 'text-indigo-600', bg: 'bg-indigo-500', border: 'border-indigo-200' },
    { key: 'FeatureMatch', label: '特征匹配', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-500', border: 'border-violet-200' },
    { key: 'ColorMatch', label: '颜色识别', icon: Palette, color: 'text-pink-600', bg: 'bg-pink-500', border: 'border-pink-200' },
    { key: 'OCR', label: 'OCR识别', icon: ScanText, color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-200' },
    { key: 'NeuralNetworkClassify', label: '模型分类', icon: Brain, color: 'text-amber-600', bg: 'bg-amber-500', border: 'border-amber-200' },
    { key: 'NeuralNetworkDetect', label: '模型检测', icon: ScanEye, color: 'text-orange-600', bg: 'bg-orange-500', border: 'border-orange-200' },
    { key: 'Custom', label: '自定义', icon: Code2, color: 'text-slate-600', bg: 'bg-slate-500', border: 'border-slate-200' },
    { key: 'Unknown', label: '未知节点', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-400', border: 'border-gray-300' }
]

// 生成 Map 方便 O(1) 查找
export const NODE_CONFIG_MAP = RECOGNITION_CONFIG.reduce((acc, item) => {
    acc[item.key] = item
    return acc
}, {})

// 导出给 Select 组件使用的选项格式
export const recognitionTypes = RECOGNITION_CONFIG.filter(t => t.key !== 'Unknown').map(t => ({
    value: t.key,
    label: t.label,
    icon: t.icon,
    color: t.color.replace('600', '500') // 保持原有 select 颜色逻辑
}))

// 2. 动作类型 (合并了 CustomNode.vue 中的样式配置)
export const ACTION_CONFIG = [
    { key: 'DoNothing', label: '无动作', icon: Square, color: 'text-slate-400', bg: 'bg-slate-50' },
    { key: 'Click', label: '点击', icon: MousePointer, color: 'text-blue-500', bg: 'bg-blue-50' },
    { key: 'LongPress', label: '长按', icon: Hand, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { key: 'MultiSwipe', label: '多指滑动', icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'TouchDown', label: '按下', icon: Fingerprint, color: 'text-violet-500', bg: 'bg-violet-50' },
    { key: 'TouchMove', label: '移动', icon: Move, color: 'text-violet-500', bg: 'bg-violet-50' },
    { key: 'TouchUp', label: '抬起', icon: Hand, color: 'text-violet-500', bg: 'bg-violet-50' },
    { key: 'Scroll', label: '滚轮', icon: Mouse, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { key: 'Key', label: '物理按键', icon: Keyboard, color: 'text-emerald-500', bg: 'bg-emerald-50' }, // 补充缺失的 Key
    { key: 'ClickKey', label: '按键', icon: Keyboard, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { key: 'LongPressKey', label: '长按键', icon: Keyboard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'KeyDown', label: '键按下', icon: Keyboard, color: 'text-teal-500', bg: 'bg-teal-50' },
    { key: 'KeyUp', label: '键抬起', icon: Keyboard, color: 'text-teal-500', bg: 'bg-teal-50' },
    { key: 'InputText', label: '输入文本', icon: Type, color: 'text-green-500', bg: 'bg-green-50' },
    { key: 'StartApp', label: '启动应用', icon: Play, color: 'text-sky-500', bg: 'bg-sky-50' },
    { key: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500', bg: 'bg-red-50' },
    { key: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500', bg: 'bg-rose-50' },
    { key: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500', bg: 'bg-amber-50' },
    { key: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500', bg: 'bg-slate-50' }
]

export const ACTION_CONFIG_MAP = ACTION_CONFIG.reduce((acc, item) => {
    acc[item.key] = item
    return acc
}, {})

export const actionTypes = ACTION_CONFIG.map(t => ({
    value: t.key,
    label: t.label,
    icon: t.icon,
    color: t.color
}))

// 3. 状态图标配置 (新增)
export const STATUS_ICONS = {
    running: { icon: Loader2, color: 'text-blue-500', spin: true, headerClass: 'bg-blue-100 border-blue-200' },
    error: { icon: AlertCircle, color: 'text-red-500', spin: false, headerClass: 'bg-red-100 border-red-200' },
    success: { icon: CheckCircle2, color: 'text-green-500', spin: false, headerClass: 'bg-green-100 border-green-200' },
    ignored: { icon: Ban, color: 'text-slate-400', spin: false, headerClass: 'bg-slate-100 border-slate-200' },
    missing: { icon: AlertCircle, color: 'text-gray-400', spin: false },
    default: { headerClass: 'bg-slate-50/50 border-slate-100' }
}

export const orderByOptions = [
    { value: 'Horizontal', label: '水平 (Horizontal)' },
    { value: 'Vertical', label: '垂直 (Vertical)' },
    { value: 'Score', label: '分数 (Score)' },
    { value: 'Area', label: '面积 (Area)' },
    { value: 'Length', label: '长度 (Length)' },
    { value: 'Random', label: '随机 (Random)' },
    { value: 'Expected', label: '期望 (Expected)' },
]

export const detectorOptions = ['SIFT', 'KAZE', 'AKAZE', 'BRISK', 'ORB']

export const focusEventTypes = [
    'Node.Recognition.Starting', 'Node.Recognition.Succeeded', 'Node.Recognition.Failed',
    'Node.Action.Starting', 'Node.Action.Succeeded', 'Node.Action.Failed'
]

export const DEFAULTS = {
    recognition: 'DirectHit', action: 'DoNothing', next: [], interrupt: [], on_error: [],
    is_sub: false, rate_limit: 1000, timeout: 20000, inverse: false, enabled: true,
    pre_delay: 200, post_delay: 200, pre_wait_freezes: 0, post_wait_freezes: 0,
    roi: [0, 0, 0, 0], roi_offset: [0, 0, 0, 0], index: 0, order_by: 'Horizontal',
    threshold: 0.7, method: 5, count: 4, detector: 'SIFT', ratio: 0.6,
    connected: false, only_rec: false, green_mask: false, target: true, duration: 200, contact: 0
}

// ================= 逻辑钩子 (Composable) =================

export function useNodeForm(props, emit) {
    const formData = ref({})
    const jsonStr = ref('')
    const jsonError = ref('')

    const updateJsonFromForm = () => {
        try {
            jsonStr.value = JSON.stringify(formData.value, null, 2)
            jsonError.value = ''
        } catch (e) {}
    }

    const emitUpdateData = () => {
        updateJsonFromForm()
        emit('update-data', { ...formData.value })
    }

    const getValue = (key, defaultVal) => formData.value[key] !== undefined ? formData.value[key] : (defaultVal ?? DEFAULTS[key])

    const setValue = (key, value) => {
        if (key === 'target' && value === true) {
            delete formData.value[key]
        } else if (value === DEFAULTS[key] || value === '' || value === null) {
            delete formData.value[key]
        } else {
            formData.value[key] = value
        }
        emitUpdateData()
    }

    const getArrayValue = (key) => {
        const val = formData.value[key]
        return Array.isArray(val) ? val.join(', ') : (val || '')
    }

    const setArrayValue = (key, value) => {
        if (!value || value.trim() === '') delete formData.value[key]
        else formData.value[key] = value.split(',').map(s => s.trim()).filter(Boolean)
        emitUpdateData()
    }

    // JSON Helpers
    const getJsonValue = (key) => {
        const val = getValue(key, null)
        return (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : val)
    }

    const setJsonValue = (key, rawVal) => {
        if (!rawVal || !rawVal.trim()) { setValue(key, null); return }
        try {
            if (rawVal.startsWith('[') || rawVal.startsWith('{')) setValue(key, JSON.parse(rawVal))
            else { const num = Number(rawVal); setValue(key, isNaN(num) ? rawVal : num) }
        } catch (e) { setValue(key, rawVal) }
    }

    const getTargetValue = (key) => {
        const val = formData.value[key]
        return (val === true || val === undefined) ? '' : (Array.isArray(val) ? JSON.stringify(val) : val)
    }

    const setTargetValue = (key, rawVal) => {
        if (rawVal === '' || rawVal.toLowerCase() === 'true') { setValue(key, true); return }
        try {
            const parsed = JSON.parse(rawVal)
            if (Array.isArray(parsed)) { setValue(key, parsed); return }
        } catch (e) {}
        setValue(key, rawVal)
    }

    const handleJsonInput = (event) => {
        const newVal = event.target.value
        jsonStr.value = newVal
        try {
            const parsed = JSON.parse(newVal)
            jsonError.value = ''
            formData.value = parsed
            emitUpdateData()
        } catch (e) { jsonError.value = e.message }
    }

    // Focus/Callback Logic
    const focusData = computed(() => (typeof formData.value.focus === 'object' && formData.value.focus !== null) ? formData.value.focus : {})
    const availableFocusEvents = computed(() => focusEventTypes.filter(type => !Object.keys(focusData.value).includes(type)))

    const addFocusParam = (type) => {
        if (!formData.value.focus || typeof formData.value.focus !== 'object') formData.value.focus = {}
        formData.value.focus[type] = ''
        emitUpdateData()
    }

    const removeFocusParam = (key) => {
        if (formData.value.focus) {
            delete formData.value.focus[key]
            if (Object.keys(formData.value.focus).length === 0) delete formData.value.focus
            emitUpdateData()
        }
    }

    const updateFocusParam = (key, value) => {
        if (!formData.value.focus) formData.value.focus = {}
        formData.value.focus[key] = value
        emitUpdateData()
    }

    watch(() => props.visible, (val) => {
        if (val) {
            formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {}))
            updateJsonFromForm()
            jsonError.value = ''
        }
    }, { immediate: true })

    watch(() => props.nodeData?.data, (newData) => {
        if (props.visible && newData) {
            formData.value = JSON.parse(JSON.stringify(newData))
            updateJsonFromForm()
        }
    }, { deep: true })

    return {
        formData, jsonStr, jsonError, getValue, setValue, getArrayValue, setArrayValue,
        getJsonValue, setJsonValue, getTargetValue, setTargetValue, handleJsonInput,
        focusData, availableFocusEvents, addFocusParam, removeFocusParam, updateFocusParam
    }
}