/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DeviceScreen from '@/components/Flow/DeviceScreen.vue'

const colorRange = { lower: [10, 20, 30], upper: [100, 120, 140] }
const calculateSelectionColorRange = vi.fn().mockResolvedValue(colorRange)

vi.mock('@/services/api', () => ({
  deviceApi: {
    getScreenshot: vi.fn().mockResolvedValue({
      image: 'data:image/png;base64,screenshot',
      size: [1280, 720]
    }),
    ocrText: vi.fn()
  }
}))

const DeviceScreenCanvasStub = defineComponent({
  name: 'DeviceScreenCanvas',
  emits: ['selection-change', 'selection-complete', 'preview-generated', 'image-uploaded', 'refresh'],
  setup(_, { emit, expose }) {
    expose({
      calculateSelectionColorRange,
      generatePreviewSnapshot: vi.fn().mockResolvedValue('data:image/png;base64,preview'),
      resetView: vi.fn(),
      isDragging: false
    })
    return () => h(
      'button',
      {
        'data-test': 'complete-selection',
        onClick: () => {
          const selection = { x: 10, y: 20, w: 30, h: 40 }
          emit('selection-change', selection)
          emit('selection-complete', selection)
        }
      },
      'select'
    )
  }
})

const DeviceScreenSidebarStub = defineComponent({
  name: 'DeviceScreenSidebar',
  props: {
    colorRange: Object,
    colorRangeError: String,
    isColorRangeLoading: Boolean
  },
  emits: ['confirm'],
  template: '<button data-test="confirm" @click="$emit(\'confirm\')">confirm</button>'
})

describe('DeviceScreen color range picker', () => {
  it('calculates the selected pixels and forwards the range to confirmation', async () => {
    const wrapper = mount(DeviceScreen, {
      props: { visible: true, mode: 'color_range', colorMethod: 4 },
      global: {
        stubs: {
          DeviceScreenCanvas: DeviceScreenCanvasStub,
          DeviceScreenSidebar: DeviceScreenSidebarStub
        }
      }
    })
    await flushPromises()

    await wrapper.get('[data-test="complete-selection"]').trigger('click')
    await nextTick()
    await flushPromises()

    expect(calculateSelectionColorRange).toHaveBeenCalledWith(4)
    expect(wrapper.findComponent(DeviceScreenSidebarStub).props('colorRange')).toEqual(colorRange)

    await wrapper.get('[data-test="confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual([colorRange])
  })
})
