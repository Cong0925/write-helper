<script lang="ts">
// Module-level flag: survives component re-creation across session
let sessionSkipDelete = false
</script>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { appState, type FileEntry } from '../store'
import { readFile, readDirectory, createFile, renameItem, deleteItem, getNextNumber } from '../api'
import { useCtxMenu } from '../useCtxMenu'
import { dialog } from '../composables/useDialog'

const props = defineProps<{
  entries: FileEntry[]
  depth?: number
  autoExpand?: boolean
  activeVolume?: string
  initEditingPath?: string
  allExpanded?: boolean
  showCheckbox?: boolean
  checkedSet?: Set<string>
}>()

const emit = defineEmits<{
  select: [path: string]
  refresh: []
  editingDone: []
  fileCheck: [payload: { path: string; checked: boolean }]
}>()

const expanded = ref<Set<string>>(new Set())
const childrenMap = ref<Map<string, FileEntry[]>>(new Map())
const editingName = ref<{ path: string; name: string } | null>(null)

const ctxMenu = useCtxMenu()

// Auto-expand on mount
onMounted(() => {
  if (props.autoExpand) {
    expandAll(props.entries)
  }
})

// Expand/collapse all via external toggle
function expandAll(list: FileEntry[]) {
  for (const e of list) {
    if (e.isDir) {
      expanded.value.add(e.path)
      if (e.children) expandAll(e.children)
    }
  }
}
watch(() => props.allExpanded, (val) => {
  if (val === undefined) return
  if (val) {
    expandAll(props.entries)
  } else {
    expanded.value.clear()
  }
})

// External init for inline rename
watch(() => props.initEditingPath, (path) => {
  if (!path) return
  const found = props.entries.find(e => e.path === path)
  if (found) {
    editingName.value = { path: found.path, name: found.name }
  }
})

function getDirChildren(entry: FileEntry): FileEntry[] | null {
  if (childrenMap.value.has(entry.path)) return childrenMap.value.get(entry.path)!
  if (entry.children && entry.children.length > 0) return entry.children
  return null
}

async function toggleDir(entry: FileEntry) {
  if (!entry.isDir) return
  if (expanded.value.has(entry.path)) {
    expanded.value.delete(entry.path)
    return
  }
  expanded.value.add(entry.path)
  if (!childrenMap.value.has(entry.path) && (!entry.children || entry.children.length === 0)) {
    try {
      const children = await readDirectory(entry.path)
      childrenMap.value.set(entry.path, children)
    } catch {
      childrenMap.value.set(entry.path, [])
    }
  }
}

async function openFile(entry: FileEntry) {
  if (entry.isDir) {
    emit('select', entry.path)
    return
  }

  // If auto-save is off and there are unsaved changes, prompt to save first
  if (!appState.autoSave && appState.isDirty && appState.currentFile) {
    const ok = await dialog.confirm(`「${appState.currentFile.name}」有未保存的修改，是否保存后再切换？\n\n确定=保存并切换   取消=放弃修改并切换`)
    if (ok) {
      try {
        const { writeFile } = await import('../api')
        await writeFile(appState.currentFile.path, appState.currentContent)
        appState.isDirty = false
      } catch { await dialog.alert('保存失败') }
    }
  }

  try {
    const content = await readFile(entry.path)
    appState.currentFile = { path: entry.path, name: entry.name }
    appState.currentContent = content
    appState.isDirty = false
  } catch {}
}

function isActive(entry: FileEntry) {
  return appState.currentFile?.path === entry.path
}

// ========== DELETE with session-level confirm dialog ==========
const deleting = ref<Set<string>>(new Set())

const showDeleteConfirm = ref(false)
const pendingDeleteItem = ref<FileEntry | null>(null)
const skipDeleteChecked = ref(false)

function handleDeleteClick(entry: FileEntry) {
  if (sessionSkipDelete) {
    doDelete(entry)
  } else {
    pendingDeleteItem.value = entry
    showDeleteConfirm.value = true
    skipDeleteChecked.value = false
  }
}

async function confirmDelete() {
  if (skipDeleteChecked.value) {
    sessionSkipDelete = true
  }
  showDeleteConfirm.value = false
  const entry = pendingDeleteItem.value
  pendingDeleteItem.value = null
  if (entry) {
    await doDelete(entry)
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
  pendingDeleteItem.value = null
}

async function doDelete(entry: FileEntry) {
  if (deleting.value.has(entry.path)) return
  deleting.value.add(entry.path)
  try {
    await deleteItem(entry.path)
    if (appState.currentFile?.path === entry.path) {
      appState.currentFile = null
      appState.currentContent = ''
    }
  } catch {
    await dialog.alert('删除失败，请重试')
  } finally {
    deleting.value.delete(entry.path)
    emit('refresh')
  }
}

// ========== INLINE RENAME ==========
function startInlineRename(entry: FileEntry, event: MouseEvent) {
  event.stopPropagation()
  editingName.value = { path: entry.path, name: entry.name }
}

async function finishInlineRename() {
  const t = editingName.value
  editingName.value = null
  emit('editingDone')
  if (!t || !t.name.trim()) return
  const oldName = t.path.substring(t.path.replace(/\\/g, '/').lastIndexOf('/') + 1)
  if (t.name === oldName) return
  try {
    await renameItem(t.path, t.name.trim())
    if (appState.currentFile?.path === t.path) {
      const dir = t.path.substring(0, t.path.lastIndexOf('/'))
      appState.currentFile = { path: dir + '/' + t.name.trim(), name: t.name.trim() }
    }
    emit('refresh')
  } catch { await dialog.alert('重命名失败') }
}

function onRenameInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') finishInlineRename()
  else if (e.key === 'Escape') {
    editingName.value = null
    emit('editingDone')
  }
}

// ========== DRAG & DROP (initiate drag only — drop handled by LeftPanel) ==========
function onDragStart(e: DragEvent, entry: FileEntry) {
  if (entry.isDir || !e.dataTransfer) return
  e.dataTransfer.setData('text/plain', entry.path)
  e.dataTransfer.effectAllowed = 'move'
}

// ========== CONTEXT MENU ==========
function showCtx(e: MouseEvent, entry: FileEntry) {
  e.preventDefault()
  e.stopPropagation()
  const mx = Math.min(e.clientX, window.innerWidth - 180)
  const my = Math.min(e.clientY, window.innerHeight - 280)
  ctxMenu.show({ x: Math.max(8, mx), y: Math.max(8, my), target: entry })
}

function closeCtx() { ctxMenu.hide() }

function parentPath(p: string) {
  const i = p.replace(/\\/g, '/').lastIndexOf('/')
  return i >= 0 ? p.slice(0, i) : ''
}

async function onNewFile() {
  const t = ctxMenu.target.value; if (!t) return; closeCtx()
  const parentDir = t.isDir ? t.path : parentPath(t.path)
  try {
    const nextNum = await getNextNumber(parentDir, '第', '.md')
    const name = `第${nextNum}章`
    await createFile(`${parentDir}/${name}`)
    // Reload children for the parent directory
    try {
      const children = await readDirectory(parentDir)
      childrenMap.value.set(parentDir, children)
    } catch {}
    // Focus the new file for inline rename
    editingName.value = { path: `${parentDir}/${name}.md`, name: `${name}.md` }
  } catch { await dialog.alert('创建失败') }
}

async function onRename() {
  const t = ctxMenu.target.value; if (!t) return; closeCtx()
  editingName.value = { path: t.path, name: t.name }
}

async function onDelete() {
  const t = ctxMenu.target.value; if (!t) return; closeCtx()
  await handleDeleteClick(t)
}

async function onRefresh() {
  closeCtx()
  emit('refresh')
}
</script>

<template>
  <div @click.stop="closeCtx">
    <template v-for="entry in entries" :key="entry.path">
      <div
        class="tree-item"
        :draggable="!entry.isDir"
        :class="{
          active: isActive(entry) && !entry.isDir,
          'is-dir': entry.isDir,
        }"
        :style="{ paddingLeft: 12 + (depth ?? 0) * 16 + 'px' }"
        @click="entry.isDir ? toggleDir(entry) : openFile(entry)"
        @contextmenu="showCtx($event, entry)"
        @dragstart="onDragStart($event, entry)"
      >
        <span v-if="entry.isDir" class="toggle-icon">
          {{ expanded.has(entry.path) ? '▼' : '▶' }}
        </span>
        <input
          v-if="showCheckbox && !entry.isDir"
          type="checkbox"
          class="batch-checkbox"
          :checked="checkedSet?.has(entry.path)"
          @change="emit('fileCheck', { path: entry.path, checked: ($event.target as HTMLInputElement).checked })"
          @click.stop
        />
        <span class="tree-icon">{{ entry.isDir ? '📁' : '📄' }}</span>

        <!-- Inline rename -->
        <template v-if="editingName?.path === entry.path">
          <input
            v-model="editingName.name"
            class="inline-rename-input"
            @keydown="onRenameInputKeydown"
            @blur="finishInlineRename"
            @click.stop
            autofocus
          />
        </template>
        <span v-else class="tree-name">
          {{ entry.isDir ? entry.name : entry.name.replace(/\.md$/, '') }}
        </span>

        <!-- File action buttons -->
        <div class="tree-item-actions" v-if="!entry.isDir" @click.stop draggable="false">
          <button class="tree-action-btn" title="重命名" @click="startInlineRename(entry, $event)" draggable="false">✎</button>
          <button class="tree-action-btn danger" title="删除" @click="handleDeleteClick(entry)" draggable="false">✕</button>
        </div>
      </div>

      <!-- Recursive children -->
      <FileTree
        v-if="entry.isDir && expanded.has(entry.path) && getDirChildren(entry)"
        :entries="getDirChildren(entry)!"
        :depth="(depth ?? 0) + 1"
        :active-volume="activeVolume"
        :init-editing-path="props.initEditingPath"
        :all-expanded="props.allExpanded"
        :show-checkbox="showCheckbox"
        :checked-set="checkedSet"
        @select="(p: string) => emit('select', p)"
        @refresh="emit('refresh')"
        @editing-done="emit('editingDone')"
        @file-check="(e: any) => emit('fileCheck', e)"
      />
    </template>

    <!-- Delete confirm dialog -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="showDeleteConfirm" class="confirm-overlay" @click.self="cancelDelete">
          <div class="confirm-dialog">
            <div class="confirm-icon-wrap">
              <span class="confirm-icon">🗑</span>
            </div>
            <div class="confirm-title">确认删除</div>
            <div class="confirm-text">
              确定要删除「<strong>{{ pendingDeleteItem?.name }}</strong>」吗？<br>
              此操作无法撤销。
            </div>
            <label class="confirm-checkbox">
              <input type="checkbox" v-model="skipDeleteChecked" />
              <span class="checkbox-label">不再询问（本次编辑）</span>
            </label>
            <div class="confirm-actions">
              <button class="confirm-btn" @click="cancelDelete">取消</button>
              <button class="confirm-btn confirm-danger" @click="confirmDelete">
                <span>🗑</span> 删除
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Context menu (Teleport to body) -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible.value"
        class="ctx-menu"
        :style="{ left: ctxMenu.x.value + 'px', top: ctxMenu.y.value + 'px' }"
        @click.stop
      >
        <template v-if="ctxMenu.target.value?.isDir">
          <div class="ctx-item" @click="onNewFile"><span class="ctx-item-icon">📄</span>新建章节</div>
          <div class="ctx-divider"></div>
        </template>
        <div class="ctx-item" @click="onRename"><span class="ctx-item-icon">✎</span>重命名</div>
        <div class="ctx-item" @click="onRefresh"><span class="ctx-item-icon">↻</span>刷新</div>
        <div class="ctx-divider"></div>
        <div class="ctx-item danger" @click="onDelete"><span class="ctx-item-icon">✕</span>删除</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  margin: 1px 4px;
  user-select: none;
  position: relative;
  transition: background 0.1s;
}
.tree-item:hover { background: var(--hover-bg); }
.tree-item.active {
  background: var(--accent-color);
  color: #fff;
}
.tree-item.active .tree-name,
.tree-item.active .tree-action-btn {
  color: #fff;
}
.tree-item.is-dir:hover { background: var(--hover-bg); }


.toggle-icon { font-size: 8px; width: 12px; text-align: center; flex-shrink: 0; color: var(--text-muted); }
.tree-icon { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }
.tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tree-item-actions {
  display: none;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}
.tree-item:hover .tree-item-actions { display: flex; }

.tree-action-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.tree-action-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.tree-action-btn.danger:hover { color: var(--danger-color); background: rgba(231, 76, 60, 0.1); }

.batch-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-color);
  cursor: pointer;
  flex-shrink: 0;
}

.inline-rename-input {
  flex: 1;
  min-width: 0;
  padding: 1px 4px;
  font-size: 13px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 3px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}


/* ===== Delete confirm dialog ===== */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px 28px 24px;
  width: 340px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.confirm-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(231, 76, 60, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
}
.confirm-icon {
  font-size: 24px;
  line-height: 1;
}
.confirm-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}
.confirm-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 22px;
}
.confirm-text strong {
  color: var(--text-primary);
  font-weight: 600;
}
.confirm-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 8px 14px;
  background: var(--hover-bg);
  border-radius: 8px;
  margin-bottom: 24px;
  transition: background 0.15s;
}
.confirm-checkbox:hover {
  background: var(--active-bg);
}
.confirm-checkbox input {
  accent-color: var(--accent-color);
  width: 15px;
  height: 15px;
  cursor: pointer;
}
.checkbox-label {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1;
}
.confirm-actions {
  display: flex;
  gap: 12px;
}
.confirm-btn {
  flex: 1;
  padding: 10px 0;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.confirm-btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-muted);
}
.confirm-btn.confirm-danger {
  background: var(--danger-color);
  color: #fff;
  border-color: var(--danger-color);
}
.confirm-btn.confirm-danger:hover {
  background: #c0392b;
  border-color: #c0392b;
}

/* Transition */
.confirm-fade-enter-active { transition: opacity 0.2s ease; }
.confirm-fade-leave-active { transition: opacity 0.15s ease; }
.confirm-fade-enter-from,
.confirm-fade-leave-to { opacity: 0; }
</style>
