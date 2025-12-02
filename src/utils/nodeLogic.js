// nodeLogic.js
import {ref, computed, watch, reactive} from 'vue'
import {
    Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
    Square, MousePointer, Hand, ArrowRight, Layers, Fingerprint, Move,
    Mouse, Keyboard, Type, Play, Terminal, Wand2
} from 'lucide-vue-next'

// ================= 常量定义 =================

export const recognitionTypes = [
    {value: 'DirectHit', label: '直接命中', icon: Target, color: 'text-blue-500'},
    {value: 'TemplateMatch', label: '模板匹配', icon: Image, color: 'text-indigo-500'},
    {value: 'FeatureMatch', label: '特征匹配', icon: Sparkles, color: 'text-violet-500'},
    {value: 'ColorMatch', label: '颜色识别', icon: Palette, color: 'text-pink-500'},
    {value: 'OCR', label: 'OCR识别', icon: ScanText, color: 'text-emerald-500'},
    {value: 'NeuralNetworkClassify', label: '模型分类', icon: Brain, color: 'text-amber-500'},
    {value: 'NeuralNetworkDetect', label: '模型检测', icon: ScanEye, color: 'text-orange-500'},
    {value: 'Custom', label: '自定义', icon: Code2, color: 'text-slate-500'}
]

export const actionTypes = [
    {value: 'DoNothing', label: '无动作', icon: Square, color: 'text-slate-400'},
    {value: 'Click', label: '点击', icon: MousePointer, color: 'text-blue-500'},
    {value: 'LongPress', label: '长按', icon: Hand, color: 'text-blue-600'},
    {value: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500'},
    {value: 'MultiSwipe', label: '多指滑动', icon: Layers, color: 'text-indigo-600'},
    {value: 'TouchDown', label: '按下', icon: Fingerprint, color: 'text-violet-500'},
    {value: 'TouchMove', label: '移动', icon: Move, color: 'text-violet-500'},
    {value: 'TouchUp', label: '抬起', icon: Hand, color: 'text-violet-500'},
    {value: 'Scroll', label: '滚轮', icon: Mouse, color: 'text-cyan-500'},
    {value: 'ClickKey', label: '按键', icon: Keyboard, color: 'text-emerald-500'},
    {value: 'LongPressKey', label: '长按键', icon: Keyboard, color: 'text-emerald-600'},
    {value: 'KeyDown', label: '键按下', icon: Keyboard, color: 'text-teal-500'},
    {value: 'KeyUp', label: '键抬起', icon: Keyboard, color: 'text-teal-500'},
    {value: 'InputText', label: '输入文本', icon: Type, color: 'text-green-500'},
    {value: 'StartApp', label: '启动应用', icon: Play, color: 'text-sky-500'},
    {value: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500'},
    {value: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500'},
    {value: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500'},
    {value: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500'}
]

export const orderByOptions = [
    {value: 'Horizontal', label: '水平 (Horizontal)'},
    {value: 'Vertical', label: '垂直 (Vertical)'},
    {value: 'Score', label: '分数 (Score)'},
    {value: 'Area', label: '面积 (Area)'},
    {value: 'Length', label: '长度 (Length)'},
    {value: 'Random', label: '随机 (Random)'},
    {value: 'Expected', label: '期望 (Expected)'},
]

export const detectorOptions = ['SIFT', 'KAZE', 'AKAZE', 'BRISK', 'ORB']

export const focusEventTypes = [
    'Node.Recognition.Starting',
    'Node.Recognition.Succeeded',
    'Node.Recognition.Failed',
    'Node.Action.Starting',
    'Node.Action.Succeeded',
    'Node.Action.Failed'
]

export const DEFAULTS = {
    recognition: 'DirectHit',
    action: 'DoNothing',
    next: [],
    interrupt: [],
    on_error: [],
    is_sub: false,
    rate_limit: 1000,
    timeout: 20000,
    inverse: false,
    enabled: true,
    pre_delay: 200,
    post_delay: 200,
    pre_wait_freezes: 0,
    post_wait_freezes: 0,
    roi: [0, 0, 0, 0],
    roi_offset: [0, 0, 0, 0],
    index: 0,
    order_by: 'Horizontal',
    threshold: 0.7,
    method: 5,
    count: 4,
    detector: 'SIFT',
    ratio: 0.6,
    connected: false,
    only_rec: false,
    green_mask: false,
    target: true,
    duration: 200,
    contact: 0
}

// ================= 逻辑钩子 (Composable) =================

export function useNodeForm(props, emit) {
    const formData = ref({})
    const jsonStr = ref('')
    const jsonError = ref('')

    // --- Core Getters/Setters ---

    const updateJsonFromForm = () => {
        try {
            jsonStr.value = JSON.stringify(formData.value, null, 2)
            jsonError.value = ''
        } catch (e) {
        }
    }

    const emitUpdateData = () => {
        // 注意：这里我们通常不直接更新JSON字符串，除非在 activeTab 切走时
        updateJsonFromForm()
        emit('update-data', {...formData.value})
    }

    const getValue = (key, defaultVal) => {
        return formData.value[key] !== undefined ? formData.value[key] : (defaultVal ?? DEFAULTS[key])
    }

    const setValue = (key, value) => {
        if (key === 'target' && value === true) {
            delete formData.value[key]
            emitUpdateData()
            return
        }
        if (value === DEFAULTS[key] || value === '' || value === null) {
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

    // --- JSON Helpers ---

    const getJsonValue = (key) => {
        const val = getValue(key, null)
        return (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : val)
    }

    const setJsonValue = (key, rawVal) => {
        if (!rawVal || !rawVal.trim()) {
            setValue(key, null);
            return
        }
        try {
            if (rawVal.startsWith('[') || rawVal.startsWith('{')) setValue(key, JSON.parse(rawVal))
            else {
                const num = Number(rawVal);
                setValue(key, isNaN(num) ? rawVal : num)
            }
        } catch (e) {
            setValue(key, rawVal)
        }
    }

    const getTargetValue = (key) => {
        const val = formData.value[key]
        return (val === true || val === undefined) ? '' : (Array.isArray(val) ? JSON.stringify(val) : val)
    }

    const setTargetValue = (key, rawVal) => {
        if (rawVal === '' || rawVal.toLowerCase() === 'true') {
            setValue(key, true);
            return
        }
        try {
            const parsed = JSON.parse(rawVal)
            if (Array.isArray(parsed)) {
                setValue(key, parsed);
                return
            }
        } catch (e) {
        }
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
        } catch (e) {
            jsonError.value = e.message
        }
    }

    // --- Focus/Callback Logic ---

    const focusData = computed(() => {
        if (typeof formData.value.focus === 'object' && formData.value.focus !== null) return formData.value.focus
        return {}
    })

    const availableFocusEvents = computed(() => {
        const currentKeys = Object.keys(focusData.value)
        return focusEventTypes.filter(type => !currentKeys.includes(type))
    })

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

    // --- Initialization Watchers ---

    watch(() => props.visible, (val) => {
        if (val) {
            formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {}))
            updateJsonFromForm()
            jsonError.value = ''
        }
    }, {immediate: true})

    watch(() => props.nodeData?.data, (newData) => {
        if (props.visible && newData) {
            // 这里为了防止输入时光标跳动，可以加一个检查：如果正处于JSON编辑模式且无错误，不强制覆盖，
            // 但为了保持原逻辑一致性，这里保持原样。
            formData.value = JSON.parse(JSON.stringify(newData))
            updateJsonFromForm()
        }
    }, {deep: true})

    return {
        formData,
        jsonStr,
        jsonError,
        getValue,
        setValue,
        getArrayValue,
        setArrayValue,
        getJsonValue,
        setJsonValue,
        getTargetValue,
        setTargetValue,
        handleJsonInput,
        updateJsonFromForm,
        // Focus exports
        focusData,
        availableFocusEvents,
        addFocusParam,
        removeFocusParam,
        updateFocusParam
    }
}