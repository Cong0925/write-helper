<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { appState, type WordCount } from '../store'
import { readFile, writeFile } from '../api'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { categories, getTemplatesByCategory, type TemplateItem } from '../article-templates'
import RichTextEditor from './RichTextEditor.vue'

// ===== Watch for article selection from LeftPanel =====
watch(() => appState.currentFile, async (file) => {
  // Cancel pending auto-save timer
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  // Flush unsaved edits to the OLD file before switching
  if (appState.isDirty && savedFilePath.value) {
    const html = editorRef.value?.getHtml() || editorContent.value
    try {
      await writeFile(savedFilePath.value, html)
      appState.isDirty = false
    } catch {}
  }
  savedFilePath.value = null
  // Reset editor content — the currentContent watch will populate it
  if (!file) {
    editorContent.value = ''
  }
})

// ===== Category & Template state =====
const activeCategory = ref<string>('follow')
const catNavCollapsed = ref(false)
const currentTemplates = computed(() => getTemplatesByCategory(activeCategory.value))
// showQuickTools/showMobilePreview now use appState.articleShowQuickTools/articleShowMobilePreview
const articleWordCount = ref<WordCount>({ totalChars: 0, chineseChars: 0, words: 0, lines: 0 })

// ===== Rich text editor ref =====
const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null)
const editorContent = ref('')

// ===== Article Metadata =====
const showMeta = ref(false)
const metaTitle = ref('')
const metaSummary = ref('')
const metaCover = ref('')
const metaOriginal = ref(true)
const metaOriginalLink = ref('')
const metaAllowReprint = ref(false)
// Toutiao
const metaTitle2 = ref('')
const metaTitle3 = ref('')
const metaCoverMode = ref<'single' | 'triple'>('single')
const metaCategory = ref('')
const metaSaved = ref(false)

const projectType = computed(() => appState.project?.projectType || 'novel')
const isWechat = computed(() => projectType.value === 'wechat_article')
const isToutiao = computed(() => projectType.value === 'toutiao_article')
const metaCategories = ['财经', '科技', '体育', '娱乐', '教育', '三农', '美食', '旅游', '时尚', '育儿']

async function loadMeta() {
  if (!appState.project) return
  try {
    const configPath = appState.project.path + '/.writinghelper/type_config.json'
    const content = await readFile(configPath)
    const config = JSON.parse(content)
    metaTitle.value = config.title || ''
    metaCover.value = config.coverImage || ''
    if (isWechat.value) {
      metaSummary.value = config.summary || ''
      metaOriginalLink.value = config.originalLink || ''
      metaOriginal.value = config.isOriginal !== false
      metaAllowReprint.value = config.allowReprint || false
    } else {
      metaTitle2.value = config.title2 || ''
      metaTitle3.value = config.title3 || ''
      metaCoverMode.value = config.coverMode || 'single'
      metaCategory.value = config.category || ''
      /* no ads field */
    }
  } catch { /* no saved meta */ }
}

async function saveMeta() {
  if (!appState.project) return
  const config = isWechat.value ? {
    title: metaTitle.value, summary: metaSummary.value,
    coverImage: metaCover.value, originalLink: metaOriginalLink.value,
    isOriginal: metaOriginal.value, allowReprint: metaAllowReprint.value,
  } : {
    title: metaTitle.value, title2: metaTitle2.value, title3: metaTitle3.value,
    coverImage: metaCover.value, coverMode: metaCoverMode.value,
    category: metaCategory.value,
  }
  try {
    const configPath = appState.project.path + '/.writinghelper/type_config.json'
    await writeFile(configPath, JSON.stringify(config, null, 2))
    metaSaved.value = true
    setTimeout(() => metaSaved.value = false, 2000)
  } catch { /* ignore */ }
}

function onTemplateClick(tpl: TemplateItem) {
  editorRef.value?.insertHtml(tpl.html)
}

function onWordCount(count: WordCount) {
  articleWordCount.value = count
}

// ===== Mobile Preview (controlled via appState for RightPanel integration)
// state lives in appState.articleShowMobilePreview

// ===== Auto-save =====
let saveTimer: ReturnType<typeof setTimeout> | null = null
const savedFilePath = ref<string | null>(null)

async function saveArticle() {
  if (!appState.currentFile) return
  // Guard: don't save if the file was switched since this save was scheduled
  if (appState.currentFile.path !== savedFilePath.value) return
  const html = editorRef.value?.getHtml() || editorContent.value
  try {
    await writeFile(appState.currentFile.path, html)
    appState.isDirty = false
  } catch {}
}

function scheduleSave() {
  if (!appState.currentFile) return
  savedFilePath.value = appState.currentFile.path
  if (appState.autoSave) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveArticle(), 500)
  }
}

// Track whether content update is programmatic (file load) vs user edit
let contentUpdateFromLoad = false

watch(() => appState.currentContent, (content) => {
  contentUpdateFromLoad = true
  editorContent.value = content || ''
}, { immediate: true })

// User edits: detect via editorContent changes that are NOT from programmatic loads
watch(editorContent, () => {
  if (contentUpdateFromLoad) {
    contentUpdateFromLoad = false
    return
  }
  // User-initiated change
  appState.isDirty = true
  scheduleSave()
})

// ===== Watch for actions triggered from RightPanel =====
watch(() => appState.articleActionStamp, () => {
  const action = appState.articlePendingAction
  if (!action) return
  appState.articlePendingAction = ''
  if (action === 'copy') copyContent()
  else if (action === 'clear') clearContent()
})

// ===== Article actions =====
function copyContent() {
  editorRef.value?.copyContent()
}

async function clearContent() {
  const ok = await tauriConfirm('确定要清空编辑器内容吗？此操作不可撤销。', { title: '清空确认', kind: 'warning' })
  if (!ok) return
  editorRef.value?.clearContent()
}

const charCountStr = computed(() =>
  `当前 ${(articleWordCount.totalChars || 0).toLocaleString()} 字`
)

const articleTitle = computed(() => {
  if (!appState.currentFile) return '未选择文章'
  return appState.currentFile.name.replace(/\.(md|html)$/, '')
})

onMounted(() => {
  loadMeta()
})

// Watch for project change
watch(() => appState.project, (np, op) => {
  if (np && np !== op) {
    editorContent.value = ''
    loadMeta()
  }
})
</script>

<template>
  <div class="article-editor-main">
    <!-- ===== LEFT: Category Navigation ===== -->
    <div class="cat-nav" :class="{ collapsed: catNavCollapsed }">
      <div class="cat-nav-header">
        <span class="cat-nav-title" v-show="!catNavCollapsed">排版分类</span>
        <button class="cat-nav-toggle" @click="catNavCollapsed = !catNavCollapsed" :title="catNavCollapsed ? '展开' : '折叠'">
          <span v-if="catNavCollapsed">▶</span>
          <span v-else>◀</span>
        </button>
      </div>
      <div class="cat-nav-list">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="cat-nav-item"
          :class="{ active: activeCategory === cat.id }"
          :title="catNavCollapsed ? cat.name : ''"
          @click="activeCategory = cat.id"
        >
          <span class="cat-icon">{{ cat.icon }}</span>
          <span class="cat-name" v-show="!catNavCollapsed">{{ cat.name }}</span>
        </div>
      </div>
    </div>

    <!-- ===== MIDDLE: Template Gallery ===== -->
    <div class="template-gallery">
      <div class="gallery-header">
        <span class="gallery-title">{{ categories.find(c => c.id === activeCategory)?.name || '模板' }}</span>
        <span class="gallery-count">{{ currentTemplates.length }} 个模板</span>
      </div>
      <div class="gallery-scroll">
        <div v-if="currentTemplates.length === 0" class="gallery-empty">
          暂无模板
        </div>
        <div
          v-for="tpl in currentTemplates"
          :key="tpl.id"
          class="template-card"
          @click="onTemplateClick(tpl)"
        >
          <div class="template-preview" v-html="tpl.html"></div>
          <div class="template-name">{{ tpl.name }}</div>
        </div>
      </div>
    </div>

    <!-- ===== RIGHT: Editor Area ===== -->
    <div class="editor-area-right">
      <!-- Article info bar (minimal — just shows current article name) -->
      <div class="article-info-bar">
        <span class="ai-title">{{ articleTitle }}</span>
        <div class="ai-actions">
          <button class="ai-btn" @click="showMeta = !showMeta" :class="{ active: showMeta }" title="文章设置">
            ⚙
          </button>
        </div>
      </div>

      <!-- Metadata panel -->
      <Transition name="slide-down">
        <div v-if="showMeta" class="meta-panel">
          <div class="meta-grid">
            <div class="form-group">
              <label class="form-label">文章标题</label>
              <input v-model="metaTitle" class="form-input" placeholder="输入文章标题" />
            </div>
            <div class="form-group">
              <label class="form-label">封面图片路径</label>
              <input v-model="metaCover" class="form-input" placeholder="images/cover.jpg" />
            </div>
            <template v-if="isWechat">
              <div class="form-group full-width">
                <label class="form-label">摘要（120字以内）</label>
                <textarea v-model="metaSummary" class="form-textarea" rows="2" maxlength="120" placeholder="输入文章摘要"></textarea>
                <span class="char-count">{{ metaSummary.length }}/120</span>
              </div>
              <div class="form-group">
                <label class="form-label">原文链接</label>
                <input v-model="metaOriginalLink" class="form-input" placeholder="https://..." />
              </div>
              <div class="form-group toggle-group">
                <label class="form-label">声明原创</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="metaOriginal" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="form-group toggle-group" v-if="!metaOriginal">
                <label class="form-label">允许转载</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="metaAllowReprint" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </template>
            <template v-if="isToutiao">
              <div class="form-group">
                <label class="form-label">备选标题 2</label>
                <input v-model="metaTitle2" class="form-input" maxlength="30" placeholder="备选标题" />
              </div>
              <div class="form-group">
                <label class="form-label">备选标题 3</label>
                <input v-model="metaTitle3" class="form-input" maxlength="30" placeholder="备选标题" />
              </div>
              <div class="form-group">
                <label class="form-label">封面模式</label>
                <div class="radio-group">
                  <label class="radio-label"><input type="radio" v-model="metaCoverMode" value="single" /> 单图</label>
                  <label class="radio-label"><input type="radio" v-model="metaCoverMode" value="triple" /> 三图</label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">分类</label>
                <select v-model="metaCategory" class="form-input">
                  <option value="">选择分类</option>
                  <option v-for="c in metaCategories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </template>
          </div>
          <div class="meta-actions">
            <button class="btn-save-meta" @click="saveMeta">{{ metaSaved ? '已保存 ✓' : '保存设置' }}</button>
          </div>
        </div>
      </Transition>

      <!-- Empty state when no file is selected -->
      <div v-if="!appState.currentFile" class="editor-empty-state">
        <div class="editor-empty-content">
          <span class="empty-icon">📝</span>
          <p class="empty-text">请从左侧列表选择一篇文章</p>
          <p class="empty-hint">或点击「新建文章」开始创作</p>
        </div>
      </div>

      <!-- Rich text editor — keyed by file path to force re-creation on switch -->
      <div v-else class="rich-editor-container">
        <RichTextEditor
          :key="appState.currentFile?.path || 'empty'"
          ref="editorRef"
          v-model="editorContent"
          @word-count="onWordCount"
        />
      </div>

      <!-- Bottom action bar -->
      <div class="editor-bottom-bar">
        <div class="ebb-left">
          <span class="wc-info">{{ charCountStr }}</span>
        </div>
      </div>
    </div>

    <!-- ===== Quick Tools Sidebar ===== -->
    <Transition name="slide-right">
      <div v-if="appState.articleShowQuickTools" class="quick-tools-sidebar">
        <div class="qt-header">
          <span>快捷工具</span>
          <button class="qt-close" @click="appState.articleShowQuickTools = false">✕</button>
        </div>
        <div class="qt-body">
          <div class="qt-item" @click="alert('SVG 图库 - 敬请期待')">
            <span class="qt-icon">🎨</span>
            <span class="qt-label">SVG 图库</span>
          </div>
          <div class="qt-item" @click="alert('二维码生成器 - 敬请期待')">
            <span class="qt-icon">📱</span>
            <span class="qt-label">二维码生成</span>
          </div>
          <div class="qt-item" @click="alert('OCR 文字识别 - 敬请期待')">
            <span class="qt-icon">🔍</span>
            <span class="qt-label">OCR 识别</span>
          </div>
          <div class="qt-item" @click="alert('微信表情 - 敬请期待')">
            <span class="qt-icon">😊</span>
            <span class="qt-label">微信表情</span>
          </div>
          <div class="qt-item" @click="alert('配色神器 - 敬请期待')">
            <span class="qt-icon">🌈</span>
            <span class="qt-label">配色神器</span>
          </div>
          <div class="qt-item" @click="alert('一键制图 - 敬请期待')">
            <span class="qt-icon">🖼</span>
            <span class="qt-label">一键制图</span>
          </div>
          <div class="qt-item" @click="alert('图片压缩 - 敬请期待')">
            <span class="qt-icon">📦</span>
            <span class="qt-label">图片压缩</span>
          </div>
          <div class="qt-item" @click="alert('GIF 动画 - 敬请期待')">
            <span class="qt-icon">🎬</span>
            <span class="qt-label">GIF 动画</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ===== Mobile Preview Overlay ===== -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="appState.articleShowMobilePreview" class="mobile-preview-overlay" @click.self="appState.articleShowMobilePreview = false">
          <div class="mobile-preview-container">
            <div class="mobile-preview-header">
              <span>手机预览</span>
              <button class="mp-close" @click="appState.articleShowMobilePreview = false">✕</button>
            </div>
            <div class="mobile-frame">
              <div class="mobile-status-bar">
                <span>9:41</span>
                <span>📶 🔋</span>
              </div>
              <div class="mobile-content" v-html="editorRef?.getHtml() || editorContent || '<p style=\'color:#999;text-align:center;padding:40px 0;\'>暂无内容</p>'"></div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.article-editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: var(--bg-primary);
}

/* ===== Left: Category Navigation ===== */
.cat-nav {
  width: 180px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease;
}

.cat-nav.collapsed {
  width: 42px;
}

.cat-nav.collapsed .cat-nav-item {
  justify-content: center;
  padding: 8px 4px;
}

.cat-nav.collapsed .cat-icon {
  width: auto;
}

.cat-nav-header {
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.cat-nav.collapsed .cat-nav-header {
  justify-content: center;
  padding: 14px 4px 10px;
}

.cat-nav-toggle {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s;
}
.cat-nav-toggle:hover { background: var(--hover-bg); color: var(--text-primary); }

.cat-nav-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.cat-nav-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.cat-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s;
  font-size: 13px;
  color: var(--text-secondary);
}

.cat-nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.cat-nav-item.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.cat-icon {
  font-size: 16px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.cat-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Middle: Template Gallery ===== */
.template-gallery {
  width: 320px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.gallery-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.gallery-count {
  font-size: 11px;
  color: var(--text-muted);
}

.gallery-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gallery-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.template-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-secondary);
}

.template-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.template-preview {
  padding: 14px;
  min-height: 40px;
  border-bottom: 1px solid var(--border-color);
  background: #fff;
  pointer-events: none;
}

.template-preview :deep(img) {
  max-width: 100%;
  height: auto;
}

.template-name {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  font-weight: 500;
}

/* ===== Right: Editor Area ===== */
.editor-area-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* Article info bar */
.article-info-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ai-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.ai-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.ai-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.ai-btn.active { background: var(--accent-light); color: var(--accent-color); border-color: var(--accent-color); }

/* Metadata panel */
.meta-panel {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
  max-height: 280px;
  overflow-y: auto;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
}

.meta-grid .form-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-grid .full-width { grid-column: 1 / -1; }

.form-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input, .form-textarea {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.form-input:focus, .form-textarea:focus { border-color: var(--accent-color); }
.form-textarea { resize: none; }
.char-count { font-size: 10px; color: var(--text-muted); align-self: flex-end; }

.toggle-group {
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
}

.toggle-switch {
  position: relative;
  width: 34px; height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}
.toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0;
  background: var(--border-color);
  border-radius: 9px;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute; width: 14px; height: 14px;
  left: 2px; bottom: 2px;
  background: #fff; border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background: var(--accent-color); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }

.radio-group { display: flex; gap: 10px; }
.radio-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-primary); cursor: pointer; }

.meta-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.btn-save-meta {
  padding: 4px 14px;
  border: none;
  border-radius: 5px;
  background: var(--accent-color);
  color: #1e1e2e;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.btn-save-meta:hover { opacity: 0.85; }

/* Rich editor container */
.rich-editor-container {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

/* Empty state */
.editor-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.editor-empty-content {
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* Bottom bar */
.editor-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.wc-info {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ===== Quick Tools Sidebar ===== */
.quick-tools-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.qt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.qt-close {
  width: 22px; height: 22px;
  border: none; border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
}
.qt-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.qt-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qt-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s;
  font-size: 13px;
  color: var(--text-secondary);
}

.qt-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.qt-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.qt-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Mobile Preview ===== */
.mobile-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mobile-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 340px;
  padding: 8px 4px 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.mp-close {
  width: 28px; height: 28px;
  border: none; border-radius: 6px;
  background: rgba(255,255,255,0.15);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
.mp-close:hover { background: rgba(255,255,255,0.25); }

.mobile-frame {
  width: 340px;
  height: 640px;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
}

.mobile-status-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 20px 4px;
  font-size: 11px;
  color: #333;
  font-weight: 600;
  background: #fff;
  flex-shrink: 0;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.7;
  color: #333;
}

.mobile-content :deep(img) {
  max-width: 100%;
  height: auto;
}

/* ===== Transitions ===== */
.slide-down-enter-active { transition: all 0.15s ease-out; }
.slide-down-leave-active { transition: all 0.1s ease-in; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

.slide-right-enter-active { transition: all 0.15s ease-out; }
.slide-right-leave-active { transition: all 0.1s ease-in; }
.slide-right-enter-from,
.slide-right-leave-to { opacity: 0; transform: translateX(20px); }

.fade-enter-active { transition: opacity 0.2s; }
.fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
