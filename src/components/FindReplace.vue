<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import { appState, type SearchMatch } from '../store'
import { searchInProjectAdv, findAndReplaceAdv, readFile, readDirectory } from '../api'
import { getEditorView } from '../editorHelper'

const emit = defineEmits<{ close: [] }>()

// Panel position / drag
const panelX = ref(0)
const panelY = ref(0)
const isDragging = ref(false)
const dragStart = { x: 0, y: 0, elX: 0, elY: 0 }
onMounted(() => {
  // Default position: right side near top
  panelX.value = window.innerWidth - 520
  panelY.value = 60
})

function startDrag(e: MouseEvent) {
  isDragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.elX = panelX.value
  dragStart.elY = panelY.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  panelX.value = dragStart.elX + (e.clientX - dragStart.x)
  panelY.value = dragStart.elY + (e.clientY - dragStart.y)
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Mode
const mode = ref<'find' | 'replace'>('find')

// Inputs
const findText = ref('')
const replaceText = ref('')
const scope = ref<'chapter' | 'all'>('chapter')

// Options
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)

// Match state (current chapter - editor based)
const matches = ref<{ from: number; to: number; line: number; text: string }[]>([])
const currentMatch = ref(0)
const totalMatchCount = ref(0)

// Search results (full book)
const searchResults = ref<{ filePath: string; fileName: string; matches: SearchMatch[] }[]>([])

// Full-book search state
const fullBookLoading = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null

function buildRegex(query: string, cs: boolean, ww: boolean, regex: boolean): RegExp | null {
  let flags = 'g'
  if (!cs) flags += 'i'

  let pattern: string
  if (regex) {
    pattern = query
  } else {
    pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (ww) {
      pattern = `(?<![\\w\\u4e00-\\u9fff])${pattern}(?![\\w\\u4e00-\\u9fff])`
    }
  }

  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

// Search in current chapter (editor content)
function searchInEditor() {
  const view = getEditorView()
  if (!view || !findText.value) {
    matches.value = []
    totalMatchCount.value = 0
    currentMatch.value = 0
    return
  }

  const doc = view.state.doc
  const query = findText.value
  const allMatches: { from: number; to: number; line: number; text: string }[] = []

  // Get the document text
  const content = doc.toString()
  const re = buildRegex(query, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return

  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    // Calculate line number
    const line = content.slice(0, match.index).split('\n').length
    // Get the line content
    const lineStart = content.lastIndexOf('\n', match.index - 1) + 1
    const lineEnd = content.indexOf('\n', match.index)
    const lineText = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)

    allMatches.push({
      from: match.index,
      to: match.index + match[0].length,
      line,
      text: lineText.trim(),
    })

    if (match.index === re.lastIndex) re.lastIndex++
    if (allMatches.length > 10000) break
  }

  matches.value = allMatches
  totalMatchCount.value = allMatches.length
  if (currentMatch.value >= allMatches.length) {
    currentMatch.value = allMatches.length > 0 ? 0 : 0
  }
}

function goToMatch(index: number) {
  const view = getEditorView()
  if (!view || matches.value.length === 0) return
  if (index < 0) index = matches.value.length - 1
  if (index >= matches.value.length) index = 0
  currentMatch.value = index
  const m = matches.value[index]
  view.dispatch({
    selection: { anchor: m.from, head: m.to },
    scrollIntoView: true,
  })
  view.focus()
}

function prevMatch() { goToMatch(currentMatch.value - 1) }
function nextMatch() { goToMatch(currentMatch.value + 1) }

// Search full book
async function searchFullBook() {
  if (!findText.value || !appState.project) return
  fullBookLoading.value = true
  try {
    const results = await searchInProjectAdv(
      appState.project.path,
      findText.value,
      caseSensitive.value,
      wholeWord.value,
      useRegex.value,
    )
    searchResults.value = results

    let count = 0
    for (const r of results) count += r.matches.length
    totalMatchCount.value = count
    currentMatch.value = count > 0 ? 1 : 0
  } catch {
    searchResults.value = []
  } finally {
    fullBookLoading.value = false
  }
}

// Auto-search on input change
watch([findText, caseSensitive, wholeWord, useRegex], () => {
  searchResults.value = []
  matches.value = []
  if (searchTimer) clearTimeout(searchTimer)
  if (!findText.value) {
    totalMatchCount.value = 0
    return
  }

  if (scope.value === 'chapter') {
    searchTimer = setTimeout(() => searchInEditor(), 200)
  } else {
    // Full book: search after 1.5s debounce
    fullBookLoading.value = true
    searchTimer = setTimeout(() => searchFullBook(), 1500)
  }
})

watch(scope, () => {
  searchResults.value = []
  if (scope.value === 'chapter') {
    searchInEditor()
  }
})

// Replace handling
async function replaceCurrent() {
  if (!findText.value) return
  const view = getEditorView()
  if (!view || matches.value.length === 0) return

  const m = matches.value[currentMatch.value]
  if (!m) return

  view.dispatch({
    changes: { from: m.from, to: m.to, insert: replaceText.value },
  })
  appState.currentContent = view.state.doc.toString()
  appState.isDirty = true

  // Re-search after replace
  searchInEditor()
  if (currentMatch.value >= matches.value.length && matches.value.length > 0) {
    currentMatch.value = matches.value.length - 1
  }
}

async function replaceAll() {
  if (!findText.value) return

  if (scope.value === 'chapter') {
    // Replace in editor
    const view = getEditorView()
    if (!view) return
    const doc = view.state.doc
    const content = doc.toString()
    const query = findText.value
    const repl = replaceText.value
    const re = buildRegex(query, caseSensitive.value, wholeWord.value, useRegex.value)
    if (!re) return

    const newContent = content.replace(re, repl)

    view.dispatch({
      changes: { from: 0, to: content.length, insert: newContent },
    })
    appState.currentContent = newContent
    appState.isDirty = true
    searchInEditor()
  } else {
    // Replace in all files via backend
    if (!appState.project) return
    const scopeFile = ''
    try {
      await findAndReplaceAdv(
        appState.project.path,
        findText.value,
        replaceText.value,
        scopeFile,
        caseSensitive.value,
        wholeWord.value,
        useRegex.value,
      )
      // Reload current file
      if (appState.currentFile) {
        const content = await readFile(appState.currentFile.path)
        appState.currentContent = content
      }
      // Update file tree
      if (appState.project) {
        appState.fileTree = await readDirectory(appState.project.path)
      }
      searchFullBook()
    } catch {}
  }
}

function goToSearchResult(m: SearchMatch) {
  readFile(m.filePath).then(content => {
    appState.currentFile = { path: m.filePath, name: m.fileName }
    appState.currentContent = content
    appState.isDirty = false
    // Scroll to line
    setTimeout(() => {
      const view = getEditorView()
      if (!view) return
      const doc = view.state.doc
      if (m.lineNumber < 1 || m.lineNumber > doc.lines) return
      const line = doc.line(m.lineNumber)
      view.dispatch({
        selection: { anchor: line.from + m.matchStart, head: line.from + m.matchEnd },
        scrollIntoView: true,
      })
    }, 100)
  })
}

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

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
</script>

<template>
  <div
    class="find-replace-panel"
    :style="{ left: panelX + 'px', top: panelY + 'px' }"
  >
    <!-- Draggable header -->
    <div class="fr-header" @mousedown="startDrag">
      <div class="fr-tabs">
        <button class="fr-tab" :class="{ active: mode === 'find' }" @click.stop="mode = 'find'">查找</button>
        <button class="fr-tab" :class="{ active: mode === 'replace' }" @click.stop="mode = 'replace'">替换</button>
      </div>
      <span class="fr-drag-hint">⋮⋮</span>
      <button class="close-btn" @click.stop="$emit('close')">✕</button>
    </div>

    <div class="fr-body">
      <!-- Find input with match counter -->
      <div class="fr-input-wrap">
        <input
          v-model="findText"
          type="text"
          class="fr-input"
          placeholder="查找..."
          @keydown.enter="scope === 'chapter' ? nextMatch() : searchFullBook()"
        />
        <span v-if="findText && totalMatchCount > 0" class="match-counter">
          {{ scope === 'chapter' ? `${currentMatch + 1}/${totalMatchCount}` : `${totalMatchCount} 处` }}
        </span>
        <button v-if="findText" class="input-clear" @click="findText = ''">✕</button>
      </div>

      <!-- Replace input -->
      <div v-if="mode === 'replace'" class="fr-input-wrap">
        <input
          v-model="replaceText"
          type="text"
          class="fr-input"
          placeholder="替换为..."
          @keydown.enter="replaceCurrent"
        />
      </div>

      <!-- Options row -->
      <div class="fr-opt-row">
        <div class="fr-opt-group">
          <button class="opt-btn" :class="{ active: caseSensitive }" @click="caseSensitive = !caseSensitive" title="区分大小写">Aa</button>
          <button class="opt-btn" :class="{ active: wholeWord }" @click="wholeWord = !wholeWord" title="全词匹配">词</button>
          <button class="opt-btn" :class="{ active: useRegex }" @click="useRegex = !useRegex" title="正则表达式">.*</button>
        </div>
        <div class="fr-radio-group">
          <label class="fr-radio"><input v-model="scope" type="radio" value="chapter" /> 本章</label>
          <label class="fr-radio"><input v-model="scope" type="radio" value="all" /> 全书</label>
        </div>
      </div>

      <!-- Match navigation (current chapter) -->
      <div v-if="scope === 'chapter' && totalMatchCount > 0" class="fr-nav-row">
        <div class="fr-nav-buttons">
          <button class="fr-nav-btn" @click="prevMatch" :disabled="totalMatchCount === 0" title="上一个 (Shift+Enter)">▲</button>
          <button class="fr-nav-btn" @click="nextMatch" :disabled="totalMatchCount === 0" title="下一个 (Enter)">▼</button>
        </div>
        <div class="fr-replace-btns" v-if="mode === 'replace'">
          <button class="fr-action-btn" @click="replaceCurrent" :disabled="totalMatchCount === 0">替换当前</button>
          <button class="fr-action-btn primary" @click="replaceAll" :disabled="totalMatchCount === 0">全部替换</button>
        </div>
      </div>

      <!-- Replace buttons for full book -->
      <div v-if="scope === 'all' && findText" class="fr-nav-row">
        <button class="fr-action-btn" @click="searchFullBook" :disabled="fullBookLoading">
          {{ fullBookLoading ? '搜索中...' : '搜索全书' }}
        </button>
        <button v-if="mode === 'replace' && totalMatchCount > 0" class="fr-action-btn primary" @click="replaceAll">
          全部替换
        </button>
      </div>

      <!-- Loading indicator -->
      <div v-if="fullBookLoading" class="fr-loading">搜索中...</div>

      <!-- === Match results display === -->
      <!-- Current chapter results (inline, like VS Code) -->
      <div v-if="scope === 'chapter' && totalMatchCount > 0" class="fr-results">
        <div class="fr-results-header">
          {{ totalMatchCount }} 个匹配
        </div>
        <div class="fr-results-list">
          <div
            v-for="(m, i) in matches"
            :key="i"
            class="fr-result-item"
            :class="{ active: i === currentMatch }"
            @click="goToMatch(i)"
          >
            <span class="fr-result-num">{{ m.line }}</span>
            <span class="fr-result-text" v-html="highlightText(m.text, findText)"></span>
          </div>
        </div>
      </div>

      <!-- Full book results (like SearchPanel) -->
      <div v-if="scope === 'all' && searchResults.length > 0" class="fr-results">
        <div class="fr-results-header">
          共 {{ totalMatchCount }} 个结果，{{ searchResults.length }} 个文件
        </div>
        <div class="fr-results-list">
          <template v-for="file in searchResults" :key="file.filePath">
            <div class="fr-result-file">{{ file.fileName }} ({{ file.matches.length }})</div>
            <div
              v-for="(m, i) in file.matches"
              :key="i"
              class="fr-result-item"
              @click="goToSearchResult(m)"
            >
              <span class="fr-result-num">{{ m.lineNumber }}</span>
              <span class="fr-result-text" v-html="highlightText(m.lineContent.trim(), findText)"></span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.find-replace-panel {
  position: fixed;
  z-index: 200;
  width: 380px;
  max-height: 70vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.fr-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: grab;
  gap: 6px;
  -webkit-app-region: no-drag;
}
.fr-header:active { cursor: grabbing; }

.fr-tabs { display: flex; gap: 2px; }

.fr-tab {
  padding: 3px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
}
.fr-tab.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}
.fr-tab:hover:not(.active) { color: var(--text-primary); }

.fr-drag-hint {
  flex: 1;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  letter-spacing: 2px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
}
.close-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

.fr-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}

/* Input */
.fr-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: border-color 0.15s;
}
.fr-input-wrap:focus-within { border-color: var(--accent-color); }

.fr-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

.match-counter {
  padding: 0 6px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.input-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
}
.input-clear:hover { color: var(--text-primary); background: var(--hover-bg); }

/* Options */
.fr-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.fr-opt-group { display: flex; gap: 3px; }

.opt-btn {
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.1s;
  font-family: monospace;
  line-height: 1.5;
}
.opt-btn:hover { color: var(--text-primary); border-color: var(--text-muted); }
.opt-btn.active { color: var(--accent-color); border-color: var(--accent-color); background: var(--accent-light); }

.fr-radio-group { display: flex; gap: 10px; }

.fr-radio {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}
.fr-radio input { accent-color: var(--accent-color); }

/* Nav & actions */
.fr-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.fr-nav-buttons { display: flex; gap: 4px; }

.fr-nav-btn {
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.fr-nav-btn:hover:not(:disabled) { background: var(--hover-bg); color: var(--text-primary); }
.fr-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fr-replace-btns { display: flex; gap: 4px; }

.fr-action-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.fr-action-btn:hover:not(:disabled) { background: var(--hover-bg); color: var(--text-primary); }
.fr-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fr-action-btn.primary {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}
.fr-action-btn.primary:hover:not(:disabled) { opacity: 0.9; }

.fr-loading {
  text-align: center;
  padding: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Results display */
.fr-results {
  border-top: 1px solid var(--border-color);
  padding-top: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.fr-results-header {
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 4px 4px;
  font-weight: 500;
}

.fr-results-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.fr-result-file {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 4px 2px;
  margin-top: 4px;
}

.fr-result-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s;
}
.fr-result-item:hover { background: var(--hover-bg); }
.fr-result-item.active { background: var(--accent-light); }

.fr-result-num {
  color: var(--text-muted);
  font-size: 10px;
  min-width: 22px;
  text-align: right;
  font-family: monospace;
  flex-shrink: 0;
}

.fr-result-text {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fr-result-text :deep(mark) {
  background: rgba(243, 156, 18, 0.3);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}
</style>
