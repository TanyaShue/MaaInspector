import { describe, expect, it } from 'vitest'
import {
  calculateColorRange,
  calculateSelectionPixelBounds,
  rgbToGray,
  rgbToOpenCvHsv
} from '@/utils/colorRange'

describe('colorRange', () => {
  it('calculates RGB bounds from opaque pixels', () => {
    const result = calculateColorRange(
      new Uint8ClampedArray([10, 80, 200, 255, 30, 20, 220, 255, 5, 100, 150, 255]),
      4
    )

    expect(result).toEqual({ lower: [5, 20, 150], upper: [30, 100, 220] })
  })

  it('converts RGB primaries to OpenCV HSV bounds', () => {
    expect(rgbToOpenCvHsv(255, 0, 0)).toEqual([0, 255, 255])
    expect(rgbToOpenCvHsv(0, 255, 0)).toEqual([60, 255, 255])
    expect(rgbToOpenCvHsv(0, 0, 255)).toEqual([120, 255, 255])

    expect(
      calculateColorRange(
        new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
        40
      )
    ).toEqual({ lower: [0, 255, 255], upper: [120, 255, 255] })
  })

  it('calculates grayscale bounds', () => {
    expect(rgbToGray(255, 255, 255)).toBe(255)
    expect(rgbToGray(0, 0, 0)).toBe(0)
    expect(
      calculateColorRange(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 6)
    ).toEqual({ lower: [0], upper: [255] })
  })

  it('ignores fully transparent pixels', () => {
    expect(calculateColorRange(new Uint8ClampedArray([0, 0, 0, 0, 12, 34, 56, 255]), 4)).toEqual({
      lower: [12, 34, 56],
      upper: [12, 34, 56],
    })
  })

  it('returns null for empty, transparent, or unsupported input', () => {
    expect(calculateColorRange(new Uint8ClampedArray(), 4)).toBeNull()
    expect(calculateColorRange(new Uint8ClampedArray([1, 2, 3, 0]), 4)).toBeNull()
    expect(calculateColorRange(new Uint8ClampedArray([1, 2, 3, 255]), 7)).toBeNull()
  })

  it('covers the complete selected pixel area when scaling coordinates', () => {
    expect(calculateSelectionPixelBounds(
      { x: 10.25, y: 20.25, w: 5.5, h: 4.5 },
      { width: 100, height: 100 },
      { width: 200, height: 300 }
    )).toEqual({ x: 20, y: 60, w: 12, h: 15 })
  })

  it('clamps selection bounds to the source image', () => {
    expect(calculateSelectionPixelBounds(
      { x: 95, y: 98, w: 10, h: 10 },
      { width: 100, height: 100 },
      { width: 200, height: 200 }
    )).toEqual({ x: 190, y: 196, w: 10, h: 4 })
  })
})
