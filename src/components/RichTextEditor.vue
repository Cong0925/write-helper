<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, onUnmounted, computed } from 'vue'
import { DOMSerializer } from '@tiptap/pm/model'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Node, mergeAttributes, Mark, Extension } from '@tiptap/core'
import { NodeSelection, TextSelection, Plugin } from '@tiptap/pm/state'
import type { WordCount } from '../store'
import { setTiptapEditor } from '../tiptapHelper'
import { dialog } from '../composables/useDialog'
import { readFileBase64 } from '../api/files'
import ImageReplacePanel from './ImageReplacePanel.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'wordCount': [count: WordCount]
}>()

const showHtmlView = ref(false)
const htmlCode = ref('')

// Color picker
const showColorPicker = ref(false)
const currentColorAction = ref<'text' | 'bg'>('text')
const colors = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#2980b9', '#9b59b6', '#8e44ad', '#34495e',
  '#95a5a6', '#7f8c8d', '#000000', '#555555', '#999999',
]

// ─── SpanStyle mark — preserves arbitrary inline <span> styles ───
const SpanStyle = Mark.create({
  name: 'spanStyle',
  excludes: '',
  parseHTML() {
    return [{
      tag: 'span',
      getAttrs: (node) => {
        if (typeof node === 'string') return false
        const el = node as HTMLElement
        const style = el.getAttribute('style')
        return style ? { style } : false
      },
    }]
  },
  renderHTML({ mark }) {
    if (!mark.attrs.style) return ['span', 0]
    return ['span', { style: mark.attrs.style }, 0]
  },
})

// ─── Custom Section node — raw HTML block, preserves all styles faithfully ───
const Section = Node.create({
  name: 'section',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: element => element.innerHTML || '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-template]' }]
  },

  renderHTML({ node }) {
    const el = document.createElement('section')
    el.setAttribute('data-template', 'true')
    el.innerHTML = node.attrs.html as string
    return el
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const el = document.createElement('section')
      el.setAttribute('data-template', 'true')
      el.contentEditable = 'true'
      el.innerHTML = node.attrs.html as string

      el.addEventListener('input', () => {
        const pos = getPos()
        if (typeof pos === 'number') {
          editor.commands.command(({ tr }) => {
            tr.setNodeAttribute(pos, 'html', el.innerHTML)
            return true
          })
        }
      })

      el.addEventListener('keydown', (e) => {
        // Ctrl+A — select all in the full editor, not just inside this section
        if (e.ctrlKey && e.key === 'a') {
          e.preventDefault()
          const { view } = editor
          const { state } = view
          const sel = new TextSelection(state.doc.resolve(0), state.doc.resolve(state.doc.content.size))
          view.dispatch(state.tr.setSelection(sel))
          view.focus()
          return
        }
        e.stopPropagation()
      })

      return {
        dom: el,
        update: (updatedNode) => {
          if (updatedNode.attrs.html !== el.innerHTML) {
            el.innerHTML = updatedNode.attrs.html as string
          }
          return true
        },
        stopEvent: () => true,
        // Ignore all DOM mutations — content inside atom nodes is NOT
        // managed by ProseMirror. Without this, DOMObserver will try to
        // reconcile mutations (typing, image clicks, etc.) against the
        // ProseMirror document, corrupting the node's content and losing images.
        ignoreMutation: () => true,
      }
    }
  },
})

// ─── Custom Div node — preserves <div> elements as editable containers ───
const Div = Node.create({
  name: 'div',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      style: { default: '' },
    }
  },
  parseHTML() {
    return [{
      tag: 'div',
      getAttrs(node) {
        if (typeof node === 'string') return false
        const el = node as HTMLElement
        if (el.getAttribute('data-type') === 'html-block') return false
        const style = el.getAttribute('style') || ''
        return style ? { style } : {}
      },
    }]
  },
  renderHTML({ node }) {
    const attrs: Record<string, string> = {}
    if (node.attrs.style) attrs.style = node.attrs.style as string
    return ['div', mergeAttributes(attrs), 0]
  },
})

// ─── Editable Image — adds double-click to change src ───
const EditableImage = Image.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement
              if (target.tagName !== 'IMG') return false
              const src = target.getAttribute('src') || ''
              const isPlaceholder = src.includes('/images/carousel-') && src.endsWith('.svg')
              const isInCarousel = !isPlaceholder && !!target.closest('[style*="carouselAnim"], [style*="min-width:33.333%"]')
              if (isPlaceholder || isInCarousel) {
                // Collect all carousel images and dispatch a custom event
                const allImgs = view.dom.querySelectorAll('img')
                const srcs: string[] = []
                for (const imgEl of allImgs) {
                  const s = imgEl.getAttribute('src') || ''
                  if (s.includes('/images/carousel-') || imgEl.closest('[style*="carouselAnim"], [style*="min-width:33.333%"]')) {
                    if (!srcs.includes(s)) srcs.push(s)
                  }
                }
                const defaults = ['/images/carousel-1.svg', '/images/carousel-2.svg', '/images/carousel-3.svg']
                while (srcs.length < 3) srcs.push(defaults[srcs.length])
                view.dom.dispatchEvent(new CustomEvent('carousel-click', { bubbles: true, detail: srcs.slice(0, 3) }))
                return true
              }

              imagePanelSrc.value = src
              imagePanelShow.value = true
              imagePanelCb = null
              new Promise<string | null>((resolve) => { imagePanelCb = resolve }).then((newSrc) => {
                if (!newSrc || newSrc === src) return
                const pos = view.posAtDOM(target, 0)

                // Try normal path: image is a regular ProseMirror node
                if (pos !== null && pos !== undefined) {
                  for (let i = Math.max(0, pos - 5); i <= pos + 5; i++) {
                    const node = view.state.doc.nodeAt(i)
                    if (node?.type.name === 'image' && node.attrs.src === src) {
                      view.dispatch(view.state.tr.setNodeMarkup(i, undefined, { ...node.attrs, src: newSrc }))
                      break
                    }
                  }
                  return
                }

                // Fallback: image is inside a Section atom node (raw HTML).
                // Update the live DOM directly, then sync to the section node's
                // html attribute via the nodeView's own input handler.
                const sectionEl = target.closest('section[data-template]') as HTMLElement | null
                if (!sectionEl) return
                target.setAttribute('src', newSrc)
                sectionEl.dispatchEvent(new Event('input', { bubbles: true }))
              })
              return true
            },
          },
        },
      }),
    ]
  },
})

/* ── SectionProtection — prevents accidental backspace/delete from removing Section atom nodes ── */
const SectionProtection = Extension.create({
  name: 'sectionProtection',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return false
            const { selection } = view.state
            // Only block when cursor is empty (no explicit NodeSelection or text selection)
            if (!selection.empty) return false
            if (!('$from' in selection)) return false

            const { $from } = selection
            const isBackspace = event.key === 'Backspace'

            if (isBackspace) {
              // Cursor at start of a block: check if previous sibling is a Section
              if ($from.parentOffset === 0) {
                for (let i = $from.depth; i > 0; i--) {
                  if ($from.index(i) > 0) {
                    const prev = $from.node(i).child($from.index(i) - 1)
                    if (prev?.type.name === 'section') {
                      event.preventDefault()
                      return true
                    }
                  }
                }
              }
            } else {
              // Delete key: check if next sibling is a Section
              for (let i = $from.depth; i > 0; i--) {
                const parent = $from.node(i)
                const afterIdx = $from.indexAfter(i)
                if (afterIdx < parent.childCount) {
                  const next = parent.child(afterIdx)
                  if (next?.type.name === 'section') {
                    event.preventDefault()
                    return true
                  }
                }
              }
            }

            return false
          },
        },
      }),
    ]
  },
})

const editor = useEditor({
  content: props.modelValue || '<p>开始编辑文章...</p>',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: false,
      underline: false,
    }),
    Underline,
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { target: '_blank', rel: 'noopener' },
    }),
    EditableImage.configure({ inline: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: '开始编辑文章内容...' }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    SpanStyle,
    Section,
    Div,
    SectionProtection,
  ],
  onCreate: ({ editor: ed }) => {
    ed.view.dom.addEventListener('paste', handlePaste)
    setTiptapEditor(ed)
  },
  onDestroy: (props?: { editor: any }) => {
    try { props?.editor?.view?.dom?.removeEventListener('paste', handlePaste) } catch {}
    setTiptapEditor(null)
  },
  onUpdate: ({ editor: ed }) => {
    const html = ed.getHTML()
    emit('update:modelValue', html)
    scheduleWordCount(ed)
  },
})

// ─── Word count with debounce (150ms) ───────────────────────
let _wcTimer: ReturnType<typeof setTimeout> | null = null

function scheduleWordCount(ed: any) {
  if (_wcTimer) clearTimeout(_wcTimer)
  _wcTimer = setTimeout(() => doWordCount(ed), 150)
}

function doWordCount(ed: any) {
  _wcTimer = null
  // Use DOM textContent because atom:true section nodes are invisible to ProseMirror's textBetween
  const raw = (ed.view.dom as HTMLElement).textContent || ''
  const text = raw.replace(/\s+/g, ' ').trim()
  const chars = [...text]
  const totalChars = chars.filter(c => c !== ' ').length
  const chineseChars = chars.filter(c => c >= '\u{4e00}' && c <= '\u{9fff}').length
  const lines = raw.trim() === '' ? 0 : raw.trim().split(/\n+/).filter((l: string) => l.trim()).length
  emit('wordCount', { totalChars, chineseChars, words: totalChars, lines })
}

// Model value sync
watch(() => props.modelValue, (val) => {
  if (!editor.value || showHtmlView.value) return
  const current = editor.value.getHTML()
  if (val && val !== current) {
    editor.value.commands.setContent(val, false)
    doWordCount(editor.value)
  }
})

// ===== Toolbar actions =====
function execCmd(cmd: string, attr?: any) {
  if (!editor.value) return
  const ed = editor.value
  switch (cmd) {
    case 'bold': ed.chain().focus().toggleBold().run(); break
    case 'italic': ed.chain().focus().toggleItalic().run(); break
    case 'underline': ed.chain().focus().toggleUnderline().run(); break
    case 'strike': ed.chain().focus().toggleStrike().run(); break
    case 'h1': ed.chain().focus().toggleHeading({ level: 1 }).run(); break
    case 'h2': ed.chain().focus().toggleHeading({ level: 2 }).run(); break
    case 'h3': ed.chain().focus().toggleHeading({ level: 3 }).run(); break
    case 'h4': ed.chain().focus().toggleHeading({ level: 4 }).run(); break
    case 'p': ed.chain().focus().setParagraph().run(); break
    case 'bulletList': ed.chain().focus().toggleBulletList().run(); break
    case 'orderedList': ed.chain().focus().toggleOrderedList().run(); break
    case 'blockquote': ed.chain().focus().toggleBlockquote().run(); break
    case 'code': ed.chain().focus().toggleCodeBlock().run(); break
    case 'hr': ed.chain().focus().setHorizontalRule().run(); break
    case 'undo': ed.chain().focus().undo().run(); break
    case 'redo': ed.chain().focus().redo().run(); break
    case 'align-left': ed.chain().focus().setTextAlign('left').run(); break
    case 'align-center': ed.chain().focus().setTextAlign('center').run(); break
    case 'align-right': ed.chain().focus().setTextAlign('right').run(); break
    case 'clearFormat': ed.chain().focus().clearNodes().unsetAllMarks().run(); break
    case 'setColor': ed.chain().focus().setColor(attr).run(); break
    case 'unsetColor': ed.chain().focus().unsetColor().run(); break
    case 'setHighlight': ed.chain().focus().toggleHighlight({ color: attr }).run(); break
    case 'unsetHighlight': ed.chain().focus().unsetHighlight().run(); break
  }
}

function isActive(cmd: string, attr?: any): boolean {
  if (!editor.value) return false
  const ed = editor.value
  switch (cmd) {
    case 'bold': return ed.isActive('bold')
    case 'italic': return ed.isActive('italic')
    case 'underline': return ed.isActive('underline')
    case 'strike': return ed.isActive('strike')
    case 'h1': return ed.isActive('heading', { level: 1 })
    case 'h2': return ed.isActive('heading', { level: 2 })
    case 'h3': return ed.isActive('heading', { level: 3 })
    case 'h4': return ed.isActive('heading', { level: 4 })
    case 'bulletList': return ed.isActive('bulletList')
    case 'orderedList': return ed.isActive('orderedList')
    case 'blockquote': return ed.isActive('blockquote')
    case 'code': return ed.isActive('codeBlock')
    case 'align-left': return ed.isActive({ textAlign: 'left' })
    case 'align-center': return ed.isActive({ textAlign: 'center' })
    case 'align-right': return ed.isActive({ textAlign: 'right' })
    default: return false
  }
}

// Table insertion
function insertTable() {
  if (!editor.value) return
  editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

// Link insertion
async function insertLink() {
  if (!editor.value) return
  const url = await dialog.prompt('输入链接地址:', 'https://')
  if (url) {
    editor.value.chain().focus().setLink({ href: url }).run()
  }
}

// Image insertion
async function insertImage() {
  if (!editor.value) return
  imagePanelSrc.value = ''
  imagePanelShow.value = true
  const src = await new Promise<string | null>((resolve) => {
    imagePanelCb = resolve
  })
  if (src) {
    editor.value.chain().focus().setImage({ src }).run()
  }
}

// Replace selected image
const hasImageSelected = computed(() => {
  if (!editor.value) return false
  const { selection } = editor.value.state
  return selection instanceof NodeSelection && selection.node.type.name === 'image'
})

async function replaceSelectedImage() {
  if (!editor.value || !hasImageSelected.value) return
  const sel = editor.value.state.selection as NodeSelection
  const node = sel.node
  imagePanelSrc.value = node.attrs.src as string
  imagePanelShow.value = true
  const newSrc = await new Promise<string | null>((resolve) => {
    imagePanelCb = resolve
  })
  if (newSrc) {
    editor.value.chain().focus().updateAttributes('image', { src: newSrc }).run()
  }
}

// HTML view toggle
function toggleHtmlView() {
  if (!editor.value) return
  showHtmlView.value = !showHtmlView.value
  if (showHtmlView.value) {
    htmlCode.value = editor.value.getHTML()
  } else {
    if (htmlCode.value) {
      editor.value.commands.setContent(htmlCode.value, false)
    }
  }
}

function onHtmlInput() {
  // Live update not needed
}

// Insert HTML at cursor position — parse through ProseMirror for full toolbar editability
function insertHtml(html: string) {
  if (!editor.value) return
  if (showHtmlView.value) {
    const pos = htmlCode.value.length
    htmlCode.value = htmlCode.value.slice(0, pos) + '\n' + html + htmlCode.value.slice(pos)
    return
  }
    // Only wrap in Section atom node when the template contains <style> tags
  // (carousel keyframes, animated footers) that ProseMirror would strip.
  // For all other templates, insert directly as parseable HTML so the
  // content is fully editable (not trapped in an atom node).
  if (html.includes('<style>')) {
    editor.value.chain().focus().insertContent(`<section data-template="true">${html}</section><p><br></p>`).run()
  } else {
    editor.value.chain().focus().insertContent(html).run()
  }
}

// Insert inline content (single character / inline text) without trailing blank paragraph
function insertInline(text: string) {
  if (!editor.value) return
  if (showHtmlView.value) {
    const pos = htmlCode.value.length
    htmlCode.value = htmlCode.value.slice(0, pos) + text + htmlCode.value.slice(pos)
    return
  }
  editor.value.chain().focus().insertContent(text).run()
}

// Get full HTML — walks the document to preserve Section raw HTML faithfully
function getHtml(): string {
  if (showHtmlView.value) return htmlCode.value
  if (!editor.value) return ''

  const doc = editor.value.state.doc
  const serializer = DOMSerializer.fromSchema(editor.value.schema)
  const parts: string[] = []

  doc.forEach((node) => {
    if (node.type.name === 'section') {
      // Wrap in <section data-template="true"> so that setContent() on save/load
      // re-creates Section nodes instead of re-parsing into Div+Image (which
      // produces empty <p> wrappers and drops <style> tags).
      parts.push(`<section data-template="true">${node.attrs.html}</section>`)
    } else {
      const div = document.createElement('div')
      div.appendChild(serializer.serializeNode(node))
      parts.push(div.innerHTML)
    }
  })

  return parts.join('')
}

// Get content length
function getContentLength(): number {
  const html = getHtml()
  const text = html.replace(/<[^>]*>/g, '').trim()
  return [...text].length
}

// Get rendered HTML from the editor's live DOM for clipboard copy.
// Reads from the actual browser-rendered DOM (editor.view.dom.innerHTML)
// instead of ProseMirror's DOMSerializer, so Section atom nodes preserve
// their raw template HTML faithfully and no double-serialization occurs.
function getHtmlForCopy(): string {
  if (!editor.value) return ''
  if (showHtmlView.value) return htmlCode.value
  let html = editor.value.view.dom.innerHTML
    // Strip ProseMirror internal artifacts
    .replace(/<span class="ProseMirror-trailingBreak"><\/span>/g, '')
    .replace(/\sdata-pm-slice="[^"]*"/g, '')
    .replace(/ contenteditable="true"/g, '')
  return html
}

// Set content
function setContent(html: string) {
  if (!editor.value) return
  if (showHtmlView.value) {
    htmlCode.value = html
  } else {
    editor.value.commands.setContent(html, false)
  }
}

// Clear all content
function clearContent() {
  if (!editor.value) return
  if (showHtmlView.value) {
    htmlCode.value = ''
  } else {
    editor.value.commands.clearContent()
  }
}

// Render HTML into an iframe's document, then browser-native copy from there.
// The iframe provides an independent browser context — same mechanism 135/365 use.
// This ensures clipboard HTML is browser-serialized (not ProseMirror-serialized),
// which other editors (Toutiao, WeChat) can process correctly.
// Render HTML through iframe, convert <div> → <section>, return browser-normalized HTML
function convertViaIframe(html: string): string {
  document.getElementById('copy-staging-iframe')?.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'copy-staging-iframe'
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) { iframe.remove(); return html }
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:8px;font-family:sans-serif;font-size:16px;line-height:1.8}</style></head><body>${html}</body></html>`)
  doc.close()

  // Convert <div> → <section>. Toutiao/WeChat whitelist <section> but strip <div>.
  doc.body.querySelectorAll('div').forEach(div => {
    const section = doc.createElement('section')
    for (const attr of div.attributes) section.setAttribute(attr.name, attr.value)
    while (div.firstChild) section.appendChild(div.firstChild)
    div.replaceWith(section)
  })

  const result = doc.body.innerHTML
  iframe.remove()
  return result
}

// ─── Helper: convert local image file paths in HTML to base64 data URLs ───
// This lets Toutiao/WeChat's editors auto-upload images when pasting.
async function replaceLocalImagesWithBase64(html: string): Promise<string> {
  const div = document.createElement('div')
  div.innerHTML = html
  const imgs = div.querySelectorAll('img')
  if (imgs.length === 0) return html

  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp', ico: 'image/x-icon',
  }

  const tasks: Promise<void>[] = []

  imgs.forEach(img => {
    const src = img.getAttribute('src') || ''
    // Skip non-local paths (already data URLs or remote URLs)
    if (!src || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return

    const ext = src.split('.').pop()?.toLowerCase() || ''
    const mime = mimeMap[ext] || 'image/png'

    tasks.push(
      readFileBase64(src)
        .then(b64 => { img.setAttribute('src', `data:${mime};base64,${b64}`) })
        .catch(() => { /* keep original src if file read fails */ })
    )
  })

  if (tasks.length === 0) return html
  await Promise.all(tasks)
  return div.innerHTML
}

// ─── Check if there are any unreplaced default SVG placeholders ───
function hasUnreplacedPlaceholders(): boolean {
  if (!editor.value) return false
  const html = getHtml()
  const div = document.createElement('div')
  div.innerHTML = html
  const imgs = div.querySelectorAll('img')
  for (const img of imgs) {
    const src = img.getAttribute('src') || ''
    // All built-in template SVGs live under /images/
    if (src.startsWith('/images/')) return true
  }
  return false
}

// Copy all content — convert local images to data URL → convert div→section, then Clipboard API
async function copyContent() {
  // Guard: check for unreplaced placeholder images
  if (hasUnreplacedPlaceholders()) {
    dialog.alert('当前内容中包含未替换的默认占位图（/images/ 开头的 SVG），请先点击图片替换后再复制。')
    return
  }
  const html = getHtmlForCopy()
  const withDataUrls = await replaceLocalImagesWithBase64(html)
  const converted = convertViaIframe(withDataUrls)
  const div = document.createElement('div')
  div.innerHTML = converted
  const text = div.textContent || ''

  navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([converted], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ]).then(() => {
    copiedTipMsg.value = '已复制到剪贴板'
    showCopiedTip.value = true
    setTimeout(() => showCopiedTip.value = false, 2000)
  }).catch(() => {
    navigator.clipboard.writeText(text).then(() => {
      copiedTipMsg.value = '已复制到剪贴板'
      showCopiedTip.value = true
      setTimeout(() => showCopiedTip.value = false, 2000)
    }).catch(() => { /* clipboard unavailable */ })
  })
}

const showCopiedTip = ref(false)
const copiedTipMsg = ref('已复制到剪贴板')

// Image replace panel state
const imagePanelShow = ref(false)
const imagePanelSrc = ref('')
let imagePanelCb: ((src: string | null) => void) | null = null

function onImagePanelConfirm(src: string) {
  imagePanelShow.value = false
  imagePanelCb?.(src)
  imagePanelCb = null
}
function onImagePanelClose() {
  imagePanelShow.value = false
  imagePanelCb?.(null)
  imagePanelCb = null
}

// Color picker
function openColorPicker(action: 'text' | 'bg') {
  currentColorAction.value = action
  showColorPicker.value = true
}

function selectColor(color: string) {
  if (currentColorAction.value === 'text') {
    execCmd('setColor', color)
  } else {
    execCmd('setHighlight', color)
  }
  showColorPicker.value = false
}

function removeColor() {
  if (currentColorAction.value === 'text') {
    execCmd('unsetColor')
  } else {
    execCmd('unsetHighlight')
  }
  showColorPicker.value = false
}

// Replace carousel placeholder images with uploaded data URLs
function replaceCarouselImages(dataUrls: string[]) {
  if (!editor.value || dataUrls.length !== 3) return
  const placeholders = ['/images/carousel-1.svg', '/images/carousel-2.svg', '/images/carousel-3.svg']

  if (showHtmlView.value) {
    let html = htmlCode.value
    for (let i = 0; i < 3; i++) {
      html = html.split(placeholders[i]).join(dataUrls[i])
    }
    htmlCode.value = html
    return
  }

  // Walk document and update image src references directly in the ProseMirror model.
  // Handles two cases:
  //   a) Section node (atom, raw HTML in attrs.html) — string replace in the HTML
  //   b) Image node (standalone, attrs.src) — setNodeMarkup to change src
  const tr = editor.value.state.tr
  let needsUpdate = false

  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name === 'section') {
      let html = node.attrs.html as string
      let changed = false
      for (let i = 0; i < 3; i++) {
        if (html.includes(placeholders[i])) {
          html = html.split(placeholders[i]).join(dataUrls[i])
          changed = true
        }
      }
      if (changed) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, html })
        needsUpdate = true
      }
    } else if (node.type.name === 'image') {
      const src = node.attrs.src as string
      const idx = placeholders.indexOf(src)
      if (idx >= 0) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: dataUrls[idx] })
        needsUpdate = true
      }
    }
  })

  if (needsUpdate) {
    editor.value.view.dispatch(tr)
  }
}

// Expose for parent
defineExpose({ insertHtml, insertInline, getHtml, setContent, clearContent, copyContent, getContentLength, replaceCarouselImages, cutSelection })

function getSelectedHtml(): string {
  if (!editor.value) return ''
  const { state } = editor.value
  const sel = state.selection as any

  // Whole section node selected
  if (sel.node?.type?.name === 'section') {
    return sel.node.attrs.html as string
  }

  // Text selection: serialize ProseMirror slice to HTML
  if (sel.empty) return ''
  const { from, to } = state.selection
  const slice = state.doc.slice(from, to)
  const div = document.createElement('div')
  DOMSerializer.fromSchema(state.schema).serializeFragment(slice.content, {}, div)
  return div.innerHTML
}

async function writeToClipboard(html: string): Promise<void> {
  const withDataUrls = await replaceLocalImagesWithBase64(html)
  const converted = convertViaIframe(withDataUrls)
  const tmp = document.createElement('div')
  tmp.innerHTML = converted
  const text = tmp.textContent || ''
  return navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([converted], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
}

async function doCopy(): Promise<boolean> {
  if (!editor.value) return false
  const html = getSelectedHtml()
  if (!html) return false
  try {
    await writeToClipboard(html)
    return true
  } catch {
    return false
  }
}

async function cutSelection() {
  if (!editor.value) return
  const html = getSelectedHtml()
  if (!html) return
  try {
    await writeToClipboard(html)
    editor.value.chain().focus().deleteSelection().run()
    copiedTipMsg.value = '已剪切到剪贴板'
    showCopiedTip.value = true
    setTimeout(() => showCopiedTip.value = false, 2000)
  } catch {
    // clipboard write failed — don't delete
  }
}

function handlePaste(event: ClipboardEvent) {
  if (!editor.value) return
  const items = event.clipboardData?.items
  if (!items) return

  const imageItems: DataTransferItem[] = []
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      imageItems.push(items[i])
    }
  }

  if (imageItems.length === 0) return

  event.preventDefault()

  let chain = Promise.resolve()
  for (const item of imageItems) {
    const blob = item.getAsFile()
    if (!blob) continue
    chain = chain.then(() => new Promise<void>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        editor.value?.chain().focus().setImage({ src: reader.result as string }).run()
        resolve()
      }
      reader.onerror = () => resolve()
      reader.readAsDataURL(blob!)
    }))
  }
}

onBeforeUnmount(() => {
  // Destroy editor before EditorContent unmounts — prevents ProseMirror's
  // DOM removal from conflicting with Vue's DOM patching
  if (editor.value && !editor.value.isDestroyed) {
    editor.value.destroy()
  }
})

onMounted(() => {
  if (editor.value) {
    setTiptapEditor(editor.value)
    doWordCount(editor.value)
  }
})

onUnmounted(() => {
  if (_wcTimer) { clearTimeout(_wcTimer); _wcTimer = null }
  setTiptapEditor(null)
})
</script>

<template>
  <div class="rich-editor" @click.stop>
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <button class="tb-btn" @click="toggleHtmlView" :class="{ active: showHtmlView }" title="HTML 源码">
          <code>&lt;/&gt;</code>
        </button>
        <span class="tb-sep"></span>
        <button class="tb-btn" @click="execCmd('undo')" :disabled="!editor?.can().undo()" title="撤销">↩</button>
        <button class="tb-btn" @click="execCmd('redo')" :disabled="!editor?.can().redo()" title="重做">↪</button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="execCmd('bold')" :class="{ active: isActive('bold') }" title="加粗"><b>B</b></button>
        <button class="tb-btn" @click="execCmd('italic')" :class="{ active: isActive('italic') }" title="斜体"><i>I</i></button>
        <button class="tb-btn" @click="execCmd('underline')" :class="{ active: isActive('underline') }" title="下划线"><u>U</u></button>
        <button class="tb-btn" @click="execCmd('strike')" :class="{ active: isActive('strike') }" title="删除线"><s>S</s></button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="execCmd('h1')" :class="{ active: isActive('h1') }" title="标题1">H1</button>
        <button class="tb-btn" @click="execCmd('h2')" :class="{ active: isActive('h2') }" title="标题2">H2</button>
        <button class="tb-btn" @click="execCmd('h3')" :class="{ active: isActive('h3') }" title="标题3">H3</button>
        <button class="tb-btn" @click="execCmd('p')" :class="{ active: isActive('p') }" title="正文">P</button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="execCmd('align-left')" :class="{ active: isActive('align-left') }" title="左对齐">≡</button>
        <button class="tb-btn" @click="execCmd('align-center')" :class="{ active: isActive('align-center') }" title="居中">≡</button>
        <button class="tb-btn" @click="execCmd('align-right')" :class="{ active: isActive('align-right') }" title="右对齐">≡</button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="execCmd('bulletList')" :class="{ active: isActive('bulletList') }" title="无序列表">•</button>
        <button class="tb-btn" @click="execCmd('orderedList')" :class="{ active: isActive('orderedList') }" title="有序列表">1.</button>
        <button class="tb-btn" @click="execCmd('blockquote')" :class="{ active: isActive('blockquote') }" title="引用">❝</button>
        <button class="tb-btn" @click="execCmd('code')" :class="{ active: isActive('code') }" title="代码块">&lt;/&gt;</button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="openColorPicker('text')" title="文字颜色">🎨</button>
        <button class="tb-btn" @click="openColorPicker('bg')" title="背景高亮">🖍</button>
        <button class="tb-btn" @click="insertLink" title="插入链接">🔗</button>
        <button class="tb-btn" @click="insertImage" title="插入图片">🖼</button>
        <button class="tb-btn" @click="insertTable" title="插入表格">⊞</button>
        <button class="tb-btn" @click="execCmd('hr')" title="分割线">—</button>
        <button
          v-if="hasImageSelected"
          class="tb-btn tb-btn-replace"
          @click="replaceSelectedImage"
          title="替换图片"
        >↻</button>
      </div>

      <span class="tb-sep"></span>

      <div class="toolbar-group">
        <button class="tb-btn" @click="execCmd('clearFormat')" title="清除格式">✕</button>
      </div>
    </div>

    <!-- Content area -->
    <div class="editor-content-area">
      <!-- HTML view -->
      <textarea
        v-if="showHtmlView"
        v-model="htmlCode"
        class="html-textarea"
        @input="onHtmlInput"
        spellcheck="false"
        placeholder="HTML 源码..."
      ></textarea>

      <!-- Visual editor -->
      <div v-else class="tiptap-editor">
        <EditorContent :editor="editor" />
      </div>
    </div>

    <!-- Color picker popup -->
    <Teleport to="body">
      <div v-if="showColorPicker" class="color-picker-overlay" @click="showColorPicker = false">
        <div class="color-picker-popup" @click.stop>
          <div class="color-picker-header">
            <span>{{ currentColorAction === 'text' ? '文字颜色' : '背景高亮' }}</span>
            <button class="cp-close" @click="showColorPicker = false">✕</button>
          </div>
          <div class="color-grid">
            <div
              v-for="color in colors"
              :key="color"
              class="color-swatch"
              :style="{ background: color }"
              @click="selectColor(color)"
            ></div>
          </div>
          <button class="cp-remove" @click="removeColor">移除颜色</button>
        </div>
      </div>
    </Teleport>

    <!-- Copied tip -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showCopiedTip" class="copied-tip">{{ copiedTipMsg }}</div>
      </Transition>
    </Teleport>

    <!-- Image replace panel -->
    <ImageReplacePanel
      :visible="imagePanelShow"
      :current-src="imagePanelSrc"
      @confirm="onImagePanelConfirm"
      @close="onImagePanelClose"
    />
  </div>
</template>

<style scoped>
.rich-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  gap: 1px;
}

.tb-btn {
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
.tb-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.tb-btn.active { background: var(--accent-light); color: var(--accent-color); }
.tb-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.tb-btn:disabled:hover { background: transparent; }
.tb-btn-replace { color: var(--accent-color); font-weight: bold; font-size: 16px; }

.tb-btn code {
  font-size: 12px;
  font-weight: 600;
}

.tb-sep {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
  flex-shrink: 0;
}

.editor-content-area {
  flex: 1;
  overflow: hidden;
}

.tiptap-editor {
  height: 100%;
  overflow-y: auto;
}

.tiptap-editor :deep(.ProseMirror) {
  padding: 20px 24px;
  min-height: 100%;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
}

.tiptap-editor :deep(.ProseMirror p) {
  margin: 8px 0;
}

.tiptap-editor :deep(.ProseMirror h1) { font-size: 22px; font-weight: bold; margin: 20px 0 10px; }
.tiptap-editor :deep(.ProseMirror h2) { font-size: 18px; font-weight: bold; margin: 18px 0 8px; }
.tiptap-editor :deep(.ProseMirror h3) { font-size: 16px; font-weight: bold; margin: 14px 0 6px; }
.tiptap-editor :deep(.ProseMirror h4) { font-size: 15px; font-weight: bold; margin: 12px 0 6px; }

.tiptap-editor :deep(.ProseMirror blockquote) {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 4px solid var(--accent-color);
  background: var(--bg-secondary);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
}

.tiptap-editor :deep(.ProseMirror ul),
.tiptap-editor :deep(.ProseMirror ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.tiptap-editor :deep(.ProseMirror li) {
  margin: 4px 0;
}

.tiptap-editor :deep(.ProseMirror a) {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}

.tiptap-editor :deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 12px auto;
  display: block;
  cursor: pointer;
}

.tiptap-editor :deep(.ProseMirror img.ProseMirror-selectednode) {
  outline: 3px solid var(--accent-color);
  outline-offset: 2px;
}

.tiptap-editor :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 24px 0;
}

/* Section template block — raw HTML, contenteditable */
.tiptap-editor :deep(section[data-template]) {
  display: block;
  outline: 2px dashed transparent;
  outline-offset: 4px;
  border-radius: 6px;
  transition: outline-color 0.15s;
}
.tiptap-editor :deep(section[data-template]:hover) {
  outline-color: var(--border-color);
}
.tiptap-editor :deep(.ProseMirror-selectednode section[data-template]),
.tiptap-editor :deep(section[data-template].ProseMirror-selectednode) {
  outline-color: var(--accent-color);
  outline-style: solid;
}

.tiptap-editor :deep(.ProseMirror pre) {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 13px;
  overflow-x: auto;
}

.tiptap-editor :deep(.ProseMirror table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}
.tiptap-editor :deep(.ProseMirror th),
.tiptap-editor :deep(.ProseMirror td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  min-width: 60px;
}
.tiptap-editor :deep(.ProseMirror th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.tiptap-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: var(--text-muted);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.html-textarea {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
  tab-size: 2;
}

/* Color picker */
.color-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-picker-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  width: 280px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}

.color-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cp-close {
  width: 24px; height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
}
.cp-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.color-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.12s;
}
.color-swatch:hover { transform: scale(1.15); border-color: var(--accent-color); }

.cp-remove {
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
.cp-remove:hover { background: var(--hover-bg); }

/* Copied tip */
.copied-tip {
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
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* Carousel animation keyframes */
@keyframes carouselAnim {
  0%, 28% { transform: translateX(0); }
  33%, 61% { transform: translateX(-33.333%); }
  66%, 94% { transform: translateX(-66.666%); }
  100% { transform: translateX(0); }
}
@keyframes dotAnim0 {
  0%, 28% { background: #4a7dd4; }
  33%, 100% { background: #d0d5dd; }
}
@keyframes dotAnim1 {
  0%, 28% { background: #d0d5dd; }
  33%, 61% { background: #4a7dd4; }
  66%, 100% { background: #d0d5dd; }
}
@keyframes dotAnim2 {
  0%, 61% { background: #d0d5dd; }
  66%, 94% { background: #4a7dd4; }
  100% { background: #d0d5dd; }
}
</style>
