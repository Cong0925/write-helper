<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { readFile } from '../api'
import type { FileEntry } from '../store'

const props = defineProps<{
  show: boolean
  volumeEntries: FileEntry[]
}>()

const emit = defineEmits<{
  close: []
  export: [filePaths: string[], format: string]
}>()

// Selection state
const selectedPaths = ref<Set<string>>(new Set())
const exportFormat = ref('md')
const previewContent = ref('')
const previewLoading = ref(false)

// Build flat ordered list of all files (chapters)
interface FlatFile {
  path: string
  name: string
  volName: string
  volPath: string
}

const allFiles = computed<FlatFile[]>(() => {
  const result: FlatFile[] = []
  for (const vol of props.volumeEntries) {
    if (!vol.isDir) continue
    const volName = vol.name
    const children = vol.children || []
    for (const ch of children) {
      if (ch.isDir) continue
      result.push({
        path: ch.path,
        name: ch.name,
        volName,
        volPath: vol.path,
      })
    }
  }
  return result
})

// Volumes that have chapters
const volumesWithChapters = computed(() => {
  return props.volumeEntries.filter(v => v.isDir && v.children && v.children.length > 0)
})

const selectedFiles = computed<FlatFile[]>(() => {
  return allFiles.value.filter(f => selectedPaths.value.has(f.path))
})

const allSelected = computed(() => {
  return allFiles.value.length > 0 && allFiles.value.every(f => selectedPaths.value.has(f.path))
})

function toggleAll() {
  if (allSelected.value) {
    selectedPaths.value = new Set()
  } else {
    selectedPaths.value = new Set(allFiles.value.map(f => f.path))
  }
}

function isVolumeAllSelected(volPath: string): boolean {
  const files = allFiles.value.filter(f => f.volPath === volPath)
  return files.length > 0 && files.every(f => selectedPaths.value.has(f.path))
}

function isVolumePartiallySelected(volPath: string): boolean {
  const files = allFiles.value.filter(f => f.volPath === volPath)
  const selected = files.filter(f => selectedPaths.value.has(f.path))
  return selected.length > 0 && selected.length < files.length
}

function toggleVolume(volPath: string) {
  const files = allFiles.value.filter(f => f.volPath === volPath)
  const allSel = files.every(f => selectedPaths.value.has(f.path))
  const next = new Set(selectedPaths.value)
  for (const f of files) {
    if (allSel) next.delete(f.path)
    else next.add(f.path)
  }
  selectedPaths.value = next
}

function toggleFile(filePath: string) {
  const next = new Set(selectedPaths.value)
  if (next.has(filePath)) next.delete(filePath)
  else next.add(filePath)
  selectedPaths.value = next
}

// Load preview content when selection changes
let previewTimer: ReturnType<typeof setTimeout> | null = null

watch([selectedPaths, () => props.show], async () => {
  if (previewTimer) clearTimeout(previewTimer)
  if (!props.show) return
  previewTimer = setTimeout(() => loadPreview(), 200)
})

async function loadPreview() {
  const files = selectedFiles.value
  if (files.length === 0) {
    previewContent.value = ''
    return
  }
  previewLoading.value = true
  try {
    const parts: string[] = []
    let lastVol = ''
    for (const f of files) {
      try {
        const content = await readFile(f.path)
        const title = f.name.replace(/\.md$/, '')
        // Match the Rust export format
        if (f.volName !== lastVol) {
          if (parts.length > 0) parts.push('\n')
          parts.push(`${f.volName}\n\n`)
          lastVol = f.volName
        }
        parts.push(`${title}\n`)
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (trimmed.startsWith('# ')) {
            parts.push(`${trimmed.slice(2)}\n`)
          } else if (trimmed) {
            parts.push(`${line}\n`)
          }
        }
        parts.push('\n')
      } catch {
        parts.push(`${f.name}\n(读取失败)\n\n`)
      }
    }
    previewContent.value = parts.join('')
  } catch {
    previewContent.value = '加载预览失败'
  } finally {
    previewLoading.value = false
  }
}

async function doExport() {
  const files = selectedFiles.value
  if (files.length === 0) return
  emit('export', files.map(f => f.path), exportFormat.value)
}

function doClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="show" class="export-overlay" @click.self="doClose">
        <div class="export-panel">
          <!-- Header -->
          <div class="export-header">
            <span class="export-header-icon">📦</span>
            <span class="export-title">批量导出</span>
            <button class="export-close-btn" @click="doClose" title="关闭">✕</button>
          </div>

          <div class="export-body">
            <!-- Left: tree -->
            <div class="export-left">
              <div class="tree-title">选择章节</div>
              <div class="tree-scroll">
                <!-- Select all -->
                <label class="tree-node all-node" :class="{ checked: allSelected }">
                  <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                  <span class="node-label">全部章节</span>
                  <span class="node-count">({{ allFiles.length }})</span>
                </label>

                <!-- Volumes -->
                <template v-for="vol in volumesWithChapters" :key="vol.path">
                  <label
                    class="tree-node vol-node"
                    :class="{
                      checked: isVolumeAllSelected(vol.path),
                      partial: isVolumePartiallySelected(vol.path),
                    }"
                  >
                    <input
                      type="checkbox"
                      :checked="isVolumeAllSelected(vol.path)"
                      :indeterminate="isVolumePartiallySelected(vol.path)"
                      @change="toggleVolume(vol.path)"
                    />
                    <span class="node-icon">📁</span>
                    <span class="node-label">{{ vol.name }}</span>
                    <span class="node-count">({{ (vol.children || []).filter(c => !c.isDir).length }})</span>
                  </label>

                  <div class="vol-children">
                    <label
                      v-for="ch in (vol.children || []).filter(c => !c.isDir)"
                      :key="ch.path"
                      class="tree-node file-node"
                      :class="{ checked: selectedPaths.has(ch.path) }"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedPaths.has(ch.path)"
                        @change="toggleFile(ch.path)"
                      />
                      <span class="node-icon">📄</span>
                      <span class="node-label">{{ ch.name.replace(/\.md$/, '') }}</span>
                    </label>
                  </div>
                </template>

                <div v-if="allFiles.length === 0" class="tree-empty">暂无章节</div>
              </div>
            </div>

            <!-- Right: preview -->
            <div class="export-right">
              <div class="preview-header">
                <span class="preview-title">合并预览</span>
                <span v-if="selectedFiles.length > 0" class="preview-count">
                  已选 {{ selectedFiles.length }} 章
                </span>
                <span v-else class="preview-count muted">未选择章节</span>
              </div>
              <div class="preview-scroll">
                <div v-if="previewLoading" class="preview-loading">加载中...</div>
                <pre v-else-if="previewContent" class="preview-content">{{ previewContent }}</pre>
                <div v-else class="preview-empty">
                  <span>请在左侧选择需要导出的章节</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="export-footer">
            <div class="footer-left">
              <label class="fmt-label">导出格式：</label>
              <select v-model="exportFormat" class="fmt-select">
                <option value="md">Markdown (.md)</option>
                <option value="txt">纯文本 (.txt)</option>
                <option value="html">HTML (.html)</option>
              </select>
            </div>
            <div class="footer-actions">
              <button class="panel-btn" @click="doClose">取消</button>
              <button
                class="panel-btn primary"
                :disabled="selectedFiles.length === 0"
                @click="doExport"
              >
                📥 导出
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  z-index: 99998;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-panel {
  width: 85vw;
  height: 80vh;
  max-width: 1100px;
  max-height: 800px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.export-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
}

.export-header-icon { font-size: 20px; margin-right: 10px; }

.export-title {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #222);
}

.export-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.export-close-btn:hover { background: var(--hover-bg, #f0f0f0); color: var(--text-primary, #222); }

/* Body */
.export-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.export-left {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
}

.tree-title {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
}

.tree-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary, #222);
  transition: background 0.1s;
  user-select: none;
}
.tree-node:hover { background: var(--hover-bg, #f5f5f5); }

.tree-node input[type="checkbox"] {
  accent-color: var(--accent-color, #4a90d9);
  width: 15px;
  height: 15px;
  cursor: pointer;
  flex-shrink: 0;
}

.tree-node .node-icon { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }

.tree-node .node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tree-node .node-count {
  font-size: 11px;
  color: var(--text-muted, #999);
  flex-shrink: 0;
}

.tree-node.all-node { font-weight: 600; }
.tree-node.vol-node { padding-left: 28px; font-weight: 500; }
.tree-node.vol-node.partial { background: var(--accent-light, #e8f0fe); }

.vol-children { padding-left: 0; }
.tree-node.file-node { padding-left: 52px; }

.tree-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #999);
}

/* Right panel */
.export-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
  gap: 12px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #666);
}

.preview-count {
  font-size: 12px;
  color: var(--accent-color, #4a90d9);
  font-weight: 500;
}
.preview-count.muted { color: var(--text-muted, #999); }

.preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: var(--bg-secondary, #fafafa);
}

.preview-content {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Noto Sans SC', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary, #222);
}

.preview-loading {
  text-align: center;
  padding: 40px;
  color: var(--text-muted, #999);
  font-size: 14px;
}

.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted, #999);
  font-size: 14px;
}

/* Footer */
.export-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fmt-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.fmt-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
}
.fmt-select:focus { border-color: var(--accent-color, #4a90d9); }

.footer-actions {
  display: flex;
  gap: 10px;
}

.panel-btn {
  padding: 8px 20px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.panel-btn:hover { background: var(--hover-bg, #f0f0f0); }

.panel-btn.primary {
  background: var(--accent-color, #4a90d9);
  color: #fff;
  border-color: var(--accent-color, #4a90d9);
}
.panel-btn.primary:hover { opacity: 0.9; }
.panel-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Transition */
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }
</style>
