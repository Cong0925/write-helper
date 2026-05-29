import { watch } from 'vue'
import { useEditorStore } from '@/stores/useEditorStore'
import { getWordCount } from '@/api/export'
import { debounce } from '@/utils/editorHelper'

export function useWordCount() {
  const editorStore = useEditorStore()

  const updateWordCount = debounce(async (text: string) => {
    try {
      const wc = await getWordCount(text)
      editorStore.setWordCount(wc)
    } catch { /* ignore */ }
  }, 300)

  watch(
    () => editorStore.currentContent,
    (text) => updateWordCount(text),
    { immediate: true },
  )
}
