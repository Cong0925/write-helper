<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { setActiveWysiwyg, getActiveWysiwyg } from '../wysiwygHelper'

const props = defineProps<{
  modelValue: string
  folderDir?: string    // e.g. "大纲", "设定", "人设", "素材" — for folder-scoped search
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLDivElement | null>(null)
let suppressRender = false

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---',
})

async function renderMarkdown(md: string) {
  if (!editorRef.value) return
  // Use lexer to get tokens, counting blank lines between blocks
  const tokens = marked.lexer(md || '')
  let html = ''
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'space') continue
    html += marked.parser([t])
    // Count following space tokens (= blank lines between blocks)
    let br = 0
    while (i + 1 + br < tokens.length && tokens[i + 1 + br].type === 'space') br++
    if (br > 0) {
      html += '\n' + Array(br).fill('<br>').join('\n') + '\n'
      i += br
    }
  }
  editorRef.value.innerHTML = html
}

// Custom turndown rule: convert <br> back to plain newline
turndownService.addRule('lineBreak', {
  filter: 'br',
  replacement: () => '\n',
})

onMounted(() => {
  renderMarkdown(props.modelValue || '')
})

watch(() => props.modelValue, async (val) => {
  if (suppressRender) {
    suppressRender = false
    return
  }
  await renderMarkdown(val || '')
})

function onInput() {
  if (!editorRef.value) return
  const md = turndownService.turndown(editorRef.value.innerHTML)
  suppressRender = true
  emit('update:modelValue', md)
}

function onWysiwygKeydown(e: KeyboardEvent) {
  // Ctrl+F → toggle find/replace panel
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    console.log('[wysiwyg] Ctrl+F intercepted on contenteditable')
    import('../store').then(({ appState }) => {
      appState.showFindReplace = !appState.showFindReplace
    })
    return
  }
}

function onFocus() {
  if (!editorRef.value) return
  setActiveWysiwyg({
    el: editorRef.value,
    folderDir: props.folderDir,
    getContent: () => props.modelValue,
    setContent: (val: string) => { suppressRender = true; emit('update:modelValue', val) },
    focus: () => editorRef.value?.focus(),
  })
}

function onBlur() {
  setTimeout(() => {
    if (getActiveWysiwyg()?.el === editorRef.value) {
      setActiveWysiwyg(null)
    }
  }, 100)
}

onUnmounted(() => {
  if (getActiveWysiwyg()?.el === editorRef.value) {
    setActiveWysiwyg(null)
  }
})

/* ---- Toolbar commands ---- */
function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
  editorRef.value?.focus()
}

function toggleHeading(level: number) {
  const tag = `H${level}`
  const sel = window.getSelection()
  if (sel && sel.anchorNode) {
    let el: HTMLElement | null = sel.anchorNode as HTMLElement
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
    while (el && el !== editorRef.value) {
      if (el.tagName === tag) {
        exec('formatBlock', 'p')
        return
      }
      el = el.parentElement
    }
  }
  exec('formatBlock', tag.toLowerCase())
}

function toggleQuote() {
  const sel = window.getSelection()
  if (sel && sel.anchorNode) {
    let el: HTMLElement | null = sel.anchorNode as HTMLElement
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
    while (el && el !== editorRef.value) {
      if (el.tagName === 'BLOCKQUOTE') {
        // Unwrap: move children out
        const parent = el.parentElement
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
        return
      }
      el = el.parentElement
    }
  }
  exec('formatBlock', 'blockquote')
}

function wrapInlineCode() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !editorRef.value) return
  const range = sel.getRangeAt(0)
  // Check if inside a code element
  let el: HTMLElement | null = sel.anchorNode as HTMLElement
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
  let inCode = false
  let codeEl: HTMLElement | null = null
  while (el && el !== editorRef.value) {
    if (el.tagName === 'CODE') { inCode = true; codeEl = el; break }
    el = el.parentElement
  }
  if (inCode && codeEl) {
    // Unwrap code
    const parent = codeEl.parentElement
    if (parent) {
      while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl)
      parent.removeChild(codeEl)
    }
  } else if (range.collapsed) {
    exec('insertHTML', '<code>代码</code>')
  } else {
    const text = range.toString()
    exec('insertHTML', `<code>${text}</code>`)
  }
  editorRef.value?.focus()
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  // Insert as plain text, let browser normalize line breaks
  document.execCommand('insertText', false, text)
}
</script>

<template>
  <div class="wysiwyg-wrap">
    <div class="wysiwyg-tb">
      <button class="wys-tb-btn" title="标题 1" @click="toggleHeading(1)">H1</button>
      <button class="wys-tb-btn" title="标题 2" @click="toggleHeading(2)">H2</button>
      <button class="wys-tb-btn" title="标题 3" @click="toggleHeading(3)">H3</button>
      <span class="wys-tb-sep"></span>
      <button class="wys-tb-btn" title="粗体" @click="exec('bold')"><strong>B</strong></button>
      <button class="wys-tb-btn" title="斜体" @click="exec('italic')"><em>I</em></button>
      <span class="wys-tb-sep"></span>
      <button class="wys-tb-btn" title="无序列表" @click="exec('insertUnorderedList')">UL</button>
      <button class="wys-tb-btn" title="有序列表" @click="exec('insertOrderedList')">OL</button>
      <button class="wys-tb-btn" title="引用" @click="toggleQuote">&gt;</button>
      <span class="wys-tb-sep"></span>
      <button class="wys-tb-btn" title="行内代码" @click="wrapInlineCode">&lt;/&gt;</button>
    </div>
    <div ref="editorRef" contenteditable class="wysiwyg-editor" @input="onInput" @paste="onPaste" @focus="onFocus" @blur="onBlur" @keydown="onWysiwygKeydown"></div>
  </div>
</template>

<style scoped>
.wysiwyg-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.wysiwyg-tb {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.wys-tb-btn {
  padding: 2px 8px;
  height: 26px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.wys-tb-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--accent-color);
}
.wys-tb-sep {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 3px;
  flex-shrink: 0;
}
.wysiwyg-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
  font-size: 13px;
  line-height: 1.8;
  font-family: inherit;
  color: var(--text-primary);
  background: transparent;
  outline: none;
  word-wrap: break-word;
}
.wysiwyg-editor h1 { font-size: 20px; font-weight: 700; margin: 18px 0 8px; }
.wysiwyg-editor h2 { font-size: 17px; font-weight: 700; margin: 14px 0 6px; }
.wysiwyg-editor h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
.wysiwyg-editor p { margin: 0 0 4px; }
.wysiwyg-editor strong { font-weight: 700; }
.wysiwyg-editor em { font-style: italic; }
.wysiwyg-editor code { background: var(--hover-bg); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: 'JetBrains Mono', Consolas, monospace; }
.wysiwyg-editor ul, .wysiwyg-editor ol { padding-left: 24px; margin: 4px 0; }
.wysiwyg-editor li { margin: 2px 0; }
.wysiwyg-editor blockquote { margin: 4px 0; padding: 2px 12px; border-left: 3px solid var(--accent-color); color: var(--text-secondary); }
</style>
