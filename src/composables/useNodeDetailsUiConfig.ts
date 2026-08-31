import { readonly, ref } from 'vue'
import type { NodeDetailsUiConfig, PipelineSchemaDocument } from '@/utils/nodeDetailsUi'
import { validateNodeDetailsUiConfig } from '@/utils/nodeDetailsUi'

const config = ref<NodeDetailsUiConfig | null>(null)
const pipelineSchema = ref<PipelineSchemaDocument | null>(null)
const loading = ref(false)
const error = ref('')
let loadPromise: Promise<void> | null = null

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path} 加载失败 (${response.status})`)
  return response.json() as Promise<T>
}

const load = async () => {
  if (config.value && pipelineSchema.value) return
  if (loadPromise) return loadPromise
  loading.value = true
  error.value = ''
  loadPromise = (async () => {
    try {
      const [nextConfig, nextSchema] = await Promise.all([
        fetchJson<NodeDetailsUiConfig>('/node-details.ui.json'),
        fetchJson<PipelineSchemaDocument>('/pipeline.schema.json')
      ])
      const configErrors = validateNodeDetailsUiConfig(nextConfig)
      if (configErrors.length) throw new Error(configErrors.join('; '))
      config.value = nextConfig
      pipelineSchema.value = nextSchema
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      console.error('Failed to load node details configuration:', cause)
    } finally {
      loading.value = false
      loadPromise = null
    }
  })()
  return loadPromise
}

export const useNodeDetailsUiConfig = () => ({
  config,
  pipelineSchema,
  loading: readonly(loading),
  error: readonly(error),
  load
})
