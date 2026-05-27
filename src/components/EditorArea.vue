<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { basicSetup, EditorView } from 'codemirror'
import { appState } from '../store'
import { writeFile, renameFile, readDirectory } from '../api'
import { setEditorView, getEditorView } from '../editorHelper'
import { registerShortcut, unregisterShortcut } from '../useKeyboardShortcuts'

// Warm dark CodeMirror theme matching the app's warm dark theme
const warmDarkTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--bg-secondary)', color: '#e8dccc' },
  '.cm-content': { caretColor: '#d4a853' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#d4a853' },
  '&.cm-focused .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(212, 168, 83, 0.2)' },
  '.cm-activeLine': { backgroundColor: 'rgba(212, 168, 83, 0.06)' },
  '.cm-gutters': { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(212, 168, 83, 0.08)' },
  '.cm-foldPlaceholder': { backgroundColor: 'transparent', color: '#7a6f62' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(212, 168, 83, 0.15)', outline: '1px solid #d4a853' },
})

const extensions = computed<any[]>(() => {
  const base: any[] = [basicSetup, markdown({ base: markdownLanguage }), EditorView.lineWrapping]
  if (appState.theme === 'dark') {
    base.push(warmDarkTheme)
  }
  return base
})

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Editable title
const isEditingTitle = ref(false)
const titleInput = ref('')

const chapterTitle = computed(() => {
  if (!appState.currentFile) return ''
  const name = appState.currentFile.name.replace(/\.md$/, '')
  const path = appState.currentFile.path.replace(/\\/g, '/')
  const parentDir = path.substring(0, path.lastIndexOf('/'))
  const volName = parentDir.substring(parentDir.lastIndexOf('/') + 1)
  if (volName.includes('卷')) {
    return `${volName} / ${name}`
  }
  return name
})

function startEditTitle() {
  if (!appState.currentFile) return
  // Only the chapter name (without volume prefix) is editable
  const name = appState.currentFile.name.replace(/\.md$/, '')
  titleInput.value = name
  isEditingTitle.value = true
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('.title-input')
    input?.focus()
  }, 50)
}

async function finishEditTitle() {
  isEditingTitle.value = false
  if (!appState.currentFile || !titleInput.value.trim()) return
  const newName = titleInput.value.trim() + '.md'
  if (newName === appState.currentFile.name) return

  const oldPath = appState.currentFile.path
  const normalizedPath = oldPath.replace(/\\/g, '/')
  const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
  const newPath = dir + '/' + newName

  try {
    await renameFile(oldPath, newPath)
    appState.currentFile = { path: newPath, name: newName }
    if (appState.project) {
      appState.fileTree = await readDirectory(appState.project.path)
    }
  } catch (e) {
    console.error('重命名失败:', e)
  }
}

function handleTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    finishEditTitle()
  } else if (e.key === 'Escape') {
    isEditingTitle.value = false
  }
}

// Expose editor view for external use (find/replace, jump-to-line)
function handleReady(payload: { view: EditorView }) {
  setEditorView(payload.view)
}

// Jump to line when appState.jumpToLine changes
watch(() => appState.jumpToLine, (lineNumber) => {
  if (lineNumber === null) return
  const view = getEditorView()
  if (!view) return
  const doc = view.state.doc
  if (lineNumber < 1 || lineNumber > doc.lines) return
  const line = doc.line(lineNumber)
  view.dispatch({
    selection: { anchor: line.from },
    scrollIntoView: true,
  })
  view.focus()
  appState.jumpToLine = null
})

// Auto-save and word count
function onUpdate(update: any) {
  const doc = update.state.doc.toString()
  if (appState.currentContent !== doc) {
    appState.currentContent = doc
    appState.isDirty = true
    scheduleSave()
  }
  updateWordCount(doc)
}

async function saveCurrentFile() {
  if (!appState.currentFile || !appState.isDirty) return
  try {
    await writeFile(appState.currentFile.path, appState.currentContent)
    appState.isDirty = false
  } catch {}
}

async function forceSave() {
  if (!appState.currentFile) return
  // Even if not dirty, force write to disk
  if (appState.currentContent) {
    try {
      await writeFile(appState.currentFile.path, appState.currentContent)
      appState.isDirty = false
    } catch {}
  }
}

// Patch: modify save timer behavior based on autoSave flag
function scheduleSave() {
  if (!appState.currentFile || !appState.isDirty) return
  if (appState.autoSave) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveCurrentFile(), 1500)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveCurrentFile()
  }
}

function updateWordCount(text: string) {
  const chars = [...text]
  appState.wordCount = {
    totalChars: chars.length,
    chineseChars: chars.filter(c => c >= '\u{4e00}' && c <= '\u{9fff}').length,
    words: text.split(/[\s\n]+/).filter(s => s.length > 0).length,
    lines: text === '' ? 0 : text.split('\n').length,
  }
}

watch(() => appState.currentFile, async () => {
  if (saveTimer) clearTimeout(saveTimer)
  isEditingTitle.value = false
  if (appState.currentContent) {
    updateWordCount(appState.currentContent)
  }
})

// Editor context menu
const editorCtx = ref({ show: false, x: 0, y: 0 })
const editorHasSel = ref(false)
let editorMenuStamp = 0

function showEditorCtx(e: MouseEvent) {
  e.preventDefault()
  const view = getEditorView()
  editorHasSel.value = view ? view.state.selection.main.from !== view.state.selection.main.to : false
  // Adjust to stay within viewport
  const mx = Math.min(e.clientX, window.innerWidth - 180)
  const my = Math.min(e.clientY, window.innerHeight - 240)
  editorCtx.value = { show: true, x: Math.max(8, mx), y: Math.max(8, my) }
  editorMenuStamp = ++appState.ctxMenuStamp
}

// Close when another context menu opens
watch(() => appState.ctxMenuStamp, (stamp) => {
  if (editorMenuStamp !== 0 && stamp !== editorMenuStamp) {
    editorCtx.value.show = false
  }
})

function hideEditorCtx() { editorCtx.value.show = false }

// Click outside to close editor context menu
let editorCtxCleanup: (() => void) | null = null
watch(() => editorCtx.value.show, (v) => {
  if (v) {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest('.ctx-menu') && !el.closest('.editor-area')) {
        editorCtx.value.show = false
      }
    }
    document.addEventListener('click', handler, true)
    editorCtxCleanup = () => document.removeEventListener('click', handler, true)
  } else {
    editorCtxCleanup?.()
    editorCtxCleanup = null
  }
})
onMounted(() => {
  registerShortcut('saveFile', forceSave)
})

onUnmounted(() => {
  editorCtxCleanup?.()
  unregisterShortcut('saveFile')
})

function editorCopy() {
  hideEditorCtx()
  const view = getEditorView()
  if (!view) return
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(sel.from, sel.to - sel.from)
  if (text) navigator.clipboard.writeText(text)
}

function editorCut() {
  hideEditorCtx()
  const view = getEditorView()
  if (!view) return
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(sel.from, sel.to - sel.from)
  if (text) {
    navigator.clipboard.writeText(text)
    view.dispatch({ changes: { from: sel.from, to: sel.to, insert: '' } })
    appState.currentContent = view.state.doc.toString()
    appState.isDirty = true
  }
}

async function editorPaste() {
  hideEditorCtx()
  const view = getEditorView()
  if (!view) return
  try {
    const text = await navigator.clipboard.readText()
    const sel = view.state.selection.main
    view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } })
    appState.currentContent = view.state.doc.toString()
    appState.isDirty = true
  } catch {}
}

function editorSelectAll() {
  hideEditorCtx()
  const view = getEditorView()
  if (!view) return
  const doc = view.state.doc
  view.dispatch({ selection: { anchor: 0, head: doc.length } })
  view.focus()
}

const charCountStr = computed(() => {
  const wc = appState.wordCount
  return `当前 ${(wc.totalChars || 0).toLocaleString()} 字`
})

const statsStr = computed(() => {
  const wc = appState.wordCount
  const parts: string[] = []
  if (wc.chineseChars > 0) parts.push(`中文 ${wc.chineseChars.toLocaleString()}`)
  if (wc.lines > 0) parts.push(`${wc.lines} 行`)
  return parts.join(' | ')
})

const gridSize = computed(() => Math.round(appState.fontSize * appState.lineHeight) + 'px')

const editorStyle = computed(() => ({
  '--editor-font-family': appState.fontFamily,
  '--editor-font-size': appState.fontSize + 'px',
  '--editor-line-height': appState.lineHeight,
  '--editor-max-width': appState.lineWidth + 'px',
  '--editor-font-weight': appState.fontBold ? 'bold' : 'normal',
  '--editor-color': appState.fontColor || 'var(--text-primary)',
  '--editor-text-indent': appState.firstIndent ? '2em' : '0',
  '--editor-para-margin': appState.paraGap ? '1.2em' : '0',
  '--editor-grid-size': gridSize.value,
}))

// Grid is now rendered via CSS pseudo-element ::before on .cm-content
</script>

<template>
  <div class="editor-area" @keydown="handleKeydown" @contextmenu.prevent="showEditorCtx" @click="hideEditorCtx">
    <!-- Empty state -->
    <div v-if="!appState.currentFile" class="editor-empty">
      <div class="empty-icon">✍</div>
      <p class="empty-text">选择一个章节开始写作</p>
    </div>

    <!-- Editor -->
    <template v-else>
      <div class="chapter-header">
        <div class="title-area">
          <input
            v-if="isEditingTitle"
            ref="titleInputRef"
            v-model="titleInput"
            class="title-input"
            @blur="finishEditTitle"
            @keydown="handleTitleKeydown"
          />
          <h1 v-else class="chapter-title" @click="startEditTitle" title="点击编辑标题">
            {{ chapterTitle }}
          </h1>
        </div>
        <span v-if="appState.isDirty" class="save-status unsaved">未保存</span>
        <span v-else class="save-status saved">已保存</span>
      </div>

      <div class="editor-wrapper" :class="{
        'grid-active': appState.gridStyle !== 'none',
        'grid-lines': appState.gridStyle === 'lines',
        'grid-dashed': appState.gridStyle === 'dashed',
        'grid-dots': appState.gridStyle === 'dots'
      }" :style="editorStyle">
        <Codemirror
          :model-value="appState.currentContent"
          :extensions="extensions"
          :disabled="false"
          :indent-with-tab="true"
          :tab-size="2"
          :autofocus="true"
          @update="onUpdate"
          @ready="handleReady"
        />
      </div>

      <div class="editor-footer">
        <span class="footer-left">{{ statsStr }}</span>
        <span class="footer-right">{{ charCountStr }}</span>
      </div>
    </template>

    <!-- Editor context menu -->
    <Teleport to="body">
      <div
        v-if="editorCtx.show"
        class="ctx-menu"
        :style="{ left: editorCtx.x + 'px', top: editorCtx.y + 'px' }"
        @click.stop
      >
        <div class="ctx-item" :class="{ disabled: !editorHasSel }" @click="editorCopy"><span class="ctx-item-icon">📋</span>复制</div>
        <div class="ctx-item" :class="{ disabled: !editorHasSel }" @click="editorCut"><span class="ctx-item-icon">✂</span>剪切</div>
        <div class="ctx-item" @click="editorPaste"><span class="ctx-item-icon">📥</span>粘贴</div>
        <div class="ctx-divider"></div>
        <div class="ctx-item" @click="editorSelectAll"><span class="ctx-item-icon">☐</span>全选</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  min-width: 0;
  overflow: hidden;
}

.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.empty-text {
  font-size: 15px;
}

/* Chapter header */
.chapter-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 32px 8px;
  flex-shrink: 0;
}

.title-area {
  flex: 1;
}

.chapter-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s;
  display: block;
  width: 100%;
}

.chapter-title:hover {
  background: var(--hover-bg);
}

.title-input {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  padding: 4px 8px;
  outline: none;
  width: 100%;
  font-family: inherit;
}

.save-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.save-status.unsaved {
  color: var(--warning-color);
  background: rgba(243, 156, 18, 0.1);
}

.save-status.saved {
  color: var(--success-color);
  background: rgba(39, 174, 96, 0.1);
}

/* Editor wrapper */
.editor-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 0 32px 16px;
}

.editor-wrapper :deep(.cm-editor) {
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.editor-wrapper :deep(.cm-editor.cm-focused) {
  outline: none;
  border-color: var(--accent-color);
}

.editor-wrapper :deep(.cm-gutters) {
  background-color: var(--bg-secondary) !important;
  color: var(--text-muted) !important;
  border: none !important;
}

.editor-wrapper.grid-active :deep(.cm-content) {
  position: relative;
}
.editor-wrapper.grid-active :deep(.cm-content)::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-repeat: repeat;
}
.editor-wrapper.grid-lines :deep(.cm-content)::before {
  background-image: repeating-linear-gradient(0deg,
    transparent 0px,
    transparent calc(var(--editor-grid-size) - var(--grid-line-width, 1px)),
    var(--grid-line-color, var(--border-color)) calc(var(--editor-grid-size) - var(--grid-line-width, 1px)),
    var(--grid-line-color, var(--border-color)) var(--editor-grid-size)
  );
  background-size: 100% var(--editor-grid-size);
  background-position: 0 var(--grid-baseline-offset, 2px);
}
.editor-wrapper.grid-dashed :deep(.cm-content)::before {
  background-image: repeating-linear-gradient(0deg,
    transparent 0px,
    transparent calc(var(--editor-grid-size) - var(--grid-line-width, 1px)),
    var(--grid-line-color, var(--border-color)) calc(var(--editor-grid-size) - var(--grid-line-width, 1px)),
    var(--grid-line-color, var(--border-color)) var(--editor-grid-size)
  );
  background-size: 100% var(--editor-grid-size);
  background-position: 0 var(--grid-baseline-offset, 2px);
  -webkit-mask-image: repeating-linear-gradient(90deg,
    black 0px, black 10px,
    transparent 10px, transparent 18px
  );
  mask-image: repeating-linear-gradient(90deg,
    black 0px, black 10px,
    transparent 10px, transparent 18px
  );
}
.editor-wrapper.grid-dots :deep(.cm-content)::before {
  background-image: radial-gradient(circle, var(--grid-line-color, var(--border-color)) 1px, transparent 1px);
  background-size: var(--editor-grid-size) var(--editor-grid-size);
  background-position: 0 var(--grid-baseline-offset, 2px);
}

.editor-wrapper :deep(.cm-scroller) {
  overflow: auto;
  font-family: var(--editor-font-family, 'JetBrains Mono', 'Consolas', 'PingFang SC', monospace);
  font-size: var(--editor-font-size, 15px);
  line-height: var(--editor-line-height, 1.9);
  font-weight: var(--editor-font-weight, normal);
  color: var(--editor-color, var(--text-primary));
}

.editor-wrapper :deep(.cm-content) {
  padding: 20px 24px;
  max-width: var(--editor-max-width, 800px);
  margin: 0 auto;
}

.editor-wrapper :deep(.cm-line) {
  text-indent: var(--editor-text-indent, 0);
}

.editor-wrapper :deep(.cm-line) + .cm-line {
  margin-top: var(--editor-para-margin, 0);
}

/* Footer */
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 32px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-left {
  color: var(--text-muted);
  font-size: 12px;
}
.footer-right {
  color: var(--text-secondary);
  font-weight: 600;
}
</style>
