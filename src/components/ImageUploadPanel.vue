<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFileBase64 } from '../api/files'

const props = defineProps<{
  visible: boolean
  images: string[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [dataUrls: string[]]
}>()

const dataUrls = ref<string[]>([...props.images])
const loading = ref<boolean[]>([false, false, false])
const error = ref('')

// Sync when props change
import { watch } from 'vue'
watch(() => props.images, (imgs) => {
  dataUrls.value = [...imgs]
})

async function pickImage(index: number) {
  try {
    loading.value[index] = true
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
    dataUrls.value[index] = `data:${mime};base64,${b64}`
  } catch (e) {
    error.value = `图片读取失败: ${e}`
  } finally {
    loading.value[index] = false
  }
}

function handleConfirm() {
  emit('confirm', [...dataUrls.value])
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="iup-overlay" @click.self="handleClose">
        <div class="iup-panel">
          <div class="iup-header">
            <span class="iup-title">🖼 轮播图设置</span>
            <button class="iup-close" @click="handleClose">✕</button>
          </div>
          <p class="iup-desc">每张轮播图尺寸建议为 600×300 或同比例宽高</p>
          <div class="iup-slots">
            <div v-for="(_, idx) in 3" :key="idx" class="iup-slot">
              <div class="iup-slot-label">图片 {{ idx + 1 }}</div>
              <div class="iup-slot-preview" :class="{ 'has-image': dataUrls[idx] && !dataUrls[idx].includes('carousel') }">
                <img v-if="dataUrls[idx]" :src="dataUrls[idx]" class="iup-preview-img" />
                <div v-else class="iup-slot-placeholder">+</div>
              </div>
              <button class="iup-upload-btn" :disabled="loading[idx]" @click="pickImage(idx)">
                {{ loading[idx] ? '读取中...' : '选择图片' }}
              </button>
            </div>
          </div>
          <p v-if="error" class="iup-error">{{ error }}</p>
          <div class="iup-actions">
            <button class="iup-btn-cancel" @click="handleClose">取消</button>
            <button class="iup-btn-confirm" @click="handleConfirm">确认替换</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.iup-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.iup-panel {
  background: #fff;
  border-radius: 14px;
  width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  padding: 20px 24px;
}
.iup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.iup-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}
.iup-close {
  width: 26px; height: 26px;
  border: none; border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}
.iup-close:hover { background: #f1f5f9; color: #475569; }
.iup-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 16px;
}
.iup-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.iup-slot {
  display: flex;
  align-items: center;
  gap: 12px;
}
.iup-slot-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  min-width: 52px;
}
.iup-slot-preview {
  width: 90px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}
.iup-slot-preview.has-image {
  border-color: #4a7dd4;
}
.iup-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.iup-slot-placeholder {
  font-size: 20px;
  color: #cbd5e1;
}
.iup-upload-btn {
  padding: 5px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.iup-upload-btn:hover { border-color: #4a7dd4; color: #4a7dd4; }
.iup-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.iup-error {
  font-size: 12px;
  color: #ef4444;
  margin: 10px 0 0;
}
.iup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}
.iup-btn-cancel {
  padding: 6px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #fff;
  color: #64748b;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.iup-btn-cancel:hover { background: #f8fafc; }
.iup-btn-confirm {
  padding: 6px 16px;
  border: none;
  border-radius: 7px;
  background: #4a7dd4;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.iup-btn-confirm:hover { opacity: 0.9; }
.fade-enter-active { transition: opacity 0.15s; }
.fade-leave-active { transition: opacity 0.1s; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
