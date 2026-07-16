import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { UseDraggableWindowOptions } from '@/composables/useDraggableWindow'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

import { useDraggableWindow } from '@/composables/useDraggableWindow'

describe('useDraggableWindow', () => {
  const wrappers: VueWrapper[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
  })

  function createDraggableWindow(options?: UseDraggableWindowOptions) {
    let draggableWindow: ReturnType<typeof useDraggableWindow> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        const resolvedOptions = options
          ? { initialPosition: { x: 100, y: 100 }, ...options }
          : undefined
        draggableWindow = useDraggableWindow(resolvedOptions)
        return () => null
      }
    }))
    wrappers.push(wrapper)

    if (!draggableWindow) {
      throw new Error('Failed to initialize draggable window')
    }

    return {
      ...draggableWindow,
      unmount: () => wrapper.unmount()
    }
  }

  describe('initial position', () => {
    it('should use default position when no options', () => {
      const { position } = createDraggableWindow()
      expect(position.value.x).toBe(100)
      expect(position.value.y).toBe(100)
    })

    it('should use provided initial position', () => {
      const { position } = createDraggableWindow({
        initialPosition: { x: 250, y: 350 }
      })
      expect(position.value.x).toBe(250)
      expect(position.value.y).toBe(350)
    })

    it('should load position from localStorage when persistKey provided', () => {
      localStorageMock.setItem('test-window-pos', JSON.stringify({ x: 400, y: 500 }))
      const { position } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      expect(position.value.x).toBe(400)
      expect(position.value.y).toBe(500)
    })

    it('should fallback to default position when stored position is invalid', () => {
      localStorageMock.setItem('test-window-pos', 'invalid json')
      const { position } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      expect(position.value.x).toBe(100)
      expect(position.value.y).toBe(100)
    })

    it('should fallback when stored position has missing coordinates', () => {
      localStorageMock.setItem('test-window-pos', JSON.stringify({ x: 400 }))
      const { position } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      expect(position.value.x).toBe(100)
      expect(position.value.y).toBe(100)
    })
  })

  describe('startDrag', () => {
    it('should set isDragging to true', () => {
      const { startDrag, isDragging } = createDraggableWindow()
      const mockEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(isDragging.value).toBe(true)
    })

    it('should not start drag when clicking on input', () => {
      const { startDrag, isDragging } = createDraggableWindow()
      const input = document.createElement('input')
      const mockEvent = {
        target: input,
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(isDragging.value).toBe(false)
    })

    it('should not start drag when clicking on button', () => {
      const { startDrag, isDragging } = createDraggableWindow()
      const button = document.createElement('button')
      const mockEvent = {
        target: button,
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(isDragging.value).toBe(false)
    })

    it('should not start drag when clicking on textarea', () => {
      const { startDrag, isDragging } = createDraggableWindow()
      const textarea = document.createElement('textarea')
      const mockEvent = {
        target: textarea,
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(isDragging.value).toBe(false)
    })

    it('should not start drag when clicking on select', () => {
      const { startDrag, isDragging } = createDraggableWindow()
      const select = document.createElement('select')
      const mockEvent = {
        target: select,
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(isDragging.value).toBe(false)
    })

    it('should add event listeners on start', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const { startDrag } = createDraggableWindow()
      const mockEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockEvent)
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('onDrag', () => {
    it('should update position during drag', () => {
      const { startDrag, position } = createDraggableWindow()
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      const moveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 200 })
      document.dispatchEvent(moveEvent)
      expect(position.value.x).toBe(150)
      expect(position.value.y).toBe(150)
    })

    it('should not update position when not dragging', () => {
      const { position } = createDraggableWindow()
      const moveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 200 })
      document.dispatchEvent(moveEvent)
      expect(position.value.x).toBe(100)
      expect(position.value.y).toBe(100)
    })
  })

  describe('stopDrag', () => {
    it('should set isDragging to false', () => {
      const { startDrag, stopDrag, isDragging } = createDraggableWindow()
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      stopDrag()
      expect(isDragging.value).toBe(false)
    })

    it('should save position to localStorage when persistKey provided', () => {
      const { startDrag, stopDrag } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      stopDrag()
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should not save position when no persistKey', () => {
      const { startDrag, stopDrag } = createDraggableWindow()
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      stopDrag()
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should do nothing on stop if not dragging', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const { stopDrag } = createDraggableWindow()
      stopDrag()
      expect(removeEventListenerSpy).not.toHaveBeenCalled()
    })
  })

  describe('bounds clamping', () => {
    it('should clamp position to bounds during drag', () => {
      const { startDrag, position } = createDraggableWindow({
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 }
      })
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      const moveEvent = new MouseEvent('mousemove', { clientX: 600, clientY: 600 })
      document.dispatchEvent(moveEvent)
      expect(position.value.x).toBeLessThanOrEqual(500)
      expect(position.value.y).toBeLessThanOrEqual(500)
    })

    it('should clamp position to min bounds during drag', () => {
      const { startDrag, position } = createDraggableWindow({
        bounds: { minX: 50, minY: 50, maxX: 500, maxY: 500 }
      })
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      const moveEvent = new MouseEvent('mousemove', { clientX: 0, clientY: 0 })
      document.dispatchEvent(moveEvent)
      expect(position.value.x).toBeGreaterThanOrEqual(50)
      expect(position.value.y).toBeGreaterThanOrEqual(50)
    })
  })

  describe('setPosition', () => {
    it('should set position directly', () => {
      const { setPosition, position } = createDraggableWindow()
      setPosition({ x: 300, y: 400 })
      expect(position.value.x).toBe(300)
      expect(position.value.y).toBe(400)
    })

    it('should clamp position to bounds', () => {
      const { setPosition, position } = createDraggableWindow({
        bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 }
      })
      setPosition({ x: 300, y: 400 })
      expect(position.value.x).toBe(200)
      expect(position.value.y).toBe(200)
    })

    it('should save position when persistKey provided', () => {
      const { setPosition } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      setPosition({ x: 300, y: 400 })
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('resetPosition', () => {
    it('should reset to initial position', () => {
      const { resetPosition, position, startDrag } = createDraggableWindow()
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      const moveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 200 })
      document.dispatchEvent(moveEvent)
      resetPosition()
      expect(position.value.x).toBe(100)
      expect(position.value.y).toBe(100)
    })

    it('should save position when persistKey provided', () => {
      const { resetPosition } = createDraggableWindow({
        persistKey: 'test-window-pos'
      })
      resetPosition()
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('cleanup on unmount', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const { startDrag, unmount } = createDraggableWindow()
      const mockStartEvent = {
        target: document.createElement('div'),
        clientX: 150,
        clientY: 150
      } as unknown as MouseEvent
      startDrag(mockStartEvent)
      unmount()
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })
})
