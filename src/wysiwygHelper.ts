/**
 * Wysiwyg (contenteditable) editor helper — tracks the active instance
 * so FindReplace can search/replace within it.
 */
export interface WysiwygHandle {
  el: HTMLDivElement | null
  folderDir?: string       // e.g. "大纲", "设定", "人设", "素材"
  getContent: () => string
  setContent: (val: string) => void
  focus: () => void
}

let _active: WysiwygHandle | null = null

export function setActiveWysiwyg(h: WysiwygHandle | null) {
  _active = h
}

export function getActiveWysiwyg(): WysiwygHandle | null {
  return _active
}
