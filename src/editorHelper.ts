import type { EditorView } from 'codemirror'

let _editorView: EditorView | null = null

export function setEditorView(view: EditorView | null) {
  _editorView = view
}

export function getEditorView(): EditorView | null {
  return _editorView
}
