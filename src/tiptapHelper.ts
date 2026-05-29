import type { Editor } from '@tiptap/vue-3'

let _editor: Editor | null = null

export function setTiptapEditor(editor: Editor | null) {
  _editor = editor
}

export function getTiptapEditor(): Editor | null {
  return _editor
}
