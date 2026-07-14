import { ref, type Ref } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { TemplateImage, ImageDataPayload } from '@/utils/flowTypes'

interface FileScope {
  source: string
  filename: string
}

interface NodeImageBucket {
  saved: Map<string, TemplateImage>
  savedOrder: string[]
  temp: Map<string, TemplateImage>
  tempOrder: string[]
  deleted: Map<string, TemplateImage>
  deletedOrder: string[]
}

interface NodeImageStateSnapshot {
  images?: TemplateImage[]
  tempImages?: TemplateImage[]
  delImages?: TemplateImage[]
}

interface ImageManagerSnapshot {
  currentFile?: FileScope | null
  nodeImageStates?: Array<readonly [string, NodeImageStateSnapshot]>
}

interface ApplyImageChangesPayload {
  images?: TemplateImage[]
  tempImages?: TemplateImage[]
  deletedImages?: TemplateImage[]
  validPaths?: string[]
}

const createBucket = (): NodeImageBucket => ({
  saved: new Map(),
  savedOrder: [],
  temp: new Map(),
  tempOrder: [],
  deleted: new Map(),
  deletedOrder: []
})

const cloneImage = (image: TemplateImage): TemplateImage => ({ ...image })

const pushUnique = (order: string[], path: string) => {
  if (!order.includes(path)) order.push(path)
}

const removeFromOrder = (order: string[], path: string) => {
  const index = order.indexOf(path)
  if (index >= 0) order.splice(index, 1)
}

export function useImageManager() {
  const imageUrlCache = new Map<string, string>()
  const buckets = new Map<string, NodeImageBucket>()
  const nodeRevisions = new Map<string, Ref<number>>()
  // File-wide epoch. Node-local mutations use nodeRevisions so unrelated
  // CustomNode image computeds retain their cached value.
  const version = ref(0)
  const currentFile = ref<FileScope | null>(null)

  const touchAll = () => {
    version.value++
  }

  const ensureNodeRevision = (nodeId: string): Ref<number> => {
    let revision = nodeRevisions.get(nodeId)
    if (!revision) {
      revision = ref(0)
      nodeRevisions.set(nodeId, revision)
    }
    return revision
  }

  const touchNode = (nodeId: string) => {
    ensureNodeRevision(nodeId).value++
  }

  const getNodeVersion = (nodeId: string): number => ensureNodeRevision(nodeId).value

  const ensureBucket = (nodeId: string): NodeImageBucket => {
    let bucket = buckets.get(nodeId)
    if (!bucket) {
      bucket = createBucket()
      buckets.set(nodeId, bucket)
    }
    return bucket
  }

  const getBucket = (nodeId: string): NodeImageBucket | undefined => buckets.get(nodeId)

  const getImageUrl = (fullPath: string): string | undefined => {
    if (!fullPath) return undefined
    let url = imageUrlCache.get(fullPath)
    if (!url) {
      url = convertFileSrc(fullPath)
      imageUrlCache.set(fullPath, url)
    }
    return url
  }

  const normalizeImage = (image: TemplateImage): TemplateImage => {
    const next = cloneImage(image)
    if (next.fullPath) {
      next.url = getImageUrl(next.fullPath)
    } else if (!next.url && next.base64) {
      next.url = next.base64
    }
    return next
  }

  const setCollection = (
    collection: Map<string, TemplateImage>,
    order: string[],
    images: TemplateImage[]
  ) => {
    collection.clear()
    order.splice(0)

    images.forEach((image) => {
      if (!image.path) return
      collection.set(image.path, normalizeImage(image))
      pushUnique(order, image.path)
    })
  }

  const orderedImages = (collection: Map<string, TemplateImage>, order: string[]): TemplateImage[] =>
    order
      .map(path => collection.get(path))
      .filter((image): image is TemplateImage => !!image)
      .map(cloneImage)

  const resetForFile = (file: FileScope) => {
    currentFile.value = { ...file }
    buckets.clear()
    imageUrlCache.clear()
    nodeRevisions.clear()
    touchAll()
  }

  const replaceLoadedImages = (imageMap: Record<string, TemplateImage[] | unknown>) => {
    buckets.clear()
    nodeRevisions.clear()

    Object.entries(imageMap || {}).forEach(([nodeId, images]) => {
      if (!Array.isArray(images)) return
      const bucket = ensureBucket(nodeId)
      setCollection(bucket.saved, bucket.savedOrder, images.filter((image): image is TemplateImage =>
        !!image && typeof image === 'object' && typeof (image as TemplateImage).path === 'string'
      ))
    })

    touchAll()
  }

  const setNodeImages = (nodeId: string, images: TemplateImage[]) => {
    const bucket = ensureBucket(nodeId)
    setCollection(bucket.saved, bucket.savedOrder, images)
    bucket.temp.clear()
    bucket.tempOrder = []
    bucket.deleted.clear()
    bucket.deletedOrder = []
    touchNode(nodeId)
  }

  const getNodeSavedImages = (nodeId: string): TemplateImage[] => {
    const bucket = getBucket(nodeId)
    return bucket ? orderedImages(bucket.saved, bucket.savedOrder) : []
  }

  const getNodeTempImages = (nodeId: string): TemplateImage[] => {
    const bucket = getBucket(nodeId)
    return bucket ? orderedImages(bucket.temp, bucket.tempOrder) : []
  }

  const getNodeDeletedImages = (nodeId: string): TemplateImage[] => {
    const bucket = getBucket(nodeId)
    return bucket ? orderedImages(bucket.deleted, bucket.deletedOrder) : []
  }

  const getNodeImages = (nodeId: string): TemplateImage[] => [
    ...getNodeSavedImages(nodeId),
    ...getNodeTempImages(nodeId)
  ]

  const addTempImage = (nodeId: string, path: string, fullPath?: string, base64?: string) => {
    if (!path) return
    const bucket = ensureBucket(nodeId)
    const existing = bucket.temp.get(path)
    const next = normalizeImage({
      ...(existing || { path, found: true }),
      path,
      fullPath: fullPath ?? existing?.fullPath,
      base64: base64 ?? existing?.base64,
      found: true
    })

    bucket.temp.set(path, next)
    pushUnique(bucket.tempOrder, path)
    bucket.deleted.delete(path)
    removeFromOrder(bucket.deletedOrder, path)
    touchNode(nodeId)
  }

  const deleteImage = (nodeId: string, path: string) => {
    const bucket = getBucket(nodeId)
    if (!bucket || !path) return

    const saved = bucket.saved.get(path)
    if (saved) {
      bucket.saved.delete(path)
      removeFromOrder(bucket.savedOrder, path)
      bucket.deleted.set(path, normalizeImage(saved))
      pushUnique(bucket.deletedOrder, path)
      touchNode(nodeId)
      return
    }

    if (bucket.temp.delete(path)) {
      removeFromOrder(bucket.tempOrder, path)
      touchNode(nodeId)
    }
  }

  const restoreImage = (nodeId: string, path: string) => {
    const bucket = getBucket(nodeId)
    if (!bucket || !path) return

    const deleted = bucket.deleted.get(path)
    if (!deleted) return

    bucket.deleted.delete(path)
    removeFromOrder(bucket.deletedOrder, path)
    bucket.saved.set(path, normalizeImage(deleted))
    pushUnique(bucket.savedOrder, path)
    touchNode(nodeId)
  }

  const applyNodeImageChanges = (nodeId: string, changes: ApplyImageChangesPayload) => {
    const bucket = ensureBucket(nodeId)
    const validPathSet = Array.isArray(changes.validPaths) ? new Set(changes.validPaths) : null
    const savedImages = changes.images ?? []
    const tempImages = changes.tempImages ?? []
    const deletedImages = changes.deletedImages ?? []

    setCollection(
      bucket.saved,
      bucket.savedOrder,
      validPathSet ? savedImages.filter(image => validPathSet.has(image.path)) : savedImages
    )
    setCollection(
      bucket.temp,
      bucket.tempOrder,
      validPathSet ? tempImages.filter(image => validPathSet.has(image.path)) : tempImages
    )
    setCollection(
      bucket.deleted,
      bucket.deletedOrder,
      deletedImages.filter(image => (image as TemplateImage & { _source?: string })._source !== 'temp')
    )
    touchNode(nodeId)
  }

  const getPendingImageChanges = (): ImageDataPayload => {
    const delImages: ImageDataPayload['delImages'] = []
    const tempImages: ImageDataPayload['tempImages'] = []

    buckets.forEach((bucket, nodeId) => {
      bucket.deletedOrder.forEach((path) => {
        if (bucket.deleted.has(path)) delImages.push({ path, nodeId })
      })
      bucket.tempOrder.forEach((path) => {
        const image = bucket.temp.get(path)
        if (image?.base64) {
          tempImages.push({ path, base64: image.base64, nodeId })
        }
      })
    })

    return { delImages, tempImages }
  }

  const commitPendingImageChanges = () => {
    buckets.forEach((bucket, nodeId) => {
      const changed = bucket.tempOrder.length > 0 || bucket.deletedOrder.length > 0
      bucket.tempOrder.forEach((path) => {
        const image = bucket.temp.get(path)
        if (!image) return
        bucket.saved.set(path, normalizeImage({ ...image, base64: image.base64 }))
        pushUnique(bucket.savedOrder, path)
      })
      bucket.temp.clear()
      bucket.tempOrder = []
      bucket.deleted.clear()
      bucket.deletedOrder = []
      if (changed) touchNode(nodeId)
    })
  }

  const clearTempImageData = () => {
    commitPendingImageChanges()
  }

  const migrateNodeState = (oldId: string, newId: string) => {
    if (!oldId || !newId || oldId === newId) return
    const source = buckets.get(oldId)
    if (!source) return

    const target = buckets.get(newId)
    if (!target) {
      buckets.set(newId, source)
    } else {
      setCollection(target.saved, target.savedOrder, [
        ...orderedImages(target.saved, target.savedOrder),
        ...orderedImages(source.saved, source.savedOrder)
      ])
      setCollection(target.temp, target.tempOrder, [
        ...orderedImages(target.temp, target.tempOrder),
        ...orderedImages(source.temp, source.tempOrder)
      ])
      setCollection(target.deleted, target.deletedOrder, [
        ...orderedImages(target.deleted, target.deletedOrder),
        ...orderedImages(source.deleted, source.deletedOrder)
      ])
    }

    buckets.delete(oldId)
    touchNode(oldId)
    touchNode(newId)
  }

  const removeNodeState = (nodeId: string) => {
    if (buckets.delete(nodeId)) touchNode(nodeId)
  }

  const clearAll = () => {
    currentFile.value = null
    buckets.clear()
    imageUrlCache.clear()
    nodeRevisions.clear()
    touchAll()
  }

  const getImagePaths = (nodeId: string): string[] => {
    const bucket = getBucket(nodeId)
    if (!bucket) return []
    return [...bucket.savedOrder, ...bucket.tempOrder]
  }

  const getImagesForTemplatePaths = (nodeId: string, templatePaths: string[], limit = 16): TemplateImage[] => {
    void version.value
    void getNodeVersion(nodeId)
    const bucket = getBucket(nodeId)
    if (!bucket || !templatePaths.length || limit <= 0) return []

    const result: TemplateImage[] = []
    for (const path of templatePaths) {
      if (result.length >= limit) break
      const image = bucket.saved.get(path) ?? bucket.temp.get(path)
      if (!image || image.found === false) continue
      const normalized = normalizeImage(image)
      result.push(normalized)
    }
    return result
  }

  const getImagesForDisplay = (nodeId: string, templatePaths: string[]): TemplateImage[] =>
    getImagesForTemplatePaths(nodeId, templatePaths, 16)

  const getImagesForDisplayWithCache = (nodeId: string, templatePaths: string[]): TemplateImage[] =>
    getImagesForTemplatePaths(nodeId, templatePaths, 16)

  const hasTemplateChanged = (nodeId: string): boolean => {
    const bucket = getBucket(nodeId)
    if (!bucket) return false
    return bucket.tempOrder.length > 0 || bucket.deletedOrder.length > 0
  }

  const getImageData = (): ImageDataPayload => getPendingImageChanges()

  const exportState = (): ImageManagerSnapshot => ({
    currentFile: currentFile.value ? { ...currentFile.value } : null,
    nodeImageStates: Array.from(buckets.entries()).map(([nodeId, bucket]) => [
      nodeId,
      {
        images: orderedImages(bucket.saved, bucket.savedOrder),
        tempImages: orderedImages(bucket.temp, bucket.tempOrder),
        delImages: orderedImages(bucket.deleted, bucket.deletedOrder)
      }
    ] as const)
  })

  const restoreState = (snapshot?: ImageManagerSnapshot) => {
    currentFile.value = null
    buckets.clear()
    imageUrlCache.clear()
    nodeRevisions.clear()
    if (!snapshot) {
      touchAll()
      return
    }

    currentFile.value = snapshot.currentFile ? { ...snapshot.currentFile } : null
    snapshot.nodeImageStates?.forEach(([nodeId, state]) => {
      const bucket = ensureBucket(nodeId)
      setCollection(bucket.saved, bucket.savedOrder, state.images || [])
      setCollection(bucket.temp, bucket.tempOrder, state.tempImages || [])
      setCollection(bucket.deleted, bucket.deletedOrder, state.delImages || [])
    })
    touchAll()
  }

  const setNodeImageChanges = (nodeId: string, images: TemplateImage[], tempImages: TemplateImage[]) => {
    applyNodeImageChanges(nodeId, { images, tempImages, deletedImages: [] })
  }

  return {
    imageUrlCache,
    version,
    getNodeVersion,
    currentFile,
    resetForFile,
    replaceLoadedImages,
    getImageUrl,
    setNodeImages,
    setNodeImageChanges,
    getNodeImages,
    getNodeSavedImages,
    getNodeTempImages,
    getNodeDeletedImages,
    addTempImage,
    deleteImage,
    restoreImage,
    applyNodeImageChanges,
    getPendingImageChanges,
    commitPendingImageChanges,
    getImageData,
    clearTempImageData,
    clearNodeState: removeNodeState,
    removeNodeState,
    migrateNodeState,
    clearAll,
    getImagePaths,
    getImagesForDisplay,
    getImagesForDisplayWithCache,
    getImagesForTemplatePaths,
    hasTemplateChanged,
    exportState,
    restoreState
  }
}
