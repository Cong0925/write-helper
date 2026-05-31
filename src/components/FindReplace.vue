<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted, computed, nextTick } from 'vue'
import { appState, cacheFileContent, getCachedContent, clearAllContentCache, type SearchMatch } from '../store'
import { searchInProjectAdv, findAndReplaceAdv, readFile, readDirectory, writeFile } from '../api'
import { getEditorView } from '../editorHelper'
import { getTiptapEditor } from '../tiptapHelper'
import { getWysiwygByFolder, getActiveWysiwyg, selectNthMatchInElement, scrollWysiwygToSelection } from '../wysiwygHelper'
import { eventBus } from '../composables/useEventBus'

const emit = defineEmits<{ close: [] }>()

// ─── Side-panel → folderDir mapping ───
const SIDE_TO_FOLDER: Record<string, string> = {
  outline: '大纲',
  characters: '人设',
  world: '设定',
  material: '素材',
}
// Reverse: folderDir → activeSidePanel value
const FOLDER_TO_SIDE: Record<string, string> = {
  '大纲': 'outline',
  '人设': 'characters',
  '设定': 'world',
  '素材': 'material',
}

// ─── Panel position / drag ───
const panelX = ref(0)
const panelY = ref(0)
const isDragging = ref(false)
const dragStart = { x: 0, y: 0, elX: 0, elY: 0 }
onMounted(() => {
  panelX.value = window.innerWidth - 520
  panelY.value = 60
  // Default target: if a side-panel editor is registered, select it;
  // otherwise fall back to 小说正文
  const folder = activeSidePanelFolder.value
  if (folder && getWysiwygByFolder(folder)) {
    searchTarget.value = folder
    searchScope.value = 'current'
  } else {
    searchTarget.value = 'main'
    const pt = appState.project?.projectType || 'novel'
    if (pt === 'wechat_article' || pt === 'toutiao_article') {
      searchScope.value = 'current'
    }
  }
  // Consume any pre-selected text captured before the panel opened
  if (appState.findInitialText) {
    findText.value = appState.findInitialText
    appState.findInitialText = ''
  }
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

// ─── Mode & Inputs ───
const mode = ref<'find' | 'replace'>('find')
const findText = ref('')
const replaceText = ref('')

// ─── Target & Scope (replaces old radio-button scope) ───
// target: 'main' | '大纲' | '人设' | '设定' | '素材'
const searchTarget = ref<string>('main')
// scope:  'current' = single file, 'all' = entire book / all folder files
const searchScope = ref<'current' | 'all'>('current')

// Options
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)

// ─── Derived ───
const isArticleProject = computed(() => {
  const pt = appState.project?.projectType || 'novel'
  return pt === 'wechat_article' || pt === 'toutiao_article'
})

/** The folderDir of the currently visible side panel (空字符串 = none). */
const activeSidePanelFolder = computed(() => {
  return SIDE_TO_FOLDER[appState.activeSidePanel] || ''
})

/** Dropdown options for the target selector. */
const targetOptions = computed(() => {
  const opts: { value: string; label: string }[] = [
    { value: 'main', label: '小说正文' },
  ]
  const folder = activeSidePanelFolder.value
  if (folder) opts.push({ value: folder, label: folder })
  return opts
})

/** Dropdown options for the scope selector (depends on the target). */
const scopeOptions = computed(() => {
  if (searchTarget.value === 'main') {
    return [
      { value: 'current' as const, label: '本章' },
      ...(isArticleProject.value ? [] : [{ value: 'all' as const, label: '全书' }]),
    ]
  }
  // Side-panel target
  return [
    { value: 'current' as const, label: '当前文件' },
    { value: 'all' as const, label: '所有文件' },
  ]
})

/** Is the current search a "single file" search (not a full-book/folder sweep)? */
const isSingleFileSearch = computed(() => searchScope.value === 'current')

// ─── Match state (single-file results) ───
const matches = ref<{ from: number; to: number; line: number; text: string }[]>([])
const currentMatch = ref(0)
const totalMatchCount = ref(0)

// ─── Search results (full-book / folder via backend) ───
const searchResults = ref<{ filePath: string; fileName: string; matches: SearchMatch[] }[]>([])
const fullBookLoading = ref(false)

// ─── Collapsible file results ───
const expandedFiles = ref<Set<string>>(new Set())

function isFileExpanded(filePath: string) {
  return expandedFiles.value.has(filePath)
}
function toggleFileExpand(filePath: string) {
  const s = new Set(expandedFiles.value)
  if (s.has(filePath)) s.delete(filePath)
  else s.add(filePath)
  expandedFiles.value = s
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

// ─── Regex builder ───
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
  try { return new RegExp(pattern, flags) } catch { return null }
}

// ─── Get the target Wysiwyg handle for the selected target ───
function getTargetWysiwyg() {
  if (searchTarget.value === 'main') return null
  const w = getWysiwygByFolder(searchTarget.value)
  if (w && w.el && document.body.contains(w.el)) return w
  return null
}

// ─── Search functions ───

/** Search in the main CodeMirror editor (chapter scope). */
function searchInEditor() {
  if (isArticleProject.value) { searchInTiptap(); return }

  const view = getEditorView()
  if (!view || !findText.value) {
    matches.value = []; totalMatchCount.value = 0; currentMatch.value = 0
    return
  }
  const doc = view.state.doc
  const content = doc.toString()
  const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return

  const allMatches: { from: number; to: number; line: number; text: string }[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length
    const lineStart = content.lastIndexOf('\n', match.index - 1) + 1
    const lineEnd = content.indexOf('\n', match.index)
    const lineText = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    allMatches.push({ from: match.index, to: match.index + match[0].length, line, text: lineText.trim() })
    if (match.index === re.lastIndex) re.lastIndex++
    if (allMatches.length > 10000) break
  }
  matches.value = allMatches
  totalMatchCount.value = allMatches.length
  if (currentMatch.value >= allMatches.length) currentMatch.value = allMatches.length > 0 ? 0 : 0
}

function searchInTiptap() {
  const editor = getTiptapEditor()
  if (!editor || !findText.value) {
    matches.value = []; totalMatchCount.value = 0; currentMatch.value = 0
    return
  }
  const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return

  const allMatches: { from: number; to: number; line: number; text: string }[] = []
  const doc = editor.state.doc
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    const text = node.text || ''
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const from = pos + m.index; const to = pos + m.index + m[0].length
      const before = text.slice(0, m.index)
      const line = before.split('\n').length
      const lineStart = text.lastIndexOf('\n', m.index - 1) + 1
      const lineEnd = text.indexOf('\n', m.index)
      const lineText = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
      allMatches.push({ from, to, line: line + 1, text: lineText.trim() })
      if (m.index === re.lastIndex) re.lastIndex++
      if (allMatches.length > 10000) return false
    }
    return allMatches.length <= 10000
  })
  matches.value = allMatches
  totalMatchCount.value = allMatches.length
  if (currentMatch.value >= allMatches.length) currentMatch.value = allMatches.length > 0 ? 0 : 0
}

function searchInWysiwyg(wysiwyg: NonNullable<ReturnType<typeof getActiveWysiwyg>>) {
  if (!findText.value) {
    matches.value = []; totalMatchCount.value = 0; currentMatch.value = 0
    return
  }
  const content = wysiwyg.getContent()
  const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return
  const allMatches: { from: number; to: number; line: number; text: string }[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length
    const lineStart = content.lastIndexOf('\n', match.index - 1) + 1
    const lineEnd = content.indexOf('\n', match.index)
    const lineText = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    allMatches.push({ from: match.index, to: match.index + match[0].length, line, text: lineText.trim() })
    if (match.index === re.lastIndex) re.lastIndex++
    if (allMatches.length > 10000) break
  }
  matches.value = allMatches
  totalMatchCount.value = allMatches.length
  currentMatch.value = allMatches.length > 0 ? 0 : 0
}

/** Full-book search (backend). */
async function searchFullBook() {
  if (!findText.value || !appState.project) return
  fullBookLoading.value = true
  try {
    // Save the current file first so disk content matches the editor
    // (otherwise unsaved edits are invisible to the backend search)
    if (appState.currentFile && appState.isDirty && appState.currentContent) {
      try { await writeFile(appState.currentFile.path, appState.currentContent); appState.isDirty = false } catch {}
    }
    const root = appState.project.projectType === 'novel'
      ? appState.project.path + '/分卷'
      : appState.project.path
    console.log('[FindReplace] searchFullBook root:', root)
    const results = await searchInProjectAdv(root, findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
    console.log('[FindReplace] searchFullBook results count:', results.length)
    searchResults.value = results
    let count = 0
    for (const r of results) count += r.matches.length
    totalMatchCount.value = count
    currentMatch.value = count > 0 ? 1 : 0
    // Default: expand first file, collapse rest
    expandedFiles.value = new Set(results.length > 0 ? [results[0].filePath] : [])
  } catch (e) {
    console.error('[FindReplace] searchFullBook error:', e)
    searchResults.value = []
  } finally { fullBookLoading.value = false }
}

/** Search all files in a side-panel folder via backend. */
async function searchFolder(folderDir: string) {
  if (!findText.value || !appState.project) return
  fullBookLoading.value = true
  try {
    const folderPath = appState.project.path + '/' + folderDir
    const results = await searchInProjectAdv(folderPath, findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
    searchResults.value = results
    let count = 0
    for (const r of results) count += r.matches.length
    totalMatchCount.value = count
    currentMatch.value = count > 0 ? 1 : 0
    expandedFiles.value = new Set(results.length > 0 ? [results[0].filePath] : [])
  } catch {
    searchResults.value = []
  } finally { fullBookLoading.value = false }
}

// ─── Main search dispatcher ───
function performSearch() {
  searchResults.value = []
  matches.value = []
  if (!findText.value) { totalMatchCount.value = 0; return }

  const target = searchTarget.value
  const scope = searchScope.value

  if (target === 'main') {
    if (scope === 'current') {
      searchInEditor()
    } else {
      console.log('[FindReplace] performSearch -> searchFullBook (target=main, scope=all)')
      searchFullBook()
    }
  } else {
    // Side-panel target
    if (scope === 'current') {
      const w = getTargetWysiwyg()
      if (w) searchInWysiwyg(w)
    } else {
      searchFolder(target)
    }
  }
}

function goToMatch(index: number) {
  const target = searchTarget.value
  const scope = searchScope.value

  if (isArticleProject.value) {
    goToTiptapMatch(index)
    return
  }

  if (target !== 'main' && scope === 'current') {
    const wysiwyg = getTargetWysiwyg()
    if (wysiwyg) { goToWysiwygMatch(wysiwyg, index); return }
  }
  // 'main' target → CodeMirror
  const view = getEditorView()
  if (!view || matches.value.length === 0) return

  // Normalize index
  if (index < 0) index = matches.value.length - 1
  if (index >= matches.value.length) index = 0
  currentMatch.value = index

  const m = matches.value[index]
  if (!m) return

  const doc = view.state.doc
  const query = findText.value
  if (!query) { view.focus(); return }

  // Strategy: go to the stored line number, then re-find the correct
  // occurrence of the query within that line.  We count how many matches
  // on the same line come BEFORE the clicked one (localIndex), then
  // find the (localIndex)-th occurrence within the current line text.
  if (m.line >= 1 && m.line <= doc.lines) {
    const line = doc.line(m.line)
    // Count prior matches on the same line
    let localIndex = 0
    for (let i = 0; i < index; i++) {
      if (matches.value[i]?.line === m.line) localIndex++
    }
    // Find the localIndex-th occurrence of the query on this line
    const re = buildRegex(query, caseSensitive.value, wholeWord.value, useRegex.value)
    if (re) {
      let occurrence = 0
      let rm: RegExpExecArray | null
      while ((rm = re.exec(line.text)) !== null) {
        if (occurrence === localIndex) {
          view.dispatch({
            selection: { anchor: line.from + rm.index, head: line.from + rm.index + rm[0].length },
          })
          view.focus()
          // Direct scroll — more reliable than scrollIntoView which
          // can be off due to CSS padding on .cm-content
          const block = view.lineBlockAt(line.from)
          if (block) view.scrollDOM.scrollTop = Math.max(0, block.top - 60)
          return
        }
        occurrence++
        if (rm.index === re.lastIndex) re.lastIndex++
      }
    }
  }

  // Fallback: scan the entire document for the Nth match
  const re = buildRegex(query, caseSensitive.value, wholeWord.value, useRegex.value)
  if (re) {
    const content = doc.toString()
    let nth = 0
    let rm: RegExpExecArray | null
    while ((rm = re.exec(content)) !== null) {
      if (nth === index) {
        view.dispatch({ selection: { anchor: rm.index, head: rm.index + rm[0].length } })
        view.focus()
        const block = view.lineBlockAt(rm.index)
        if (block) view.scrollDOM.scrollTop = Math.max(0, block.top - 60)
        return
      }
      nth++
      if (rm.index === re.lastIndex) re.lastIndex++
      if (nth > 10000) break
    }
  }
}

function goToTiptapMatch(index: number) {
  const editor = getTiptapEditor()
  if (!editor || matches.value.length === 0) return
  if (index < 0) index = matches.value.length - 1
  if (index >= matches.value.length) index = 0
  currentMatch.value = index
  const m = matches.value[index]
  editor.commands.setTextSelection({ from: m.from, to: m.to })
  editor.commands.focus()
  scrollTiptapToSelection(editor)
}

/**
 * Walk the rendered DOM text nodes and select the Nth occurrence of the query.
 * Returns true if found, false otherwise.
 */
function goToWysiwygMatch(wysiwyg: NonNullable<ReturnType<typeof getActiveWysiwyg>>, index: number) {
  if (!matches.value.length) return
  if (index < 0) index = matches.value.length - 1
  if (index >= matches.value.length) index = 0
  currentMatch.value = index
  wysiwyg.focus()
  const query = findText.value
  if (query && wysiwyg.el) {
    selectNthMatchInElement(wysiwyg.el, query, index)
  }
  scrollWysiwygToSelection(wysiwyg)
}

function scrollTiptapToSelection(editor: NonNullable<ReturnType<typeof getTiptapEditor>>) {
  const dom = editor.view.dom as HTMLElement
  const sel = editor.state.selection
  const from = sel.from
  const coords = editor.view.coordsAtPos(from)
  if (!coords) return
  let parent = dom.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      const parentRect = parent.getBoundingClientRect()
      if (coords.top < parentRect.top || coords.bottom > parentRect.bottom) {
        parent.scrollTop += coords.top - parentRect.top - 60
      }
      break
    }
    parent = parent.parentElement
  }
}

function prevMatch() { goToMatch(currentMatch.value - 1) }
function nextMatch() { goToMatch(currentMatch.value + 1) }

// ─── Replace ───
async function replaceCurrent() {
  if (!findText.value) return
  const target = searchTarget.value
  const scope = searchScope.value

  if (isArticleProject.value) { replaceInTiptap(); return }

  // Side-panel single-file replace
  if (target !== 'main' && scope === 'current') {
    const wysiwyg = getTargetWysiwyg()
    if (wysiwyg) { replaceInWysiwyg(wysiwyg); return }
  }
  // CodeMirror replace
  const view = getEditorView()
  if (!view || matches.value.length === 0) return
  const m = matches.value[currentMatch.value]
  if (!m) return
  view.dispatch({ changes: { from: m.from, to: m.to, insert: replaceText.value } })
  appState.currentContent = view.state.doc.toString()
  cacheFileContent(appState.currentFile?.path, appState.currentContent)
  appState.isDirty = true
  searchInEditor()
  if (currentMatch.value >= matches.value.length && matches.value.length > 0) {
    currentMatch.value = matches.value.length - 1
  }
}

function replaceInTiptap() {
  const editor = getTiptapEditor()
  if (!editor || matches.value.length === 0) return
  const m = matches.value[currentMatch.value]
  if (!m) return
  editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).deleteSelection().insertContent(replaceText.value).run()
  appState.isDirty = true
  setTimeout(() => searchInTiptap(), 50)
}

function replaceInWysiwyg(wysiwyg: NonNullable<ReturnType<typeof getActiveWysiwyg>>) {
  if (!matches.value.length) return
  const m = matches.value[currentMatch.value]
  if (!m) return
  const content = wysiwyg.getContent()
  const newContent = content.slice(0, m.from) + replaceText.value + content.slice(m.to)
  wysiwyg.setContent(newContent)
  setTimeout(() => searchInWysiwyg(wysiwyg), 50)
}

function replaceAllInTiptap() {
  const editor = getTiptapEditor()
  if (!editor) return
  const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return
  const allMatches: { from: number; to: number }[] = []
  const doc = editor.state.doc
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    const text = node.text || ''
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      allMatches.push({ from: pos + m.index, to: pos + m.index + m[0].length })
      if (m.index === re.lastIndex) re.lastIndex++
    }
    return true
  })
  let tr = editor.state.tr
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const m = allMatches[i]
    tr = tr.replaceWith(m.from, m.to, editor.state.schema.text(replaceText.value))
  }
  editor.view.dispatch(tr)
  appState.isDirty = true
  searchInTiptap()
}

function replaceAllInWysiwyg(wysiwyg: NonNullable<ReturnType<typeof getActiveWysiwyg>>) {
  if (!findText.value) return
  const content = wysiwyg.getContent()
  const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
  if (!re) return
  const newContent = content.replace(re, replaceText.value)
  wysiwyg.setContent(newContent)
  searchInWysiwyg(wysiwyg)
}

async function replaceAll() {
  if (!findText.value) return
  const target = searchTarget.value
  const scope = searchScope.value

  if (target === 'main' && scope === 'current') {
    if (isArticleProject.value) { replaceAllInTiptap(); return }
    const view = getEditorView()
    if (!view) return
    const content = view.state.doc.toString()
    const re = buildRegex(findText.value, caseSensitive.value, wholeWord.value, useRegex.value)
    if (!re) return
    const newContent = content.replace(re, replaceText.value)
    view.dispatch({ changes: { from: 0, to: content.length, insert: newContent } })
    appState.currentContent = newContent
    cacheFileContent(appState.currentFile?.path, newContent)
    appState.isDirty = true
    searchInEditor()
  } else if (target !== 'main' && scope === 'current') {
    const wysiwyg = getTargetWysiwyg()
    if (wysiwyg) replaceAllInWysiwyg(wysiwyg)
  } else {
    // 'all' scope — backend replace
    if (!appState.project) return
    // ── Confirm dialog ──
    const replaceFileCount = searchResults.value.length
    const replaceMatchCount = totalMatchCount.value
    if (replaceFileCount > 0) {
      const scopeName = target !== 'main' ? `「${target}」文件夹` : '全书'
      const msg = `即将在 ${scopeName} 的 ${replaceFileCount} 个文件中执行替换，` +
        `共 ${replaceMatchCount} 个匹配项。\n\n确定执行全部替换？`
      if (!confirm(msg)) return
    }
    // ── Save current file first so unsaved edits are included ──
    if (appState.currentFile && appState.isDirty && appState.currentContent) {
      try { await writeFile(appState.currentFile.path, appState.currentContent); appState.isDirty = false } catch {}
    }
    // ── Determine root path ──
    let rootPath: string
    if (target !== 'main') {
      rootPath = appState.project.path + '/' + target
    } else if (appState.project.projectType === 'novel') {
      rootPath = appState.project.path + '/分卷'
    } else {
      rootPath = appState.project.path
    }
    try {
      const count = await findAndReplaceAdv(rootPath, findText.value, replaceText.value, '',
        caseSensitive.value, wholeWord.value, useRegex.value)
      console.log('[FindReplace] replaceAll replaced', count, 'occurrences')
      // Clear caches so all files are re-read from disk next time
      clearAllContentCache()
      // Refresh the main editor's current file
      if (appState.currentFile) {
        const content = await readFile(appState.currentFile.path)
        appState.currentContent = content
      }
      if (appState.project) appState.fileTree = await readDirectory(appState.project.path)
      // Notify the side panel to reload its currently-open file from disk
      if (target !== 'main') {
        eventBus.emit('panel:refreshContent', { folderDir: target })
      }
      performSearch()
    } catch (e) { console.error('[replaceAll] backend failed:', e) }
  }
}

// ─── Navigate to full-book/folder result ───
async function goToSearchResult(m: SearchMatch) {
  const target = searchTarget.value

  // ── Side-panel target: open in the floating layer's editor ──
  if (target !== 'main') {
    const sidePanel = FOLDER_TO_SIDE[target]
    if (sidePanel) {
      // Find which match-index this click corresponds to (within its file)
      let matchIndex = 0
      for (const fileResult of searchResults.value) {
        if (fileResult.filePath === m.filePath) {
          const idx = fileResult.matches.indexOf(m)
          if (idx !== -1) { matchIndex = idx; break }
        }
      }
      // Switch to the correct panel — the panel's own event handler
      // will open the file and position to the correct match
      appState.activeSidePanel = sidePanel
      await nextTick()
      eventBus.emit('panel:openFile', {
        folderDir: target,
        filePath: m.filePath,
        fileName: m.fileName,
        matchIndex,
        query: findText.value,
      })
    }
    return
  }

  // ── Main editor target: always read from disk so the loaded content
  //    exactly matches the backend search result positions.  The cache
  //    may contain un-saved edits that would shift line numbers/offsets.
  if (appState.currentFile && appState.isDirty && appState.currentContent) {
    try { await writeFile(appState.currentFile.path, appState.currentContent); appState.isDirty = false } catch {}
  }
  if (appState.currentFile && appState.currentContent) {
    cacheFileContent(appState.currentFile.path, appState.currentContent)
  }
  try {
    const content = await readFile(m.filePath)
    appState.currentFile = { path: m.filePath, name: m.fileName }
    appState.currentContent = content
    appState.isDirty = false
    jumpToMatch(m)
  } catch { /* ignore */ }
}

function jumpToMatch(m: SearchMatch) {
  setTimeout(() => {
    if (isArticleProject.value) {
      const editor = getTiptapEditor()
      if (!editor) return
      const searchText = findText.value
      if (searchText) {
        const doc = editor.state.doc
        let found = false
        doc.descendants((node, pos) => {
          if (found || !node.isText) return true
          const idx = (node.text || '').indexOf(searchText)
          if (idx !== -1) {
            editor.commands.setTextSelection({ from: pos + idx, to: pos + idx + searchText.length })
            editor.commands.focus()
            scrollTiptapToSelection(editor)
            found = true; return false
          }
          return true
        })
      } else { editor.commands.focus() }
      return
    }
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
}

// ─── Watchers ───

// Auto-search on input / option change (debounced for single-file)
watch([findText, caseSensitive, wholeWord, useRegex], () => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!findText.value) { totalMatchCount.value = 0; return }

  if (isSingleFileSearch.value) {
    searchTimer = setTimeout(() => performSearch(), 200)
  } else {
    // 'all' scope: debounce longer, then search
    fullBookLoading.value = true
    searchTimer = setTimeout(() => performSearch(), 1500)
  }
})

// Re-search when target or scope changes
watch([searchTarget, searchScope], () => {
  if (!findText.value) return
  console.log('[FindReplace] scope/target changed:', searchTarget.value, searchScope.value)
  performSearch()
})

// Article projects: only 'current' scope
watch(isArticleProject, (v) => {
  if (v) searchScope.value = 'current'
})

// ─── Cleanup ───
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

// ─── Text helpers ───
function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text)
  const lowerQ = query.toLowerCase()
  const lowerText = text.toLowerCase()
  let result = ''
  let pos = 0
  while (pos < text.length) {
    const idx = lowerText.indexOf(lowerQ, pos)
    if (idx === -1) { result += escapeHtml(text.slice(pos)); break }
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
  <div class="find-replace-panel" :style="{ left: panelX + 'px', top: panelY + 'px' }">
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
      <!-- ── Target & Scope selectors (same row) ── -->
      <div class="fr-two-selectors">
        <div class="fr-selector-item">
          <label class="fr-selector-label">作用范围</label>
          <select v-model="searchTarget" class="fr-select">
            <option v-for="opt in targetOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="fr-selector-item">
          <label class="fr-selector-label">搜索范围</label>
          <select v-model="searchScope" class="fr-select">
            <option v-for="opt in scopeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- ── Find input + search button ── -->
      <div class="fr-input-wrap">
        <input v-model="findText" type="text" class="fr-input" placeholder="查找..."
          @keydown.enter="isSingleFileSearch ? nextMatch() : undefined" />
        <span v-if="findText && totalMatchCount > 0" class="match-counter">
          {{ isSingleFileSearch ? `${currentMatch + 1}/${totalMatchCount}` : `${totalMatchCount} 处` }}
        </span>
        <button v-if="findText" class="input-clear" @click="findText = ''">✕</button>
      </div>

      <!-- ── Replace input ── -->
      <div v-if="mode === 'replace'" class="fr-input-wrap">
        <input v-model="replaceText" type="text" class="fr-input" placeholder="替换为..." @keydown.enter="replaceCurrent" />
      </div>

      <!-- ── Options + search button (same row) ── -->
      <div class="fr-opt-row">
        <div class="fr-opt-group">
          <button class="opt-btn" :class="{ active: caseSensitive }" @click="caseSensitive = !caseSensitive" title="区分大小写">Aa</button>
          <button class="opt-btn" :class="{ active: wholeWord }" @click="wholeWord = !wholeWord" title="全词匹配">词</button>
          <button class="opt-btn" :class="{ active: useRegex }" @click="useRegex = !useRegex" title="正则表达式">.*</button>
        </div>
        <button class="fr-search-btn" @click="performSearch" :disabled="!findText">🔍 查找</button>
      </div>

      <!-- ── Navigation & replace buttons (single-file results) ── -->
      <div v-if="isSingleFileSearch && totalMatchCount > 0" class="fr-nav-row">
        <div class="fr-nav-buttons">
          <button class="fr-nav-btn" @click="prevMatch" :disabled="totalMatchCount === 0" title="上一个 (Shift+Enter)">▲</button>
          <button class="fr-nav-btn" @click="nextMatch" :disabled="totalMatchCount === 0" title="下一个 (Enter)">▼</button>
        </div>
        <div class="fr-replace-btns" v-if="mode === 'replace'">
          <button class="fr-action-btn" @click="replaceCurrent" :disabled="totalMatchCount === 0">替换当前</button>
          <button class="fr-action-btn primary" @click="replaceAll" :disabled="totalMatchCount === 0">全部替换</button>
        </div>
      </div>

      <!-- ── Action buttons for 'all' scope ── -->
      <div v-if="!isSingleFileSearch && findText" class="fr-nav-row">
        <button class="fr-action-btn" @click="performSearch" :disabled="fullBookLoading">
          {{ fullBookLoading ? '搜索中...' : (searchTarget !== 'main' ? '搜索文件夹' : '搜索全书') }}
        </button>
        <button v-if="mode === 'replace' && totalMatchCount > 0" class="fr-action-btn primary" @click="replaceAll">全部替换</button>
      </div>

      <!-- Loading indicator -->
      <div v-if="fullBookLoading" class="fr-loading">搜索中...</div>

      <!-- ── Single-file results ── -->
      <div v-if="isSingleFileSearch && totalMatchCount > 0" class="fr-results">
        <div class="fr-results-header">{{ totalMatchCount }} 个匹配</div>
        <div class="fr-results-list">
          <div v-for="(m, i) in matches" :key="i"
            class="fr-result-item" :class="{ active: i === currentMatch }" @click="goToMatch(i)">
            <span class="fr-result-num">{{ m.line }}</span>
            <span class="fr-result-text" v-html="highlightText(m.text, findText)"></span>
          </div>
        </div>
      </div>

      <!-- ── Full-book / folder results (collapsible) ── -->
      <div v-if="!isSingleFileSearch && searchResults.length > 0" class="fr-results">
        <div class="fr-results-header">共 {{ totalMatchCount }} 个结果，{{ searchResults.length }} 个文件</div>
        <div class="fr-results-list">
          <template v-for="file in searchResults" :key="file.filePath">
            <!-- File header: clickable to collapse/expand -->
            <div class="fr-result-file" @click="toggleFileExpand(file.filePath)">
              <span class="fr-collapse-icon">{{ isFileExpanded(file.filePath) ? '▼' : '▶' }}</span>
              {{ file.fileName }} ({{ file.matches.length }})
            </div>
            <!-- Matches (shown when expanded) -->
            <template v-if="isFileExpanded(file.filePath)">
              <div v-for="(m, i) in file.matches" :key="i"
                class="fr-result-item" @click="goToSearchResult(m)">
                <span class="fr-result-num">{{ m.lineNumber }}</span>
                <span class="fr-result-text" v-html="highlightText(m.lineContent.trim(), findText)"></span>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.find-replace-panel {
  position: fixed;
  z-index: 99999;
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

/* Selector rows (above input, same line) */
.fr-two-selectors {
  display: flex;
  gap: 8px;
}
.fr-selector-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.fr-selector-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 48px;
}
.fr-select {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  cursor: pointer;
}
.fr-select:focus { border-color: var(--accent-color); }

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

.fr-search-btn {
  padding: 3px 10px;
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  background: var(--accent-color);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  line-height: 1.5;
  flex-shrink: 0;
}
.fr-search-btn:hover:not(:disabled) { opacity: 0.9; }
.fr-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 4px 2px;
  margin-top: 4px;
  cursor: pointer;
  transition: background 0.1s;
  border-radius: 4px;
}
.fr-result-file:hover { background: var(--hover-bg); }

.fr-collapse-icon {
  font-size: 10px;
  color: var(--text-muted);
  width: 12px;
  flex-shrink: 0;
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
