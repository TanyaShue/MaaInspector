import { describe, expect, it } from 'vitest'
import {
  actionResultFieldOrder,
  normalizeActionResult,
  normalizeRecognitionResults,
  recognitionResultKind,
} from '@/utils/debugResultAdapter'

describe('debug result adapters', () => {
  it('reads OCR candidates from MaaFramework raw_detail bundles', () => {
    const all = [
      { box: [13, 9, 69, 36], score: 0.988864, text: '8:50' },
      { box: [122, 432, 63, 19], score: 0.996937, text: 'Shizuku' },
    ]
    const filtered = [all[0]]
    const best = all[0]

    const result = normalizeRecognitionResults({
      algorithm: 'OCR',
      hit: true,
      all_results: [],
      best_result: { box: [13, 9, 69, 36] },
      raw_detail: { all, filtered, best },
    })

    expect(result).toEqual({ all, filtered, best })
    expect(result.best).toMatchObject({ text: '8:50', score: 0.988864 })
  })

  it.each([
    ['TemplateMatch', { box: [1, 2, 3, 4], score: 0.92 }, 'score'],
    ['FeatureMatch', { box: [1, 2, 3, 4], count: 18 }, 'count'],
    ['ColorMatch', { box: [1, 2, 3, 4], count: 240 }, 'count'],
    ['NeuralNetworkClassify', { box: [1, 2, 3, 4], score: 0.9, cls_index: 2, label: 'cat' }, 'neural'],
    ['NeuralNetworkDetect', { box: [1, 2, 3, 4], score: 0.8, cls_index: 4, label: 'button' }, 'neural'],
    ['Custom', { box: [1, 2, 3, 4], detail: { custom: true } }, 'custom'],
  ])('normalizes a direct %s result', (algorithm, rawDetail, kind) => {
    const result = normalizeRecognitionResults({
      algorithm,
      hit: true,
      raw_detail: rawDetail,
    })

    expect(result.all).toEqual([rawDetail])
    expect(result.filtered).toEqual([rawDetail])
    expect(result.best).toEqual(rawDetail)
    expect(recognitionResultKind(algorithm)).toBe(kind)
  })

  it('preserves recursive And/Or sub-recognition details', () => {
    const subDetails = [
      {
        algorithm: 'OCR',
        hit: true,
        box: [1, 2, 3, 4],
        raw_detail: { text: 'OK', score: 0.99, box: [1, 2, 3, 4] },
      },
      {
        algorithm: 'TemplateMatch',
        hit: false,
        box: [5, 6, 7, 8],
        raw_detail: { score: 0.2, box: [5, 6, 7, 8] },
      },
    ]

    const result = normalizeRecognitionResults({
      algorithm: 'Or',
      hit: true,
      raw_detail: {},
      sub_details: subDetails,
    })

    expect(result.all).toEqual(subDetails)
    expect(result.filtered).toEqual([subDetails[0]])
    expect(result.best).toEqual(subDetails[0])
  })

  it('handles DirectHit and unknown recognizers without inventing fields', () => {
    expect(
      normalizeRecognitionResults({ algorithm: 'DirectHit', hit: true, raw_detail: {} })
    ).toEqual({ all: [], filtered: [], best: undefined })

    const pluginResult = { confidence: 12, payload: { value: 'custom' } }
    expect(
      normalizeRecognitionResults({ algorithm: 'PluginReco', hit: true, raw_detail: pluginResult })
    ).toEqual({
      all: [pluginResult],
      filtered: [pluginResult],
      best: pluginResult,
    })
  })

  it('covers every MaaFramework action result family and preserves raw custom data', () => {
    const supported = [
      'DoNothing',
      'Click',
      'LongPress',
      'Swipe',
      'MultiSwipe',
      'TouchDown',
      'TouchMove',
      'TouchUp',
      'ClickKey',
      'LongPressKey',
      'KeyDown',
      'KeyUp',
      'InputText',
      'StartApp',
      'StopApp',
      'StopTask',
      'Scroll',
      'Command',
      'Shell',
      'Custom',
    ]
    supported.forEach((type) => expect(actionResultFieldOrder[type]).toBeDefined())

    const custom = { arbitrary: ['data'], nested: { ok: true } }
    expect(normalizeActionResult({ action: 'Custom', raw_detail: custom })).toEqual(custom)
    expect(normalizeActionResult({ action: 'DoNothing', raw_detail: null })).toEqual({})
  })
})
