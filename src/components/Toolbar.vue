<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { appState, articleProjectTypes, clearAllContentCache } from '../store'
import { getEditorView } from '../editorHelper'
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { registerShortcut, unregisterShortcut } from '../useKeyboardShortcuts'
import { formatCurrentDoc } from '../formatDoc'
import { toggleFullscreen } from '../useKeyboardShortcuts'

function backToWelcome() {
  appState.project = null
  appState.fileTree = []
  appState.currentFile = null
  appState.currentContent = ''
  appState.isDirty = false
  clearAllContentCache()
  appState.view = 'welcome'
}

const typeLabels: Record<string, string> = {
  novel: '小说', wechat_article: '公众号', toutiao_article: '头条',
}

const isArticleProject = computed(() => {
  const pt = appState.project?.projectType || ''
  return (articleProjectTypes as readonly string[]).includes(pt)
})

// F11 退出全屏监听
document.addEventListener('fullscreenchange', () => {
  appState.isFullscreen = !!document.fullscreenElement
})

function toggleFindReplace() {
  appState.showFindReplace = !appState.showFindReplace
}

function undo() {
  const view = getEditorView()
  if (view) cmUndo(view)
}

function redo() {
  const view = getEditorView()
  if (view) cmRedo(view)
}

onMounted(() => {
  registerShortcut('toggleFindReplace', toggleFindReplace)
  registerShortcut('formatDoc', formatCurrentDoc)
  registerShortcut('showOutline', () => {
    appState.activeSidePanel = appState.activeSidePanel === 'outline' ? '' : 'outline'
  })
  registerShortcut('showSettingsPanel', () => {
    appState.activeSidePanel = appState.activeSidePanel === 'world' ? '' : 'world'
  })
})

onUnmounted(() => {
  unregisterShortcut('toggleFindReplace')
  unregisterShortcut('formatDoc')
  unregisterShortcut('showOutline')
  unregisterShortcut('showSettingsPanel')
})
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="app-brand" @click="backToWelcome" title="返回首页">
        <span class="app-icon">✍</span>
      </div>
      <div class="divider"></div>
      <span class="project-tab">{{ appState.project?.name || '' }}</span>
      <span v-if="appState.project?.projectType" class="type-badge">{{ typeLabels[appState.project.projectType] || appState.project.projectType }}</span>
    </div>

    <div class="toolbar-center">
      <button v-if="!isArticleProject" class="tb-btn" title="字体设置" @click="appState.showFontSettings = true">Aa</button>
      <button v-if="!isArticleProject" class="tb-btn" title="背景设置" @click="appState.showBgSettings = true">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
    <path d="M7 3L10 3L10 6L12 4L14 6L14 3L17 3L20 7L18 9L18 20L6 20L6 9L4 7Z"/>
  </svg>
</button>
      <div class="divider"></div>
      <button class="tb-btn" title="撤销" @click="undo">↩</button>
      <button class="tb-btn" title="重做" @click="redo">↪</button>
      <div class="divider"></div>
      <button v-if="!isArticleProject" class="tb-btn" title="一键排版" @click="formatCurrentDoc">排</button>
      <button class="tb-btn" :title="appState.isFullscreen ? 'F11 退出全屏' : '全屏'" @click="toggleFullscreen">
        {{ appState.isFullscreen ? '⛶' : '⛶' }}
      </button>
      <button class="tb-btn" title="查找替换" @click="toggleFindReplace">🔍</button>
    </div>

    <div class="toolbar-right">
      <button class="tb-btn" title="设置" @click="appState.showSettings = !appState.showSettings">⚙</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: var(--toolbar-height);
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  user-select: none;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;
  -webkit-app-region: no-drag;
}

.app-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.app-brand:hover {
  background: var(--hover-bg);
}

.app-icon {
  font-size: 20px;
}

.project-tab {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--accent-color);
  white-space: nowrap;
  flex-shrink: 0;
}

.toolbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 80px;
  justify-content: flex-end;
  -webkit-app-region: no-drag;
}

.tb-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tb-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}
</style>
