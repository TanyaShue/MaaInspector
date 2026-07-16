import { describe, it, expect, vi } from 'vitest'
import { useDeviceScreenPicker } from '@/composables/useDeviceScreenPicker'

vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn(() => ({
      getNodeSavedImages: () => [],
      getNodeTempImages: () => [],
      getNodeDeletedImages: () => []
    }))
  }
})

describe('useDeviceScreenPicker', () => {
  it('writes OCR text back to the selected field', () => {
    const state: Record<string, unknown> = { expected: '' }
    const setValue = vi.fn((key: string, value: unknown) => {
      state[key] = value
    })
    const getValue = vi.fn((key: string, fallback?: unknown) => state[key] ?? fallback)
    const onUpdateData = vi.fn()

    const picker = useDeviceScreenPicker({
      formData: state,
      getValue,
      setValue,
      onUpdateData
    })

    picker.openDevicePicker('expected', 'roi', 'ROI')
    picker.handleDevicePick({
      text: '浏览器',
      best: { text: '浏览器', score: 0.98, box: [1, 2, 3, 4] },
      all: [{ text: '浏览器', score: 0.98, box: [1, 2, 3, 4] }],
      filtered: [{ text: '浏览器', score: 0.98, box: [1, 2, 3, 4] }]
    })

    expect(setValue).toHaveBeenCalledWith('expected', '浏览器')
  })

  it('opens color range mode with the current ROI and forwards the result', () => {
    const state: Record<string, unknown> = { roi: [10, 20, 30, 40] }
    const onConfirm = vi.fn()
    const picker = useDeviceScreenPicker({
      formData: state,
      getValue: (key: string, fallback?: unknown) => state[key] ?? fallback,
      setValue: vi.fn(),
      onUpdateData: vi.fn()
    })

    picker.openDevicePicker({
      field: 'color_range',
      mode: 'color_range',
      method: 40,
      referenceField: 'roi',
      onConfirm
    })

    expect(picker.deviceScreenConfig.mode).toBe('color_range')
    expect(picker.deviceScreenConfig.colorMethod).toBe(40)
    expect(picker.deviceScreenConfig.initialRect).toEqual([10, 20, 30, 40])

    const result = { lower: [0, 100, 120], upper: [20, 255, 255] }
    picker.handleDevicePick(result)
    expect(onConfirm).toHaveBeenCalledWith(result)
  })
})
