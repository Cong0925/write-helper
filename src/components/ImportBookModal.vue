<script setup lang="ts">
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { createImportProject, writeFile, readFile, readDocxText } from '../api'
import { appState } from '../store'

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const importStep = ref<'select' | 'preview' | 'importing'>('select')
const filePath = ref('')
const fileName = ref('')
const fileContent = ref('')
const projectName = ref('')
const error = ref('')

interface ChapterInfo {
  header: string
  content: string
}

interface VolumeGroup {
  name: string
  chapters: ChapterInfo[]
}

const volumes = ref<VolumeGroup[]>([])
const totalChapters = computed(() => volumes.value.reduce((s, v) => s + v.chapters.length, 0))

/* ---- Chapter parsing ---- */
const chapterRegex = /^(第[\d一二三四五六七八九十百千零]+章)/
const volRegex = /^(第[\d一二三四五六七八九十百千零]+卷)/

function parseContent(text: string, fname: string) {
  projectName.value = fname.replace(/\.(txt|md|docx)$/i, '')

  const lines = text.split('\n')
  const vols: VolumeGroup[] = []
  let currentVol: VolumeGroup | null = null
  let currentHeader = ''
  let currentContent: string[] = []
  let inChapter = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for volume header
    const volMatch = trimmed.match(volRegex)
    if (volMatch) {
      // Flush previous chapter
      if (currentHeader && inChapter) {
        currentVol!.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
        currentHeader = ''
        currentContent = []
      }
      currentVol = { name: trimmed, chapters: [] }
      vols.push(currentVol)
      inChapter = false
      continue
    }

    // Check for chapter header
    const chMatch = trimmed.match(chapterRegex)
    if (chMatch) {
      if (currentHeader && inChapter && currentVol) {
        currentVol.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
        currentContent = []
      }
      // If no volume yet, create default one
      if (!currentVol) {
        currentVol = { name: '第一卷', chapters: [] }
        vols.push(currentVol)
      }
      currentHeader = trimmed
      inChapter = true
      continue
    }

    if (inChapter && currentVol) {
      currentContent.push(line)
    }
  }

  // Push last chapter
  if (currentHeader && inChapter && currentVol) {
    currentVol.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
  }

  // If no volume at all, create a default one
  if (vols.length === 0) {
    vols.push({ name: '第一卷', chapters: [] })
  }

  volumes.value = vols
}

/* ---- File picking ---- */
async function selectFile() {
  error.value = ''
  try {
    const selected = await open({
      multiple: false,
      title: '选择要导入的作品文件',
      filters: [{
        name: '作品文件',
        extensions: ['txt', 'md', 'docx'],
      }],
    })
    if (!selected) return

    filePath.value = selected
    const parts = selected.replace(/\\/g, '/').split('/')
    fileName.value = parts[parts.length - 1]
    loading.value = true

    let text = ''
    const ext = fileName.value.split('.').pop()?.toLowerCase()
    if (ext === 'docx') {
      text = await readDocxText(selected)
    } else {
      text = await readFile(selected)
    }

    if (!text.trim()) {
      error.value = '文件内容为空'
      loading.value = false
      return
    }

    fileContent.value = text
    parseContent(text, fileName.value)
    importStep.value = 'preview'
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '读取文件失败'
  } finally {
    loading.value = false
  }
}

/* ---- Import ---- */
async function handleImport() {
  if (!projectName.value.trim()) {
    error.value = '请输入作品名称'
    return
  }
  importStep.value = 'importing'
  error.value = ''

  try {
    const { getConfig } = await import('../api')
    let saveDir = ''
    try {
      saveDir = await getConfig('defaultProjectDir')
    } catch { /* ignore */ }
    if (!saveDir) {
      const parts = filePath.value.replace(/\\/g, '/').split('/')
      parts.pop()
      saveDir = parts.join('/')
    }
    const projectRoot = saveDir + '/' + projectName.value.trim()

    await createImportProject(projectRoot, projectName.value.trim())

    const { createDirectory } = await import('../api')
    const volBase = projectRoot + '/分卷'

    // Write each volume's chapters
    for (const vol of volumes.value) {
      const volDir = volBase + '/' + vol.name
      await createDirectory(volDir)

      for (let i = 0; i < vol.chapters.length; i++) {
        const ch = vol.chapters[i]
        const chapFileName = `第${i + 1}章.md`
        await writeFile(volDir + '/' + chapFileName,
          `# ${ch.header}\n\n${ch.content.trim()}\n`)
      }
    }

    const { openProject } = await import('../api')
    const info = await openProject(projectRoot)
    appState.project = info
    appState.view = 'main'
    emit('close')
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '导入失败'
    importStep.value = 'preview'
  }
}

function resetSelection() {
  importStep.value = 'select'
  filePath.value = ''
  fileName.value = ''
  fileContent.value = ''
  volumes.value = []
  error.value = ''
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">导入项目</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Step: Select file -->
        <template v-if="importStep === 'select'">
          <div class="step-section">
            <p class="step-desc">选择小说文件（支持 .txt、.md、.docx 格式），系统将自动识别章节并拆分导入到新项目中。</p>
            <button class="pick-btn" :disabled="loading" @click="selectFile">
              {{ loading ? '读取中...' : '选择文件' }}
            </button>
          </div>
        </template>

        <!-- Step: Preview -->
        <template v-if="importStep === 'preview'">
          <div class="preview-section">
            <div class="file-info">
              <span class="file-label">文件：</span>
              <span class="file-name">{{ fileName }}</span>
            </div>

            <div class="form-row">
              <label class="form-label">作品名称</label>
              <input v-model="projectName" class="text-input" placeholder="输入作品名称" />
            </div>

            <div class="detect-info">
              检测到 <strong>{{ volumes.length }}</strong> 个分卷，共 <strong>{{ totalChapters }}</strong> 章
            </div>

          </div>

            <div class="vol-chapter-list">
              <div v-for="(vol, vi) in volumes" :key="vi" class="vol-group">
                <div class="vol-title">{{ vol.name }}</div>
                <div v-for="(ch, ci) in vol.chapters" :key="ci" class="chapter-item">
                  <span class="ch-num">{{ ci + 1 }}.</span>
                  <span class="ch-header">{{ ch.header }}</span>
                  <span class="ch-preview">{{ ch.content.slice(0, 40).replace(/\n/g, ' ') }}{{ ch.content.length > 40 ? '...' : '' }}</span>
                </div>
              </div>
            </div>
        </template>

        <!-- Step: Importing -->
        <template v-if="importStep === 'importing'">
          <div class="importing-section">
            <div class="spinner"></div>
            <p>正在导入并创建项目...</p>
          </div>
        </template>

        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="modal-footer">
        <span class="footer-hint" v-if="importStep === 'select'">将自动创建标准项目结构</span>
        <span class="footer-hint" v-else-if="importStep === 'preview'">确认无误后点击导入</span>
        <div class="footer-actions">
          <button v-if="importStep === 'preview'" class="btn-secondary" :disabled="loading" @click="resetSelection">重新选择</button>
          <button v-if="importStep === 'preview'" class="btn-primary" :disabled="loading" @click="handleImport">导入</button>
        </div>
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
  width: 560px;
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
.modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.close-btn {
  background: none; border: none; color: var(--text-muted); font-size: 18px;
  cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.close-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }
.step-section { text-align: center; padding: 32px 0; }
.step-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; }
.pick-btn {
  padding: 12px 36px; background: var(--accent-color); color: #1e1e2e; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.pick-btn:hover:not(:disabled) { opacity: 0.9; }
.pick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Preview */
.preview-section { display: flex; flex-direction: column; gap: 12px; }
.file-info { font-size: 12px; color: var(--text-muted); padding: 8px 10px; background: var(--bg-surface); border-radius: 6px; }
.file-label { color: var(--text-secondary); }
.file-name { color: var(--text-primary); font-weight: 500; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.text-input {
  padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-color);
  border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 0.15s;
}
.text-input:focus { border-color: var(--accent-color); }
.detect-info { font-size: 12px; color: var(--text-secondary); padding: 6px 10px; background: var(--bg-surface); border-radius: 6px; }
.detect-info strong { color: var(--accent-color); }
.vol-chapter-list { max-height: 260px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; background: var(--bg-surface); }
.vol-group { margin-bottom: 8px; }
.vol-group:last-child { margin-bottom: 0; }
.vol-title { font-size: 13px; font-weight: 600; color: var(--accent-color); padding: 4px 4px 4px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 4px; }
.chapter-item { display: flex; align-items: center; gap: 6px; padding: 3px 4px; font-size: 12px; }
.ch-num { color: var(--text-muted); min-width: 24px; text-align: right; flex-shrink: 0; }
.ch-header { color: var(--text-primary); font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.ch-preview { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

/* Importing */
.importing-section { text-align: center; padding: 40px 0; }
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--border-color);
  border-top-color: var(--accent-color); border-radius: 50%;
  animation: spin 0.7s linear infinite; margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.importing-section p { font-size: 14px; color: var(--text-secondary); }
.error-msg { padding: 10px 14px; background: rgba(243, 139, 168, 0.15); color: #f38ba8; border-radius: 8px; font-size: 13px; }
.modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-top: 1px solid var(--border-color); }
.footer-hint { font-size: 12px; color: var(--text-muted); }
.footer-actions { display: flex; gap: 8px; }
.btn-secondary { padding: 10px 20px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; cursor: pointer; transition: background 0.15s; }
.btn-secondary:hover:not(:disabled) { background: var(--hover-bg); }
.btn-primary { padding: 10px 28px; background: var(--accent-color); color: #1e1e2e; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
