<script setup lang="ts">
import { computed } from 'vue'
import { appState } from '../store'

const typePanelSets: Record<string, string[]> = {
  novel: ['proofread', 'outline', 'characters', 'world', 'material'],
  wechat_article: ['proofread', 'material'],
  toutiao_article: ['proofread', 'material'],
}

const allPanels = [
  { id: 'proofread', icon: '✓', label: '校对', group: 'upper' },
  { id: 'outline', icon: '☰', label: '大纲', group: 'lower' },
  { id: 'characters', icon: '👤', label: '人设', group: 'lower' },
  { id: 'world', icon: '🌍', label: '设定', group: 'lower' },
  { id: 'material', icon: '📎', label: '素材', group: 'lower' },
  { id: 'ai', icon: '🤖', label: 'AI 助手', group: 'ai' },
]

const allowedPanels = computed(() => {
  const pt = appState.project?.projectType || 'novel'
  return typePanelSets[pt] || typePanelSets.novel
})

const visibleUpper = computed(() => allPanels.filter(p => p.group === 'upper' && allowedPanels.value.includes(p.id)))
const visibleLower = computed(() => allPanels.filter(p => p.group === 'lower' && allowedPanels.value.includes(p.id)))
const visibleAi = computed(() => allPanels.filter(p => p.group === 'ai'))

function togglePanel(id: string) {
  if (appState.activeSidePanel !== id) {
    // Open different panel — preserve current mode
    appState.activeSidePanel = id
    // sidePanelMode stays as-is
  } else if (appState.sidePanelMode === 'float') {
    // Already open in float → switch to docked
    appState.sidePanelMode = 'docked'
  } else {
    // Already open in docked → close, reset to float
    appState.activeSidePanel = ''
    appState.sidePanelMode = 'float'
  }
}

const isArticleProject = computed(() => {
  const pt = appState.project?.projectType || 'novel'
  return pt === 'wechat_article' || pt === 'toutiao_article'
})

function triggerAction(action: string) {
  appState.articlePendingAction = action
  appState.articleActionStamp++
}
</script>

<template>
  <div class="right-panel">
    <button
      v-for="item in visibleUpper"
      :key="item.id"
      class="side-btn"
      :class="{ active: appState.activeSidePanel === item.id }"
      :title="item.label"
      @click="togglePanel(item.id)"
    >
      <span class="side-icon">{{ item.icon }}</span>
      <span class="side-label">{{ item.label }}</span>
    </button>
    <template v-if="isArticleProject">
      <button
        class="side-btn"
        :class="{ active: appState.articleShowMobilePreview }"
        title="手机预览"
        @click="appState.articleShowMobilePreview = !appState.articleShowMobilePreview"
      >
        <span class="side-icon">📱</span>
        <span class="side-label">预览</span>
      </button>
      <button
        class="side-btn"
        :class="{ active: appState.articleShowQuickTools }"
        title="快捷工具"
        @click="appState.articleShowQuickTools = !appState.articleShowQuickTools"
      >
        <span class="side-icon">🛠</span>
        <span class="side-label">工具</span>
      </button>
      <button class="side-btn" title="一键复制" @click="triggerAction('copy')">
        <span class="side-icon">📋</span>
        <span class="side-label">复制</span>
      </button>
      <button class="side-btn" title="清空内容" @click="triggerAction('clear')">
        <span class="side-icon">🗑</span>
        <span class="side-label">清空</span>
      </button>
    </template>
    <div class="side-divider" v-if="visibleLower.length > 0"></div>
    <button
      v-for="item in visibleLower"
      :key="item.id"
      class="side-btn"
      :class="{ active: appState.activeSidePanel === item.id }"
      :title="item.label"
      @click="togglePanel(item.id)"
    >
      <span class="side-icon">{{ item.icon }}</span>
      <span class="side-label">{{ item.label }}</span>
    </button>
    <div class="side-divider"></div>
    <button
      v-for="item in visibleAi"
      :key="item.id"
      class="side-btn"
      :class="{ active: appState.activeSidePanel === item.id }"
      :title="item.label"
      @click="togglePanel(item.id)"
    >
      <span class="side-icon">{{ item.icon }}</span>
      <span class="side-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.right-panel {
  width: var(--right-panel-width);
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  flex-shrink: 0;
  overflow-y: auto;
}

.side-btn {
  width: 40px;
  height: 48px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.15s;
  position: relative;
  flex-shrink: 0;
}

.side-btn:hover {
  background: var(--hover-bg);
  color: var(--text-secondary);
}

.side-btn.active {
  color: var(--accent-color);
}

.side-btn.active::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent-color);
  border-radius: 0 3px 3px 0;
}

.side-icon {
  font-size: 16px;
  line-height: 1;
}

.side-label {
  font-size: 10px;
  line-height: 1;
}

.side-divider {
  width: 28px;
  height: 1px;
  background: var(--border-color);
  margin: 6px 0;
  flex-shrink: 0;
}
</style>
