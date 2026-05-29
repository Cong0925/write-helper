import { ref, watch, onUnmounted } from 'vue'
import { appState } from './store'
import type { FileEntry } from './store'

export function useCtxMenu() {
  const visible = ref(false)
  const x = ref(0)
  const y = ref(0)
  const target = ref<FileEntry | null>(null)
  let myStamp = 0

  function show(opts: { x: number; y: number; target: FileEntry }) {
    visible.value = true
    x.value = opts.x
    y.value = opts.y
    target.value = opts.target
    myStamp = ++appState.ctxMenuStamp
  }

  function hide() {
    visible.value = false
    target.value = null
    myStamp = 0
  }

  // Close when another context menu opens
  watch(() => appState.ctxMenuStamp, (stamp) => {
    if (myStamp !== 0 && stamp !== myStamp) {
      hide()
    }
  })

  function onDocumentClick(e: MouseEvent) {
    if (!visible.value) return
    const el = e.target as HTMLElement
    if (!el.closest('.ctx-menu')) {
      hide()
    }
  }

  watch(visible, (v) => {
    if (v) {
      document.addEventListener('click', onDocumentClick, true)
    } else {
      document.removeEventListener('click', onDocumentClick, true)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick, true)
  })

  return { visible, x, y, target, show, hide }
}
