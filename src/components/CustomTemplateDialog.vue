<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  initialHtml?: string
  initialName?: string
}>()

const emit = defineEmits<{
  save: [name: string, html: string]
  close: []
}>()

const templateName = ref('')
const templateHtml = ref('')
const previewKey = ref(0)

watch(() => props.visible, (v) => {
  if (v) {
    templateName.value = props.initialName || ''
    templateHtml.value = props.initialHtml || ''
    previewKey.value++
  }
})

function onSave() {
  const name = templateName.value.trim()
  const html = templateHtml.value.trim()
  if (!name) return
  if (!html) return
  emit('save', name, html)
  emit('close')
}

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('ctd-overlay')) {
    emit('close')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="ctd-overlay"
        @click="onBackdropClick"
        @keydown="handleKeydown"
        tabindex="-1"
      >
        <div class="ctd-dialog">
          <div class="ctd-header">
            <span class="ctd-title">自定义模板</span>
            <button class="ctd-close" @click="$emit('close')">✕</button>
          </div>

          <div class="ctd-body">
            <!-- Name input -->
            <div class="ctd-name-row">
              <input
                v-model="templateName"
                class="ctd-name-input"
                placeholder="模板名称（如：我的自定义卡片）"
              />
            </div>

            <!-- Split: preview top, editor bottom -->
            <div class="ctd-split">
              <div class="ctd-preview-area">
                <div class="ctd-section-label">预览</div>
                <div class="ctd-preview" :key="previewKey">
                  <div v-if="!templateHtml.trim()" class="ctd-preview-empty">在此处输入 HTML 代码以预览效果</div>
                  <div v-else v-html="templateHtml" class="ctd-preview-content"></div>
                </div>
              </div>
              <div class="ctd-editor-area">
                <div class="ctd-section-label">HTML 代码</div>
                <textarea
                  v-model="templateHtml"
                  class="ctd-editor"
                  spellcheck="false"
                  placeholder="粘贴或编写 HTML 代码..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="ctd-footer">
            <button class="ctd-btn ctd-btn-cancel" @click="$emit('close')">取消</button>
            <button
              class="ctd-btn ctd-btn-save"
              :disabled="!templateName.trim() || !templateHtml.trim()"
              @click="onSave"
            >保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctd-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctd-dialog {
  width: 680px;
  height: 580px;
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ctd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  flex-shrink: 0;
}

.ctd-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #333);
}

.ctd-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ctd-close:hover { background: var(--hover-bg, #f0f0f0); color: var(--text-primary, #333); }

.ctd-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 18px;
  gap: 10px;
  overflow: hidden;
}

.ctd-name-row {
  flex-shrink: 0;
}

.ctd-name-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.ctd-name-input:focus { border-color: var(--accent-color, #4a7dd4); }

.ctd-split {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.ctd-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.ctd-preview-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ctd-preview {
  flex: 1;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 6px;
  padding: 14px;
  overflow-y: auto;
  background: #fff;
  min-height: 100px;
}

.ctd-preview-empty {
  color: var(--text-muted, #ccc);
  font-size: 13px;
  text-align: center;
  padding: 40px 0;
}

.ctd-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.ctd-editor-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ctd-editor {
  flex: 1;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary, #333);
  background: var(--bg-secondary, #f8f8f8);
  resize: none;
  outline: none;
  tab-size: 2;
}
.ctd-editor:focus { border-color: var(--accent-color, #4a7dd4); }

.ctd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color, #e8e8e8);
  flex-shrink: 0;
}

.ctd-btn {
  padding: 7px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: all 0.12s;
}

.ctd-btn-cancel {
  background: transparent;
  color: var(--text-secondary, #888);
  border: 1px solid var(--border-color, #e8e8e8);
}
.ctd-btn-cancel:hover { background: var(--hover-bg, #f0f0f0); }

.ctd-btn-save {
  background: var(--accent-color, #4a7dd4);
  color: #fff;
}
.ctd-btn-save:hover { opacity: 0.88; }
.ctd-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

/* Transition */
.fade-enter-active { transition: opacity 0.15s; }
.fade-leave-active { transition: opacity 0.1s; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
