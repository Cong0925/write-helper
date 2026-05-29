<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { appState } from '../store'

const props = withDefaults(defineProps<{ panelLeft?: number; panelTop?: number }>(), { panelLeft: 160, panelTop: 100 })
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

/* ---- State ---- */
const selectedIdx = ref(0)

const currentGroup = computed(() => appState.customRuleGroups[selectedIdx.value])

function selectGroup(idx: number) {
  if (idx >= 0 && idx < appState.customRuleGroups.length) selectedIdx.value = idx
}

function toggleGroup(idx: number) {
  const g = appState.customRuleGroups[idx]
  if (g) g.enabled = !g.enabled
  save()
}

function getNextName(): string {
  let max = 0
  for (const g of appState.customRuleGroups) {
    const m = g.name.match(/^词库(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `词库${max + 1}`
}

function newGroup() {
  const name = getNextName()
  appState.customRuleGroups.push({ name, enabled: true, rules: [] })
  selectedIdx.value = appState.customRuleGroups.length - 1
  save()
}

function removeGroup(idx: number) {
  if (appState.customRuleGroups.length <= 1) return
  appState.customRuleGroups.splice(idx, 1)
  if (selectedIdx.value >= appState.customRuleGroups.length) {
    selectedIdx.value = appState.customRuleGroups.length - 1
  }
  save()
}

function addRule() {
  currentGroup.value?.rules.push({ detect: '', correct: '' })
  save()
}

function removeRule(idx: number) {
  currentGroup.value?.rules.splice(idx, 1)
  save()
}

function onNameInput(e: Event, idx: number) {
  const el = e.target as HTMLElement
  let text = el.textContent?.trim() || ''
  if (text.length > 10) text = text.slice(0, 10)
  appState.customRuleGroups[idx].name = text || `词库${idx + 1}`
}

async function save() {
  try {
    const { saveCustomRules } = await import('../proofreadData')
    await saveCustomRules()
  } catch { /* ignore */ }
}

onMounted(async () => {
  try {
    const { loadCustomRules } = await import('../proofreadData')
    await loadCustomRules()
  } catch { /* ignore */ }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-panel">
      <div class="cr-dialog" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
        <!-- Header -->
        <div class="cr-header" @mousedown.prevent="onDragStart">
          <span class="cr-title">自定义纠错词库</span>
          <button class="cr-close" @click="emit('close')">✕</button>
        </div>

        <div class="cr-body">
          <!-- Left panel: group list -->
          <div class="cr-left">
            <div class="cr-groups">
              <div
                v-for="(g, idx) in appState.customRuleGroups"
                :key="idx"
                class="cr-group"
                :class="{ active: selectedIdx === idx }"
                @click="selectGroup(idx)"
              >
                <span
                  class="cr-toggle"
                  :class="{ on: g.enabled }"
                  @click.stop="toggleGroup(idx)"
                ></span>
                <span
                  class="cr-gname"
                  contenteditable
                  :class="{ editing: selectedIdx === idx }"
                  @blur="onNameInput($event, idx)"
                  @keydown.enter.prevent="($event.target as HTMLElement).blur()"
                >{{ g.name }}</span>
                <button
                  v-if="appState.customRuleGroups.length > 1"
                  class="cr-gdel"
                  @click.stop="removeGroup(idx)"
                  title="删除词库"
                >✕</button>
              </div>
            </div>
            <button class="cr-new" @click="newGroup">+ 新建</button>
          </div>

          <!-- Right panel: rule table -->
          <div class="cr-right">
            <div v-if="!currentGroup" class="cr-empty">请选择一个词库</div>
            <template v-else>
              <div class="cr-table-hd">
                <span class="cr-col-detect">检测词</span>
                <span class="cr-col-correct">修正词（选填）</span>
                <span class="cr-col-act"></span>
              </div>
              <div class="cr-table">
                <div v-for="(rule, idx) in currentGroup.rules" :key="idx" class="cr-row">
                  <input v-model="rule.detect" class="cr-input cr-col-detect" placeholder="输入检测词" @input="save" />
                  <input v-model="rule.correct" class="cr-input cr-col-correct" placeholder="选填" @input="save" />
                  <button class="cr-rmrule" @click="removeRule(idx)">✕</button>
                </div>
              </div>
              <button class="cr-addrule" @click="addRule">+ 添加行</button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cr-dialog {
  position: fixed;
  width: 560px;
  max-height: 90vh;
  height: 380px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  z-index: 2000;
  overflow: hidden;
}

.cr-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  cursor: grab; user-select: none;
}
.cr-header:active { cursor: grabbing; }
.cr-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.cr-close {
  width: 28px; height: 28px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-muted); font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.cr-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.cr-body {
  display: flex; flex: 1; overflow: hidden;
}

/* Left panel */
.cr-left {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.cr-groups {
  flex: 1; overflow-y: auto; padding: 4px;
}
.cr-group {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  margin-bottom: 2px;
}
.cr-group.active { background: var(--hover-bg); }
.cr-group:hover { background: var(--hover-bg); }

.cr-toggle {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border-color); flex-shrink: 0;
  cursor: pointer; position: relative;
}
.cr-toggle.on { border-color: var(--accent-color); background: var(--accent-color); }
.cr-toggle.on::after {
  content: ''; position: absolute; top: 4px; left: 4px;
  width: 6px; height: 6px; border-radius: 50%; background: #fff;
}

.cr-gname {
  flex: 1; font-size: 12px; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  outline: none; border-radius: 3px; padding: 1px 3px;
}
.cr-gname.editing:focus { background: var(--bg-primary); }

.cr-gdel {
  width: 18px; height: 18px; border: none; border-radius: 50%;
  background: transparent; color: var(--text-muted); font-size: 10px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cr-gdel:hover { background: var(--hover-bg); color: var(--danger-color); }

.cr-new {
  height: 32px; margin: 4px; border-radius: 6px;
  border: 1px dashed var(--border-color);
  background: transparent; color: var(--accent-color);
  font-size: 12px; cursor: pointer; flex-shrink: 0;
}
.cr-new:hover { background: var(--hover-bg); }

/* Right panel */
.cr-right {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.cr-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 48px 0; }

.cr-table-hd {
  display: flex; padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
}
.cr-col-detect { flex: 1; }
.cr-col-correct { flex: 1; }
.cr-col-act { width: 28px; flex-shrink: 0; }

.cr-table {
  flex: 1; overflow-y: auto; padding: 4px 12px;
}
.cr-row {
  display: flex; gap: 8px; align-items: center;
  padding: 4px 0;
}
.cr-input {
  flex: 1; height: 30px; padding: 0 8px;
  border: 1px solid var(--border-color); border-radius: 5px;
  background: var(--bg-primary); color: var(--text-primary);
  font-size: 12px; outline: none;
}
.cr-input:focus { border-color: var(--accent-color); }

.cr-rmrule {
  width: 24px; height: 24px; border: none; border-radius: 50%;
  background: transparent; color: var(--text-muted); font-size: 11px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cr-rmrule:hover { background: var(--hover-bg); color: var(--danger-color); }

.cr-addrule {
  height: 30px; margin: 4px 12px 8px;
  border: 1px dashed var(--border-color); border-radius: 5px;
  background: transparent; color: var(--accent-color); font-size: 11px;
  cursor: pointer; flex-shrink: 0;
}
.cr-addrule:hover { background: var(--hover-bg); }

.overlay-panel-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.overlay-panel-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.overlay-panel-enter-from,
.overlay-panel-leave-to { opacity: 0; transform: scale(0.96); }
</style>
