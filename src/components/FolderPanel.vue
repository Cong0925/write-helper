<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { appState } from '../store'
import type { FileEntry } from '../store'
import WysiwygEditor from './WysiwygEditor.vue'

const props = defineProps<{
  dirName: string
}>()

/* ---- File loading ---- */
const folderFiles = ref<FileEntry[]>([])
const folderLoading = ref(false)

async function loadFolderFiles() {
  if (!appState.project) { folderFiles.value = []; return }
  folderLoading.value = true
  try {
    const { readDirectory } = await import('../api')
    const entries = await readDirectory(appState.project.path + '/' + props.dirName)
    // Merge: keep existing order, append new entries at the end
    const existingPaths = new Set(folderFiles.value.map(e => e.path))
    const newEntries = entries.filter(e => !existingPaths.has(e.path))
    if (folderFiles.value.length === 0) {
      folderFiles.value = entries
    } else if (newEntries.length > 0) {
      folderFiles.value = [...folderFiles.value, ...newEntries]
    }
    // Refresh children for all expanded folders so the display stays in sync
    for (const dirPath of expandedFolders.value) {
      try {
        const kids = await readDirectory(dirPath)
        folderChildren.value[dirPath] = kids
      } catch {
        folderChildren.value[dirPath] = []
      }
    }
  } catch (e) {
    console.error(`FolderPanel(${props.dirName}) loadFolderFiles失败:`, e)
    folderFiles.value = []
  }
  folderLoading.value = false
}

/* ---- File operations ---- */
const selectedFile = ref<FileEntry | null>(null)
const selectedContent = ref('')
const contentLoading = ref(false)
let contentDirty = true

const renamingFile = ref<FileEntry | null>(null)
const renameInput = ref('')
const actionMenuPath = ref<string | null>(null)
const expandedFolders = ref(new Set<string>())
const folderChildren = ref<Record<string, FileEntry[]>>({})

function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : p
}

async function toggleFolder(folderPath: string) {
  if (expandedFolders.value.has(folderPath)) {
    expandedFolders.value.delete(folderPath)
    return
  }
  expandedFolders.value.add(folderPath)
  if (!folderChildren.value[folderPath]) {
    try {
      const { readDirectory } = await import('../api')
      const kids = await readDirectory(folderPath)
      folderChildren.value[folderPath] = kids
    } catch {
      folderChildren.value = { ...folderChildren.value, [folderPath]: [] }
    }
  }
}

async function openFolderFile(entry: FileEntry) {
  if (entry.isDir) {
    selectedFile.value = null
    selectedContent.value = ''
    toggleFolder(entry.path)
    return
  }
  selectedFile.value = entry
  contentLoading.value = true
  contentDirty = true
  try {
    const { readFile } = await import('../api')
    selectedContent.value = await readFile(entry.path)
  } catch { selectedContent.value = '' }
  contentLoading.value = false
  contentDirty = false
}

function onContentInput() {
  contentDirty = false
  saveFolderContent()
}

async function saveFolderContent() {
  if (!selectedFile.value || contentDirty) return
  try {
    const { writeFile } = await import('../api')
    await writeFile(selectedFile.value.path, selectedContent.value)
  } catch { /* ignore */ }
}

async function newFile() {
  if (!appState.project) return
  try {
    const { createFile, writeFile, getNextNumber } = await import('../api')
    const dir = appState.project.path + '/' + props.dirName
    const num = await getNextNumber(dir, props.dirName, 'md')
    const fileName = props.dirName + num
    const path = dir + '/' + fileName + '.md'
    await createFile(path)
    await writeFile(path, fileName + '\n')
    folderFiles.value = [...folderFiles.value, { name: fileName + '.md', path, isDir: false }]
  } catch (e) { console.error('newFile失败:', e) }
}

async function deleteFolderFile(entry: FileEntry) {
  if (entry.isDir) {
    const children = folderChildren.value[entry.path]
    if (children && children.length > 0) return
    try {
      const { readDirectory } = await import('../api')
      const kids = await readDirectory(entry.path)
      if (kids.length > 0) return
    } catch { return }
  }
  try {
    const { deleteItem } = await import('../api')
    await deleteItem(entry.path)
    if (selectedFile.value?.path === entry.path) {
      selectedFile.value = null
      selectedContent.value = ''
    }
    // Remove from parent array
    const delParent = parentDir(entry.path)
    const delBase = appState.project?.path + '/' + props.dirName
    if (delParent === delBase) {
      folderFiles.value = folderFiles.value.filter(e => e.path !== entry.path)
    } else if (folderChildren.value[delParent]) {
      folderChildren.value[delParent] = folderChildren.value[delParent].filter(e => e.path !== entry.path)
    }
    const copy = { ...folderChildren.value }
    delete copy[entry.path]
    folderChildren.value = copy
  } catch { /* ignore */ }
}

function startRename(entry: FileEntry) {
  renamingFile.value = entry
  renameInput.value = entry.name.replace(/\.md$/, '')
}

async function confirmRename() {
  const entry = renamingFile.value
  if (!entry || !renameInput.value.trim()) { renamingFile.value = null; return }
  try {
    const { renameFile } = await import('../api')
    const dir = parentDir(entry.path)
    const newName = renameInput.value.trim() + (entry.isDir ? '' : '.md')
    const newPath = dir + '/' + newName
    await renameFile(entry.path, newPath)
    if (selectedFile.value?.path === entry.path) {
      const oldName = entry.name.replace(/\.md$/, '')
      const newNameStr = renameInput.value.trim()
      selectedFile.value = { ...selectedFile.value, path: newPath, name: newName }
      // Sync first line of content with new filename
      const lines = selectedContent.value.split('\n')
      if (lines[0] === oldName) {
        lines[0] = newNameStr
        selectedContent.value = lines.join('\n')
        const { writeFile } = await import('../api')
        await writeFile(newPath, selectedContent.value)
      }
    }
    renamingFile.value = null
    // Update entry in-place
    entry.name = newName
    entry.path = newPath
    const baseR = appState.project?.path + '/' + props.dirName
    const renParent = parentDir(newPath)
    if (renParent === baseR) {
      folderFiles.value = [...folderFiles.value]
    } else if (folderChildren.value[renParent]) {
      folderChildren.value = { ...folderChildren.value }
    }
  } catch { renamingFile.value = null }
}

/* ---- Move up/down ---- */
function toggleActionMenu(path: string) {
  actionMenuPath.value = actionMenuPath.value === path ? null : path
}

function getPeers(entry: FileEntry): FileEntry[] {
  const parent = parentDir(entry.path)
  const basePath = appState.project?.path + '/' + props.dirName
  if (parent === basePath) return folderFiles.value
  return folderChildren.value[parent] || []
}

async function moveItem(entry: FileEntry, direction: 'up' | 'down') {
  const peers = getPeers(entry)
  const idx = peers.findIndex(e => e.path === entry.path)
  if (idx < 0) { console.warn('moveItem: 未在列表中找到条目', entry.path); return }
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= peers.length) return
  const other = peers[target]

  const aNum = entry.name.match(/(\d+)/)?.[1]
  const bNum = other.name.match(/(\d+)/)?.[1]
  if (!aNum || !bNum) { console.warn('moveItem: 名称中无数字', entry.name, other.name); return }

  const dir = parentDir(entry.path)
  const ext = entry.name.endsWith('.md') ? '.md' : ''
  const oExt = other.name.endsWith('.md') ? '.md' : ''

  try {
    const { renameFile } = await import('../api')
    const tmpName = `__tmp_${aNum}${ext}`
    await renameFile(entry.path, dir + '/' + tmpName)
    await renameFile(other.path, dir + '/' + entry.name.replace(/\.md$/, '') + oExt)
    await renameFile(dir + '/' + tmpName, dir + '/' + other.name.replace(/\.md$/, '') + ext)

    // Swap positions in the peers array (filenames on disk are already swapped)
    peers[idx] = other
    peers[target] = entry

    // Update selectedFile reference if needed
    if (selectedFile.value?.path === other.path) {
      selectedFile.value = { ...selectedFile.value }
    } else if (selectedFile.value?.path === entry.path) {
      selectedFile.value = { ...selectedFile.value }
    }

    // Trigger reactivity
    const basePath = appState.project?.path + '/' + props.dirName
    if (dir === basePath) {
      folderFiles.value = [...folderFiles.value]
    } else {
      folderChildren.value = { ...folderChildren.value }
    }

    actionMenuPath.value = null
  } catch { /* ignore */ }
}

/* ---- Display rows ---- */
const folderSearchQuery = ref('')

const displayRows = computed(() => {
  const q = folderSearchQuery.value.trim().toLowerCase()
  const children = folderChildren.value
  const rows: { type: 'dir' | 'file'; entry: FileEntry; depth: number; peerIdx: number; peerCount: number }[] = []

  for (let fi = 0; fi < folderFiles.value.length; fi++) {
    const entry = folderFiles.value[fi]
    if (entry.isDir) {
      const childFiles = children[entry.path] || []
      const folderMatch = !q || entry.name.toLowerCase().includes(q)
      const matchChildren = q ? childFiles.filter(c => c.name.toLowerCase().includes(q)) : childFiles
      if (q && !folderMatch && matchChildren.length === 0) continue
      rows.push({ type: 'dir', entry, depth: 0, peerIdx: fi, peerCount: folderFiles.value.length })
      if (expandedFolders.value.has(entry.path) || q) {
        const showFiles = q ? matchChildren : childFiles
        for (let ci = 0; ci < showFiles.length; ci++) {
          rows.push({ type: 'file', entry: showFiles[ci], depth: 1, peerIdx: ci, peerCount: childFiles.length })
        }
      }
    } else {
      if (q && !entry.name.toLowerCase().includes(q)) continue
      rows.push({ type: 'file', entry, depth: 0, peerIdx: fi, peerCount: folderFiles.value.length })
    }
  }
  return rows
})

/* ---- Click outside to close action menu ---- */
watch(actionMenuPath, (v) => {
  if (v) {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest('.fp-more-wrap')) actionMenuPath.value = null
    }
    document.addEventListener('click', handler, true)
    menuCleanup = () => document.removeEventListener('click', handler, true)
    // Auto-flip: if button is in bottom 25% of list visible area, flip up
    nextTick(() => {
      const dd = document.querySelector('.fp-dropdown') as HTMLElement | null
      if (!dd) return
      const moreWrap = dd.closest('.fp-more-wrap') as HTMLElement | null
      const btn = moreWrap?.querySelector('.fp-more-btn') as HTMLElement | null
      const list = dd.closest('.fp-list') as HTMLElement | null
      if (!btn || !list) return
      const btnRect = btn.getBoundingClientRect()
      const listRect = list.getBoundingClientRect()
      const ratio = (btnRect.bottom - listRect.top) / listRect.height
      dd.style.removeProperty('top')
      dd.style.removeProperty('bottom')
      if (ratio > 0.75) {
        dd.style.top = 'auto'
        dd.style.bottom = '100%'
      }
    })
  } else {
    menuCleanup?.()
    menuCleanup = null
  }
})
let menuCleanup: (() => void) | null = null
onUnmounted(() => menuCleanup?.())

onMounted(async () => {
  await loadFolderFiles()
})
</script>

<template>
  <div class="fp-split">
    <!-- Left: content preview -->
    <div class="fp-content">
      <div v-if="contentLoading" class="fp-loading">加载中…</div>
      <div v-else-if="!selectedFile" class="fp-empty">
        <p>选择文件查看内容</p>
      </div>
      <template v-else>
        <WysiwygEditor v-model="selectedContent" :folder-dir="props.dirName" @update:model-value="onContentInput" />
      </template>
    </div>
    <!-- Right: file list -->
    <div class="fp-sidebar">
      <div class="fp-search">
        <input v-model="folderSearchQuery" class="fp-search-input" placeholder="搜索文件…" />
      </div>
      <div class="fp-toolbar">
        <button class="fp-btn" title="新建" @click="newFile">+</button>
        <button class="fp-btn" title="刷新" @click="loadFolderFiles">↻</button>
      </div>
      <div v-if="folderLoading" class="fp-loading small">加载中…</div>
      <div v-else-if="!displayRows.length" class="fp-empty small">暂无文件</div>
      <div v-else class="fp-list">
        <template v-for="(row, idx) in displayRows" :key="row.entry.path + '-' + idx">
          <!-- Directory row -->
          <div v-if="row.type === 'dir'"
            class="fp-item"
            @click="openFolderFile(row.entry)">
            <template v-if="renamingFile?.path === row.entry.path">
              <input v-model="renameInput" class="fp-rename-input" @keyup.enter="confirmRename" @blur="confirmRename" @click.stop autofocus />
            </template>
            <template v-else>
              <span class="fp-icon fold-icon" @click.stop="toggleFolder(row.entry.path)">{{ expandedFolders.has(row.entry.path) ? '▼' : '▶' }}</span>
              <span class="fp-icon">📁</span>
              <span class="fp-name">{{ row.entry.name }}</span>
              <span class="fp-actions">
                <button class="fp-act" title="重命名" @click.stop="startRename(row.entry)">✎</button>
                <div class="fp-more-wrap">
                  <button class="fp-act fp-more-btn" title="更多" @click.stop="toggleActionMenu(row.entry.path)">⋯</button>
                  <div v-if="actionMenuPath === row.entry.path" class="fp-dropdown" @click.stop>
                    <button class="fp-drop-item" :class="{ disabled: row.peerIdx === 0 }" @click="row.peerIdx > 0 && moveItem(row.entry, 'up')">上移</button>
                    <button class="fp-drop-item" :class="{ disabled: row.peerIdx === row.peerCount - 1 }" @click="row.peerIdx < row.peerCount - 1 && moveItem(row.entry, 'down')">下移</button>
                    <div class="fp-drop-divider"></div>
                    <button class="fp-drop-item danger" @click="deleteFolderFile(row.entry)">删除</button>
                  </div>
                </div>
              </span>
            </template>
          </div>
          <!-- File row -->
          <div v-else
            class="fp-item"
            :class="{ active: selectedFile?.path === row.entry.path, 'fp-indent': row.depth > 0 }"
            @click="openFolderFile(row.entry)">
            <template v-if="renamingFile?.path === row.entry.path">
              <input v-model="renameInput" class="fp-rename-input" @keyup.enter="confirmRename" @blur="confirmRename" @click.stop autofocus />
            </template>
            <template v-else>
              <span class="fp-icon">📄</span>
              <span class="fp-name">{{ row.entry.name.replace(/\.md$/, '') }}</span>
              <span class="fp-actions">
                <button class="fp-act" title="重命名" @click.stop="startRename(row.entry)">✎</button>
                <div class="fp-more-wrap">
                  <button class="fp-act fp-more-btn" title="更多" @click.stop="toggleActionMenu(row.entry.path)">⋯</button>
                  <div v-if="actionMenuPath === row.entry.path" class="fp-dropdown" @click.stop>
                    <button class="fp-drop-item" :class="{ disabled: row.peerIdx === 0 }" @click="row.peerIdx > 0 && moveItem(row.entry, 'up')">上移</button>
                    <button class="fp-drop-item" :class="{ disabled: row.peerIdx === row.peerCount - 1 }" @click="row.peerIdx < row.peerCount - 1 && moveItem(row.entry, 'down')">下移</button>
                    <div class="fp-drop-divider"></div>
                    <button class="fp-drop-item danger" @click="deleteFolderFile(row.entry)">删除</button>
                  </div>
                </div>
              </span>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp-split { display: flex; height: 100%; gap: 0; }
.fp-content { flex: 5; overflow: hidden; padding-right: 10px; display: flex; flex-direction: column; }
.fp-sidebar { flex: 3; min-width: 0; border-left: 1px solid var(--border-color); padding-left: 10px; display: flex; flex-direction: column; position: relative; }
.fp-search { margin-bottom: 6px; }
.fp-search-input { width: 100%; height: 28px; padding: 0 8px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-primary); color: var(--text-primary); font-size: 11px; outline: none; }
.fp-search-input:focus { border-color: var(--accent-color); }
.fp-toolbar { display: flex; gap: 4px; margin-bottom: 8px; flex-shrink: 0; }
.fp-btn { flex: 1; height: 28px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fp-btn:hover { background: var(--hover-bg); }
.fp-loading, .fp-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 32px 0; }
.fp-loading.small, .fp-empty.small { padding: 16px 0; font-size: 11px; }
.fp-list { flex: 1; overflow-y: auto; }
.fp-item { display: flex; align-items: center; gap: 4px; padding: 6px 6px; border-radius: 4px; cursor: pointer; margin-bottom: 1px; }
.fp-item:hover { background: var(--hover-bg); }
.fp-item.active { background: var(--accent-light); }
.fp-item.fp-indent { padding-left: 28px; }
.fold-icon { font-size: 10px; width: 16px; text-align: center; flex-shrink: 0; cursor: pointer; }
.fold-icon:hover { background: var(--hover-bg); border-radius: 3px; }
.fp-name { flex: 1; font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fp-icon { font-size: 12px; flex-shrink: 0; }
.fp-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; align-items: center; }
.fp-item:hover .fp-actions { opacity: 1; }
.fp-act { width: 20px; height: 20px; border: none; border-radius: 3px; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fp-act:hover { background: var(--hover-bg); color: var(--text-primary); }
.fp-act.danger:hover { color: var(--danger-color); }
.fp-rename-input { width: 100%; height: 24px; padding: 0 4px; border: 1px solid var(--accent-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; outline: none; }

/* ---- More button & dropdown ---- */
.fp-more-wrap { position: relative; }
.fp-more-btn { font-size: 14px; letter-spacing: 1px; }
.fp-dropdown {
  position: absolute; right: 0; top: 100%; z-index: 30;
  background: var(--bg-secondary); border: 1px solid var(--border-color);
  border-radius: 6px; padding: 4px; min-width: 90px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.fp-drop-item {
  display: block; width: 100%; padding: 6px 10px; border: none; border-radius: 4px;
  background: transparent; color: var(--text-primary); font-size: 11px;
  cursor: pointer; text-align: left; white-space: nowrap;
}
.fp-drop-item:hover { background: var(--hover-bg); }
.fp-drop-item.disabled { opacity: 0.4; cursor: not-allowed; }
.fp-drop-item.disabled:hover { background: transparent; }
.fp-drop-item.danger { color: var(--danger-color); }
.fp-drop-item.danger:hover { background: rgba(231,76,60,0.08); }
.fp-drop-divider { height: 1px; background: var(--border-color); margin: 4px 6px; }
</style>
