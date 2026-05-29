import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WordCount } from './types'

export const useEditorStore = defineStore('editor', () => {
  const currentContent = ref('')
  const isDirty = ref(false)
  const wordCount = ref<WordCount>({ totalChars: 0, chineseChars: 0, words: 0, lines: 0 })
  const jumpToLine = ref<number | null>(null)
  const autoSave = ref(true)
  const showAutoSaveWarning = ref(false)

  const totalChars = computed(() => wordCount.value.totalChars)
  const chineseChars = computed(() => wordCount.value.chineseChars)

  function setContent(content: string) {
    currentContent.value = content
  }

  function setDirty(dirty: boolean) {
    isDirty.value = dirty
  }

  function setWordCount(wc: WordCount) {
    wordCount.value = wc
  }

  function setJumpToLine(line: number | null) {
    jumpToLine.value = line
  }

  function setAutoSave(enabled: boolean) {
    autoSave.value = enabled
  }

  return {
    currentContent, isDirty, wordCount, jumpToLine, autoSave, showAutoSaveWarning,
    totalChars, chineseChars,
    setContent, setDirty, setWordCount, setJumpToLine, setAutoSave,
  }
})
