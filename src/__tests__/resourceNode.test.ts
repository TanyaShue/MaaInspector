import { describe, expect, it } from 'vitest'
import { parseResourceNodeLocations } from '@/utils/resourceNode'

describe('parseResourceNodeLocations', () => {
  it('normalizes valid exact node locations and ignores malformed rows', () => {
    expect(parseResourceNodeLocations({
      results: [
        { source: 'resource-a', filename: 'a.json', node_id: 'node', display_id: 'node' },
        { source: 'resource-b', filename: 'broken.json' },
      ]
    })).toEqual([
      {
        source: 'resource-a',
        filename: 'a.json',
        nodeId: 'node',
        displayId: 'node',
      }
    ])
  })
})
