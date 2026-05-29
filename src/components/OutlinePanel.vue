<script setup lang="ts">
import { computed } from 'vue'
import { appState } from '../store'

interface OutlineItem {
  level: number
  text: string
  line: number
}

const outlines = computed<OutlineItem[]>(() => {
  if (!appState.currentContent) return []
  const items: OutlineItem[] = []
  const lines = appState.currentContent.split('\n')
  lines.forEach((line, i) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      items.push({ level: match[1].length, text: match[2], line: i })
    }
  })
  return items
})
</script>

<template>
  <div class="outline-panel">
    <div class="outline-title">大纲</div>
    <div v-if="outlines.length === 0" class="outline-empty">
      无标题结构
    </div>
    <div
      v-for="item in outlines"
      :key="item.line"
      class="outline-item"
      :style="{ paddingLeft: (item.level - 1) * 16 + 12 + 'px' }"
    >
      <span class="outline-marker">{{ '#'.repeat(item.level) }}</span>
      <span class="outline-text">{{ item.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.outline-panel {
  border-top: 1px solid var(--border-color);
  padding: 8px 0;
}

.outline-title {
  padding: 4px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.outline-empty {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.outline-item {
  padding: 3px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.outline-item:hover {
  background: var(--hover-bg);
}

.outline-marker {
  color: var(--accent-color);
  font-size: 11px;
  opacity: 0.6;
  flex-shrink: 0;
}

.outline-text {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
