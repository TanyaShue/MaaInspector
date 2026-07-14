import type { FlowNodeMeta, FlowBusinessData, FlowNode, TemplateImage } from '@/utils/flowTypes'
import type { useImageManager } from '@/composables/useImageManager'
import { normalizeTemplateList, normalizeTemplateValue } from '@/utils/templateUtils'
import { ensureNodeMeta } from '@/utils/nodeHelpers'

export const modifyTemplatePath = (
  nodeData: FlowNodeMeta,
  path: string,
  mode: 'add' | 'remove' = 'add'
) => {
  if (!nodeData.data) nodeData.data = {}
  const tpl = (nodeData.data as FlowBusinessData).template

  let paths = normalizeTemplateList(tpl)

  if (mode === 'add') {
    if (!paths.includes(path)) paths.push(path)
  } else if (mode === 'remove') {
    paths = paths.filter((p) => p !== path)
  }
  const nextTemplate = normalizeTemplateValue(paths)
  if (nextTemplate === undefined) delete (nodeData.data as FlowBusinessData).template
  else (nodeData.data as FlowBusinessData).template = nextTemplate
}

export const updateCompositeTemplate = (
  meta: FlowNodeMeta,
  target: { compositeKey: 'all_of' | 'any_of'; compositeIndex: number },
  updater: (current: string[]) => string[]
) => {
  if (!meta.data) meta.data = {}
  const data = meta.data as Record<string, unknown>

  const applyUpdate = (list: unknown, assign: (nextList: unknown[]) => void) => {
    if (!Array.isArray(list) || target.compositeIndex < 0 || target.compositeIndex >= list.length)
      return
    const item = list[target.compositeIndex]
    if (!item || typeof item !== 'object') return
    const itemObj = { ...(item as Record<string, unknown>) }
    const current = normalizeTemplateList(itemObj.template)
    const next = updater(current)
    if (!next.length) delete itemObj.template
    else if (next.length === 1) itemObj.template = next[0]
    else itemObj.template = next
    const nextList = [...list]
    nextList[target.compositeIndex] = itemObj
    assign(nextList)
  }

  applyUpdate(data[target.compositeKey], (nextList) => {
    data[target.compositeKey] = nextList
  })

  const recognition = data.recognition
  if (recognition && typeof recognition === 'object' && !Array.isArray(recognition)) {
    const param = (recognition as Record<string, unknown>).param
    if (param && typeof param === 'object' && !Array.isArray(param)) {
      applyUpdate((param as Record<string, unknown>)[target.compositeKey], (nextList) => {
        ;(param as Record<string, unknown>)[target.compositeKey] = nextList
      })
    }
  }
}

export const handleSpecialAction = (
  node: FlowNode,
  actionData: FlowBusinessData,
  imageManager: ReturnType<typeof useImageManager>
) => {
  const meta = ensureNodeMeta(node)
  if (!meta) return
  const action = (actionData as Record<string, unknown>)._action as string | undefined
  const templateTarget = (actionData as Record<string, unknown>).templateTarget as
    | { compositeKey: 'all_of' | 'any_of'; compositeIndex: number }
    | undefined

  if (
    action === 'delete_images' ||
    (action === 'save_screenshot' &&
      Array.isArray((actionData as Record<string, unknown>).deletePaths))
  ) {
    const deletePaths = ((actionData as Record<string, unknown>).deletePaths as string[]) || []
    if (!deletePaths.length) return

    deletePaths.forEach((path) => imageManager.deleteImage(node.id, path))

    if (templateTarget) {
      deletePaths.forEach((path) => {
        updateCompositeTemplate(meta, templateTarget, (current) =>
          current.filter((p) => p !== path)
        )
      })
    } else {
      deletePaths.forEach((path) => modifyTemplatePath(meta, path, 'remove'))
    }
  }

  if (action === 'add_temp_image') {
    const { imagePath, imageBase64 } = actionData as Record<string, string>
    if (!imagePath || !imageBase64) return

    imageManager.addTempImage(node.id, imagePath, undefined, imageBase64)

    if (templateTarget) {
      updateCompositeTemplate(meta, templateTarget, (current) =>
        current.includes(imagePath) ? current : [...current, imagePath]
      )
    } else {
      modifyTemplatePath(meta, imagePath, 'add')
    }
  }

  if (action === 'restore_image') {
    const { imagePath } = actionData as Record<string, string>
    imageManager.restoreImage(node.id, imagePath)

    if (templateTarget) {
      updateCompositeTemplate(meta, templateTarget, (current) =>
        current.includes(imagePath) ? current : [...current, imagePath]
      )
    } else {
      modifyTemplatePath(meta, imagePath, 'add')
    }
  }

  if (action === 'save_image_changes') {
    const { validPaths, images, tempImages, deletedImages } = actionData as Record<
      string,
      unknown
    > & {
      validPaths?: string[]
      images?: TemplateImage[]
      tempImages?: TemplateImage[]
      deletedImages?: TemplateImage[]
    }
    const savedImages = images || []
    const pendingImages = tempImages || []
    const effectiveValidPaths = normalizeTemplateList(
      Array.isArray(validPaths)
        ? validPaths
        : [...savedImages, ...pendingImages].map((image) => image.path)
    )

    pendingImages.forEach((image) => {
      if (image.path && !effectiveValidPaths.includes(image.path)) {
        effectiveValidPaths.push(image.path)
      }
    })

    imageManager.applyNodeImageChanges(node.id, {
      images: savedImages,
      tempImages: pendingImages,
      deletedImages: deletedImages || [],
      validPaths: effectiveValidPaths,
    })

    if (!meta.data) meta.data = {}
    if (templateTarget) {
      updateCompositeTemplate(meta, templateTarget, () =>
        effectiveValidPaths.length ? [...effectiveValidPaths] : []
      )
    } else {
      if (effectiveValidPaths.length) {
        ;(meta.data as FlowBusinessData).template = [...effectiveValidPaths]
      } else {
        delete (meta.data as FlowBusinessData).template
      }
    }
  }
}
