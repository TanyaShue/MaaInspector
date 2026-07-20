import { beforeEach, describe, expect, it } from 'vitest'
import { useAnnouncementState } from '@/features/changelog/useAnnouncementState'

describe('useAnnouncementState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('marks a release as read when the announcement closes', () => {
    const state = useAnnouncementState('v1.2.3')

    expect(state.hasUnread.value).toBe(true)
    state.open()
    expect(state.visible.value).toBe(true)

    state.close()
    expect(state.visible.value).toBe(false)
    expect(state.hasUnread.value).toBe(false)
    expect(useAnnouncementState('v1.2.3').hasUnread.value).toBe(false)
  })

  it('shows the unread indicator for a newer release', () => {
    useAnnouncementState('v1.2.3').close()

    expect(useAnnouncementState('v1.2.4').hasUnread.value).toBe(true)
  })
})
