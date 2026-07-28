import { ref } from 'vue'
import { makeFileId } from '@/utils/fileId'

export interface ResourceDocumentChange {
  fileId: string
  source: string
  filename: string
  origin: string
  revision: number
}

const latestChange = ref<ResourceDocumentChange | null>(null)
let revision = 0

export const notifyResourceDocumentSaved = (
  source: string,
  filename: string,
  origin: string
) => {
  latestChange.value = {
    fileId: makeFileId(source, filename),
    source,
    filename,
    origin,
    revision: ++revision,
  }
}

export const useResourceDocumentChanges = () => latestChange

export const resetResourceDocumentChangesForTests = () => {
  latestChange.value = null
  revision = 0
}
