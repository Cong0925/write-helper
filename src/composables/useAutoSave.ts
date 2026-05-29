import { watch } from 'vue'
import { useEditorStore } from '@/stores/useEditorStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { writeFile } from '@/api/files'

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_DELAY = 1500

export function useAutoSave() {
  const editorStore = useEditorStore()
  const projectStore = useProjectStore()

  watch(
    () => editorStore.currentContent,
    (newContent) => {
      if (!editorStore.autoSave) return
      if (!projectStore.currentFile) return

      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(async () => {
        try {
          await writeFile(projectStore.currentFile!.path, newContent)
          editorStore.setDirty(false)
        } catch {
          editorStore.showAutoSaveWarning = true
        }
      }, AUTO_SAVE_DELAY)
    },
  )
}
