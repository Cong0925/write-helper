<script setup lang="ts">
import { appState } from '../store'

const upperItems = [
  { id: 'proofread', icon: '✓', label: '校对' },
]

const lowerItems = [
  { id: 'outline', icon: '☰', label: '大纲' },
  { id: 'characters', icon: '👤', label: '人设' },
  { id: 'world', icon: '🌍', label: '设定' },
  { id: 'material', icon: '📎', label: '素材' },
]

function togglePanel(id: string) {
  appState.activeSidePanel = appState.activeSidePanel === id ? '' : id
}
</script>

<template>
  <div class="right-panel">
    <button
      v-for="item in upperItems"
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
      v-for="item in lowerItems"
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
