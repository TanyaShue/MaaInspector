import { resourceApi } from '@/services/api'
import type { FlowBusinessData, TemplateImage } from '@/utils/flowTypes'
import { isPipelineV2Nodes, toPipelineV1Nodes } from '@/utils/pipelineTransform'

export interface ResourceDocumentPayload {
  source: string
  filename: string
  nodes: Record<string, FlowBusinessData>
  images: Record<string, TemplateImage[]>
  imageBasePath?: string
  fileVersion: 'V1' | 'V2'
}

const normalizeImages = (value: unknown): Record<string, TemplateImage[]> => {
  if (!value || typeof value !== 'object') return {}
  const normalized: Record<string, TemplateImage[]> = {}

  Object.entries(value).forEach(([nodeId, images]) => {
    if (!Array.isArray(images)) return
    normalized[nodeId] = images.filter((image): image is TemplateImage =>
      !!image &&
      typeof image === 'object' &&
      typeof (image as TemplateImage).path === 'string'
    )
  })
  return normalized
}

export const loadResourceDocument = async (
  source: string,
  filename: string
): Promise<ResourceDocumentPayload> => {
  const [nodeResponse, imageResponse] = await Promise.all([
    resourceApi.getFileNodes<Record<string, FlowBusinessData>>(source, filename),
    resourceApi.getTemplateImages(source, filename),
  ])
  const rawNodes = nodeResponse.nodes || {}
  const fileVersion = isPipelineV2Nodes(rawNodes) ? 'V2' : 'V1'

  return {
    source,
    filename,
    nodes: fileVersion === 'V2' ? toPipelineV1Nodes(rawNodes) : rawNodes,
    images: normalizeImages(imageResponse.results),
    imageBasePath: (imageResponse as Record<string, unknown>).base_image_path as string | undefined,
    fileVersion,
  }
}
