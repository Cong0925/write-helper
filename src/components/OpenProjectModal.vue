<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { openProject } from '../api'
import { appState } from '../store'

const emit = defineEmits<{ close: [] }>()

const projectPath = ref('')
const projectName = ref('')
const projectDescription = ref('')
const loading = ref(false)
const error = ref('')
const validated = ref(false)

async function selectProjectPath() {
  error.value = ''
  try {
    const folder = await open({ directory: true, multiple: false, title: '选择项目文件夹' })
    if (!folder) return

    projectPath.value = folder
    validated.value = false
    loading.value = true

    const project = await openProject(folder)
    projectName.value = project.name
    projectDescription.value = project.description || ''
    validated.value = true
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '无法打开项目'
    projectName.value = ''
    projectDescription.value = ''
    validated.value = false
  } finally {
    loading.value = false
  }
}

async function handleOpen() {
  if (!validated.value) return
  try {
    const project = await openProject(projectPath.value)
    appState.project = project
    appState.view = 'main'
    emit('close')
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '打开项目失败'
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">打开作品</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- 路径选择 -->
        <div class="form-section">
          <label class="section-label">项目目录</label>
          <div class="path-select-row">
            <input
              :value="projectPath"
              class="text-input"
              placeholder="选择写作助手项目文件夹"
              readonly
            />
            <button class="browse-btn" :disabled="loading" @click="selectProjectPath">
              {{ loading ? '验证中...' : '浏览' }}
            </button>
          </div>
          <p class="helper-text">选择包含 .writinghelper 目录的项目文件夹</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="error-msg">{{ error }}</div>

        <!-- Project Info Preview -->
        <div v-if="validated" class="preview-card">
          <div class="preview-icon">📁</div>
          <div class="preview-info">
            <h3 class="preview-name">{{ projectName }}</h3>
            <p v-if="projectDescription" class="preview-desc">{{ projectDescription }}</p>
            <p class="preview-path">{{ projectPath }}</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <span class="footer-hint">{{ validated ? '已检测到有效的项目文件' : '请选择项目文件夹' }}</span>
        <button class="btn-primary" :disabled="!validated" @click="handleOpen">
          打开作品
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
  max-height: 80vh;
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
  margin-bottom: 16px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.path-select-row {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
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

.browse-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.browse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.helper-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.error-msg {
  padding: 10px 14px;
  background: rgba(243, 139, 168, 0.15);
  color: #f38ba8;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.preview-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--bg-surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-top: 8px;
}

.preview-icon {
  font-size: 32px;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-path {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: auto;
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
