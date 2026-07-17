import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RecognitionTab from '@/components/Flow/NodeDetailsPanels/RecognitionTab.vue'
import type { NodeFormMethods } from '@/composables/useNodeForm'

const createForm = () => {
  const setValue = vi.fn()
  const form = {
    getValue: (_key: string, defaultValue?: unknown) => defaultValue,
    setValue,
    setValues: vi.fn(),
    getJsonValue: vi.fn(() => ''),
    setJsonValue: vi.fn(),
  } as unknown as NodeFormMethods
  return { form, setValue }
}

const stubs = {
  RecognitionCommonFields: true,
  TemplateMatchFields: true,
  FeatureMatchFields: true,
  OcrFields: true,
  NeuralNetworkFields: true,
  CompositeRecognitionEditor: true,
  CustomCompletionEditor: true,
}

describe('recognition method options', () => {
  it('limits color matching to RGB, HSV and grayscale methods', async () => {
    const { form, setValue } = createForm()
    const wrapper = mount(RecognitionTab, {
      props: { currentRecognition: 'ColorMatch', form },
      global: { stubs },
    })

    const methodSelect = wrapper.find('select')
    expect(methodSelect.findAll('option').map(option => option.attributes('value'))).toEqual([
      '4',
      '40',
      '6',
    ])

    await methodSelect.setValue('40')
    expect(setValue).toHaveBeenCalledWith('method', 40)
  })

  it('limits template matching to the three supported OpenCV methods', () => {
    const { form } = createForm()
    const wrapper = mount(RecognitionTab, {
      props: { currentRecognition: 'TemplateMatch', form },
      global: { stubs },
    })

    expect(wrapper.find('select').findAll('option').map(option => option.attributes('value'))).toEqual([
      '1',
      '3',
      '5',
    ])
  })
})
