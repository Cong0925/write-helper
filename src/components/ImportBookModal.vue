<script setup lang="ts">
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { createImportProject, writeFile, readFile, readDocxText, createProjectV2 } from '../api'
import { appState } from '../store'

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const importStep = ref<'select' | 'chooseType' | 'preview' | 'importing'>('select')
const filePath = ref('')
const fileName = ref('')
const fileContent = ref('')
const projectName = ref('')
const error = ref('')
const importType = ref('')

interface ChapterInfo { header: string; content: string }
interface VolumeGroup { name: string; chapters: ChapterInfo[] }

const volumes = ref<VolumeGroup[]>([])
const totalChapters = computed(() => volumes.value.reduce((s, v) => s + v.chapters.length, 0))

// Article preview text (first 500 chars)
const articlePreview = computed(() => fileContent.value.slice(0, 500))

/* ── Smart Chapter/Volume Parsing ── */
const chineseNum = '零一二三四五六七八九十百千'

function parseChineseNumber(s: string): number {
  const map: Record<string, number> = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000 }
  let result = 0, unit = 1
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i]
    if (c === '十') { result += 10 * (result > 0 ? 0 : 1); unit = 1 }
    else if (c === '百') { result += 100 * (result > 0 ? 1 : 0); unit = 100 }
    else if (c === '千') { result += 1000 * (result > 0 ? 1 : 0); unit = 1000 }
    else if (map[c] !== undefined) { result += map[c] * unit; unit = 1 }
  }
  return result || 0
}

const chPattern = /^第([\d一二三四五六七八九十百千零]+)章(?:\s|$)/
const volPattern = /^第([\d一二三四五六七八九十百千零]+)卷(?:\s|$)/

function isStructuralHeader(line: string, nextLine: string, prevLine: string): boolean {
  const trimmed = line.trim()
  // Must be reasonably short (structural headers are not full sentences)
  if (trimmed.length > 50) return false

  const chMatch = trimmed.match(chPattern)
  const volMatch = trimmed.match(volPattern)

  if (!chMatch && !volMatch) return false

  // Key heuristic: if the line contains "第X章" or "第X卷" in the MIDDLE of text
  // (not at the very beginning), it's likely a mention
  const idx = trimmed.search(/(第[\d一二三四五六七八九十百千零]+[章卷])/)
  if (idx > 10) return false // mention embedded deep in text

  // If next non-empty line is also a chapter/volume header, this is structural
  const nextTrim = nextLine.trim()
  if (nextTrim.match(chPattern) || nextTrim.match(volPattern)) return true

  // If line itself contains narrative/commentary keywords, it's likely a mention, not structure
  const narrativeKw = ['完结', '即将', '伏笔', '期待', '开始', '请看', '记得', '之前', '回顾', '预告', '注意', '提示']
  const hasNarrative = narrativeKw.some(kw => trimmed.includes(kw))

  // But "第X卷 完结" with short overall length could still be structural (volume ending note)
  // Use line length to determine: if very short (< 25 chars), it's structural even with "完结"
  if (hasNarrative && trimmed.length > 25) return false

  return true
}

function parseContent(text: string, fname: string) {
  projectName.value = fname.replace(/\.(txt|md|docx)$/i, '')
  const isArticle = importType.value !== 'novel'

  // For article imports, don't parse — just store the content
  if (isArticle) {
    volumes.value = []
    return
  }

  const lines = text.split('\n')
  const vols: VolumeGroup[] = []
  let currentVol: VolumeGroup | null = null
  let currentHeader = ''
  let currentContent: string[] = []
  let inChapter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
    const prevLine = i > 0 ? lines[i - 1] : ''

    if (!isStructuralHeader(trimmed, nextLine, prevLine)) {
      if (inChapter && currentVol) {
        currentContent.push(line)
      }
      continue
    }

    // Is a volume header
    const volMatch = trimmed.match(volPattern)
    const chMatch = trimmed.match(chPattern)

    if (volMatch) {
      // Flush previous chapter
      if (currentHeader && inChapter && currentVol) {
        currentVol.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
        currentHeader = ''
        currentContent = []
      }
      // Skip if this looks like a mention (too many non-header words)
      if (trimmed.length > 35) {
        if (inChapter && currentVol) currentContent.push(line)
        continue
      }
      currentVol = { name: trimmed, chapters: [] }
      vols.push(currentVol)
      inChapter = false
      continue
    }

    if (chMatch) {
      // Flush previous chapter
      if (currentHeader && inChapter && currentVol) {
        currentVol.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
        currentContent = []
      }
      if (!currentVol) {
        currentVol = { name: '第一卷', chapters: [] }
        vols.push(currentVol)
      }
      // Skip if too long (likely a mention)
      if (trimmed.length > 50) {
        if (currentVol) currentContent.push(line)
        continue
      }
      currentHeader = trimmed
      inChapter = true
      continue
    }
  }

  // Flush last chapter
  if (currentHeader && inChapter && currentVol) {
    currentVol.chapters.push({ header: currentHeader, content: currentContent.join('\n') })
  }

  if (vols.length === 0) {
    vols.push({ name: '第一卷', chapters: [] })
  }

  // Remove empty volumes
  const filtered = vols.filter(v => v.chapters.length > 0)
  volumes.value = filtered.length > 0 ? filtered : [{ name: '第一卷', chapters: [] }]
}

/* ── File picking ── */
async function selectFile() {
  error.value = ''
  try {
    const selected = await open({
      multiple: false,
      title: '选择要导入的文件',
      filters: [{ name: '文本文件', extensions: ['txt', 'md', 'docx'] }],
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
    loading.value = false
    importStep.value = 'chooseType'
  } catch (e: any) {
    error.value = typeof e === 'string' ? e : e.message || '读取文件失败'
    loading.value = false
  }
}

function chooseType(type: string) {
  importType.value = type
  parseContent(fileContent.value, fileName.value)
  importStep.value = 'preview'
}

/* ── Import ── */
async function handleImport() {
  if (!projectName.value.trim()) {
    error.value = '请输入名称'
    return
  }
  importStep.value = 'importing'
  error.value = ''

  try {
    const { getConfig } = await import('../api')
    let saveDir = ''
    try { saveDir = await getConfig('defaultProjectDir') } catch {}
    if (!saveDir) {
      const parts = filePath.value.replace(/\\/g, '/').split('/')
      parts.pop()
      saveDir = parts.join('/')
    }
    const projectRoot = saveDir + '/' + projectName.value.trim()

    const isArticle = importType.value !== 'novel'

    if (isArticle) {
      await createProjectV2(projectRoot, projectName.value.trim(), '', '', importType.value, {})
      const contentRoot = importType.value === 'wechat_article' ? 'articles' : 'articles'
      const articlePath = projectRoot + '/' + contentRoot + '/' + projectName.value.trim() + '.md'
      await writeFile(articlePath, fileContent.value)
    } else {
      await createImportProject(projectRoot, projectName.value.trim())
      const volBase = projectRoot + '/分卷'

      for (const vol of volumes.value) {
        const { createDirectory } = await import('../api')
        const volDir = volBase + '/' + vol.name
        await createDirectory(volDir)

        for (let i = 0; i < vol.chapters.length; i++) {
          const ch = vol.chapters[i]
          const chapFileName = `第${i + 1}章.md`
          await writeFile(volDir + '/' + chapFileName,
            `# ${ch.header}\n\n${ch.content.trim()}\n`)
        }
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
  importType.value = ''
  error.value = ''
}

const typeOptions = [
  { id: 'novel', icon: '📖', label: '长篇小说', desc: '自动拆分卷章结构' },
  { id: 'wechat_article', icon: '💬', label: '公众号文章', desc: '整篇导入为单篇文章' },
  { id: 'toutiao_article', icon: '📰', label: '头条文章', desc: '整篇导入为单篇文章' },
]
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
            <p class="step-desc">支持 .txt / .md / .docx 格式。小说将自动拆分为卷章，文章将完整导入。</p>
            <button class="pick-btn" :disabled="loading" @click="selectFile">
              {{ loading ? '读取中...' : '选择文件' }}
            </button>
          </div>
        </template>

        <!-- Step: Choose type -->
        <template v-if="importStep === 'chooseType'">
          <div class="step-section">
            <div class="file-info">
              <span class="file-label">文件：</span>
              <span class="file-name">{{ fileName }}</span>
            </div>
            <p class="step-desc">请选择导入类型：</p>
            <div class="type-grid">
              <div
                v-for="t in typeOptions" :key="t.id"
                class="type-card" :class="{ selected: importType !== '' && importType === t.id }"
                @click="chooseType(t.id)"
              >
                <div class="type-icon">{{ t.icon }}</div>
                <div class="type-name">{{ t.label }}</div>
                <div class="type-desc">{{ t.desc }}</div>
              </div>
            </div>
          </div>
        </template>

        <!-- Step: Preview -->
        <template v-if="importStep === 'preview'">
          <div class="preview-section">
            <div class="file-info">
              <span class="file-label">文件：</span>
              <span class="file-name">{{ fileName }}</span>
              <span class="file-type-tag">{{ importType === 'novel' ? '小说' : '文章' }}</span>
            </div>

            <div class="form-row">
              <label class="form-label">名称</label>
              <input v-model="projectName" class="text-input" placeholder="输入名称" />
            </div>

            <!-- Novel preview -->
            <template v-if="importType === 'novel'">
              <div class="detect-info">
                识别出 <strong>{{ volumes.length }}</strong> 个分卷，共 <strong>{{ totalChapters }}</strong> 章
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

            <!-- Article preview -->
            <template v-else>
              <div class="detect-info">将完整导入为一篇文章</div>
              <div class="article-preview-box">{{ articlePreview }}{{ fileContent.length > 500 ? '...' : '' }}</div>
            </template>
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
        <span class="footer-hint" v-if="importStep === 'select'">自动识别章节结构</span>
        <span class="footer-hint" v-else-if="importStep === 'chooseType'">选择导入类型</span>
        <span class="footer-hint" v-else-if="importStep === 'preview'">确认无误后点击导入</span>
        <div class="footer-actions">
          <button v-if="importStep === 'chooseType' || importStep === 'preview'" class="btn-secondary" :disabled="loading" @click="resetSelection">重新选择</button>
          <button v-if="importStep === 'preview'" class="btn-primary" :disabled="loading" @click="handleImport">导入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-card {
  width: 560px; max-height: 85vh; background: var(--bg-primary);
  border: 1px solid var(--border-color); border-radius: 16px;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 0; }
.modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.close-btn {
  background: none; border: none; color: var(--text-muted); font-size: 18px;
  cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.close-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }

.step-section { text-align: center; padding: 16px 0; }
.step-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; }

.pick-btn {
  padding: 12px 36px; background: var(--accent-color); color: #1e1e2e; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.pick-btn:hover:not(:disabled) { opacity: 0.9; }
.pick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.file-info {
  font-size: 12px; color: var(--text-muted); padding: 8px 10px;
  background: var(--bg-surface); border-radius: 6px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 8px;
}
.file-label { color: var(--text-secondary); }
.file-name { color: var(--text-primary); font-weight: 500; flex: 1; }
.file-type-tag {
  font-size: 10px; padding: 1px 8px; border-radius: 8px;
  background: var(--accent-light); color: var(--accent-color); font-weight: 600;
}

/* Type selection */
.type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.type-card {
  padding: 16px 12px; border: 2px solid var(--border-color); border-radius: 12px;
  cursor: pointer; text-align: center; transition: all 0.15s;
}
.type-card:hover { border-color: var(--accent-color); background: var(--accent-light); }
.type-card.selected { border-color: var(--accent-color); background: var(--accent-light); }
.type-icon { font-size: 28px; margin-bottom: 8px; }
.type-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.type-desc { font-size: 11px; color: var(--text-muted); }

/* Preview */
.preview-section { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.text-input {
  padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-color);
  border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none;
}
.text-input:focus { border-color: var(--accent-color); }
.detect-info {
  font-size: 12px; color: var(--text-secondary); padding: 6px 10px;
  background: var(--bg-surface); border-radius: 6px;
}
.detect-info strong { color: var(--accent-color); }
.vol-chapter-list {
  max-height: 260px; overflow-y: auto; border: 1px solid var(--border-color);
  border-radius: 8px; padding: 8px; background: var(--bg-surface);
}
.vol-group { margin-bottom: 8px; }
.vol-group:last-child { margin-bottom: 0; }
.vol-title {
  font-size: 13px; font-weight: 600; color: var(--accent-color);
  padding: 4px 4px 4px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 4px;
}
.chapter-item { display: flex; align-items: center; gap: 6px; padding: 3px 4px; font-size: 12px; }
.ch-num { color: var(--text-muted); min-width: 24px; text-align: right; flex-shrink: 0; }
.ch-header { color: var(--text-primary); font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.ch-preview { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

.article-preview-box {
  max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border-color);
  border-radius: 8px; background: var(--bg-surface); font-size: 13px;
  color: var(--text-secondary); line-height: 1.7; white-space: pre-wrap;
}

/* Importing */
.importing-section { text-align: center; padding: 40px 0; }
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--border-color);
  border-top-color: var(--accent-color); border-radius: 50%;
  animation: spin 0.7s linear infinite; margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.importing-section p { font-size: 14px; color: var(--text-secondary); }
.error-msg {
  padding: 10px 14px; background: rgba(243, 139, 168, 0.15);
  color: #f38ba8; border-radius: 8px; font-size: 13px;
}
.modal-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-top: 1px solid var(--border-color);
}
.footer-hint { font-size: 12px; color: var(--text-muted); }
.footer-actions { display: flex; gap: 8px; }
.btn-secondary {
  padding: 10px 20px; background: var(--bg-surface); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;
  cursor: pointer; transition: background 0.15s;
}
.btn-secondary:hover:not(:disabled) { background: var(--hover-bg); }
.btn-primary {
  padding: 10px 28px; background: var(--accent-color); color: #1e1e2e;
  border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
