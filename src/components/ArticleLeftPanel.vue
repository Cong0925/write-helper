<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { appState, type FileEntry } from '../store'
import { readDirectory, createFile, readFile, deleteItem, renameFile, openInExplorer } from '../api'
import { dialog } from '../composables/useDialog'
import { registerShortcut, unregisterShortcut } from '../useKeyboardShortcuts'

const collapsed = ref(false)
const articles = ref<FileEntry[]>([])
const sortBy = ref<'date' | 'name'>('date')
const sortDesc = ref(true)
const fileSearchQuery = ref('')

const contentRoot = computed(() => {
  if (!appState.project) return ''
  const pt = appState.project.projectType || 'novel'
  const roots: Record<string, string> = {
    novel: '分卷',
    wechat_article: 'articles',
    toutiao_article: 'articles',
  }
  return appState.project.path + '/' + (roots[pt] || 'articles')
})

const isArticleProject = computed(() => {
  const pt = appState.project?.projectType || 'novel'
  return pt === 'wechat_article' || pt === 'toutiao_article'
})

const fileExt = computed(() => isArticleProject.value ? '.html' : '.md')

onMounted(async () => {
  await loadArticles()
  registerShortcut('newChapter', handleNewArticle)
})

onUnmounted(() => {
  unregisterShortcut('newChapter')
})

watch(() => appState.project, async (np, op) => {
  if (np && np !== op) await loadArticles()
})

async function loadArticles() {
  const root = contentRoot.value
  if (!root) return
  try {
    const entries = await readDirectory(root)
    // Normalize paths to forward slashes for cross-platform consistency
    // Accept .md (novel) or .html (article types)
    articles.value = entries
      .filter(e => !e.isDir && (e.name.endsWith('.md') || e.name.endsWith('.html')))
      .map(e => ({ ...e, path: e.path.replace(/\\/g, '/') }))
      .sort((a, b) => b.name.localeCompare(a.name))
  } catch {
    articles.value = []
  }
}

const sortedArticles = computed(() => {
  const list = [...articles.value]
  if (sortBy.value === 'date') {
    list.sort((a, b) => b.path.localeCompare(a.path))
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (sortDesc.value) list.reverse()
  return list
})

const filteredArticles = computed(() => {
  const q = fileSearchQuery.value.trim().toLowerCase()
  if (!q) return sortedArticles.value
  return sortedArticles.value.filter(e => e.name.toLowerCase().includes(q))
})

// Read file first, then set currentFile + currentContent together (no race)
let selectStamp = 0

async function selectArticle(entry: FileEntry) {
  const stamp = ++selectStamp
  try {
    const content = await readFile(entry.path)
    if (stamp !== selectStamp) return // stale: user clicked another file
    appState.currentFile = { path: entry.path, name: entry.name }
    appState.currentContent = content
    appState.isDirty = false
  } catch {}
}

function isActive(entry: FileEntry) {
  return appState.currentFile?.path === entry.path
}

async function handleNewArticle() {
  if (!appState.project) return
  const root = contentRoot.value
  if (!root) return
  const ext = fileExt.value
  // Generate filename from current date
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const baseName = `新文章_${dateStr}`
  let name = baseName
  let i = 1
  while (articles.value.some(a => a.name === `${name}${ext}`)) {
    name = `${baseName}_${i}`
    i++
  }
  const filePath = `${root}/${name}${ext}`
  try {
    await createFile(filePath)
    await loadArticles()
    // Only auto-open if no file is currently open
    if (!appState.currentFile) {
      editingPath.value = filePath
      const content = await readFile(filePath)
      appState.currentFile = { path: filePath, name: `${name}${ext}` }
      appState.currentContent = content
      appState.isDirty = false
    }
  } catch {}
}

// Inline rename
const editingPath = ref('')
const renameInput = ref('')
let renaming = false

function startRename(entry: FileEntry) {
  editingPath.value = entry.path
  renameInput.value = entry.name.replace(/\.(md|html)$/, '')
}

async function confirmRename(entry: FileEntry) {
  if (renaming) return
  if (!renameInput.value.trim()) { editingPath.value = ''; return }
  const origExt = entry.name.endsWith('.html') ? '.html' : '.md'
  const newName = renameInput.value.trim() + origExt
  if (newName === entry.name) { editingPath.value = ''; return }
  const dir = entry.path.substring(0, entry.path.lastIndexOf('/'))
  const newPath = dir + '/' + newName
  renaming = true
  try {
    await renameFile(entry.path, newPath)
  } catch (e) {
    await dialog.alert('重命名失败: ' + e)
    editingPath.value = ''
    renaming = false
    return
  }
  if (appState.currentFile?.path === entry.path) {
    appState.currentFile = { path: newPath, name: newName }
  }
  await loadArticles()
  editingPath.value = ''
  renaming = false
}

function handleRenameKeydown(e: KeyboardEvent, entry: FileEntry) {
  if (e.key === 'Enter') { e.preventDefault(); confirmRename(entry) }
  else if (e.key === 'Escape') { editingPath.value = '' }
}

async function handleDelete(entry: FileEntry) {
  const ok = await dialog.confirm(`删除文章「${articleTitle(entry.name)}」？此操作不可恢复！`)
  if (!ok) return
  try {
    await deleteItem(entry.path)
    if (appState.currentFile?.path === entry.path) {
      appState.currentFile = null
      appState.currentContent = ''
    }
    await loadArticles()
  } catch { await dialog.alert('删除失败') }
}

async function handleOpenFileLocation(entry: FileEntry) {
  try {
    await openInExplorer(entry.path)
  } catch { await dialog.alert('打开文件位置失败') }
}

// More menu (⋮)
const moreMenu = ref<{ show: boolean; entry: FileEntry | null; x: number; y: number }>({
  show: false, entry: null, x: 0, y: 0,
})

function showMoreMenu(entry: FileEntry, event: MouseEvent) {
  event.stopPropagation()
  const mx = Math.min(event.clientX, window.innerWidth - 180)
  const my = Math.min(event.clientY, window.innerHeight - 200)
  moreMenu.value = {
    show: true,
    entry,
    x: Math.max(8, mx),
    y: Math.max(8, my),
  }
}

function closeMoreMenu() {
  moreMenu.value.show = false
}

function handleMoreAction(action: 'openLocation' | 'delete') {
  const entry = moreMenu.value.entry
  if (!entry) return
  closeMoreMenu()
  if (action === 'openLocation') {
    handleOpenFileLocation(entry)
  } else if (action === 'delete') {
    handleDelete(entry)
  }
}

// Click outside to close more menu
let _moreMenuHandler: ((e: MouseEvent) => void) | null = null

watch(() => moreMenu.value.show, (v) => {
  if (v) {
    _moreMenuHandler = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest('.article-more-menu') && !el.closest('.art-act-more')) {
        moreMenu.value.show = false
      }
    }
    document.addEventListener('click', _moreMenuHandler, true)
  } else {
    if (_moreMenuHandler) {
      document.removeEventListener('click', _moreMenuHandler, true)
      _moreMenuHandler = null
    }
  }
})

onUnmounted(() => {
  if (_moreMenuHandler) {
    document.removeEventListener('click', _moreMenuHandler, true)
    _moreMenuHandler = null
  }
})

function formatDate(entry: FileEntry): string {
  // Use file modification time if available
  if (entry.modified) {
    const d = new Date(entry.modified)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    return `${dateStr} ${timeStr}`
  }
  // Fallback: extract date from filename pattern like "新文章_2026-05-27.md"
  const m = entry.name.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  return ''
}

function articleTitle(name: string): string {
  return name.replace(/\.(md|html)$/, '')
}
</script>

<template>
  <div class="article-left-panel" :class="{ collapsed }">
    <!-- Collapsed: icons only -->
    <div v-if="collapsed" class="panel-icons-only">
      <button class="collapsed-btn" title="新建文章" @click="handleNewArticle">＋</button>
      <button class="collapsed-btn" title="刷新列表" @click="loadArticles">↻</button>
    </div>

    <!-- Expanded: full panel content -->
    <template v-if="!collapsed">
      <!-- Header actions -->
      <div class="panel-section action-section">
        <button class="action-btn primary" @click="handleNewArticle">＋ 新建文章</button>
        <button class="action-btn icon-only" @click="loadArticles" title="刷新列表">↻</button>
      </div>

      <!-- Sort controls -->
      <div class="panel-section sort-section">
        <span class="sort-label">排序</span>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'date' }"
          @click="sortBy = 'date'; sortDesc = !sortDesc"
        >
          日期 {{ sortBy === 'date' ? (sortDesc ? '↓' : '↑') : '' }}
        </button>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'name' }"
          @click="sortBy = 'name'; sortDesc = !sortDesc"
        >
          名称 {{ sortBy === 'name' ? (sortDesc ? '↓' : '↑') : '' }}
        </button>
      </div>

      <!-- File search -->
      <div class="panel-section file-search-section">
        <div class="file-search-box">
          <span class="file-search-icon">🔍</span>
          <input
            v-model="fileSearchQuery"
            type="text"
            class="file-search-input"
            placeholder="搜索文件名..."
          />
          <button v-if="fileSearchQuery" class="file-search-clear" @click="fileSearchQuery = ''">✕</button>
        </div>
      </div>

      <!-- Article list -->
      <div class="panel-section article-list-section">
        <div v-if="filteredArticles.length === 0" class="article-empty">
          <template v-if="fileSearchQuery && articles.length > 0">
            <p>未找到匹配的文章</p>
            <p class="article-empty-hint">尝试其他搜索词</p>
          </template>
          <template v-else>
            <p>暂无文章</p>
            <p class="article-empty-hint">点击「新建文章」开始创作</p>
          </template>
        </div>
        <div
          v-for="entry in filteredArticles"
          :key="entry.path"
          class="article-row"
          :class="{ active: isActive(entry) }"
          @click="selectArticle(entry)"
        >
          <!-- Inline rename mode -->
          <template v-if="editingPath === entry.path">
            <input
              v-model="renameInput"
              class="rename-input"
              @click.stop
              @keydown="handleRenameKeydown($event, entry)"
              @blur="confirmRename(entry)"
              autofocus
            />
          </template>
          <template v-else>
            <div class="article-main">
              <span class="article-title">{{ articleTitle(entry.name) }}</span>
              <span v-if="formatDate(entry)" class="article-date">{{ formatDate(entry) }}</span>
            </div>
            <div class="article-actions">
              <button class="art-act-icon" title="重命名" @click.stop="startRename(entry)">✎</button>
              <button class="art-act-more" @click.stop="showMoreMenu(entry, $event)">⋯</button>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Toggle collapse button -->
    <button class="panel-toggle-btn" :title="collapsed ? '展开' : '折叠'" @click="collapsed = !collapsed">
      {{ collapsed ? '▶' : '◀' }}
    </button>

    <!-- More menu (...) -->
    <Teleport to="body">
      <div
        v-if="moreMenu.show"
        class="article-more-menu ctx-menu"
        :style="{ left: moreMenu.x + 'px', top: moreMenu.y + 'px' }"
        @click.stop
      >
        <div class="ctx-item" @click="handleMoreAction('openLocation')">
          <span class="ctx-item-icon">📁</span>打开文件所在位置
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-item danger" @click="handleMoreAction('delete')">
          <span class="ctx-item-icon">✕</span>删除文件
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.article-left-panel {
  width: 200px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.18s ease;
  position: relative;
  overflow: hidden;
}

.article-left-panel.collapsed {
  width: 42px;
}

.panel-icons-only {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
}

.collapsed-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.collapsed-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

.panel-toggle-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 36px;
  border: none;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-muted);
  font-size: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 2;
  padding: 0;
}
.article-left-panel:hover .panel-toggle-btn {
  opacity: 1;
}
.panel-toggle-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.panel-section {
  border-bottom: 1px solid var(--border-color);
}

.action-section {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
}

.action-btn {
  flex: 1;
  padding: 5px 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.action-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.action-btn.primary {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}
.action-btn.primary:hover { opacity: 0.9; }
.action-btn.icon-only {
  flex: 0 0 32px;
  font-size: 16px;
  padding: 0;
}

.sort-section {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
}

.sort-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 4px;
}

.sort-btn {
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}
.sort-btn:hover { background: var(--hover-bg); color: var(--text-secondary); }
.sort-btn.active { background: var(--accent-light); color: var(--accent-color); border-color: var(--accent-color); }

.article-list-section {
  flex: 1;
  overflow-y: auto;
}

.article-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8;
}

.article-empty-hint {
  font-size: 11px;
  opacity: 0.7;
}

.article-row {
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  transition: background 0.1s;
  min-height: 42px;
}

.article-row:hover {
  background: var(--hover-bg);
}

.article-row.active {
  background: var(--accent-light);
  border-bottom-color: var(--accent-color);
}

.article-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 0;
  overflow: hidden;
}

.article-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-date {
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
}

.article-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s;
}

.article-row:hover .article-actions,
.article-row.active .article-actions {
  opacity: 1;
}

.art-act-icon {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.art-act-icon:hover { background: var(--hover-bg); color: var(--text-primary); }

.art-act-more {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.art-act-more:hover { background: var(--hover-bg); color: var(--text-primary); }

.rename-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--accent-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

/* File search */
.file-search-section { padding: 6px 10px; }

.file-search-box {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 8px;
  transition: border-color 0.15s;
}
.file-search-box:focus-within { border-color: var(--accent-color); }

.file-search-icon { font-size: 12px; margin-right: 4px; }

.file-search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 5px 0;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}
.file-search-input::placeholder { color: var(--text-muted); }

.file-search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.file-search-clear:hover { color: var(--text-primary); background: var(--hover-bg); }
</style>
