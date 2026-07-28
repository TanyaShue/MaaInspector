import { ref } from 'vue'
import { makeFileId } from '@/utils/fileId'

export interface ResourceDocumentChange {
  fileId: string
  source: string
  filename: string
  origin: string
  revision: number
}

const documentChanges = ref<Map<string, ResourceDocumentChange>>(new Map())
let revision = 0

export const notifyResourceDocumentSaved = (
  source: string,
  filename: string,
  origin: string
) => {
  const change = {
    fileId: makeFileId(source, filename),
    source,
    filename,
    origin,
    revision: ++revision,
  }
  documentChanges.value = new Map(documentChanges.value).set(change.fileId, change)
}

export const useResourceDocumentChanges = () => documentChanges

export const resetResourceDocumentChangesForTests = () => {
  documentChanges.value = new Map()
  revision = 0
}
