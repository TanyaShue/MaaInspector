import { describe, expect, it } from 'vitest'
import {
  notifyResourceDocumentSaved,
  resetResourceDocumentChangesForTests,
  useResourceDocumentChanges,
} from '@/services/resourceDocumentEvents'

describe('resourceDocumentEvents', () => {
  it('publishes a monotonically increasing resource-file revision', () => {
    resetResourceDocumentChangesForTests()
    const changes = useResourceDocumentChanges()

    notifyResourceDocumentSaved('D:/resource', 'pipeline.json', 'sub-canvas-1')
    const firstRevision = changes.value.get('D:/resource|pipeline.json')?.revision ?? 0
    notifyResourceDocumentSaved('D:/resource', 'pipeline.json', 'sub-canvas-2')

    expect(changes.value.get('D:/resource|pipeline.json')).toEqual({
      fileId: 'D:/resource|pipeline.json',
      source: 'D:/resource',
      filename: 'pipeline.json',
      origin: 'sub-canvas-2',
      revision: firstRevision + 1,
    })
  })
})
