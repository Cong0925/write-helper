<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { appState } from '../store'
import { proofreadText, type ProofreadItem } from '../proofread'
import { getEditorView } from '../editorHelper'
import AIPanel from '../ai/AIPanel.vue'
import SensitiveWordDialog from './SensitiveWordDialog.vue'
import CustomRuleDialog from './CustomRuleDialog.vue'
import CharacterPanel from './CharacterPanel.vue'
import FolderPanel from './FolderPanel.vue'

/* ---- Panel metadata ---- */
const panelTitle = computed(() => {
  const titles: Record<string, string> = {
    proofread: '校对',
    outline: '大纲',
    characters: '人设',
    world: '设定',
    material: '素材',
    ai: 'AI 助手',
  }
  return titles[appState.activeSidePanel] || ''
})

function doClose() {
  appState.activeSidePanel = ''
}

/* ---- Panel sizing ---- */
const isWidePanel = computed(() =>
  ['outline', 'characters', 'world', 'material', 'ai'].includes(appState.activeSidePanel)
)
const panelWidth = computed(() => isWidePanel.value ? 550 : 340)

/* ---- Panel mode ---- */
const isDocked = computed(() => appState.sidePanelMode === 'docked')

function toggleMode() {
  appState.sidePanelMode = appState.sidePanelMode === 'float' ? 'docked' : 'float'
}

const panelStyle = computed(() => {
  if (isDocked.value) return {}
  return { left: pos.value.x + 'px', top: pos.value.y + 'px' }
})

/* ---- Drag (float mode only, with top boundary) ---- */
const pos = ref({ x: 0, y: 0 })
let dragging = false
let startX = 0, startY = 0
let startPosX = 0, startPosY = 0

function onDragStart(e: MouseEvent) {
  if (isDocked.value) return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  startPosX = pos.value.x
  startPosY = pos.value.y
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging) return
  pos.value.x = startPosX + (e.clientX - startX)
  pos.value.y = Math.max(0, startPosY + (e.clientY - startY))
}

function onDragEnd() {
  dragging = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})

/* ---- View switching ---- */
const view = ref<'result' | 'sensitive-mgmt'>('result')

function switchToResult() { view.value = 'result' }

/* ---- Collapsible modules ---- */
const collapsed = ref(new Set<string>())
function toggleCollapse(id: string) {
  if (collapsed.value.has(id)) collapsed.value.delete(id)
  else collapsed.value.add(id)
}

/* ---- Dialog state ---- */
const showSensitiveDialog = ref(false)
const showCustomRuleDialog = ref(false)

/* ---- Persistent ignore list ---- */
const ignoredEntries = ref<import('../proofreadData').IgnoredEntry[]>([])

function getCurrentFilePath(): string {
  return appState.currentFile?.path || ''
}

function getLineContent(lineNum: number): string {
  const view = getEditorView()
  if (!view) return ''
  try {
    return view.state.doc.line(lineNum).toString()
  } catch {
    return ''
  }
}

function isIgnored(item: ProofreadItem): boolean {
  const fp = getCurrentFilePath()
  if (!fp) return false
  const lc = getLineContent(item.lineNum)
  const id = item.wrong || item.message
  return ignoredEntries.value.some(e =>
    e.filePath === fp && e.text === id && e.lineContent === lc
  )
}

/* Dialog opens to the left of the side panel */
const dialogAnchor = computed(() => ({
  x: Math.max(0, pos.value.x - 425),
  y: pos.value.y,
}))

/* ---- Per-module state ---- */
interface ModuleState {
  status: 'idle' | 'loading' | 'clean' | 'issues'
  items: ProofreadItem[]
  ignored: number[]
}

function freshModule(): ModuleState {
  return { status: 'idle', items: [], ignored: [] }
}

const typoMod = reactive<ModuleState>(freshModule())
const sensitiveMod = reactive<ModuleState>(freshModule())
const formatMod = reactive<ModuleState>(freshModule())
const customMod = reactive<ModuleState>(freshModule())

/* ---- Clear detection on file switch ---- */
watch(() => appState.currentFile?.path, () => {
  Object.assign(typoMod, freshModule())
  Object.assign(sensitiveMod, freshModule())
  Object.assign(formatMod, freshModule())
  Object.assign(customMod, freshModule())
})

const visibleTypos = computed(() =>
  typoMod.items.filter((_, i) => !typoMod.ignored.includes(i))
)
const visibleSensitive = computed(() =>
  sensitiveMod.items.filter((_, i) => !sensitiveMod.ignored.includes(i))
)
const visibleCustom = computed(() =>
  customMod.items.filter((_, i) => !customMod.ignored.includes(i))
)

/* ---- Status text ---- */
function statusText(mod: ModuleState): string {
  if (mod.status === 'idle') return '未检测'
  if (mod.status === 'loading') return '检测中…'
  if (mod.status === 'clean') return '✓ 无问题'
  const shown = mod.items.length - mod.ignored.length
  return `${shown} 个问题`
}

/* ---- Run single module check ---- */
function runModuleCheck(mod: ModuleState, type: 'typo' | 'sensitive' | 'format' | 'custom') {
  const editorView = getEditorView()
  if (!editorView) return
  const text = editorView.state.doc.toString()
  mod.status = 'loading'

  const opts = { typo: type === 'typo', sensitive: type === 'sensitive', format: type === 'format', custom: type === 'custom', grammar: false }

  setTimeout(() => {
    const r = proofreadText(text, appState.sensitiveWords, appState.customRuleGroups, opts)
    let items = type === 'typo' ? r.typos : type === 'sensitive' ? r.sensitive : type === 'format' ? r.format : r.custom
    // Filter out persistently ignored items
    if (getCurrentFilePath()) {
      items = items.filter(item => !isIgnored(item))
    }
    mod.items = items
    mod.ignored = []
    mod.status = items.length === 0 ? 'clean' : 'issues'
  }, 50)
}

/* ---- Jump to item with selection highlight ---- */
function jumpToItem(item: ProofreadItem) {
  const view = getEditorView()
  if (!view) return
  const lineInfo = view.state.doc.line(item.lineNum)
  if (!lineInfo) return
  const from = lineInfo.from + item.colNum - 1
  const to = item.wrong ? from + item.wrong.length : from
  view.dispatch({
    selection: { anchor: from, head: to || from },
    scrollIntoView: true,
  })
  view.focus()
}

/* ---- Ignore ---- */
function ignoreItem(mod: ModuleState, item: ProofreadItem) {
  const idx = mod.items.indexOf(item)
  if (idx !== -1 && !mod.ignored.includes(idx)) {
    mod.ignored.push(idx)
    if (mod.ignored.length >= mod.items.length) {
      mod.status = 'clean'
    }
  }
}

async function ignorePermanently(mod: ModuleState, item: ProofreadItem) {
  // In-memory hide
  ignoreItem(mod, item)

  // Persist to file so next check also skips it
  const fp = getCurrentFilePath()
  if (!fp) return
  const id = item.wrong || item.message
  if (!id) return
  const lc = getLineContent(item.lineNum)
  if (!lc) return
  try {
    const { addIgnored } = await import('../proofreadData')
    await addIgnored({ filePath: fp, text: id, lineContent: lc })
    const { loadIgnored } = await import('../proofreadData')
    ignoredEntries.value = await loadIgnored()
  } catch { /* ignore */ }
}

/* ---- Apply fixes ---- */
function applyFix(mod: ModuleState, item: ProofreadItem) {
  if (!item.wrong || !item.correct) return
  const view = getEditorView()
  if (!view) return
  const lineInfo = view.state.doc.line(item.lineNum)
  if (!lineInfo) return
  const from = lineInfo.from + item.colNum - 1
  const to = from + item.wrong.length
  view.dispatch({ changes: { from, to, insert: item.correct } })
  view.focus()
  // Remove from visible list after applying
  ignoreItem(mod, item)
}

const nonIgnoredTypos = computed(() =>
  typoMod.items.filter((_, i) => !typoMod.ignored.includes(i))
)

function applyAllFixes() {
  const view = getEditorView()
  if (!view) return
  const sorted = [...nonIgnoredTypos.value].sort((a, b) => (b.lineNum - a.lineNum) || (b.colNum - a.colNum))
  const changes = sorted.map(item => {
    if (!item.wrong || !item.correct) return null
    const lineInfo = view.state.doc.line(item.lineNum)
    if (!lineInfo) return null
    const from = lineInfo.from + item.colNum - 1
    const to = from + item.wrong.length
    return { changes: { from, to, insert: item.correct } }
  }).filter((x): x is NonNullable<typeof x> => x != null)
  if (!changes.length) return
  view.dispatch(...changes)
  view.focus()
  // Mark all as ignored
  typoMod.ignored = nonIgnoredTypos.value.map((_, i) => i)
  typoMod.status = 'clean'
}

/* ---- Sensitive word management ---- */
const newWord = ref('')
const importText = ref('')
const importName = ref('')
const showImport = ref(false)

const MAX_VISIBLE_WORDS = 10
const wordListDisplay = computed(() => appState.sensitiveWords.slice(0, MAX_VISIBLE_WORDS))
const wordOverflow = computed(() =>
  appState.sensitiveWords.length > MAX_VISIBLE_WORDS
    ? appState.sensitiveWords.length - MAX_VISIBLE_WORDS
    : 0
)

function addWord() {
  const w = newWord.value.trim()
  if (!w) return
  if (!appState.sensitiveWords.includes(w)) {
    appState.sensitiveWords.push(w)
  }
  // Also add to 默认模板
  let defaultTmpl = appState.sensitiveTemplates.find(t => t.name === '默认模板')
  if (!defaultTmpl) {
    defaultTmpl = { name: '默认模板', words: [] }
    appState.sensitiveTemplates.push(defaultTmpl)
  }
  if (!defaultTmpl.words.includes(w)) {
    defaultTmpl.words.push(w)
  }
  newWord.value = ''
  saveSensitiveConfig()
}

function saveTemplate() {
  const name = importName.value.trim()
  if (!name) return
  const words = importText.value.split(/[\n,，、\s]+/).map(w => w.trim()).filter(w => w.length > 0)
  if (!words.length) return
  // Save template for reference
  appState.sensitiveTemplates = appState.sensitiveTemplates.filter(t => t.name !== name)
  appState.sensitiveTemplates.push({ name, words })
  // Auto-apply: add all template words to the active list
  for (const w of words) {
    if (!appState.sensitiveWords.includes(w)) appState.sensitiveWords.push(w)
  }
  importName.value = ''
  importText.value = ''
  showImport.value = false
  saveSensitiveConfig()
}

function removeTemplate(name: string) {
  appState.sensitiveTemplates = appState.sensitiveTemplates.filter(t => t.name !== name)
  saveSensitiveConfig()
}

async function saveSensitiveConfig() {
  try {
    const { saveSensitiveData } = await import('../proofreadData')
    await saveSensitiveData()
  } catch { /* ignore */ }
}

async function loadSensitiveConfig() {
  try {
    const { loadSensitiveData } = await import('../proofreadData')
    await loadSensitiveData()
  } catch { /* ignore */ }
}

onMounted(async () => {
  pos.value.x = Math.max(0, window.innerWidth - 340 - 52)
  pos.value.y = 0
  await loadSensitiveConfig()
  try {
    const { loadIgnored } = await import('../proofreadData')
    ignoredEntries.value = await loadIgnored()
  } catch { /* ignore */ }
})

/* Reposition on panel type change */
watch(() => appState.activeSidePanel, (id) => {
  if (!id) return
  pos.value.x = Math.max(0, window.innerWidth - panelWidth.value - 52)
})

watch(() => appState.sidePanelMode, (mode) => {
  if (mode === 'float' && appState.activeSidePanel) {
    pos.value.x = Math.max(0, window.innerWidth - panelWidth.value - 52)
  }
})
</script>

<template>
  <Transition name="overlay-panel">
    <div
      v-if="appState.activeSidePanel"
      class="side-panel"
      :class="{ 'panel-wide': isWidePanel, 'panel-docked': isDocked }"
      :style="panelStyle"
    >
      <!-- Header -->
      <div class="panel-header" @mousedown.prevent="onDragStart">
        <span class="panel-title">
          <template v-if="view === 'result'">{{ panelTitle }}</template>
          <template v-else>敏感词管理</template>
        </span>
        <div class="header-actions">
          <button class="mode-btn" :title="isDocked ? '切换为悬浮' : '切换为嵌入'" @click.stop="toggleMode">
            {{ isDocked ? '🗔' : '📌' }}
          </button>
          <button class="panel-close" @click.stop="doClose">✕</button>
        </div>
      </div>

      <!-- ============ View: Result ============ -->
      <template v-if="view === 'result'">
        <div class="panel-body">
          <!-- Folder-based panels -->
          <AIPanel v-if="appState.activeSidePanel === 'ai'" />
          <CharacterPanel v-if="appState.activeSidePanel === 'characters'" />
          <FolderPanel v-else-if="appState.activeSidePanel === 'outline'" dirName="大纲" />
          <FolderPanel v-else-if="appState.activeSidePanel === 'world'" dirName="设定" />
          <FolderPanel v-else-if="appState.activeSidePanel === 'material'" dirName="素材" />

          <!-- Proofread panel -->
          <template v-else-if="appState.activeSidePanel === 'proofread'">
            <!-- ─── 错别字检测 ─── -->
            <div class="module">
              <div class="module-hd" @click="toggleCollapse('typo')">
                <span class="collapse-arrow">{{ collapsed.has('typo') ? '▶' : '▼' }}</span>
                <span class="mod-icon mod-typo">错</span>
                <span class="mod-title">错别字检测</span>
                <span class="mod-status" :class="typoMod.status">{{ statusText(typoMod) }}</span>
              </div>

              <template v-if="!collapsed.has('typo')">
              <div v-if="visibleTypos.length" class="err-list">
                <div v-for="(item, idx) in visibleTypos" :key="idx" class="err-row" @click="jumpToItem(item)">
                  <span class="err-text">
                    <span class="err-src">{{ item.wrong }}</span>
                    <span class="err-arrow">→</span>
                    <span class="err-dst">{{ item.correct }}</span>
                  </span>
                  <span class="err-actions" @click.stop>
                    <button class="act-btn" @click="ignorePermanently(typoMod, item)">忽略</button>
                    <button class="act-btn act-primary" @click="applyFix(typoMod, item)">修改</button>
                  </span>
                </div>
              </div>

              <div class="mod-actions">
                <button class="btn-action" :disabled="!nonIgnoredTypos.length" @click="applyAllFixes">全部修改</button>
                <button
                  class="btn-action btn-primary"
                  :disabled="typoMod.status === 'loading'"
                  @click="runModuleCheck(typoMod, 'typo')"
                >{{ typoMod.status === 'loading' ? '检测中…' : '检测' }}</button>
              </div>
              </template>
            </div>

            <div class="mod-spacer"></div>

            <!-- ─── 病句检测 ─── -->
            <div class="module">
              <div class="module-hd" @click="toggleCollapse('grammar')">
                <span class="collapse-arrow">{{ collapsed.has('grammar') ? '▶' : '▼' }}</span>
                <span class="mod-icon mod-gram">句</span>
                <span class="mod-title">病句检测</span>
                <span class="mod-status ai-needed">需接入AI</span>
              </div>
              <template v-if="!collapsed.has('grammar')">
              <button class="btn-full disabled" disabled>需接入AI模型后可用</button>
              </template>
            </div>

            <div class="mod-spacer"></div>

            <!-- ─── 风险检测 ─── -->
            <div class="module">
              <div class="module-hd" @click="toggleCollapse('risk')">
                <span class="collapse-arrow">{{ collapsed.has('risk') ? '▶' : '▼' }}</span>
                <span class="mod-icon mod-risk">险</span>
                <span class="mod-title">风险检测</span>
                <span class="mod-status" :class="sensitiveMod.status">{{ statusText(sensitiveMod) }}</span>
                <button class="hd-btn" @click.stop="view='sensitive-mgmt'">设置词库</button>
              </div>

              <template v-if="!collapsed.has('risk')">
              <div v-if="visibleSensitive.length" class="res-cpt">
                <div v-for="(item, idx) in visibleSensitive" :key="idx" class="res-crow" @click="jumpToItem(item)">
                  <span class="res-cword">{{ item.message }}</span>
                  <span class="res-cactions" @click.stop>
                    <button class="act-btn" @click="ignorePermanently(sensitiveMod, item)">忽略</button>
                  </span>
                </div>
              </div>

              <button
                class="btn-full"
                :disabled="sensitiveMod.status === 'loading'"
                @click="runModuleCheck(sensitiveMod, 'sensitive')"
              >{{ sensitiveMod.status === 'loading' ? '检测中…' : '检测风险内容' }}</button>
              </template>
            </div>

            <div class="mod-spacer"></div>

            <!-- ─── 自定义纠错 ─── -->
            <div class="module">
              <div class="module-hd" @click="toggleCollapse('custom')">
                <span class="collapse-arrow">{{ collapsed.has('custom') ? '▶' : '▼' }}</span>
                <span class="mod-icon mod-custom">纠</span>
                <span class="mod-title">自定义纠错</span>
                <span class="mod-status" :class="customMod.status">{{ statusText(customMod) }}</span>
                <button class="hd-btn" @click.stop="showCustomRuleDialog = true">设置词库</button>
              </div>

              <template v-if="!collapsed.has('custom')">
              <div v-if="visibleCustom.length" class="err-list">
                <div v-for="(item, idx) in visibleCustom" :key="idx" class="err-row" @click="jumpToItem(item)">
                  <span class="err-text">
                    <span class="err-src">{{ item.wrong }}</span>
                    <span class="err-arrow">→</span>
                    <span class="err-dst">{{ item.correct || '(删除)' }}</span>
                  </span>
                  <span class="err-actions" @click.stop>
                    <button class="act-btn" @click="ignorePermanently(customMod, item)">忽略</button>
                    <button v-if="item.correct" class="act-btn act-primary" @click="applyFix(customMod, item)">修改</button>
                  </span>
                </div>
              </div>

              <button
                class="btn-full"
                :disabled="customMod.status === 'loading'"
                @click="runModuleCheck(customMod, 'custom')"
              >{{ customMod.status === 'loading' ? '检测中…' : '检测自定义规则' }}</button>
              </template>
            </div>

            <!-- ─── Bottom ─── -->
            <div class="bottom-area">
              <p class="disclaimer">智能识别，可能出现误差，仅供参考</p>
              <button class="btn-primary-full" disabled>全文检测</button>
            </div>
          </template>

          <template v-else>
            <p class="placeholder">功能开发中</p>
          </template>
        </div>
      </template>

      <!-- Dialogs (visible in any view) -->
      <SensitiveWordDialog v-if="showSensitiveDialog" :panel-left="dialogAnchor.x" :panel-top="dialogAnchor.y" @close="showSensitiveDialog = false" />
      <CustomRuleDialog v-if="showCustomRuleDialog" :panel-left="dialogAnchor.x" :panel-top="dialogAnchor.y" @close="showCustomRuleDialog = false" />

      <!-- ============ View: Sensitive Word Management ============ -->
      <template v-if="view === 'sensitive-mgmt'">
        <div class="panel-body">
          <button class="btn-text back-btn" @click="switchToResult">← 返回检测</button>

          <!-- Add word -->
          <div class="mgmt-section">
            <label class="mgmt-label">添加敏感词到默认模板</label>
            <div class="add-row">
              <input v-model="newWord" class="mgmt-input" placeholder="输入敏感词" @keyup.enter="addWord" />
              <button class="btn-small" @click="addWord">添加</button>
            </div>
          </div>

          <!-- Import template -->
          <div class="mgmt-section">
            <button class="btn-text" @click="showImport = !showImport">
              {{ showImport ? '收起' : '📄 导入模板' }}
            </button>
            <div v-if="showImport" class="import-area">
              <input v-model="importName" class="mgmt-input" placeholder="模板名称" />
              <textarea
                v-model="importText" class="mgmt-textarea"
                placeholder="每行一个敏感词，或用逗号、分号、顿号、空格分割" rows="5"
              ></textarea>
              <button class="btn-small" @click="saveTemplate">保存并应用</button>
            </div>
          </div>

          <!-- Word list (chips, max 10) -->
          <div class="mgmt-section">
            <label class="mgmt-label">当前词库（{{ appState.sensitiveWords.length }} 个词）</label>
            <div v-if="!appState.sensitiveWords.length" class="empty-state small"><p>暂无敏感词</p></div>
            <div v-else class="word-chips" @click="showSensitiveDialog = true">
              <span v-for="(word, idx) in wordListDisplay" :key="idx" class="chip">{{ word }}</span>
              <span v-if="wordOverflow" class="chip chip-more">+{{ wordOverflow }}</span>
            </div>
            <p class="chip-hint">点击标签浏览全部敏感词（可按模板筛选、模糊搜索）</p>
          </div>

          <!-- Saved templates (reference only, auto-applied) -->
          <div v-if="appState.sensitiveTemplates.length" class="mgmt-section">
            <label class="mgmt-label">已导入模板</label>
            <div v-for="(tmpl, idx) in appState.sensitiveTemplates" :key="idx" class="tpl-row">
              <div class="tpl-info">
                <span class="tpl-name">{{ tmpl.name }}</span>
                <span class="tpl-count">{{ tmpl.words.length }} 词</span>
              </div>
              <button class="btn-tiny danger" @click="removeTemplate(tmpl.name)">删除</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
/* ============ Base ============ */
.side-panel {
  width: 340px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Float mode: overlay */
.side-panel:not(.panel-docked) {
  position: fixed;
  max-height: 90vh;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  z-index: 1001;
}
/* Docked mode: inline flex item */
.side-panel.panel-docked {
  position: relative;
  flex-shrink: 0;
  height: 100%;
  border-left: 1px solid var(--border-color);
}
.side-panel.panel-wide {
  width: 550px;
}
.side-panel.panel-wide.panel-docked {
  height: 100%;
}

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  cursor: grab; user-select: none;
}
.panel-docked .panel-header { cursor: default; }
.panel-header:active { cursor: grabbing; }
.panel-docked .panel-header:active { cursor: default; }
.panel-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }

.header-actions {
  display: flex; align-items: center; gap: 4px;
}

.mode-btn {
  width: 28px; height: 28px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-muted); font-size: 13px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.mode-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

.panel-close {
  width: 28px; height: 28px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-muted); font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.panel-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.panel-body { flex: 1; overflow-y: auto; padding: 14px; }
.placeholder { color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 40px; }

/* ============ Module ============ */
.module {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: visible;
}

.module-hd {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer; user-select: none;
}
.module-hd:hover { background: var(--hover-bg); }

.collapse-arrow {
  font-size: 10px; color: var(--text-muted);
  width: 14px; flex-shrink: 0; text-align: center;
}

.mod-icon {
  width: 22px; height: 22px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.mod-typo { background: #e74c3c; }
.mod-gram { background: #95a5a6; }
.mod-risk { background: #f39c12; }
.mod-custom { background: #3498db; }

.mod-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mod-status { font-size: 11px; color: var(--text-muted); margin-left: auto; }
.mod-status.loading { color: var(--accent-color); }
.mod-status.clean { color: var(--success-color); }
.mod-status.issues { color: var(--danger-color); }
.mod-status.ai-needed { color: var(--text-muted); opacity: 0.6; }

.hd-btn {
  background: none; border: none;
  color: var(--accent-color); font-size: 11px; cursor: pointer;
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px;
}
.hd-btn:hover { background: var(--hover-bg); }

.mod-spacer { height: 10px; }

/* ─── Error list (typo) ─── */
.err-list { }
.err-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.err-row:hover { background: var(--hover-bg); }

.err-text {
  flex: 1; font-size: 12px; color: var(--text-primary);
  display: flex; align-items: center; gap: 4px;
}
.err-src { color: var(--danger-color); font-weight: 600; text-decoration: line-through; }
.err-arrow { color: var(--text-muted); font-size: 11px; }
.err-dst { color: var(--success-color); font-weight: 600; }
.err-actions { display: flex; gap: 2px; flex-shrink: 0; }

/* ─── Action buttons ─── */
.act-btn {
  background: none; border: none;
  font-size: 11px; color: var(--text-muted); cursor: pointer;
  padding: 2px 6px; border-radius: 3px;
}
.act-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.act-btn.act-primary { color: var(--accent-color); }
.act-btn.act-primary:hover { background: var(--accent-light); }

.mod-actions {
  display: flex; gap: 6px; padding: 8px 12px;
}
.btn-action {
  flex: 1; height: 32px; border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px; cursor: pointer;
}
.btn-action:hover { background: var(--hover-bg); }
.btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-action.btn-primary {
  background: var(--accent-color); color: #fff; border-color: var(--accent-color);
}
.btn-action.btn-primary:hover { background: var(--accent-hover); }
.btn-action.btn-primary:disabled { opacity: 0.5; }

/* ─── Full-width button ─── */
.btn-full {
  width: 100%; height: 34px; border: none;
  background: var(--bg-primary); color: var(--text-primary);
  font-size: 12px; cursor: pointer;
}
.btn-full:hover { background: var(--hover-bg); }
.btn-full.disabled, .btn-full:disabled {
  color: var(--text-muted); cursor: not-allowed; opacity: 0.5;
}

/* ─── Compact results ─── */
.res-cpt { border-bottom: 1px solid var(--border-color); }
.res-crow {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.res-crow:last-child { border-bottom: none; }
.res-crow:hover { background: var(--hover-bg); }
.res-cword { flex: 1; font-size: 11px; color: var(--text-primary); }
.res-cactions { display: flex; gap: 2px; flex-shrink: 0; }

/* ============ Bottom ============ */
.bottom-area {
  margin-top: 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.disclaimer {
  text-align: center; font-size: 11px; color: var(--text-muted);
}
.btn-primary-full {
  width: 100%; height: 38px;
  border: none; border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-muted); font-size: 13px; font-weight: 600;
  cursor: not-allowed; opacity: 0.55;
}

/* ============ Sensitive Word Management ============ */
.back-btn { margin-bottom: 10px; }
.btn-text {
  background: none; border: none;
  color: var(--accent-color); font-size: 12px; cursor: pointer;
  padding: 4px 6px; border-radius: 4px;
}
.btn-text:hover { background: var(--hover-bg); }

.mgmt-section { margin-bottom: 14px; }
.mgmt-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.add-row { display: flex; gap: 6px; }

.mgmt-input {
  flex: 1; height: 32px; padding: 0 10px;
  border: 1px solid var(--border-color); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px; outline: none;
}
.mgmt-input:focus { border-color: var(--accent-color); }
.mgmt-textarea {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--border-color); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px;
  outline: none; resize: vertical; margin-top: 6px; font-family: inherit;
}
.mgmt-textarea:focus { border-color: var(--accent-color); }

.btn-small {
  height: 32px; padding: 0 14px; border: 1px solid var(--border-color);
  border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);
  font-size: 12px; cursor: pointer; white-space: nowrap;
}
.btn-small:hover { background: var(--hover-bg); }

.import-area { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }

/* ─── Word chips ─── */
.word-chips {
  display: flex; flex-wrap: wrap; gap: 5px; cursor: pointer;
  padding: 4px 0;
}
.chip {
  padding: 3px 10px; background: var(--bg-surface);
  border: 1px solid var(--border-color); border-radius: 14px;
  font-size: 11px; color: var(--text-primary);
}
.chip:hover { background: var(--hover-bg); }
.chip.chip-more {
  background: var(--accent-light); color: var(--accent-color);
  border-color: transparent; font-weight: 600;
}

/* ─── Templates ─── */
.tpl-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 6px;
}
.tpl-info { display: flex; flex-direction: column; gap: 2px; }
.tpl-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.tpl-count { font-size: 11px; color: var(--text-muted); }

.btn-tiny {
  height: 26px; padding: 0 10px; border: 1px solid var(--border-color);
  border-radius: 5px; background: var(--bg-primary); color: var(--text-primary);
  font-size: 11px; cursor: pointer;
}
.btn-tiny:hover { background: var(--hover-bg); }
.btn-tiny.danger { color: var(--danger-color); }
.btn-tiny.danger:hover { background: rgba(231,76,60,0.08); }

.chip-hint { font-size: 10px; color: var(--text-muted); margin: 2px 0 0; cursor: pointer; }
.chip-hint:hover { color: var(--accent-color); }
.empty-state { text-align: center; color: var(--text-muted); font-size: 13px; padding: 24px 0; }
.empty-state.small { padding: 12px 0; }

/* ─── Transition ─── */
.overlay-panel-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.overlay-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.overlay-panel-enter-from,
.overlay-panel-leave-to { opacity: 0; transform: translateY(-8px); }

/* Docked mode: no fade transition */
.panel-docked.overlay-panel-enter-active,
.panel-docked.overlay-panel-leave-active { transition: none; }
.panel-docked.overlay-panel-enter-from,
.panel-docked.overlay-panel-leave-to { opacity: 1; transform: none; }
</style>
