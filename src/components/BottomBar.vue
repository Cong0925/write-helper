<script setup lang="ts">
import { appState } from '../store'
</script>

<template>
  <div class="bottom-bar">
    <div class="bar-left">
      <span v-if="appState.currentFile" class="bar-item">
        {{ appState.currentFile.name.replace(/\.md$/, '') }}
      </span>
    </div>
    <div class="bar-right">
      <span class="bar-item" v-if="appState.wordCount.totalChars > 0">
        总字数：{{ appState.wordCount.totalChars.toLocaleString() }}
      </span>
      <span class="bar-item" v-if="appState.wordCount.chineseChars > 0">
        中文：{{ appState.wordCount.chineseChars.toLocaleString() }}
      </span>
      <span class="bar-item">
        {{ appState.isDirty ? '未保存' : '已同步' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.bottom-bar {
  height: var(--bottom-bar-height);
  background: var(--bg-toolbar);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.bar-left, .bar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bar-item {
  white-space: nowrap;
}
</style>
