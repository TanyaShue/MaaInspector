export type EditorActiveState = boolean | (() => boolean)

export const isEditorActive = (state: EditorActiveState | undefined): boolean =>
  typeof state === 'function' ? state() : state !== false

export const onlyWhenEditorActive = <T extends Event>(
  state: EditorActiveState | undefined,
  handler: (event: T) => void
) => (event: T) => {
  if (!isEditorActive(state)) return
  handler(event)
}
