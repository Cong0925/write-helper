<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { WordCount } from '../store'
import ImageReplacePanel from './ImageReplacePanel.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'wordCount': [count: WordCount]
}>()

const editorEl = ref<HTMLDivElement | null>(null)
const showColorPicker = ref(false)
const colorAction = ref<'text' | 'bg'>('text')
const linkUrl = ref('')
const showLinkInput = ref(false)
const showCopiedTip = ref(false)
const undoStack = ref<{ html: string; cursor: { start: number; end: number } | null }[]>([])
const undoIdx = ref(-1)

const colors = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#2980b9', '#9b59b6', '#8e44ad', '#34495e',
  '#95a5a6', '#7f8c8d', '#000000', '#555555', '#999999',
  '#ffffff',
]

const fontSizes = ['12', '14', '15', '16', '18', '20', '24', '28', '32', '36', '48']
const fontFamilies = [
  { label: '默认', value: '' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '思源黑体', value: 'Source Han Sans SC' },
  { label: '楷体', value: 'KaiTi' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
]

// ===== Content sync =====
let syncing = false

watch(() => props.modelValue, (val) => {
  if (syncing) return
  if (!editorEl.value) return
  const current = normalizeHtml(editorEl.value.innerHTML)
  const incoming = normalizeHtml(val || '')
  if (incoming !== current) {
    editorEl.value.innerHTML = val || '<p><br></p>'
  }
})

function normalizeHtml(html: string): string {
  return html.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function emitUpdate() {
  if (!editorEl.value) return
  syncing = true
  emit('update:modelValue', editorEl.value.innerHTML)
  nextTick(() => { syncing = false })
  scheduleWordCount()
}

// ===== Word count =====
let wcTimer: ReturnType<typeof setTimeout> | null = null

function scheduleWordCount() {
  if (wcTimer) clearTimeout(wcTimer)
  wcTimer = setTimeout(() => {
    if (!editorEl.value) return
    const text = editorEl.value.innerText || ''
    const chars = [...text]
    emit('wordCount', {
      totalChars: chars.filter(c => c !== '\n').length,
      chineseChars: chars.filter(c => c >= '\u{4e00}' && c <= '\u{9fff}').length,
      words: chars.filter(c => c !== '\n').length,
      lines: text === '' ? 0 : text.split('\n').filter(l => l.trim()).length,
    })
  }, 150)
}

// ===== Undo stack =====
function pushUndo() {
  if (!editorEl.value) return
  // Trim stack if we're not at the end
  if (undoIdx.value < undoStack.value.length - 1) {
    undoStack.value = undoStack.value.slice(0, undoIdx.value + 1)
  }
  const html = editorEl.value.innerHTML
  const last = undoStack.value[undoStack.value.length - 1]
  if (last && last.html === html) return // skip if unchanged
  undoStack.value.push({ html, cursor: saveCursor() })
  if (undoStack.value.length > 50) undoStack.value.shift()
  undoIdx.value = undoStack.value.length - 1
}

function saveCursor(): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  return { start: range.startOffset, end: range.endOffset }
}

function restoreCursor(pos: { start: number; end: number } | null) {
  if (!pos || !editorEl.value) return
  const sel = window.getSelection()
  if (!sel) return
  try {
    const range = document.createRange()
    const walker = document.createTreeWalker(editorEl.value, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    let offset = 0
    while (node) {
      const len = (node.textContent || '').length
      if (offset + len >= pos.start) {
        range.setStart(node, Math.min(pos.start - offset, len))
        break
      }
      offset += len
      node = walker.nextNode()
    }
    walker.currentNode = editorEl.value
    node = walker.nextNode()
    offset = 0
    while (node) {
      const len = (node.textContent || '').length
      if (offset + len >= pos.end) {
        range.setEnd(node, Math.min(pos.end - offset, len))
        break
      }
      offset += len
      node = walker.nextNode()
    }
    sel.removeAllRanges()
    sel.addRange(range)
  } catch { /* ignore */ }
}

function undo() {
  if (undoIdx.value <= 0) return
  undoIdx.value--
  const snap = undoStack.value[undoIdx.value]
  if (!snap || !editorEl.value) return
  editorEl.value.innerHTML = snap.html
  restoreCursor(snap.cursor)
  emitUpdate()
}

function redo() {
  if (undoIdx.value >= undoStack.value.length - 1) return
  undoIdx.value++
  const snap = undoStack.value[undoIdx.value]
  if (!snap || !editorEl.value) return
  editorEl.value.innerHTML = snap.html
  restoreCursor(snap.cursor)
  emitUpdate()
}

// ===== Toolbar commands =====
function exec(cmd: string, value?: string) {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(cmd, false, value)
  editorEl.value?.focus()
  pushUndo()
  emitUpdate()
}

function execFontSize(px: string) {
  if (!editorEl.value) return
  editorEl.value.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || sel.isCollapsed) return
  document.execCommand('styleWithCSS', false, 'true')
  const range = sel.getRangeAt(0)
  const content = range.extractContents()
  if (!content.textContent?.trim()) {
    range.insertNode(content)
    return
  }
  const span = document.createElement('span')
  span.style.fontSize = px + 'px'
  span.appendChild(content)
  range.insertNode(span)
  sel.removeAllRanges()
  pushUndo()
  emitUpdate()
}

function execFontFamily(value: string) {
  if (!editorEl.value) return
  editorEl.value.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || sel.isCollapsed) return
  document.execCommand('styleWithCSS', false, 'true')
  const range = sel.getRangeAt(0)
  const content = range.extractContents()
  if (!content.textContent?.trim()) {
    range.insertNode(content)
    return
  }
  const span = document.createElement('span')
  span.style.fontFamily = value
  span.appendChild(content)
  range.insertNode(span)
  sel.removeAllRanges()
  pushUndo()
  emitUpdate()
}

function selectColor(color: string) {
  editorEl.value?.focus()
  if (colorAction.value === 'text') {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, color)
  } else {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('hiliteColor', false, color)
  }
  showColorPicker.value = false
  pushUndo()
  emitUpdate()
}

function removeColor() {
  editorEl.value?.focus()
  if (colorAction.value === 'text') {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, '')
    document.execCommand('removeFormat', false)
  } else {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('hiliteColor', false, '')
    document.execCommand('removeFormat', false)
  }
  showColorPicker.value = false
  pushUndo()
  emitUpdate()
}

function execClearFormat() {
  editorEl.value?.focus()
  document.execCommand('removeFormat', false)
  pushUndo()
  emitUpdate()
}

function execHeading(level: string) {
  editorEl.value?.focus()
  document.execCommand('formatBlock', false, level)
  pushUndo()
  emitUpdate()
}

// ===== Link =====
function insertLink() {
  editorEl.value?.focus()
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const existing = findParentLink(range)
  if (existing) {
    linkUrl.value = existing.getAttribute('href') || ''
  } else {
    linkUrl.value = ''
  }
  showLinkInput.value = true
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.cbe-link-input')
    input?.focus()
  })
}

function findParentLink(range: Range): HTMLAnchorElement | null {
  let el: Node | null = range.commonAncestorContainer
  while (el && el !== editorEl.value) {
    if (el.nodeName === 'A') return el as HTMLAnchorElement
    el = el.parentNode
  }
  return null
}

function confirmLink() {
  editorEl.value?.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) { showLinkInput.value = false; return }
  const range = sel.getRangeAt(0)
  const existing = findParentLink(range)

  if (linkUrl.value) {
    if (existing) {
      existing.setAttribute('href', linkUrl.value)
    } else {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('createLink', false, linkUrl.value)
    }
  } else if (existing) {
    // Remove link - unwrap
    const parent = existing.parentNode
    if (parent) {
      while (existing.firstChild) {
        parent.insertBefore(existing.firstChild, existing)
      }
      parent.removeChild(existing)
    }
  }
  showLinkInput.value = false
  pushUndo()
  emitUpdate()
}

function removeLink() {
  editorEl.value?.focus()
  document.execCommand('unlink', false)
  pushUndo()
  emitUpdate()
}

// ===== Image =====
const showImageReplace = ref(false)
const imageSrc = ref('')
let imageCb: ((src: string | null) => void) | null = null

function insertImage() {
  editorEl.value?.focus()
  imageSrc.value = ''
  showImageReplace.value = true
  imageCb = (src) => {
    if (src) {
      editorEl.value?.focus()
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('insertImage', false, src)
      pushUndo()
      emitUpdate()
    }
  }
}

function onImageConfirm(src: string) {
  showImageReplace.value = false
  imageCb?.(src)
  imageCb = null
}

function onImageClose() {
  showImageReplace.value = false
  imageCb?.(null)
  imageCb = null
}

// ===== Template insertion =====
function insertHtml(html: string) {
  if (!editorEl.value) return
  editorEl.value.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const fragment = range.createContextualFragment(html)
  range.insertNode(fragment)
  // Insert a line break after the template
  const br = document.createElement('br')
  range.collapse(false)
  range.insertNode(br)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  editorEl.value.focus()
  pushUndo()
  emitUpdate()
}

function insertInline(text: string) {
  if (!editorEl.value) return
  editorEl.value.focus()
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(document.createTextNode(text))
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  pushUndo()
  emitUpdate()
}

// ===== Public API =====
function getHtml(): string {
  return editorEl.value?.innerHTML || ''
}

function setContent(html: string) {
  if (!editorEl.value) return
  editorEl.value.innerHTML = html || '<p><br></p>'
  pushUndo()
  emitUpdate()
}

function clearContent() {
  if (!editorEl.value) return
  editorEl.value.innerHTML = '<p><br></p>'
  undoStack.value = []
  undoIdx.value = -1
  pushUndo()
  emitUpdate()
}

function copyContent() {
  const html = getHtml()
  const div = document.createElement('div')
  div.innerHTML = html
  const text = div.textContent || ''
  navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ]).then(() => {
    showCopiedTip.value = true
    setTimeout(() => showCopiedTip.value = false, 2000)
  }).catch(() => {
    navigator.clipboard.writeText(text)
    showCopiedTip.value = true
    setTimeout(() => showCopiedTip.value = false, 2000)
  })
}

function getContentLength(): number {
  if (!editorEl.value) return 0
  const text = editorEl.value.innerText || ''
  return [...text].length
}

function replaceCarouselImages(dataUrls: string[]) {
  if (!editorEl.value || dataUrls.length !== 3) return
  const placeholders = ['/images/carousel-1.svg', '/images/carousel-2.svg', '/images/carousel-3.svg']
  let html = editorEl.value.innerHTML
  for (let i = 0; i < 3; i++) {
    html = html.split(placeholders[i]).join(dataUrls[i])
  }
  editorEl.value.innerHTML = html
  pushUndo()
  emitUpdate()
}

defineExpose({ insertHtml, insertInline, getHtml, setContent, clearContent, copyContent, getContentLength, replaceCarouselImages })

// ===== Events =====
function onInput() {
  pushUndo()
  emitUpdate()
}

function onPaste(e: ClipboardEvent) {
  // Let browser handle paste natively for styled content
  // After paste, sync
  setTimeout(() => {
    pushUndo()
    emitUpdate()
  }, 0)
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    redo()
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    exec('bold')
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    exec('italic')
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
    e.preventDefault()
    exec('underline')
    return
  }
}

function onCopy(_e: ClipboardEvent) {
  // Browser native copy preserves all styles — no intervention needed
}

// ===== Lifecycle =====
onMounted(() => {
  if (editorEl.value && props.modelValue) {
    editorEl.value.innerHTML = props.modelValue
  }
  nextTick(() => scheduleWordCount())
})

onBeforeUnmount(() => {
  if (wcTimer) clearTimeout(wcTimer)
})
</script>

<template>
  <div class="cbe-root" @click.stop>
    <!-- Toolbar -->
    <div class="cbe-toolbar">
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="撤销" @click="undo">↩</button>
        <button class="cbe-tb-btn" title="重做" @click="redo">↪</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <select class="cbe-select" title="字体" @change="execFontFamily(($event.target as HTMLSelectElement).value)">
          <option v-for="f in fontFamilies" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
        <select class="cbe-select cbe-select-size" title="字号" @change="execFontSize(($event.target as HTMLSelectElement).value)">
          <option v-for="s in fontSizes" :key="s" :value="s">{{ s }}px</option>
        </select>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="加粗 Ctrl+B" @click="exec('bold')"><b>B</b></button>
        <button class="cbe-tb-btn" title="斜体 Ctrl+I" @click="exec('italic')"><i>I</i></button>
        <button class="cbe-tb-btn" title="下划线 Ctrl+U" @click="exec('underline')"><u>U</u></button>
        <button class="cbe-tb-btn" title="删除线" @click="exec('strikeThrough')"><s>S</s></button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="文字颜色" @click="colorAction = 'text'; showColorPicker = true">🎨</button>
        <button class="cbe-tb-btn" title="背景颜色" @click="colorAction = 'bg'; showColorPicker = true">🖍</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="居左" @click="exec('justifyLeft')">≡</button>
        <button class="cbe-tb-btn" title="居中" @click="exec('justifyCenter')">≡</button>
        <button class="cbe-tb-btn" title="居右" @click="exec('justifyRight')">≡</button>
        <button class="cbe-tb-btn" title="两端对齐" @click="exec('justifyFull')">≡</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="无序列表" @click="exec('insertUnorderedList')">•</button>
        <button class="cbe-tb-btn" title="有序列表" @click="exec('insertOrderedList')">1.</button>
        <button class="cbe-tb-btn" title="缩进" @click="exec('indent')">→</button>
        <button class="cbe-tb-btn" title="减少缩进" @click="exec('outdent')">←</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="标题2" @click="execHeading('h2')">H2</button>
        <button class="cbe-tb-btn" title="标题3" @click="execHeading('h3')">H3</button>
        <button class="cbe-tb-btn" title="正文" @click="execHeading('p')">P</button>
        <button class="cbe-tb-btn" title="引用" @click="exec('formatBlock', 'blockquote')">❝</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="插入链接" @click="insertLink">🔗</button>
        <button class="cbe-tb-btn" title="取消链接" @click="removeLink">✂</button>
        <button class="cbe-tb-btn" title="插入图片" @click="insertImage">🖼</button>
      </div>
      <span class="cbe-tb-sep"></span>
      <div class="cbe-tb-group">
        <button class="cbe-tb-btn" title="清除格式" @click="execClearFormat">✕</button>
      </div>
    </div>

    <!-- Link input bar -->
    <div v-if="showLinkInput" class="cbe-link-bar">
      <input
        v-model="linkUrl"
        class="cbe-link-input"
        placeholder="输入链接地址 https://..."
        @keyup.enter="confirmLink"
        @keyup.escape="showLinkInput = false"
      />
      <button class="cbe-link-ok" @click="confirmLink">确定</button>
      <button class="cbe-link-cancel" @click="showLinkInput = false">取消</button>
    </div>

    <!-- Content area -->
    <div
      ref="editorEl"
      class="cbe-content"
      contenteditable="true"
      @input="onInput"
      @paste="onPaste"
      @keydown="onKeydown"
      @copy="onCopy"
    >
      <p><br></p>
    </div>

    <!-- Color picker -->
    <Teleport to="body">
      <div v-if="showColorPicker" class="cbe-color-overlay" @click="showColorPicker = false">
        <div class="cbe-color-popup" @click.stop>
          <div class="cbe-color-header">
            <span>{{ colorAction === 'text' ? '文字颜色' : '背景颜色' }}</span>
            <button class="cbe-color-close" @click="showColorPicker = false">✕</button>
          </div>
          <div class="cbe-color-grid">
            <div
              v-for="c in colors"
              :key="c"
              class="cbe-color-swatch"
              :style="{ background: c, border: c === '#ffffff' ? '1px solid #ddd' : 'none' }"
              @click="selectColor(c)"
            ></div>
          </div>
          <button class="cbe-color-remove" @click="removeColor">移除颜色</button>
        </div>
      </div>
    </Teleport>

    <!-- Copied tip -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showCopiedTip" class="cbe-copied-tip">已复制到剪贴板</div>
      </Transition>
    </Teleport>

    <!-- Image replace panel -->
    <ImageReplacePanel
      v-if="showImageReplace"
      :visible="showImageReplace"
      :current-src="imageSrc"
      @confirm="onImageConfirm"
      @close="onImageClose"
    />
  </div>
</template>

<style scoped>
.cbe-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

/* ===== Toolbar ===== */
.cbe-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.cbe-tb-group {
  display: flex;
  gap: 1px;
}

.cbe-tb-btn {
  width: 32px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 0.1s;
}
.cbe-tb-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

.cbe-tb-sep {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
  flex-shrink: 0;
}

.cbe-select {
  height: 30px;
  padding: 0 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
}
.cbe-select:focus { border-color: var(--accent-color); }
.cbe-select-size { width: 58px; }

/* ===== Link bar ===== */
.cbe-link-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.cbe-link-input {
  flex: 1;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.cbe-link-input:focus { border-color: var(--accent-color); }

.cbe-link-ok {
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  background: var(--accent-color);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.cbe-link-cancel {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

/* ===== Content area ===== */
.cbe-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  background: var(--bg-secondary);
  min-height: 200px;
}

.cbe-content :deep(p) { margin: 8px 0; }
.cbe-content :deep(h1) { font-size: 22px; font-weight: bold; margin: 20px 0 10px; }
.cbe-content :deep(h2) { font-size: 18px; font-weight: bold; margin: 18px 0 8px; }
.cbe-content :deep(h3) { font-size: 16px; font-weight: bold; margin: 14px 0 6px; }
.cbe-content :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 4px solid var(--accent-color);
  background: var(--bg-primary);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
}
.cbe-content :deep(ul), .cbe-content :deep(ol) { padding-left: 24px; margin: 8px 0; }
.cbe-content :deep(li) { margin: 4px 0; }
.cbe-content :deep(a) { color: var(--accent-color); text-decoration: underline; cursor: pointer; }
.cbe-content :deep(img) { max-width: 100%; border-radius: 6px; margin: 12px auto; display: block; }
.cbe-content :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.cbe-content :deep(td), .cbe-content :deep(th) { border: 1px solid var(--border-color); padding: 8px 12px; }
.cbe-content :deep(hr) { border: none; border-top: 1px solid var(--border-color); margin: 24px 0; }
.cbe-content :deep(pre) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 13px;
  overflow-x: auto;
}
.cbe-content :deep(div[data-type="html-block"]) { display: block; }
.cbe-content:empty::before {
  content: '开始编辑文章内容...';
  color: var(--text-muted);
}

/* ===== Color picker ===== */
.cbe-color-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cbe-color-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  width: 280px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}

.cbe-color-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cbe-color-close {
  width: 24px; height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
}
.cbe-color-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.cbe-color-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.cbe-color-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s;
}
.cbe-color-swatch:hover { transform: scale(1.2); }

.cbe-color-remove {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.cbe-color-remove:hover { background: var(--hover-bg); }

/* ===== Copied tip ===== */
.cbe-copied-tip {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  background: var(--text-primary);
  color: var(--bg-primary);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 99999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: none;
}

.fade-enter-active { transition: opacity 0.2s; }
.fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
