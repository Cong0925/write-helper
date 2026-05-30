<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { appState, cacheFileContent, getCachedContent, removeCachedContent, type FileEntry } from '../store'
import { readDirectory, createFile, createDirectory, getNextNumber, readFile, deleteItem, moveItem } from '../api'
import { registerShortcut, unregisterShortcut } from '../useKeyboardShortcuts'
import { dialog } from '../composables/useDialog'
import SearchPanel from './SearchPanel.vue'
import FileTree from './FileTree.vue'
import MergeExportPanel from './MergeExportPanel.vue'

const searchQuery = ref('')

const isSearchMode = computed(() => searchQuery.value.trim().length > 0)

// Volume entries
const volumeEntries = ref<FileEntry[]>([])
const treeKey = ref(0)

// Expand/collapse all
const allExpanded = ref(true)

const volumeDir = computed(() => {
  if (!appState.project) return ''
  return appState.project.path + '/分卷'
})

onMounted(async () => {
  await loadVolumes()
  registerShortcut('newChapter', handleNewChapter)
})

onUnmounted(() => {
  unregisterShortcut('newChapter')
})

// Reload volumes when project changes (e.g. import finishes, project opened)
watch(() => appState.project, async (newProj, oldProj) => {
  if (newProj && newProj !== oldProj) {
    await loadVolumes()
  }
})

async function loadVolumes() {
  const vDir = volumeDir.value
  if (!vDir) return
  try {
    // Ensure 分卷 directory exists
    try {
      const { createDirectory } = await import('../api')
      await createDirectory(vDir)
    } catch { /* directory may already exist */ }

    volumeEntries.value = await readDirectory(vDir)
    appState.volumeEntries = volumeEntries.value
    // Set active volume to latest
    if (volumeEntries.value.length > 0) {
      const last = volumeEntries.value[volumeEntries.value.length - 1]
      appState.activeVolume = last.path
    } else {
      appState.activeVolume = ''
    }
  } catch (e) {
    console.error('loadVolumes failed:', e)
  }
}

// Get latest volume path
const latestVolumePath = computed(() => {
  if (volumeEntries.value.length === 0) return ''
  return volumeEntries.value[volumeEntries.value.length - 1].path
})

// Active volume for new chapters
function setActiveVolume(path: string) {
  appState.activeVolume = path
}

// ========== Inline rename state (volumes & chapters) ==========
const editingPath = ref('')

async function handleNewChapter(targetVolume?: string) {
  if (!appState.project) return
  const target = targetVolume || appState.activeVolume || latestVolumePath.value
  if (!target) return

  try {
    const nextNum = await getNextNumber(target, '第', '.md')
    const name = `第${nextNum}章`
    await createFile(`${target}/${name}`)
    await loadVolumes()
    // Focus the new chapter for inline rename
    editingPath.value = `${target}/${name}.md`
    // Force-save current file to disk before switching
    if (appState.currentFile && appState.isDirty && appState.currentContent) {
      try {
        const { writeFile } = await import('../api')
        await writeFile(appState.currentFile.path, appState.currentContent)
        appState.isDirty = false
      } catch {}
    }
    // Save current file content to cache before opening new one
    if (appState.currentFile && appState.currentContent) {
      cacheFileContent(appState.currentFile.path, appState.currentContent)
    }
    // Read and open the new file
    const content = await readFile(`${target}/${name}.md`)
    appState.currentFile = { path: `${target}/${name}.md`, name: `${name}.md` }
    appState.currentContent = content
    appState.isDirty = false
  } catch {}
}

async function handleNewVolume() {
  if (!appState.project) return
  const vDir = volumeDir.value
  if (!vDir) return
  try {
    const nextNum = await getNextNumber(vDir, '第', '')
    const name = `第${nextNum}卷`
    const newVolPath = `${vDir}/${name}`
    await createDirectory(newVolPath)
    // Create the first chapter inside the new volume
    const chapterNum = await getNextNumber(newVolPath, '第', '.md')
    const chapterName = `第${chapterNum}章`
    await createFile(`${newVolPath}/${chapterName}`)
    await loadVolumes()
    appState.activeVolume = newVolPath
    // Force-save current file to disk before switching
    if (appState.currentFile && appState.isDirty && appState.currentContent) {
      try {
        const { writeFile } = await import('../api')
        await writeFile(appState.currentFile.path, appState.currentContent)
        appState.isDirty = false
      } catch {}
    }
    // Save current file content to cache before switching
    if (appState.currentFile && appState.currentContent) {
      cacheFileContent(appState.currentFile.path, appState.currentContent)
    }
    // Open the first chapter
    const content = await readFile(`${newVolPath}/${chapterName}.md`)
    appState.currentFile = { path: `${newVolPath}/${chapterName}.md`, name: `${chapterName}.md` }
    appState.currentContent = content
    appState.isDirty = false
    // Focus the new volume for inline rename
    editingPath.value = newVolPath
  } catch {}
}

async function refreshTree() {
  treeKey.value++
  await loadVolumes()
}

// Toggle expand/collapse all
function toggleExpandAll() {
  allExpanded.value = !allExpanded.value
}

// ── Batch select & move chapters across volumes ──
const batchMode = ref(false)
const selectedChapters = ref(new Set<string>())
const targetVolumePath = ref('')

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedChapters.value.clear()
    targetVolumePath.value = ''
  } else if (volumeEntries.value.length > 0) {
    targetVolumePath.value = volumeEntries.value[0].path
  }
}

function onFileCheck(payload: { path: string; checked: boolean }) {
  if (payload.checked) {
    selectedChapters.value.add(payload.path)
  } else {
    selectedChapters.value.delete(payload.path)
  }
}

async function selectAllInVolume(volPath: string) {
  try {
    const { readDirectory } = await import('../api')
    const files = await readDirectory(volPath)
    const mdFiles = files.filter(f => !f.isDir && f.name.endsWith('.md')).map(f => f.path)

    const allSelected = mdFiles.length > 0 && mdFiles.every(f => selectedChapters.value.has(f))
    if (allSelected) {
      for (const f of mdFiles) selectedChapters.value.delete(f)
    } else {
      for (const f of mdFiles) selectedChapters.value.add(f)
    }
    selectedChapters.value = new Set(selectedChapters.value)
  } catch { /* ignore */ }
}

async function moveSelectedChapters() {
  if (selectedChapters.value.size === 0 || !targetVolumePath.value) return
  const count = selectedChapters.value.size
  if (!await dialog.confirm(`确定将选中的 ${count} 章移动到目标卷？`)) return

  const { moveItem } = await import('../api')
  let success = 0
  let fail = 0

  for (const srcPath of selectedChapters.value) {
    try {
      await moveItem(srcPath, targetVolumePath.value)
      success++
    } catch {
      fail++
    }
  }

  if (fail > 0) {
    await dialog.alert(`移动完成：${success} 章成功，${fail} 章失败（可能是文件名冲突）`)
  }

  selectedChapters.value.clear()
  await loadVolumes()
  if (fail === 0) batchMode.value = false
}

// Cross-volume drag & drop
const dragOverVol = ref<string | null>(null)

function onVolDragOver(e: DragEvent, volPath: string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverVol.value = volPath
}

function onVolDragLeave() {
  dragOverVol.value = null
}

async function onVolDrop(e: DragEvent, targetVolPath: string) {
  e.preventDefault()
  dragOverVol.value = null
  const srcPath = e.dataTransfer?.getData('text/plain')
  if (!srcPath) return
  try {
    await moveItem(srcPath, targetVolPath)
    await loadVolumes()
  } catch {
    await dialog.alert('移动失败')
  }
}

// Volume context menu (⋮)
const volMenu = ref<{ show: boolean; path: string; name: string; x: number; y: number }>({
  show: false, path: '', name: '', x: 0, y: 0,
})

let volMenuStamp = 0

function showVolMenu(entry: FileEntry, event: MouseEvent) {
  event.stopPropagation()
  const mx = Math.min(event.clientX, window.innerWidth - 180)
  const my = Math.min(event.clientY, window.innerHeight - 260)
  volMenu.value = {
    show: true,
    path: entry.path,
    name: entry.name,
    x: Math.max(8, mx),
    y: Math.max(8, my),
  }
  volMenuStamp = ++appState.ctxMenuStamp
}

// Close volume menu when another context menu opens
watch(() => appState.ctxMenuStamp, (stamp) => {
  if (volMenuStamp !== 0 && stamp !== volMenuStamp) {
    volMenu.value.show = false
  }
})

function closeVolMenu() { volMenu.value.show = false }

// Click outside to close volume menu
watch(() => volMenu.value.show, (v) => {
  if (v) {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest('.ctx-menu') && !el.closest('.vol-action-btn')) {
        volMenu.value.show = false
      }
    }
    document.addEventListener('click', handler, true)
    volCleanup = () => document.removeEventListener('click', handler, true)
  } else {
    volCleanup?.()
    volCleanup = null
  }
})
let volCleanup: (() => void) | null = null
onUnmounted(() => volCleanup?.())

function startVolInlineRename() {
  const v = volMenu.value; if (!v.path) return; closeVolMenu()
  editingPath.value = v.path
}

async function volDelete() {
  const v = volMenu.value; if (!v.path) return; closeVolMenu()
  if (!await dialog.confirm(`删除整卷「${v.name}」？此操作不可恢复！`)) return
  try {
    // Clean up cache for files inside the deleted volume
    const volPath = v.path.replace(/\\/g, '/')
    // removeCachedContent will be called per-file when the filesystem delete triggers
    await deleteItem(v.path)
    // If the current file is inside the deleted volume, clear editor
    if (appState.currentFile?.path.replace(/\\/g, '/').startsWith(volPath)) {
      appState.currentFile = null
      appState.currentContent = ''
    }
    await loadVolumes()
  } catch { await dialog.alert('删除失败') }
}

// Merge export panel state
const exportShow = ref(false)
const exportSuccessPath = ref('')
const showExportDone = ref(false)

function volMergeExport() {
  const v = volMenu.value; if (!v.path) return; closeVolMenu()
  exportShow.value = true
}

async function handleExport(filePaths: string[], fmt: string) {
  exportShow.value = false
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const ext = fmt === 'html' ? 'html' : fmt
    const filterName = fmt === 'md' ? 'Markdown' : fmt === 'html' ? 'HTML' : '纯文本'
    const outputPath = await save({
      filters: [{ name: filterName, extensions: [ext] }],
      defaultPath: `合并导出_${appState.project?.name || '作品'}.${ext}`,
    })
    if (!outputPath) return
    const { mergeFilesExport } = await import('../api')
    await mergeFilesExport(filePaths, outputPath, fmt)
    exportSuccessPath.value = outputPath
    showExportDone.value = true
  } catch (e: any) {
    await dialog.alert('导出失败: ' + (typeof e === 'string' ? e : e.message))
  }
}

async function openExportLocation() {
  const { openInExplorer } = await import('../api')
  try {
    await openInExplorer(exportSuccessPath.value)
  } catch {}
}</script>

<template>
  <div class="left-panel" @click="closeVolMenu">
    <!-- Search -->
    <div class="panel-section search-section">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索全书..."
        />
        <button v-if="searchQuery" class="search-clear-btn" @click="searchQuery = ''">✕</button>
      </div>
    </div>

    <!-- Search Results or Normal Tree -->
    <template v-if="isSearchMode">
      <SearchPanel :query="searchQuery.trim()" />
    </template>

    <template v-else>
      <!-- Action buttons -->
      <div class="panel-section action-section">
        <button class="action-btn primary" @click="handleNewChapter()">＋ 新建章</button>
        <button class="action-btn" @click="handleNewVolume">＋ 新建卷</button>
        <button class="action-btn" :class="{ active: batchMode }" @click="toggleBatchMode" title="批量选择章节移动分卷">☑ 批量</button>
        <button class="action-btn icon-only" @click="refreshTree" title="刷新目录">↻</button>
      </div>

      <!-- Volume / Chapter Tree -->
      <div class="panel-section tree-section">
        <div class="tree-root" :key="treeKey">
          <div class="tree-root-item">
            <span class="root-icon">📖</span>
            <span class="root-name">{{ appState.project?.name || '作品' }}</span>
            <button class="expand-toggle-btn" :title="allExpanded ? '折叠全部' : '展开全部'" @click.stop="toggleExpandAll">
              {{ allExpanded ? '▼' : '▶' }}
            </button>
          </div>
          <div class="tree-children">
            <template v-if="volumeEntries.length > 0">
              <div
                v-for="entry in volumeEntries"
                :key="entry.path"
                class="volume-wrapper"
                :class="{
                  'active-vol': appState.activeVolume === entry.path,
                  'drag-over-vol': dragOverVol === entry.path
                }"
                @click="setActiveVolume(entry.path)"
                @dragover="onVolDragOver($event, entry.path)"
                @dragleave="onVolDragLeave"
                @drop="onVolDrop($event, entry.path)"
              >
                <div class="vol-header">
                  <FileTree
                    :entries="[entry]"
                    :depth="0"
                    auto-expand
                    :active-volume="appState.activeVolume"
                    :init-editing-path="editingPath"
                    :all-expanded="allExpanded"
                    :show-checkbox="batchMode"
                    :checked-set="selectedChapters"
                    @select="setActiveVolume"
                    @refresh="refreshTree"
                    @editing-done="editingPath = ''"
                    @file-check="onFileCheck"
                    @dragover="onVolDragOver($event, entry.path)"
                    @drop="onVolDrop($event, entry.path)"
                  />
                  <div class="vol-actions">
                    <button class="vol-action-btn" title="新建章节" @click.stop="handleNewChapter(entry.path)">＋</button>
                    <button v-if="batchMode" class="vol-action-btn select-all-btn" title="全选本章" @click.stop="selectAllInVolume(entry.path)">☑</button>
                    <button class="vol-action-btn" title="更多" @click.stop="showVolMenu(entry, $event)">⋮</button>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="tree-empty">暂无章节，点击「新建卷」开始</div>
          </div>
        </div>
      </div>

      <!-- Bottom: new chapter button (normal) / batch action bar (batch mode) -->
      <div class="panel-section bottom-action">
        <template v-if="!batchMode">
          <button class="bottom-new-btn" @click="handleNewChapter()">
            ＋ 新建章节
          </button>
        </template>
        <template v-else>
          <div class="batch-bar">
            <div class="batch-info">
              <label class="batch-label">目标卷：</label>
              <select v-model="targetVolumePath" class="batch-select">
                <option v-for="ve in volumeEntries" :key="ve.path" :value="ve.path">
                  {{ ve.name }}
                </option>
              </select>
            </div>
            <div class="batch-actions">
              <span class="batch-count">{{ selectedChapters.size }} 章</span>
              <button
                class="batch-btn"
                :disabled="selectedChapters.size === 0 || !targetVolumePath"
                @click="moveSelectedChapters"
              >移动</button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Volume ⋮ menu -->
    <Teleport to="body">
      <div
        v-if="volMenu.show"
        class="ctx-menu"
        :style="{ left: volMenu.x + 'px', top: volMenu.y + 'px' }"
        @click.stop
      >
        <div class="ctx-item" @click="startVolInlineRename"><span class="ctx-item-icon">✎</span>重命名本卷</div>
        <div class="ctx-item" @click="handleNewChapter(volMenu.path)"><span class="ctx-item-icon">📄</span>新建章节</div>
        <div class="ctx-divider"></div>
        <div class="ctx-item" @click="volMergeExport"><span class="ctx-item-icon">📦</span>合并导出章节</div>
        <div class="ctx-divider"></div>
        <div class="ctx-item danger" @click="volDelete"><span class="ctx-item-icon">✕</span>删除本卷</div>
      </div>
    </Teleport>

    <MergeExportPanel
      :show="exportShow"
      :volume-entries="volumeEntries"
      @close="exportShow = false"
      @export="handleExport"
    />

    <!-- Export success dialog -->
    <Teleport to="body">
      <Transition name="panel-fade">
        <div v-if="showExportDone" class="export-done-overlay" @click.self="showExportDone = false">
          <div class="export-done-dialog">
            <div class="done-icon">✅</div>
            <h3 class="done-title">导出完成</h3>
            <p class="done-path">{{ exportSuccessPath }}</p>
            <div class="done-actions">
              <button class="done-btn open-btn" @click="openExportLocation">打开文件位置</button>
              <button class="done-btn ok-btn" @click="showExportDone = false">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.left-panel {
  width: var(--left-panel-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
}

.panel-section { border-bottom: 1px solid var(--border-color); }

.search-section { padding: 12px; }

.search-box {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 10px;
  transition: border-color 0.15s;
}
.search-box:focus-within { border-color: var(--accent-color); }

.search-icon { font-size: 13px; margin-right: 6px; }

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}
.search-input::placeholder { color: var(--text-muted); }

.search-clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  flex-shrink: 0;
}
.search-clear-btn:hover { color: var(--text-primary); background: var(--hover-bg); }

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
.action-btn.active {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}
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

.tree-section { flex: 1; overflow-y: auto; }

.tree-root { padding: 4px 0; }

.tree-root-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  margin: 0 8px 4px;
  padding: 8px 4px;
}

.root-icon { font-size: 15px; }
.root-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.expand-toggle-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
  margin-left: auto;
}
.expand-toggle-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.volume-wrapper {
  margin: 0 4px;
  border-radius: 6px;
  transition: background 0.1s;
}
.volume-wrapper.active-vol {
  background: var(--accent-light);
}
.volume-wrapper.drag-over-vol {
  outline: 2px dashed var(--accent-color);
  outline-offset: -2px;
  background: var(--accent-light);
}

/* Export success dialog */
.export-done-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.export-done-dialog {
  width: 360px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 28px 24px 20px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.done-icon { font-size: 36px; margin-bottom: 10px; }
.done-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.done-path { font-size: 11px; color: var(--text-muted); word-break: break-all; margin-bottom: 18px; }
.done-actions { display: flex; gap: 10px; justify-content: center; }
.done-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.12s;
}
.done-btn:hover { opacity: 0.9; }
.open-btn { background: var(--accent-color); color: #1e1e2e; }
.ok-btn { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); }
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }

.vol-header {
  display: flex;
  align-items: flex-start;
  position: relative;
}
.vol-header > :first-child {
  flex: 1;
  min-width: 0;
}

.vol-actions {
  display: flex;
  position: absolute;
  right: 4px;
  top: 0;
  align-items: center;
  gap: 1px;
  padding: 4px 4px 0 0;
  opacity: 0;
  transition: opacity 0.1s;
}
.volume-wrapper:hover .vol-actions,
.volume-wrapper.active-vol .vol-actions {
  opacity: 1;
}

.vol-action-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
  line-height: 1;
}
.vol-action-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.vol-action-btn.select-all-btn {
  font-size: 12px;
  color: var(--accent-color);
}

/* Batch mode checkbox (in FileTree) */
:deep(.batch-checkbox) {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-color);
  cursor: pointer;
  flex-shrink: 0;
  margin: 0 2px 0 0;
}

/* Batch action bar */
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}
.batch-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.batch-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.batch-select {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
  font-family: inherit;
}
.batch-select:focus {
  border-color: var(--accent-color);
}
.batch-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.batch-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-color);
  white-space: nowrap;
}
.batch-btn {
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s;
  font-family: inherit;
}
.batch-btn:hover { opacity: 0.85; }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tree-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.bottom-action {
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.bottom-new-btn {
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.bottom-new-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-light);
}
</style>
