<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { appState } from '../store'

const props = withDefaults(defineProps<{ panelLeft?: number; panelTop?: number }>(), { panelLeft: 120, panelTop: 80 })
const emit = defineEmits<{ close: [] }>()

/* ---- Drag ---- */
const pos = ref({ x: props.panelLeft, y: props.panelTop })
let dragging = false
let sx = 0, sy = 0, spx = 0, spy = 0

function onDragStart(e: MouseEvent) {
  dragging = true
  sx = e.clientX; sy = e.clientY
  spx = pos.value.x; spy = pos.value.y
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}
function onDragMove(e: MouseEvent) {
  if (!dragging) return
  pos.value.x = Math.max(0, spx + e.clientX - sx)
  pos.value.y = Math.max(0, spy + e.clientY - sy)
}
function onDragEnd() {
  dragging = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}
onUnmounted(() => { document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragEnd) })

/* ---- Filter & search ---- */
const activeTab = ref('__all__')
const searchQuery = ref('')

const tabs = computed(() => {
  const list: { id: string; label: string }[] = [{ id: '__all__', label: '全部' }]
  for (const t of appState.sensitiveTemplates) {
    list.push({ id: t.name, label: t.name })
  }
  return list
})

const displayedWords = computed(() => {
  let words: string[] = []
  if (activeTab.value === '__all__') {
    words = [...appState.sensitiveWords]
  } else {
    const tmpl = appState.sensitiveTemplates.find(t => t.name === activeTab.value)
    words = tmpl ? [...tmpl.words] : []
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    words = words.filter(w => w.toLowerCase().includes(q))
  }
  return words
})

function removeWord(word: string) {
  appState.sensitiveWords = appState.sensitiveWords.filter(w => w !== word)
  // Also remove from template if in template view
  if (activeTab.value !== '__all__') {
    const tmpl = appState.sensitiveTemplates.find(t => t.name === activeTab.value)
    if (tmpl) {
      tmpl.words = tmpl.words.filter(w => w !== word)
    }
  }
  saveConfig()
}

async function saveConfig() {
  try {
    const { saveSensitiveData } = await import('../proofreadData')
    await saveSensitiveData()
  } catch { /* ignore */ }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-panel">
      <div class="sw-dialog" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
        <!-- Header -->
        <div class="sw-header" @mousedown.prevent="onDragStart">
          <span class="sw-title">敏感词库管理</span>
          <button class="sw-close" @click="emit('close')">✕</button>
        </div>

        <!-- Search -->
        <div class="sw-search">
          <input v-model="searchQuery" class="sw-input" placeholder="搜索敏感词…" />
        </div>

        <!-- Tab filters -->
        <div class="sw-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="sw-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <!-- Word list -->
        <div class="sw-body">
          <div v-if="!displayedWords.length" class="sw-empty">{{ searchQuery ? '无匹配结果' : '暂无敏感词' }}</div>
          <div v-for="(word, idx) in displayedWords" :key="idx" class="sw-row">
            <span class="sw-word">{{ word }}</span>
            <button class="sw-del" @click="removeWord(word)" title="删除">✕</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="sw-footer">{{ displayedWords.length }} 个词</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sw-dialog {
  position: fixed;
  width: 420px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  z-index: 2000;
  overflow: hidden;
}
.sw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  cursor: grab; user-select: none;
}
.sw-header:active { cursor: grabbing; }
.sw-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.sw-close {
  width: 28px; height: 28px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-muted); font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.sw-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.sw-search { padding: 10px 14px 0; }
.sw-input {
  width: 100%; height: 32px; padding: 0 10px;
  border: 1px solid var(--border-color); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px; outline: none;
}
.sw-input:focus { border-color: var(--accent-color); }

.sw-tabs {
  display: flex; gap: 4px; padding: 8px 14px 0;
  overflow-x: auto; flex-shrink: 0;
}
.sw-tab {
  height: 28px; padding: 0 12px; border: 1px solid var(--border-color);
  border-radius: 14px; background: var(--bg-primary); color: var(--text-muted);
  font-size: 11px; cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.sw-tab.active {
  background: var(--accent-color); color: #fff; border-color: var(--accent-color);
}
.sw-tab:hover:not(.active) { background: var(--hover-bg); }

.sw-body {
  flex: 1; overflow-y: auto; padding: 6px 14px;
  min-height: 100px;
}
.sw-empty { text-align: center; font-size: 13px; color: var(--text-muted); padding: 32px 0; }
.sw-row {
  display: flex; align-items: center;
  padding: 6px 8px; border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}
.sw-row:last-child { border-bottom: none; }
.sw-row:hover { background: var(--hover-bg); }
.sw-word { flex: 1; color: var(--text-primary); }
.sw-del {
  width: 22px; height: 22px; border: none; border-radius: 50%;
  background: transparent; color: var(--text-muted); font-size: 11px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sw-del:hover { background: var(--hover-bg); color: var(--danger-color); }

.sw-footer {
  padding: 8px 14px; border-top: 1px solid var(--border-color);
  font-size: 11px; color: var(--text-muted); text-align: right;
}

.overlay-panel-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.overlay-panel-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.overlay-panel-enter-from,
.overlay-panel-leave-to { opacity: 0; transform: scale(0.96); }
</style>
