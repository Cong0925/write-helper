<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { appState, type WordCount } from '../store'
import { readFile, writeFile } from '../api'
import { dialog } from '../composables/useDialog'
import {
  getAllCategories,
  getTemplatesByCategory,
  getBuiltinTemplatesByCategory,
  getCustomTemplatesByCategory,
  saveCustomTemplate,
  deleteCustomTemplate,
  togglePin,
  getStamp,
  type TemplateItem,
} from '../article-templates'
import { getAllTools } from '../quick-tools'
import RichTextEditor from './RichTextEditor.vue'
import CustomTemplateDialog from './CustomTemplateDialog.vue'
import ImageUploadPanel from './ImageUploadPanel.vue'

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
const templateTab = ref<'builtin' | 'custom'>('builtin')
const emojiSubTab = ref<'colorful' | 'kaomoji' | 'mono'>('colorful')
const showCustomDialog = ref(false)
const categories = computed(() => getAllCategories())
const currentTemplates = computed(() => {
  getStamp() // reactivity dependency — re-compute when registry mutates
  if (templateTab.value === 'custom') {
    return getCustomTemplatesByCategory(activeCategory.value)
  }
  const templates = getBuiltinTemplatesByCategory(activeCategory.value)
  if (activeCategory.value === 'emoji') {
    return templates.filter(t => t.subCategory === emojiSubTab.value)
  }
  return templates
})
const hasCustomTemplates = computed(() =>
  getCustomTemplatesByCategory(activeCategory.value).length > 0
)
const builtinCount = computed(() => {
  getStamp()
  return getBuiltinTemplatesByCategory(activeCategory.value).length
})
const customCount = computed(() => {
  getStamp()
  return getCustomTemplatesByCategory(activeCategory.value).length
})
const allQuickTools = computed(() => getAllTools())
// showQuickTools/showMobilePreview now use appState.articleShowQuickTools/articleShowMobilePreview
const articleWordCount = ref<WordCount>({ totalChars: 0, chineseChars: 0, words: 0, lines: 0 })

// ===== Rich text editor ref =====
const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null)
const editorContent = ref('')

// ===== Template gallery — native emoji click handler =====
const galleryScroll = ref<HTMLElement | null>(null)

// ===== Carousel image upload =====
const showCarouselPanel = ref(false)
const carouselImages = ref<string[]>(['/images/carousel-1.svg', '/images/carousel-2.svg', '/images/carousel-3.svg'])

// Event listener cleanup refs
let _carouselEl: Element | null = null
let _onCarouselClick: ((e: Event) => void) | null = null
let _galleryCleanup: (() => void) | null = null

// Listen for clicks on carousel images inside the editor
onMounted(() => {
  const el = document.querySelector('.editor-area-right')
  if (el) {
    _carouselEl = el
    _onCarouselClick = (e: Event) => {
      const target = e.target as HTMLElement
      const img = target.closest<HTMLImageElement>('img')
      if (!img) return
      const src = img.getAttribute('src') || ''

      // Detect carousel images: placeholder src or inside a carousel container
      const isPlaceholder = src.includes('/images/carousel-') && src.endsWith('.svg')
      const isInCarousel = !isPlaceholder && !!img.closest('[style*="carouselAnim"], [style*="min-width:33.333%"]')

      if (isPlaceholder || isInCarousel) {
        // Collect all 3 carousel images from the DOM
        const editorArea = document.querySelector('.editor-area-right')
        if (editorArea) {
          const allImgs = editorArea.querySelectorAll<HTMLImageElement>('img')
          const carouselSrcs: string[] = []
          for (const imgEl of allImgs) {
            const s = imgEl.getAttribute('src') || ''
            if (s.includes('/images/carousel-') || imgEl.closest('[style*="carouselAnim"], [style*="min-width:33.333%"]')) {
              if (!carouselSrcs.includes(s)) {
                carouselSrcs.push(s)
              }
            }
          }
          // Fill up to 3 slots with found images or defaults
          const defaults = ['/images/carousel-1.svg', '/images/carousel-2.svg', '/images/carousel-3.svg']
          while (carouselSrcs.length < 3) carouselSrcs.push(defaults[carouselSrcs.length])
          carouselImages.value = carouselSrcs.slice(0, 3)
        }
        showCarouselPanel.value = true
      }
    }
    el.addEventListener('click', _onCarouselClick)
  }
})

// ===== Article Metadata =====
const showMeta = ref(false)
const metaTitle = ref('')
const metaSummary = ref('')
const metaCover = ref('')
const metaOriginal = ref(true)
const metaOriginalLink = ref('')
const metaAllowReprint = ref(false)
// Toutiao (simplified)
const metaCategory = ref('')
const metaSaved = ref(false)

// Track if user has manually edited metaTitle to avoid overwriting on file switch
const metaTitleCustomized = ref(false)

const projectType = computed(() => appState.project?.projectType || 'novel')
const isWechat = computed(() => projectType.value === 'wechat_article')
const isToutiao = computed(() => projectType.value === 'toutiao_article')

// Full category list matching project creation options
const metaCategories = ['财经', '科技', '养生', '教育', '娱乐', '体育', '时尚', '美食', '旅游', '文化', '情感', '数码', '历史', '军事', '育儿', '职场']

// Display title in info bar: metaTitle if set, otherwise filename
const displayTitle = computed(() => {
  if (metaTitle.value) return metaTitle.value
  return articleTitle.value
})

function getMetaPath(): string {
  if (!appState.currentFile) return ''
  return appState.currentFile.path.replace(/\.(html|md)$/, '_meta.json')
}

async function loadMeta() {
  if (!appState.project) return
  // Reset customization flag, wait for currentFile to be set
  metaTitleCustomized.value = false
  // Set default title from filename
  if (appState.currentFile) {
    metaTitle.value = appState.currentFile.name.replace(/\.(md|html)$/, '')
  } else {
    metaTitle.value = ''
  }
  metaCover.value = ''
  metaSummary.value = ''
  metaOriginal.value = true
  metaOriginalLink.value = ''
  metaAllowReprint.value = false
  metaCategory.value = ''
  const configPath = getMetaPath()
  if (!configPath) return
  try {
    const content = await readFile(configPath)
    const config = JSON.parse(content)
    metaTitle.value = config.title || metaTitle.value
    metaCover.value = config.coverImage || ''
    if (isWechat.value) {
      metaSummary.value = config.summary || ''
      metaOriginalLink.value = config.originalLink || ''
      metaOriginal.value = config.isOriginal !== false
      metaAllowReprint.value = config.allowReprint || false
    } else {
      metaCategory.value = config.category || ''
    }
  } catch { /* no saved meta, use defaults */ }
}

async function saveMeta() {
  if (!appState.project) return
  const config = isWechat.value ? {
    title: metaTitle.value, summary: metaSummary.value,
    coverImage: metaCover.value, originalLink: metaOriginalLink.value,
    isOriginal: metaOriginal.value, allowReprint: metaAllowReprint.value,
  } : {
    title: metaTitle.value,
    coverImage: metaCover.value,
    category: metaCategory.value,
  }
  metaTitleCustomized.value = true
  const configPath = getMetaPath()
  if (!configPath) return
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2))
    metaSaved.value = true
    metaSavedTimer = setTimeout(() => metaSaved.value = false, 2000)
  } catch { /* ignore */ }
}

// 原生事件：表情图标点击（绕过 Vue v-html 的事件限制）
onMounted(() => {
  const el = galleryScroll.value
  if (!el) return
  const handler = (e: Event) => {
    const target = e.target as HTMLElement
    const emojiSpan = target.closest<HTMLElement>('[data-emoji]')
    if (emojiSpan) {
      const char = emojiSpan.getAttribute('data-emoji')
      if (char) editorRef.value?.insertInline(char)
      return
    }
    if (target.closest('.template-actions')) return
    const card = target.closest<HTMLElement>('.template-card')
    if (card) {
      const tplId = card.getAttribute('data-tpl-id')
      if (tplId) {
        const tpl = currentTemplates.value.find(t => t.id === tplId)
        if (tpl && tpl.category !== 'emoji') {
          editorRef.value?.insertHtml(tpl.html)
        }
      }
    }
  }
  el.addEventListener('click', handler)
  _galleryCleanup = () => el.removeEventListener('click', handler)
})

onUnmounted(() => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (metaSavedTimer) { clearTimeout(metaSavedTimer); metaSavedTimer = null }
  if (_onCarouselClick && _carouselEl) { _carouselEl.removeEventListener('click', _onCarouselClick); _carouselEl = null; _onCarouselClick = null }
  _galleryCleanup?.(); _galleryCleanup = null
})

async function handleCustomSave(name: string, html: string) {
  if (!appState.project) return
  const id = `custom-${Date.now()}`
  await saveCustomTemplate({
    id,
    name,
    category: activeCategory.value,
    html,
    custom: true,
  })
  // Switch to custom tab to show the new template
  templateTab.value = 'custom'
}

async function handleDeleteCustom(id: string) {
  const ok = await dialog.confirm('确定要删除此自定义模板吗？')
  if (!ok) return
  await deleteCustomTemplate(id)
}

function handleTogglePin(id: string) {
  togglePin(id)
}

function openCustomDialog() {
  showCustomDialog.value = true
}

function handleCarouselConfirm(dataUrls: string[]) {
  showCarouselPanel.value = false
  editorRef.value?.replaceCarouselImages(dataUrls)
}

// Switch to builtin tab when category changes
watch(activeCategory, () => {
  templateTab.value = 'builtin'
  emojiSubTab.value = 'colorful'
})

function onWordCount(count: WordCount) {
  articleWordCount.value = count
}

// ===== Mobile Preview (controlled via appState for RightPanel integration)
// state lives in appState.articleShowMobilePreview

// ===== Auto-save =====
let saveTimer: ReturnType<typeof setTimeout> | null = null
let metaSavedTimer: ReturnType<typeof setTimeout> | null = null
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
  const ok = await dialog.confirm('确定要清空编辑器内容吗？此操作不可撤销。')
  if (!ok) return
  editorRef.value?.clearContent()
}

const charCountStr = computed(() =>
  `字数 ${(articleWordCount.totalChars || 0).toLocaleString()} | 汉字 ${(articleWordCount.chineseChars || 0).toLocaleString()} | 段落 ${articleWordCount.lines || 0}`
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

// Watch for file selection change — reload meta and sync title
watch(() => appState.currentFile, (file) => {
  if (file) {
    loadMeta()
  } else {
    metaTitle.value = ''
    showMeta.value = false
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
      <div class="cat-nav-footer" v-show="!catNavCollapsed">
        <span class="cat-nav-footer-icon" title="样式兼容提示">⚠</span>
        <span class="cat-nav-footer-text">模板样式在粘贴到公众号/头条等平台时可能有差异，发布前请先粘贴测试。</span>
      </div>
    </div>

    <!-- ===== MIDDLE: Template Gallery ===== -->
    <div class="template-gallery">
      <div class="gallery-header">
        <span class="gallery-title">{{ categories.find(c => c.id === activeCategory)?.name || '模板' }}</span>
        <div class="gallery-header-actions">
          <button v-if="activeCategory !== 'emoji'" class="gallery-btn-custom" @click="openCustomDialog" title="创建自定义模板">+ 自定义</button>
        </div>
      </div>
      <div class="gallery-tabs">
        <button
          class="gallery-tab"
          :class="{ active: templateTab === 'builtin' }"
          @click="templateTab = 'builtin'"
        >内置 <span class="tab-count">{{ builtinCount }}</span></button>
        <button
          v-if="activeCategory !== 'emoji'"
          class="gallery-tab"
          :class="{ active: templateTab === 'custom' }"
          @click="templateTab = 'custom'"
        >
          自定义 <span class="tab-count">{{ customCount }}</span>
        </button>
      </div>
      <!-- Sub-tabs for emoji category -->
      <div v-if="activeCategory === 'emoji'" class="emoji-sub-tabs">
        <button
          class="emoji-sub-tab"
          :class="{ active: emojiSubTab === 'colorful' }"
          @click="emojiSubTab = 'colorful'"
        >多色图标</button>
        <button
          class="emoji-sub-tab"
          :class="{ active: emojiSubTab === 'kaomoji' }"
          @click="emojiSubTab = 'kaomoji'"
        >颜文字</button>
        <button
          class="emoji-sub-tab"
          :class="{ active: emojiSubTab === 'mono' }"
          @click="emojiSubTab = 'mono'"
        >单色图标</button>
      </div>
      <div class="gallery-scroll" ref="galleryScroll">
        <div v-if="currentTemplates.length === 0" class="gallery-empty">
          {{ templateTab === 'custom' ? '暂无自定义模板' : '暂无模板' }}
        </div>
        <div
          v-for="tpl in currentTemplates"
          :key="tpl.id"
          class="template-card"
          :data-tpl-id="tpl.id"
        >
          <div class="template-actions">
            <button
              class="tpl-action-btn pin-btn"
              :class="{ pinned: tpl.pinned }"
              :title="tpl.pinned ? '取消置顶' : '置顶'"
              @click.stop="handleTogglePin(tpl.id)"
            >{{ tpl.pinned ? '📍' : '📌' }}</button>
            <button
              v-if="tpl.custom"
              class="tpl-action-btn delete-btn"
              title="删除"
              @click.stop="handleDeleteCustom(tpl.id)"
            >🗑</button>
          </div>
          <div class="template-preview" :class="{ 'template-preview--emoji': activeCategory === 'emoji' }" v-html="tpl.html"></div>
        </div>
      </div>
    </div>

    <!-- Custom Template Dialog -->
    <CustomTemplateDialog
      :visible="showCustomDialog"
      @save="handleCustomSave"
      @close="showCustomDialog = false"
    />

    <!-- Carousel Image Upload Panel -->
    <ImageUploadPanel
      :visible="showCarouselPanel"
      :images="carouselImages"
      @confirm="handleCarouselConfirm"
      @close="showCarouselPanel = false"
    />

    <!-- ===== RIGHT: Editor Area ===== -->
    <div class="editor-area-right">
      <!-- Article info bar (minimal — shows article title from meta settings) -->
      <div class="article-info-bar">
        <span class="ai-title">{{ displayTitle }}</span>
        <div class="ai-actions">
          <button
            class="ai-btn"
            :disabled="!appState.currentFile"
            @click="showMeta = !showMeta"
            :class="{ active: showMeta }"
            title="文章设置"
          >
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
          <div
            v-for="tool in allQuickTools"
            :key="tool.id"
            class="qt-item"
            @click="tool.action"
          >
            <span class="qt-icon">{{ tool.icon }}</span>
            <span class="qt-label">{{ tool.name }}</span>
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
  width: 130px;
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

.cat-nav-footer {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.cat-nav-footer-icon {
  font-size: 12px;
  flex-shrink: 0;
  line-height: 1.5;
}

.cat-nav-footer-text {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
  user-select: none;
}

/* ===== Middle: Template Gallery ===== */
.template-gallery {
  width: 300px;
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
  padding: 14px 14px 6px;
  flex-shrink: 0;
}

.gallery-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gallery-btn-custom {
  padding: 3px 10px;
  border: 1px dashed var(--accent-color, #4a7dd4);
  border-radius: 10px;
  background: transparent;
  color: var(--accent-color, #4a7dd4);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.gallery-btn-custom:hover {
  background: var(--accent-light, #eaf0fa);
}

.gallery-tabs {
  display: flex;
  gap: 0;
  padding: 6px 14px 0;
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  flex-shrink: 0;
}

.gallery-tab {
  padding: 5px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary, #888);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  margin-bottom: -1px;
}
.gallery-tab:hover { color: var(--text-primary, #333); }
.gallery-tab.active {
  color: var(--accent-color, #4a7dd4);
  border-bottom-color: var(--accent-color, #4a7dd4);
}

.tab-count {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  background: var(--border-color, #e8e8e8);
  color: var(--text-muted, #999);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 16px;
  margin-left: 3px;
}
.gallery-tab.active .tab-count {
  background: var(--accent-light, #eaf0fa);
  color: var(--accent-color, #4a7dd4);
}

.gallery-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ===== Emoji Sub-tabs ===== */
.emoji-sub-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  flex-shrink: 0;
}

.emoji-sub-tab {
  padding: 3px 12px;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 12px;
  background: var(--bg-primary, #fff);
  color: var(--text-secondary, #888);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.emoji-sub-tab:hover {
  border-color: var(--accent-color, #4a7dd4);
  color: var(--accent-color, #4a7dd4);
}
.emoji-sub-tab.active {
  background: var(--accent-color, #4a7dd4);
  border-color: var(--accent-color, #4a7dd4);
  color: #fff;
}

.gallery-count {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
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
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-secondary);
  position: relative;
}

.template-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.template-card:hover .template-actions {
  opacity: 1;
}

.template-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 2;
}

.tpl-action-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: rgba(255,255,255,0.92);
  color: var(--text-secondary, #888);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  transition: all 0.1s;
}
.tpl-action-btn:hover { background: #fff; }
.pin-btn.pinned { color: var(--accent-color, #4a7dd4); }
.delete-btn:hover { color: #e74c3c; }

.template-preview {
  padding: 14px;
  min-height: 40px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.template-preview--emoji {
  padding: 0;
  min-height: 0;
}

.template-preview :deep(img) {
  max-width: 100%;
  height: auto;
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
.ai-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ai-btn:disabled:hover { background: transparent; color: var(--text-muted); }
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
