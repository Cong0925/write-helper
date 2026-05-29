import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchResult } from './types'

export const useSearchStore = defineStore('search', () => {
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])
  const searchExpanded = ref(new Set<string>())
  const isSearching = ref(false)
  const findScope = ref<'chapter' | 'all'>('chapter')

  function setResults(results: SearchResult[]) {
    searchResults.value = results
  }

  function clearResults() {
    searchResults.value = []
  }

  function toggleExpanded(filePath: string) {
    const s = new Set(searchExpanded.value)
    if (s.has(filePath)) s.delete(filePath)
    else s.add(filePath)
    searchExpanded.value = s
  }

  return {
    searchQuery, searchResults, searchExpanded, isSearching, findScope,
    setResults, clearResults, toggleExpanded,
  }
})
