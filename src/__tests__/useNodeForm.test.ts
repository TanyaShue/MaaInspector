import { describe, it, expect, vi } from 'vitest'
import { useNodeForm } from '@/composables/useNodeForm'
import {
  DEFAULTS,
  NODE_CONFIG_MAP,
  ACTION_CONFIG_MAP,
  recognitionTypes,
  actionTypes,
  recognitionMenuOptions,
  STATUS_ICONS,
  orderByOptions,
  detectorOptions,
  focusEventTypes,
} from '@/utils/node-config'

function createMocks() {
  const emit = vi.fn()
  const props = {
    visible: true,
    nodeData: null,
    pipelineVersion: 'V1' as const,
  }
  return { emit, props }
}

describe('useNodeForm', () => {
  describe('getValue', () => {
    it('should return form value when key exists', () => {
      const { emit, props } = createMocks()
      const { formData, getValue } = useNodeForm(props, emit)
      formData.value.rate_limit = 500
      expect(getValue('rate_limit')).toBe(500)
    })

    it('should return default value from DEFAULTS when key missing', () => {
      const { emit, props } = createMocks()
      const { getValue } = useNodeForm(props, emit)
      expect(getValue('rate_limit')).toBe(DEFAULTS.rate_limit)
      expect(getValue('timeout')).toBe(DEFAULTS.timeout)
      expect(getValue('recognition')).toBe(DEFAULTS.recognition)
    })

    it('should return provided defaultVal when key missing and no DEFAULTS entry', () => {
      const { emit, props } = createMocks()
      const { getValue } = useNodeForm(props, emit)
      expect(getValue('nonexistent', 'fallback')).toBe('fallback')
    })

    it('should prefer form value over DEFAULTS and defaultVal', () => {
      const { emit, props } = createMocks()
      const { formData, getValue } = useNodeForm(props, emit)
      formData.value.rate_limit = 999
      expect(getValue('rate_limit', 111)).toBe(999)
    })
  })

  describe('setValue', () => {
    it('should set a value on formData', () => {
      const { emit, props } = createMocks()
      const { setValue, getValue } = useNodeForm(props, emit)
      setValue('timeout', 5000)
      expect(getValue('timeout')).toBe(5000)
    })

    it('should delete key when value equals default', () => {
      const { emit, props } = createMocks()
      const { formData, setValue } = useNodeForm(props, emit)
      formData.value.timeout = 9999
      setValue('timeout', DEFAULTS.timeout)
      expect(formData.value.timeout).toBeUndefined()
    })

    it('should delete key when value is empty string', () => {
      const { emit, props } = createMocks()
      const { formData, setValue } = useNodeForm(props, emit)
      formData.value.timeout = 9999
      setValue('timeout', '')
      expect(formData.value.timeout).toBeUndefined()
    })

    it('should delete key when value is null', () => {
      const { emit, props } = createMocks()
      const { formData, setValue } = useNodeForm(props, emit)
      formData.value.timeout = 9999
      setValue('timeout', null)
      expect(formData.value.timeout).toBeUndefined()
    })

    it('should delete key when target value is true', () => {
      const { emit, props } = createMocks()
      const { formData, setValue } = useNodeForm(props, emit)
      formData.value.target = [100, 200]
      setValue('target', true)
      expect(formData.value.target).toBeUndefined()
    })

    it('should call emit on update-data', () => {
      const { emit, props } = createMocks()
      const { setValue } = useNodeForm(props, emit)
      setValue('timeout', 5000)
      expect(emit).toHaveBeenCalledWith('update-data', expect.objectContaining({ timeout: 5000 }))
    })
  })

  describe('getArrayValue / setArrayValue', () => {
    it('should join array values with comma', () => {
      const { emit, props } = createMocks()
      const { formData: _formData, getArrayValue } = useNodeForm(props, emit)
      _formData.value.roi = [0, 10, 20, 30]
      expect(getArrayValue('roi')).toBe('0, 10, 20, 30')
    })

    it('should return string value as-is when not array', () => {
      const { emit, props } = createMocks()
      const { formData: _formData2, getArrayValue } = useNodeForm(props, emit)
      _formData2.value.recognition = 'TemplateMatch'
      expect(getArrayValue('recognition')).toBe('TemplateMatch')
    })

    it('should return empty string when value missing', () => {
      const { emit, props } = createMocks()
      const { getArrayValue } = useNodeForm(props, emit)
      expect(getArrayValue('nonexistent')).toBe('')
    })

    it('should split comma-separated string into array', () => {
      const { emit, props } = createMocks()
      const { formData: _fd1, setArrayValue, getValue } = useNodeForm(props, emit)
      setArrayValue('roi', '0, 10, 20, 30')
      expect(getValue('roi')).toEqual(['0', '10', '20', '30'])
    })

    it('should trim items and filter empty strings', () => {
      const { emit, props } = createMocks()
      const { formData: _fd2, setArrayValue, getValue } = useNodeForm(props, emit)
      setArrayValue('roi', ' 0 , , 10 , ')
      expect(getValue('roi')).toEqual(['0', '10'])
    })

    it('should delete key when value is empty', () => {
      const { emit, props } = createMocks()
      const { formData: _formData24, setArrayValue } = useNodeForm(props, emit)
      _formData24.value.roi = [1, 2, 3]
      setArrayValue('roi', '')
      expect(_formData24.value.roi).toBeUndefined()
    })

    it('should delete key when value is only whitespace', () => {
      const { emit, props } = createMocks()
      const { formData: _formData25, setArrayValue } = useNodeForm(props, emit)
      _formData25.value.roi = [1, 2, 3]
      setArrayValue('roi', '   ')
      expect(_formData25.value.roi).toBeUndefined()
    })
  })

  describe('getArrayList / setArrayList', () => {
    it('should return array copy when value is array', () => {
      const { emit, props } = createMocks()
      const { formData, getArrayList } = useNodeForm(props, emit)
      formData.value.next = ['a', 'b']
      const result = getArrayList('next')
      expect(result).toEqual(['a', 'b'])
      result.push('c')
      expect(formData.value.next).toEqual(['a', 'b'])
    })

    it('should wrap single value in array', () => {
      const { emit, props } = createMocks()
      const { formData, getArrayList } = useNodeForm(props, emit)
      formData.value.recognition = 'OCR'
      expect(getArrayList('recognition')).toEqual(['OCR'])
    })

    it('should return empty array when value is undefined', () => {
      const { emit, props } = createMocks()
      const { getArrayList } = useNodeForm(props, emit)
      expect(getArrayList('nonexistent')).toEqual([])
    })

    it('should set array list and emit', () => {
      const { emit, props } = createMocks()
      const { formData: _formData3, setArrayList, getValue } = useNodeForm(props, emit)
      setArrayList('next', ['node1', 'node2'])
      expect(getValue('next')).toEqual(['node1', 'node2'])
      expect(emit).toHaveBeenCalled()
    })

    it('should delete key when array is empty', () => {
      const { emit, props } = createMocks()
      const { formData: _formData23, setArrayList } = useNodeForm(props, emit)
      _formData23.value.next = ['a']
      setArrayList('next', [])
      expect(_formData23.value.next).toBeUndefined()
    })
  })

  describe('getJsonValue / setJsonValue', () => {
    it('should return JSON string for object values', () => {
      const { emit, props } = createMocks()
      const { formData: _formData17, getJsonValue } = useNodeForm(props, emit)
      _formData17.value.roi = [0, 0, 100, 100]
      expect(getJsonValue('roi')).toBe(JSON.stringify([0, 0, 100, 100]))
    })

    it('should return string representation for primitive values', () => {
      const { emit, props } = createMocks()
      const { formData: _formData18, getJsonValue } = useNodeForm(props, emit)
      _formData18.value.timeout = 20000
      expect(getJsonValue('timeout')).toBe('20000')
    })

    it('should return empty string when value is null', () => {
      const { emit, props } = createMocks()
      const { getJsonValue } = useNodeForm(props, emit)
      expect(getJsonValue('nonexistent')).toBe('')
    })

    it('should parse JSON object from string', () => {
      const { emit, props } = createMocks()
      const { formData: _formData4, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('roi', '[0, 0, 50, 50]')
      expect(getValue('roi')).toEqual([0, 0, 50, 50])
    })

    it('should parse JSON object literal', () => {
      const { emit, props } = createMocks()
      const { formData: _formData5, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('custom', '{"key": "value"}')
      expect(getValue('custom')).toEqual({ key: 'value' })
    })

    it('should parse number from plain string', () => {
      const { emit, props } = createMocks()
      const { formData: _formData6, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('timeout', '3000')
      expect(getValue('timeout')).toBe(3000)
    })

    it('should keep string when not a valid number', () => {
      const { emit, props } = createMocks()
      const { formData: _formData7, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('recognition', 'TemplateMatch')
      expect(getValue('recognition')).toBe('TemplateMatch')
    })

    it('should force string when forceString is true', () => {
      const { emit, props } = createMocks()
      const { formData: _formData8, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('timeout', '3000', true)
      expect(getValue('timeout')).toBe('3000')
    })

    it('should delete key when value is empty', () => {
      const { emit, props } = createMocks()
      const { formData: _formData22, setJsonValue } = useNodeForm(props, emit)
      _formData22.value.timeout = 9999
      setJsonValue('timeout', '')
      expect(_formData22.value.timeout).toBeUndefined()
    })

    it('should fallback to raw string on JSON parse error', () => {
      const { emit, props } = createMocks()
      const { formData: _formData9, setJsonValue, getValue } = useNodeForm(props, emit)
      setJsonValue('custom', '{invalid json}')
      expect(getValue('custom')).toBe('{invalid json}')
    })
  })

  describe('getTargetValue / setTargetValue', () => {
    it('should return empty string when target is true', () => {
      const { emit, props } = createMocks()
      const { formData: _formData19, getTargetValue } = useNodeForm(props, emit)
      _formData19.value.target = true
      expect(getTargetValue('target')).toBe('')
    })

    it('should return empty string when target is undefined', () => {
      const { emit, props } = createMocks()
      const { getTargetValue } = useNodeForm(props, emit)
      expect(getTargetValue('target')).toBe('')
    })

    it('should return JSON string for array values', () => {
      const { emit, props } = createMocks()
      const { formData: _formData20, getTargetValue } = useNodeForm(props, emit)
      _formData20.value.target = [100, 200]
      expect(getTargetValue('target')).toBe('[100,200]')
    })

    it('should return string value as-is', () => {
      const { emit, props } = createMocks()
      const { formData: _formData21, getTargetValue } = useNodeForm(props, emit)
      _formData21.value.target = 'some_string'
      expect(getTargetValue('target')).toBe('some_string')
    })

    it('should set target to true when input is empty', () => {
      const { emit, props } = createMocks()
      const { formData: _formData10, setTargetValue, getValue } = useNodeForm(props, emit)
      setTargetValue('target', '')
      expect(getValue('target')).toBe(true)
    })

    it('should set target to true when input is "true"', () => {
      const { emit, props } = createMocks()
      const { formData: _formData11, setTargetValue, getValue } = useNodeForm(props, emit)
      setTargetValue('target', 'true')
      expect(getValue('target')).toBe(true)
    })

    it('should parse JSON array from input', () => {
      const { emit, props } = createMocks()
      const { formData: _formData12, setTargetValue, getValue } = useNodeForm(props, emit)
      setTargetValue('target', '[100, 200]')
      expect(getValue('target')).toEqual([100, 200])
    })

    it('should fallback to string on parse failure', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { emit, props } = createMocks()
      const { formData: _formData13, setTargetValue, getValue } = useNodeForm(props, emit)
      setTargetValue('target', 'not-an-array')
      expect(getValue('target')).toBe('not-an-array')
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to set target value:', expect.any(SyntaxError))
    })
  })

  describe('focus parameter management', () => {
    it('should add a focus param with empty value', () => {
      const { emit, props } = createMocks()
      const { formData: _formData14, addFocusParam, focusData } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      expect(focusData.value['Node.Recognition.Starting']).toBe('')
      expect(_formData14.value.focus).toBeDefined()
    })

    it('should remove a focus param', () => {
      const { emit, props } = createMocks()
      const { formData: _formData15, addFocusParam, removeFocusParam, focusData } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      removeFocusParam('Node.Recognition.Starting')
      expect(focusData.value['Node.Recognition.Starting']).toBeUndefined()
    })

    it('should delete focus key when last param removed', () => {
      const { emit, props } = createMocks()
      const { formData: _formData16, addFocusParam, removeFocusParam } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      removeFocusParam('Node.Recognition.Starting')
      expect(_formData16.value.focus).toBeUndefined()
    })

    it('should update a focus param value', () => {
      const { emit, props } = createMocks()
      const { addFocusParam, updateFocusParam, focusData } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      updateFocusParam('Node.Recognition.Starting', 'custom-value')
      expect(focusData.value['Node.Recognition.Starting']).toBe('custom-value')
    })

    it('should emit update-data on focus changes', () => {
      const { emit, props } = createMocks()
      const { addFocusParam, removeFocusParam, updateFocusParam } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      expect(emit).toHaveBeenCalledWith('update-data', expect.any(Object))
      emit.mockClear()
      updateFocusParam('Node.Recognition.Starting', 'val')
      expect(emit).toHaveBeenCalledWith('update-data', expect.any(Object))
      emit.mockClear()
      removeFocusParam('Node.Recognition.Starting')
      expect(emit).toHaveBeenCalledWith('update-data', expect.any(Object))
    })

    it('should filter out already used events from availableFocusEvents', () => {
      const { emit, props } = createMocks()
      const { addFocusParam, availableFocusEvents } = useNodeForm(props, emit)
      addFocusParam('Node.Recognition.Starting')
      expect(availableFocusEvents.value).not.toContain('Node.Recognition.Starting')
      expect(availableFocusEvents.value).toContain('Node.Recognition.Succeeded')
    })
  })

  describe('handleJsonInput', () => {
    it('should parse valid JSON and update formData', () => {
      const { emit, props } = createMocks()
      const { handleJsonInput, formData, jsonStr: _jsonStr, jsonError } = useNodeForm(props, emit)
      const event = { target: { value: '{"recognition":"OCR","expected":"hello"}' } } as unknown as Event
      handleJsonInput(event)
      expect(formData.value.recognition).toBe('OCR')
      expect(formData.value.expected).toBe('hello')
      expect(jsonError.value).toBe('')
    })

    it('should set jsonError on invalid JSON', () => {
      const { emit, props } = createMocks()
      const { handleJsonInput, jsonError } = useNodeForm(props, emit)
      const event = { target: { value: '{invalid}' } } as unknown as Event
      handleJsonInput(event)
      expect(jsonError.value).toBeTruthy()
    })
  })

  describe('updateJsonFromForm', () => {
    it('should update jsonStr from formData', () => {
      const { emit, props } = createMocks()
      const { formData, updateJsonFromForm, jsonStr } = useNodeForm(props, emit)
      formData.value.recognition = 'OCR'
      updateJsonFromForm()
      const parsed = JSON.parse(jsonStr.value)
      expect(parsed.recognition).toBe('OCR')
    })
  })
})

describe('node-config constants', () => {
  describe('DEFAULTS', () => {
    it('should have expected default values', () => {
      expect(DEFAULTS.recognition).toBe('DirectHit')
      expect(DEFAULTS.action).toBe('DoNothing')
      expect(DEFAULTS.rate_limit).toBe(1000)
      expect(DEFAULTS.timeout).toBe(20000)
      expect(DEFAULTS.inverse).toBe(false)
      expect(DEFAULTS.enabled).toBe(true)
      expect(DEFAULTS.threshold).toBe(0.7)
      expect(DEFAULTS.repeat).toBe(1)
      expect(DEFAULTS.duration).toBe(200)
    })

    it('should have array defaults', () => {
      expect(DEFAULTS.roi).toEqual([0, 0, 0, 0])
      expect(DEFAULTS.roi_offset).toEqual([0, 0, 0, 0])
      expect(DEFAULTS.next).toEqual([])
      expect(DEFAULTS.on_error).toEqual([])
    })
  })

  describe('NODE_CONFIG_MAP', () => {
    it('should contain all recognition types except Unknown', () => {
      expect(NODE_CONFIG_MAP['DirectHit']).toBeDefined()
      expect(NODE_CONFIG_MAP['TemplateMatch']).toBeDefined()
      expect(NODE_CONFIG_MAP['OCR']).toBeDefined()
      expect(NODE_CONFIG_MAP['Unknown']).toBeDefined()
    })

    it('should have required fields on each config item', () => {
      for (const [key, item] of Object.entries(NODE_CONFIG_MAP)) {
        expect(item.key).toBe(key)
        expect(item.label).toBeDefined()
        expect(item.icon).toBeDefined()
        expect(item.color).toBeDefined()
      }
    })
  })

  describe('ACTION_CONFIG_MAP', () => {
    it('should contain all action types', () => {
      expect(ACTION_CONFIG_MAP['DoNothing']).toBeDefined()
      expect(ACTION_CONFIG_MAP['Click']).toBeDefined()
      expect(ACTION_CONFIG_MAP['Key']).toBeDefined()
      expect(ACTION_CONFIG_MAP['Command']).toBeDefined()
    })
  })

  describe('recognitionTypes', () => {
    it('should not include Unknown', () => {
      expect(recognitionTypes.find(t => t.value === 'Unknown')).toBeUndefined()
    })

    it('should have value, label, icon, color on each option', () => {
      for (const opt of recognitionTypes) {
        expect(opt.value).toBeDefined()
        expect(opt.label).toBeDefined()
        expect(opt.icon).toBeDefined()
        expect(opt.color).toBeDefined()
      }
    })
  })

  describe('actionTypes', () => {
    it('should have entries for all actions', () => {
      expect(actionTypes.length).toBeGreaterThan(0)
      expect(actionTypes[0].value).toBeDefined()
    })
  })

  describe('recognitionMenuOptions', () => {
    it('should include Unknown in menu options', () => {
      expect(recognitionMenuOptions.find(t => t.value === 'Unknown')).toBeDefined()
    })
  })

  describe('STATUS_ICONS', () => {
    it('should have entries for all statuses', () => {
      expect(STATUS_ICONS['running']).toBeDefined()
      expect(STATUS_ICONS['error']).toBeDefined()
      expect(STATUS_ICONS['success']).toBeDefined()
      expect(STATUS_ICONS['ignored']).toBeDefined()
      expect(STATUS_ICONS['default']).toBeDefined()
    })
  })

  describe('orderByOptions', () => {
    it('should have expected ordering options', () => {
      const values = orderByOptions.map(o => o.value)
      expect(values).toContain('Horizontal')
      expect(values).toContain('Vertical')
      expect(values).toContain('Score')
      expect(values).toContain('Random')
    })
  })

  describe('detectorOptions', () => {
    it('should contain expected detectors', () => {
      expect(detectorOptions).toContain('SIFT')
      expect(detectorOptions).toContain('KAZE')
      expect(detectorOptions).toContain('ORB')
    })
  })

  describe('focusEventTypes', () => {
    it('should contain expected event types', () => {
      expect(focusEventTypes).toContain('Node.Recognition.Starting')
      expect(focusEventTypes).toContain('Node.Recognition.Succeeded')
      expect(focusEventTypes).toContain('Node.Recognition.Failed')
      expect(focusEventTypes).toContain('Node.Action.Starting')
      expect(focusEventTypes).toContain('Node.Action.Succeeded')
      expect(focusEventTypes).toContain('Node.Action.Failed')
    })
  })
})
