import { ref } from 'vue'

const LAST_SEEN_RELEASE_KEY = 'maa-inspector:last-seen-release'

const readLastSeenRelease = (): string | null => {
  try {
    return localStorage.getItem(LAST_SEEN_RELEASE_KEY)
  } catch {
    return null
  }
}

const storeLastSeenRelease = (releaseId: string) => {
  try {
    localStorage.setItem(LAST_SEEN_RELEASE_KEY, releaseId)
  } catch {
    // The announcement still works when storage is disabled.
  }
}

export const useAnnouncementState = (releaseId: string) => {
  const visible = ref(false)
  const hasUnread = ref(readLastSeenRelease() !== releaseId)

  const open = () => {
    visible.value = true
  }

  const close = () => {
    visible.value = false
    hasUnread.value = false
    storeLastSeenRelease(releaseId)
  }

  return {
    visible,
    hasUnread,
    open,
    close
  }
}
