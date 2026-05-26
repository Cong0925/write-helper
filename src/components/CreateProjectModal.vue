<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { createProject, getConfig, setConfig } from '../api'
import { appState } from '../store'

const emit = defineEmits<{ close: [] }>()

const name = ref('')
const description = ref('')
const savePath = ref('')
const loading = ref(false)
const error = ref('')
const nameCharCount = computed(() => name.value.length)
const descCharCount = computed(() => description.value.length)
const hasDefaultDir = ref(false)
const showSaveDefault = ref(false)
const saveAsDefault = ref(true)

onMounted(async () => {
  try {
    const dir = await getConfig('defaultProjectDir')
    if (dir) {
      savePath.value = dir
      hasDefaultDir.value = true
    }
  } catch { /* ignore */ }
})

async function selectSavePath() {
  try {
    const folder = await open({ directory: true, multiple: false, title: '选择项目保存位置' })
    if (folder) {
      savePath.value = folder
      if (!hasDefaultDir.value) {
        showSaveDefault.value = true
      }
    }
  } catch {}
}

async function handleCreate() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = '请输入作品名称'
    return
  }
  if (!savePath.value) {
    error.value = '请选择项目保存路径'
    return
  }

  // Save as default if user opted in
  if (saveAsDefault.value) {
    try {
      await setConfig('defaultProjectDir', savePath.value)
    } catch { /* ignore */ }
  }

  loading.value = true
  try {
    const project = await createProject(
      savePath.value + '/' + name.value.trim(),
      name.value.trim(),
      description.value,
    )
    appState.project = project
    appState.view = 'main'
    emit('close')
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '创建项目失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">新建作品</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- 作品名称 -->
        <div class="form-section">
          <label class="section-label">作品名称</label>
          <div class="input-with-count">
            <input
              v-model="name"
              type="text"
              class="text-input"
              placeholder="输入作品名称"
              maxlength="50"
            />
            <span class="char-count">{{ nameCharCount }}/50</span>
          </div>
          <p class="helper-text">名称将作为文件夹名</p>
        </div>

        <!-- 作品简介 -->
        <div class="form-section">
          <label class="section-label">作品简介</label>
          <div class="textarea-with-count">
            <textarea
              v-model="description"
              class="text-area"
              placeholder="输入作品简介（可选）"
              rows="4"
              maxlength="500"
            ></textarea>
            <span class="char-count-bottom">{{ descCharCount }}/500</span>
          </div>
          <p class="helper-text">简要介绍你的作品</p>
        </div>

        <!-- 保存路径 -->
        <div class="form-section">
          <label class="section-label">保存路径(将当前目录作为后续默认目录，可在设置中修改)</label>
          <div class="path-select-row">
            <input
              :value="savePath"
              class="text-input path-input"
              placeholder="选择项目保存位置"
              readonly
            />
            <button class="browse-btn" @click="selectSavePath">选择文件夹</button>
          </div>
          <label v-if="showSaveDefault" class="default-checkbox">
            <input type="checkbox" v-model="saveAsDefault" />
            <span>将当前目录设为后续默认保存位置</span>
          </label>
        </div>

        <!-- Error -->
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <span class="footer-hint">将在选择的位置创建以作品名称命名的文件夹</span>
        <button class="btn-primary" :disabled="loading || !name.trim() || !savePath" @click="handleCreate">
          {{ loading ? '创建中...' : '创建项目' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  width: 500px;
  max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.form-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.input-with-count {
  position: relative;
}

.text-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.text-input:focus {
  border-color: var(--accent-color);
}

.char-count {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--text-muted);
}

.textarea-with-count {
  position: relative;
}

.text-area {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.6;
  transition: border-color 0.15s;
}

.text-area:focus {
  border-color: var(--accent-color);
}

.char-count-bottom {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-size: 11px;
  color: var(--text-muted);
}

.helper-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.path-select-row {
  display: flex;
  gap: 8px;
}

.path-input {
  flex: 1;
  cursor: pointer;
  color: var(--text-secondary);
}

.default-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;
}
.default-checkbox input {
  accent-color: var(--accent-color);
  width: 15px;
  height: 15px;
  cursor: pointer;
}
.default-checkbox:hover {
  color: var(--text-primary);
}

.browse-btn {
  padding: 8px 20px;
  background: var(--accent-color);
  color: #1e1e2e;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.browse-btn:hover {
  opacity: 0.9;
}

.error-msg {
  padding: 10px 14px;
  background: rgba(243, 139, 168, 0.15);
  color: #f38ba8;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 8px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.footer-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-primary {
  padding: 10px 28px;
  background: var(--accent-color);
  color: #1e1e2e;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
