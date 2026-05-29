<script setup lang="ts">
import { ref, watch } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFileBase64 } from '../api/files'

const props = defineProps<{
  visible: boolean
  currentSrc?: string
}>()

const emit = defineEmits<{
  confirm: [src: string]
  close: []
}>()

const previewSrc = ref('')
const loading = ref(false)
const error = ref('')

watch(() => props.visible, (v) => {
  if (v) {
    previewSrc.value = props.currentSrc || ''
    error.value = ''
  }
})

async function pickImage() {
  try {
    loading.value = true
    error.value = ''
    const selected = await open({
      multiple: false,
      filters: [{
        name: '图片',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
      }]
    })
    if (!selected) return

    const path = selected as string
    const ext = path.split('.').pop()?.toLowerCase() || 'png'
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      bmp: 'image/bmp'
    }
    const mime = mimeMap[ext] || 'image/png'
    const b64 = await readFileBase64(path)
    previewSrc.value = `data:${mime};base64,${b64}`
  } catch (e) {
    error.value = `图片读取失败: ${e}`
  } finally {
    loading.value = false
  }
}

function handleConfirm() {
  if (previewSrc.value) {
    emit('confirm', previewSrc.value)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="irp-fade">
      <div v-if="visible" class="irp-overlay" @click.self="handleClose">
        <div class="irp-panel">
          <div class="irp-header">
            <span class="irp-title">{{ currentSrc ? '替换图片' : '插入图片' }}</span>
            <button class="irp-close" @click="handleClose">✕</button>
          </div>

          <div class="irp-body">
            <!-- Current image preview -->
            <div class="irp-section">
              <div class="irp-label">{{ currentSrc ? '当前图片' : '预览' }}</div>
              <div class="irp-preview-wrap" :class="{ 'has-image': previewSrc }">
                <img v-if="previewSrc" :src="previewSrc" class="irp-preview-img" />
                <div v-else class="irp-placeholder">
                  <span class="irp-placeholder-icon">🖼</span>
                  <span class="irp-placeholder-text">请选择图片</span>
                </div>
              </div>
            </div>

            <!-- Image path -->
            <div v-if="previewSrc" class="irp-section">
              <div class="irp-label">图片路径</div>
              <div class="irp-path">{{ previewSrc.length > 80 ? previewSrc.slice(0, 80) + '...' : previewSrc }}</div>
            </div>

            <!-- Upload button -->
            <div class="irp-section">
              <button class="irp-upload-btn" :disabled="loading" @click="pickImage">
                {{ loading ? '读取中...' : (previewSrc ? '重新选择' : '选择图片') }}
              </button>
            </div>

            <p v-if="error" class="irp-error">{{ error }}</p>
          </div>

          <div class="irp-actions">
            <button class="irp-btn-cancel" @click="handleClose">取消</button>
            <button class="irp-btn-confirm" :disabled="!previewSrc" @click="handleConfirm">
              {{ currentSrc ? '确认替换' : '确认插入' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.irp-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.irp-panel {
  background: var(--bg-secondary);
  border-radius: 14px;
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
}
.irp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 0;
  margin-bottom: 16px;
}
.irp-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.irp-close {
  width: 26px; height: 26px;
  border: none; border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
}
.irp-close:hover { background: var(--hover-bg); color: var(--text-primary); }

.irp-body {
  padding: 0 24px;
}

.irp-section {
  margin-bottom: 16px;
}

.irp-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.irp-preview-wrap {
  width: 100%;
  height: 180px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}
.irp-preview-wrap.has-image {
  border-color: var(--accent-color);
}
.irp-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.irp-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
.irp-placeholder-icon {
  font-size: 32px;
  opacity: 0.4;
}
.irp-placeholder-text {
  font-size: 13px;
}

.irp-path {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
  padding: 8px 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  font-family: monospace;
  line-height: 1.5;
}

.irp-upload-btn {
  width: 100%;
  padding: 10px 0;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
}
.irp-upload-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background: var(--accent-light); }
.irp-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.irp-error {
  font-size: 12px;
  color: var(--danger-color);
  margin: 0 0 12px;
}

.irp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}
.irp-btn-cancel {
  padding: 7px 18px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.irp-btn-cancel:hover { background: var(--hover-bg); }

.irp-btn-confirm {
  padding: 7px 18px;
  border: none;
  border-radius: 7px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.irp-btn-confirm:hover { opacity: 0.9; }
.irp-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

.irp-fade-enter-active { transition: opacity 0.15s; }
.irp-fade-leave-active { transition: opacity 0.1s; }
.irp-fade-enter-from,
.irp-fade-leave-to { opacity: 0; }
</style>
