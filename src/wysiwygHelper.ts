/**
 * Wysiwyg (contenteditable) editor helper — tracks the active instance
 * so FindReplace can search/replace within it.
 *
 * ── Registry ──
 *   Each WysiwygEditor registers itself by folderDir ("大纲","人设","设定","素材")
 *   on mount so FindReplace can look it up by name.
 *
 * ── Active (legacy) ──
 *   _active tracks the most-recently focused editor for quick access.
 *   _captured keeps a frozen snapshot for FindReplace sessions.
 */
export interface WysiwygHandle {
  el: HTMLDivElement | null
  folderDir?: string       // e.g. "大纲", "设定", "人设", "素材"
  getContent: () => string
  setContent: (val: string) => void
  focus: () => void
}

let _active: WysiwygHandle | null = null
let _captured: WysiwygHandle | null = null

// Registry of all live Wysiwyg editors, keyed by folderDir
const _registry: Map<string, WysiwygHandle> = new Map()

export function setActiveWysiwyg(h: WysiwygHandle | null) {
  _active = h
}

export function getActiveWysiwyg(): WysiwygHandle | null {
  return _active
}

/** Freeze the currently-active handle so FindReplace keeps using it
 *  even after the editor loses focus. */
export function captureActiveWysiwyg(): WysiwygHandle | null {
  _captured = _active
  return _captured
}

/** Returns the handle that was captured when FindReplace opened. */
export function getCapturedWysiwyg(): WysiwygHandle | null {
  return _captured
}

/** Release the captured handle (called when FindReplace closes). */
export function clearCapturedWysiwyg() {
  _captured = null
}

// ─── Registry helpers (for FindReplace target dropdown) ───

/** Register a live Wysiwyg editor by folderDir so it can be looked up by name. */
export function registerWysiwyg(folderDir: string, handle: WysiwygHandle) {
  _registry.set(folderDir, handle)
}

/** Unregister a Wysiwyg editor when its component unmounts. */
export function unregisterWysiwyg(folderDir: string) {
  _registry.delete(folderDir)
}

/** Look up a Wysiwyg editor by folderDir (e.g. "大纲", "人设"). */
export function getWysiwygByFolder(folderDir: string): WysiwygHandle | undefined {
  return _registry.get(folderDir)
}

// ─── Positioning helpers (used by both FindReplace and FolderPanel) ───

/**
 * Walk the rendered DOM text nodes and select the Nth occurrence of the query.
 * Returns true if found, false otherwise.
 */
export function selectNthMatchInElement(el: HTMLElement, query: string, nth: number): boolean {
  if (!query) return false
  const lowerQuery = query.toLowerCase()
  const textNodes: { node: Text; globalOffset: number }[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false)
  let n: Text | null
  let totalOffset = 0
  while ((n = walker.nextNode() as Text | null)) {
    textNodes.push({ node: n, globalOffset: totalOffset })
    totalOffset += (n.textContent?.length || 0)
  }
  const fullText = el.textContent || ''
  const lowerText = fullText.toLowerCase()
  let pos = -1
  for (let i = 0; i <= nth; i++) {
    pos = lowerText.indexOf(lowerQuery, pos + 1)
    if (pos === -1) return false
  }
  for (const { node: tn, globalOffset } of textNodes) {
    const nodeLen = tn.textContent?.length || 0
    if (globalOffset + nodeLen > pos) {
      const localOff = pos - globalOffset
      if (localOff + query.length <= nodeLen) {
        const range = document.createRange()
        range.setStart(tn, localOff)
        range.setEnd(tn, localOff + query.length)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        return true
      }
    }
  }
  return false
}

/**
 * Scroll the Wysiwyg editor's scrollable container so the current
 * text selection is visible.
 */
export function scrollWysiwygToSelection(wysiwyg: WysiwygHandle) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !wysiwyg.el) return
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect) return
  let parent: HTMLElement | null = wysiwyg.el
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      const parentRect = parent.getBoundingClientRect()
      if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
        parent.scrollTop += rect.top - parentRect.top - 60
      }
      break
    }
    parent = parent.parentElement
  }
}
