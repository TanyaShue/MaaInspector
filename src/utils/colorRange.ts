export const SUPPORTED_COLOR_METHODS = [4, 40, 6] as const

export type SupportedColorMethod = (typeof SUPPORTED_COLOR_METHODS)[number]

export interface ColorRangeResult {
  lower: number[]
  upper: number[]
}

export interface ImageRect {
  x: number
  y: number
  w: number
  h: number
}

export const calculateSelectionPixelBounds = (
  selection: ImageRect,
  logicalSize: { width: number; height: number },
  naturalSize: { width: number; height: number }
): ImageRect | null => {
  if (selection.w <= 0 || selection.h <= 0 || logicalSize.width <= 0 || logicalSize.height <= 0) return null

  const scaleX = naturalSize.width / logicalSize.width
  const scaleY = naturalSize.height / logicalSize.height
  const left = Math.max(0, Math.min(naturalSize.width, Math.floor(selection.x * scaleX)))
  const top = Math.max(0, Math.min(naturalSize.height, Math.floor(selection.y * scaleY)))
  const right = Math.max(left, Math.min(naturalSize.width, Math.ceil((selection.x + selection.w) * scaleX)))
  const bottom = Math.max(top, Math.min(naturalSize.height, Math.ceil((selection.y + selection.h) * scaleY)))

  if (right <= left || bottom <= top) return null
  return { x: left, y: top, w: right - left, h: bottom - top }
}

export const isSupportedColorMethod = (method: number): method is SupportedColorMethod =>
  SUPPORTED_COLOR_METHODS.includes(method as SupportedColorMethod)

export const rgbToOpenCvHsv = (r: number, g: number, b: number): [number, number, number] => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  if (hue < 0) hue += 360

  const saturation = max === 0 ? 0 : delta / max
  return [
    Math.min(179, Math.max(0, Math.round(hue / 2))),
    Math.round(saturation * 255),
    Math.round(max * 255),
  ]
}

export const rgbToGray = (r: number, g: number, b: number): number =>
  Math.round(0.299 * r + 0.587 * g + 0.114 * b)

export const calculateColorRange = (
  pixels: Uint8ClampedArray | number[],
  method: number
): ColorRangeResult | null => {
  if (!isSupportedColorMethod(method) || pixels.length < 4) return null

  const channelCount = method === 6 ? 1 : 3
  const lower = Array(channelCount).fill(255) as number[]
  const upper = Array(channelCount).fill(0) as number[]
  let validPixelCount = 0

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue

    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    const channels =
      method === 4 ? [r, g, b] : method === 40 ? rgbToOpenCvHsv(r, g, b) : [rgbToGray(r, g, b)]

    channels.forEach((value, channel) => {
      lower[channel] = Math.min(lower[channel], value)
      upper[channel] = Math.max(upper[channel], value)
    })
    validPixelCount++
  }

  return validPixelCount > 0 ? { lower, upper } : null
}
