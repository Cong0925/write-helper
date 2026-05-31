import { getEditorView } from './editorHelper'
import { appState, articleProjectTypes } from './store'
import { getTiptapEditor } from './tiptapHelper'

function isArticleProject(): boolean {
  const pt = appState.project?.projectType || ''
  return (articleProjectTypes as readonly string[]).includes(pt)
}

type ShortcutFn = () => void

const actions: Record<string, ShortcutFn> = {}

export function registerShortcut(name: string, fn: ShortcutFn) {
  actions[name] = fn
}

export function unregisterShortcut(name: string) {
  delete actions[name]
}

// ── Global functions (used by both shortcuts and UI buttons) ──

export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    appState.isFullscreen = true
  } else {
    document.exitFullscreen()
    appState.isFullscreen = false
  }
}

function bossKey() {
  // 老板键: 关闭敏感面板 → 最小化窗口
  if (appState.activeSidePanel) {
    appState.activeSidePanel = ''
  }
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    getCurrentWindow().minimize()
  })
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+N — new chapter (global)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'n') {
      e.preventDefault()
      actions['newChapter']?.()
      return
    }

    // Ctrl+. — fullscreen (works everywhere, including welcome page)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '.') {
      e.preventDefault()
      toggleFullscreen()
      return
    }

    // Ctrl+K — one-key formatting (article projects not supported)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'k') {
      if (!isArticleProject()) {
        e.preventDefault()
        actions['formatDoc']?.()
      }
      return
    }

    // Ctrl+Alt+S — insert separator line
    if (e.ctrlKey && !e.shiftKey && e.altKey && e.key === 's') {
      e.preventDefault()
      insertSeparator()
      return
    }

    // Ctrl+↑ — go to chapter start (always works in editor)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      goToChapterStart()
      return
    }

    // Ctrl+↓ — go to chapter end
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      goToChapterEnd()
      return
    }

    // Alt+` — boss key (works everywhere, including welcome page)
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === '`') {
      e.preventDefault()
      bossKey()
      return
    }

    // F5 — force refresh the webview (not handled by default in Tauri)
    if (e.key === 'F5') {
      e.preventDefault()
      location.reload()
      return
    }

    // F12 — open devtools (via Rust command, since JS API doesn't have it)
    if (e.key === 'F12') {
      e.preventDefault()
      import('./api').then(({ openDevtools }) => {
        openDevtools()
      })
      return
    }

    // Ctrl+Shift+I — open devtools (backup shortcut)
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.key === 'I') {
      e.preventDefault()
      import('./api').then(({ openDevtools }) => {
        openDevtools()
      })
      return
    }

    // Ctrl+0 — open settings → shortcuts section

    // Ctrl+1 — outline (disabled for article projects)
	if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '1') {
	  if (!isArticleProject()) {
	    e.preventDefault()
	    actions['showOutline']?.()
	  }
	  return
	}

    // Ctrl+2 — settings panel (disabled for article projects)
	if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '2') {
	  if (!isArticleProject()) {
	    e.preventDefault()
	    actions['showSettingsPanel']?.()
	  }
	  return
	}

    // Ctrl+F — find/replace (only opens, never closes)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'f') {
      e.preventDefault()
      if (!appState.showFindReplace) {
        actions['openFindReplace']?.()
      }
      return
    }

    // Ctrl+S — force save
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 's') {
      e.preventDefault()
      actions['saveFile']?.()
      return
    }

    // Ctrl+C — article project copy via custom pipeline
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'c') {
      if (isArticleProject()) {
        e.preventDefault()
        actions['articleCopy']?.()
      }
      return
    }

    // Ctrl+X — article project cut (custom copy then delete selection)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'x') {
      if (isArticleProject()) {
        e.preventDefault()
        actions['articleCut']?.()
      }
      return
    }
  })
}

// ===== Editor-level shortcuts (no registration needed) =====

function insertSeparator() {
  const view = getEditorView()
  if (!view) return
  const from = view.state.selection.main.from
  const doc = view.state.doc
  // Find the start of the current line
  const line = doc.lineAt(from)
  // Insert separator before the current line
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: '---\n' },
    selection: { anchor: line.from },
  })
  view.focus()
}

function goToChapterStart() {
  if (isArticleProject()) {
    const editor = getTiptapEditor()
    if (editor) {
      editor.commands.setTextSelection(0)
      editor.commands.focus()
      // Force scroll the ProseMirror container to top
      scrollTiptapTo(editor, 'start')
    }
    return
  }
  const view = getEditorView()
  if (!view) return
  view.dispatch({
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
  view.focus()
}

function goToChapterEnd() {
  if (isArticleProject()) {
    const editor = getTiptapEditor()
    if (editor) {
      const lastPos = Math.max(0, editor.state.doc.content.size - 1)
      editor.commands.setTextSelection(lastPos)
      editor.commands.focus()
      // Force scroll the ProseMirror container to bottom
      scrollTiptapTo(editor, 'end')
    }
    return
  }
  const view = getEditorView()
  if (!view) return
  const doc = view.state.doc
  view.dispatch({
    selection: { anchor: doc.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** Force-scroll the scrollable editor container */
function scrollTiptapTo(editor: NonNullable<ReturnType<typeof getTiptapEditor>>, pos: 'start' | 'end') {
  const dom = editor.view.dom as HTMLElement
  // Find the nearest scrollable ancestor (should be .tiptap-editor or .rich-editor-container)
  let parent = dom.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      parent.scrollTop = pos === 'start' ? 0 : parent.scrollHeight
      break
    }
    parent = parent.parentElement
  }
}
