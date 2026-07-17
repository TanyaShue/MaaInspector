export type EditorActiveState = boolean | (() => boolean)

interface PositionedItem {
  id: string
  position: { x: number; y: number }
}

export const isEditorActive = (state: EditorActiveState | undefined): boolean =>
  typeof state === 'function' ? state() : state !== false

export const normalizeKeyboardKey = (event: { key?: unknown }): string =>
  typeof event.key === 'string' ? event.key.toLowerCase() : ''

export const onlyWhenEditorActive = <T extends Event>(
  state: EditorActiveState | undefined,
  handler: (event: T) => void
) => (event: T) => {
  if (!isEditorActive(state)) return
  handler(event)
}

export const syncNodePositions = <T extends PositionedItem>(
  targetNodes: T[],
  movedNodes: PositionedItem[]
) => {
  const positions = new Map(movedNodes.map(item => [item.id, item.position]))
  targetNodes.forEach(item => {
    const position = positions.get(item.id)
    if (position) item.position = { ...position }
  })
}
