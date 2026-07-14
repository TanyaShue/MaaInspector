import { resourceApi } from '@/services/api'
import { makeFileId } from '@/utils/fileId'
import { isPipelineV2Nodes, toPipelineV1Nodes } from '@/utils/pipelineTransform'
import type { FlowBusinessData, TemplateImage } from '@/utils/flowTypes'
import type { TabResourceInfo } from '@/utils/flowWorkspaceTypes'

interface ResourceFileInfo {
  source?: string | null
  value?: string | null
}

interface ResourceManagerRef {
  findFileById: (id: string) => ResourceFileInfo | undefined
  setMessage: (message: string) => void
}

type PreloadCacheEmit = {
  (e: 'load-nodes', payload: { filename: string; source: string; nodes: Record<string, FlowBusinessData>; fileVersion?: 'V1' | 'V2' }): void
  (e: 'load-images', images: Record<string, TemplateImage[]>, basePath?: string): void
}

interface CachedFileData {
  nodes: Record<string, FlowBusinessData>
  images: Record<string, TemplateImage[]>
  fileVersion?: 'V1' | 'V2'
}

interface UsePreloadCacheOptions {
  tabs: () => TabResourceInfo[] | undefined
  selectedResourceFile: () => string
  resourceManagerRef: () => ResourceManagerRef | null
  availableFiles?: () => ResourceFileInfo[]
  emit: PreloadCacheEmit
}

export function usePreloadCache(options: UsePreloadCacheOptions) {
  const preloadCache = new Map<string, CachedFileData>()

  const emitCachedFile = (
    payload: { filename: string; source: string; nodes: Record<string, FlowBusinessData>; fileVersion?: 'V1' | 'V2' },
    images: Record<string, TemplateImage[]>
  ) => {
    options.emit('load-nodes', payload)
    queueMicrotask(() => {
      options.emit('load-images', images)
    })
  }

  const preloadAllTabFiles = async () => {
    const tabs = options.tabs()
    if (!tabs || tabs.length === 0) return

    const filesToPreload = new Set<string>()
    const currentFileKey = options.selectedResourceFile()

    for (const tab of tabs) {
      const resourceFile = tab.resourceFile
      if (resourceFile) {
        const [source, filename] = resourceFile.split('|')
        if (source && filename) {
          const fileKey = resourceFile
          if (fileKey !== currentFileKey && !preloadCache.has(fileKey)) {
            filesToPreload.add(fileKey)
          }
        }
      }
    }

    if (filesToPreload.size === 0) return

    const preloadPromises = Array.from(filesToPreload).map(async (fileKey) => {
      const [source, filename] = fileKey.split('|')
      if (!source || !filename) return

      try {
        const [nodesRes, imagesRes] = await Promise.all([
          resourceApi.getFileNodes<Record<string, FlowBusinessData>>(source, filename),
          resourceApi.getTemplateImages(source, filename)
        ])

        const nodes = nodesRes.nodes || {}
        const fileVersion = isPipelineV2Nodes(nodes) ? 'V2' : 'V1'
        const normalizedNodes = fileVersion === 'V2' ? toPipelineV1Nodes(nodes) : nodes

        preloadCache.set(fileKey, {
          nodes: normalizedNodes,
          images: imagesRes.results as Record<string, TemplateImage[]> || {},
          fileVersion
        })
      } catch (e) {
        console.warn(`[预加载] 预加载文件失败: ${filename}`, e)
      }
    })

    await Promise.allSettled(preloadPromises)
  }

  const triggerLoadFromCache = (config: { filename: string; source: string; tabId: string }): boolean => {
    const fileKey = `${config.source}|${config.filename}`
    const cached = preloadCache.get(fileKey)

    if (!cached) return false

    emitCachedFile(
      { filename: config.filename, source: config.source, nodes: cached.nodes, fileVersion: cached.fileVersion },
      cached.images
    )
    preloadCache.delete(fileKey)
    return true
  }

  const handleFileSelected = (payload: { filename: string; source: string }) => {
    const rm = options.resourceManagerRef()

    const fileId = `${payload.source}|${payload.filename}`
    const fileObj = rm?.findFileById(fileId) ?? options.availableFiles?.().find(file => makeFileId(file.source ?? '', file.value ?? '') === fileId)
    if (!fileObj || !fileObj.value) return

    const src = fileObj.source ?? ''
    const fname = fileObj.value ?? ''
    const fileKey = `${src}|${fname}`

    const cached = preloadCache.get(fileKey)
    if (cached) {
      emitCachedFile(
        { filename: fname, source: src, nodes: cached.nodes, fileVersion: cached.fileVersion },
        cached.images
      )
      preloadCache.delete(fileKey)
      rm?.setMessage(`已加载: ${Object.keys(cached.nodes).length} 节点 (从缓存)`)
      return
    }

    rm?.setMessage('加载节点中...')
    resourceApi.getFileNodes<Record<string, FlowBusinessData>>(src, fname).then(res => {
      const nodes = res.nodes || {}
      const fileVersion = isPipelineV2Nodes(nodes) ? 'V2' : 'V1'
      const normalizedNodes = fileVersion === 'V2' ? toPipelineV1Nodes(nodes) : nodes

      options.emit('load-nodes', { filename: fname, source: src, nodes: normalizedNodes, fileVersion })
      rm?.setMessage(`已加载: ${Object.keys(nodes).length} 节点`)

      resourceApi.getTemplateImages(src, fname).then(imgRes => {
        const basePath = (imgRes as Record<string, unknown>).base_image_path as string | undefined
        options.emit(
          'load-images',
          (imgRes.results as Record<string, TemplateImage[]> | undefined) ?? {},
          basePath
        )
      }).catch(imgError => {
        console.warn("图片加载失败", imgError)
        options.emit('load-images', {})
      })

      void preloadAllTabFiles()
    }).catch(e => {
      console.error("加载节点失败", e)
      rm?.setMessage('节点加载失败')
    })
  }

  return {
    preloadCache,
    preloadAllTabFiles,
    triggerLoadFromCache,
    handleFileSelected
  }
}
