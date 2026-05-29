<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { appState, type SearchResult, type SearchMatch } from '../store'
import { searchInProject, searchInProjectAdv, readFile } from '../api'

const props = defineProps<{ query: string }>()
const results = ref<SearchResult[]>([])
const expandedFiles = ref<Set<string>>(new Set())
const loading = ref(false)
const totalMatches = ref(0)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Advanced options
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)

watch(() => props.query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q) {
    results.value = []
    totalMatches.value = 0
    return
  }
  loading.value = true
  // 2s debounce for global search
  debounceTimer = setTimeout(async () => {
    if (!appState.project) return
    try {
      let res: SearchResult[]
      if (caseSensitive.value || wholeWord.value || useRegex.value) {
        res = await searchInProjectAdv(
          appState.project.path,
          q,
          caseSensitive.value,
          wholeWord.value,
          useRegex.value,
        )
      } else {
        res = await searchInProject(appState.project.path, q)
      }
      results.value = res
      applySmartCollapse(res)
    } catch {
      results.value = []
    } finally {
      loading.value = false
    }
  }, 2000)
}, { immediate: true })

// Re-search when options change
watch([caseSensitive, wholeWord, useRegex], () => {
  if (props.query) {
    // Re-trigger the query watch
    const q = props.query
    if (debounceTimer) clearTimeout(debounceTimer)
    loading.value = true
    debounceTimer = setTimeout(async () => {
      if (!appState.project) return
      try {
        let res: SearchResult[]
        if (caseSensitive.value || wholeWord.value || useRegex.value) {
          res = await searchInProjectAdv(
            appState.project.path,
            q,
            caseSensitive.value,
            wholeWord.value,
            useRegex.value,
          )
        } else {
          res = await searchInProject(appState.project.path, q)
        }
        results.value = res
        applySmartCollapse(res)
      } catch {
        results.value = []
      } finally {
        loading.value = false
      }
    }, 2000)
  }
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function applySmartCollapse(res: SearchResult[]) {
  const fileCount = res.length
  const total = res.reduce((s, f) => s + f.matches.length, 0)
  expandedFiles.value = new Set(
    (fileCount === 1 || total <= 50) ? res.map(f => f.filePath) : []
  )
}

const allExpanded = computed(() => {
  if (results.value.length === 0) return false
  return results.value.every(f => expandedFiles.value.has(f.filePath))
})

function toggleExpandAll() {
  if (allExpanded.value) {
    expandedFiles.value = new Set()
  } else {
    expandedFiles.value = new Set(results.value.map(f => f.filePath))
  }
}

function toggleFile(filePath: string) {
  if (expandedFiles.value.has(filePath)) {
    expandedFiles.value.delete(filePath)
  } else {
    expandedFiles.value.add(filePath)
  }
}

function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text)
  const lowerQ = query.toLowerCase()
  const lowerText = text.toLowerCase()
  let result = ''
  let pos = 0
  while (pos < text.length) {
    const idx = lowerText.indexOf(lowerQ, pos)
    if (idx === -1) {
      result += escapeHtml(text.slice(pos))
      break
    }
    result += escapeHtml(text.slice(pos, idx))
    result += `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>`
    pos = idx + query.length
  }
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toggleCase() { caseSensitive.value = !caseSensitive.value }
function toggleWord() { wholeWord.value = !wholeWord.value }
function toggleRegex() { useRegex.value = !useRegex.value }

async function goToMatch(m: SearchMatch) {
  try {
    const content = await readFile(m.filePath)
    appState.currentFile = { path: m.filePath, name: m.fileName }
    appState.currentContent = content
    appState.isDirty = false
    // Scroll to line in editor
    appState.jumpToLine = m.lineNumber
  } catch {}
}

watch(results, (r) => {
  totalMatches.value = r.reduce((sum, f) => sum + f.matches.length, 0)
}, { immediate: true })

const filesCount = ref(0)
watch(results, (r) => {
  filesCount.value = r.length
}, { immediate: true })
</script>

<template>
  <div class="search-panel">
    <!-- Options bar -->
    <div class="search-options">
      <button class="opt-btn" :class="{ active: caseSensitive }" @click="toggleCase" title="区分大小写">Aa</button>
      <button class="opt-btn" :class="{ active: wholeWord }" @click="toggleWord" title="全词匹配">Ab</button>
      <button class="opt-btn" :class="{ active: useRegex }" @click="toggleRegex" title="正则表达式">.*</button>
    </div>

    <!-- Summary bar -->
    <div class="search-summary" v-if="!loading">
      <span>{{ totalMatches }} 个结果{{ filesCount > 0 ? `，${filesCount} 个文件` : '' }}</span>
      <div class="summary-actions" v-if="results.length > 0">
        <button class="summary-btn" @click="toggleExpandAll">{{ allExpanded ? '折叠全部' : '展开全部' }}</button>
      </div>
    </div>

    <div class="search-loading" v-if="loading">搜索中...</div>

    <div v-if="!loading && results.length === 0 && query" class="search-empty">
      暂未找到「{{ query }}」的相关内容
    </div>

    <div class="search-results">
      <div v-for="file in results" :key="file.filePath" class="file-group">
        <div class="file-header" @click="toggleFile(file.filePath)">
          <span class="file-toggle">{{ expandedFiles.has(file.filePath) ? '▼' : '▶' }}</span>
          <span class="file-icon">📄</span>
          <span class="file-name">{{ file.fileName }}</span>
          <span class="file-count">{{ file.matches.length }}</span>
        </div>

        <div v-if="expandedFiles.has(file.filePath)" class="file-matches">
          <div
            v-for="(m, i) in file.matches"
            :key="i"
            class="match-line"
            @click="goToMatch(m)"
          >
            <span class="match-num">{{ m.lineNumber }}</span>
            <span class="match-text" v-html="highlightText(m.lineContent.trim(), query)"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.search-options {
  display: flex;
  gap: 4px;
  padding: 0 12px 6px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.opt-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.1s;
  font-family: monospace;
}
.opt-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.opt-btn.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: var(--accent-light);
}

.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.summary-actions {
  display: flex;
  gap: 8px;
}

.summary-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 11px;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
}
.summary-btn:hover {
  text-decoration: underline;
}

.search-loading {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.search-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.file-group {
  margin-bottom: 2px;
}

.file-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}

.file-header:hover {
  background: var(--hover-bg);
}

.file-toggle {
  font-size: 8px;
  width: 12px;
  color: var(--text-muted);
}

.file-icon { font-size: 13px; }

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 500;
}

.file-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 1px 6px;
  border-radius: 8px;
}

.file-matches {
  border-left: 2px solid var(--border-color);
  margin-left: 20px;
}

.match-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s;
}

.match-line:hover {
  background: var(--hover-bg);
}

.match-num {
  color: var(--text-muted);
  font-size: 11px;
  min-width: 24px;
  text-align: right;
  font-family: monospace;
}

.match-text {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-text :deep(mark) {
  background: rgba(243, 156, 18, 0.3);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}
</style>
