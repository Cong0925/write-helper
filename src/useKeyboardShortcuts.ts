import { getEditorView } from './editorHelper'
import { appState } from './store'

function isArticleProject(): boolean {
  const pt = appState.project?.projectType || 'novel'
  return pt === 'wechat_article' || pt === 'toutiao_article'
}

type ShortcutFn = () => void

const actions: Record<string, ShortcutFn> = {}

export function registerShortcut(name: string, fn: ShortcutFn) {
  actions[name] = fn
}

export function unregisterShortcut(name: string) {
  delete actions[name]
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ctrl+N — new chapter (global)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'n') {
      e.preventDefault()
      actions['newChapter']?.()
      return
    }

    // Ctrl+. — fullscreen
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '.') {
      e.preventDefault()
      actions['toggleFullscreen']?.()
      return
    }

    // Ctrl+K — one-key formatting (stub)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'k') {
      e.preventDefault()
      actions['formatDoc']?.()
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

    // Alt+` — boss key (hide window)
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === '`') {
      e.preventDefault()
      actions['bossKey']?.()
      return
    }

    // Ctrl+0 — open settings → shortcuts section
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '0') {
      e.preventDefault()
      appState.settingsSection = 'shortcuts'
      appState.showSettings = true
      return
    }

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

    // Ctrl+F — find/replace
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'f') {
      // Allow in input fields (Cmd+F in browser is native)
      e.preventDefault()
      actions['toggleFindReplace']?.()
      return
    }

    // Ctrl+S — force save
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 's') {
      e.preventDefault()
      actions['saveFile']?.()
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
  const view = getEditorView()
  if (!view) return
  view.dispatch({
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
  view.focus()
}

function goToChapterEnd() {
  const view = getEditorView()
  if (!view) return
  const doc = view.state.doc
  view.dispatch({
    selection: { anchor: doc.length },
    scrollIntoView: true,
  })
  view.focus()
}
