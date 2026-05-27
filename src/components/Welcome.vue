<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { appState } from '../store'
import { openProject, getRecentProjects, removeRecentProject, renameProjectConfig, openInExplorer, deleteProjectFolder } from '../api'
import type { ProjectInfo } from '../store'
import CreateProjectModal from './CreateProjectModal.vue'
import OpenProjectModal from './OpenProjectModal.vue'
import ImportBookModal from './ImportBookModal.vue'

const recentProjects = ref<ProjectInfo[]>([])
const selectedTab = ref('all')

const filteredProjects = computed(() => {
  if (selectedTab.value === 'all') return recentProjects.value
  return recentProjects.value.filter(p => (p.projectType || 'novel') === selectedTab.value)
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = { all: recentProjects.value.length }
  for (const p of recentProjects.value) {
    const t = p.projectType || 'novel'
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
})

const typeTabs = computed(() => [
  { id: 'all', icon: '📋', label: '全部', count: typeCounts.value.all },
  { id: 'novel', icon: '📖', label: '小说', count: typeCounts.value.novel || 0 },
  { id: 'wechat_article', icon: '💬', label: '公众号', count: typeCounts.value.wechat_article || 0 },
  { id: 'toutiao_article', icon: '📰', label: '头条', count: typeCounts.value.toutiao_article || 0 },
])

const showCreateModal = ref(false)
const showOpenModal = ref(false)
const showImportModal = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const renamingProject = ref<string | null>(null)
const renameInput = ref('')

/* ---- Delete confirmation ---- */
const deleteTarget = ref<ProjectInfo | null>(null)

function confirmDelete(project: ProjectInfo, e: MouseEvent) {
  e.stopPropagation()
  deleteTarget.value = project
}

async function doDelete() {
  const project = deleteTarget.value
  if (!project) return
  deleteTarget.value = null
  try {
    await deleteProjectFolder(project.path)
    await removeRecentProject(project.path)
    recentProjects.value = recentProjects.value.filter(p => p.path !== project.path)
  } catch {}
}

function cancelDelete() {
  deleteTarget.value = null
}

onMounted(async () => {
  await loadProjects()
})

async function loadProjects() {
  refreshing.value = true
  try {
    recentProjects.value = await getRecentProjects()
  } catch {}
  refreshing.value = false
}

async function handleOpenRecent(project: ProjectInfo) {
  loading.value = true
  try {
    const info = await openProject(project.path)
    appState.project = info
    appState.view = 'main'
  } catch {
    recentProjects.value = recentProjects.value.filter(p => p.path !== project.path)
  } finally {
    loading.value = false
  }
}

function startRename(project: ProjectInfo, e: MouseEvent) {
  e.stopPropagation()
  renamingProject.value = project.path
  renameInput.value = project.name
}

async function confirmRename(project: ProjectInfo) {
  if (!renameInput.value.trim()) { renamingProject.value = null; return }
  const newName = renameInput.value.trim()
  if (newName === project.name) { renamingProject.value = null; return }
  try {
    await renameProjectConfig(project.path, newName)
    project.name = newName
  } catch {}
  renamingProject.value = null
}

async function handleOpenInExplorer(project: ProjectInfo, e: MouseEvent) {
  e.stopPropagation()
  try {
    await openInExplorer(project.path)
  } catch (e: any) {
    console.error('打开文件位置失败:', e)
  }
}
</script>

<template>
  <div class="welcome">
    <!-- Left panel: actions -->
    <div class="welcome-left">
      <div class="logo">
        <div class="logo-icon">✍</div>
        <h1>写作助手</h1>
        <p class="subtitle">离线多类型内容创作与管理平台</p>
      </div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="loading" @click="showCreateModal = true">
          新建项目
        </button>
        <button class="btn btn-secondary" :disabled="loading" @click="showOpenModal = true">
          打开已有项目
        </button>
        <div class="actions-sep"></div>
        <button class="btn btn-accent" :disabled="loading" @click="showImportModal = true">
          导入项目
        </button>
        <p class="import-hint">导入小说文件，自动识别章节并拆分</p>
      </div>
    </div>

    <!-- Right panel: project list -->
    <div class="welcome-right">
      <div class="right-header">
        <h2 class="project-list-title">我的项目</h2>
        <button class="refresh-btn" :disabled="refreshing" @click="loadProjects" title="刷新列表">↻</button>
        <div class="right-header-spacer"></div>
        <button class="settings-btn" title="设置" @click="appState.showSettings = true">⚙</button>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          v-for="tab in typeTabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: selectedTab === tab.id }"
          @click="selectedTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="filteredProjects.length === 0 && !refreshing" class="empty-projects">
        <span class="empty-icon">📚</span>
        <p>还没有项目，点击左侧新建或打开</p>
      </div>

      <!-- Loading -->
      <div v-if="refreshing" class="empty-projects">
        <p class="loading-text">刷新中...</p>
      </div>

      <div v-else-if="filteredProjects.length > 0" class="project-list">
        <div
          v-for="project in filteredProjects"
          :key="project.path"
          class="project-row"
          @click="handleOpenRecent(project)"
        >
          <template v-if="renamingProject === project.path">
            <input
              v-model="renameInput"
              class="proj-rename-input"
              @click.stop
              @keyup.enter="confirmRename(project)"
              @blur="confirmRename(project)"
              autofocus
            />
          </template>
          <template v-else>
            <div class="project-info">
              <span class="project-name">{{ project.name }}</span>
              <span class="project-path">{{ project.path }}</span>
            </div>
          </template>
          <div class="project-actions">
            <button class="proj-act" title="打开文件位置" @click.stop="handleOpenInExplorer(project, $event)">📂</button>
            <button class="proj-act" title="重命名" @click.stop="startRename(project, $event)">✎</button>
            <button class="proj-act danger" title="删除项目" @click.stop="confirmDelete(project, $event)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="cancelDelete">
      <div class="confirm-dialog">
        <div class="confirm-icon">⚠️</div>
        <h3 class="confirm-title">确认删除</h3>
        <p class="confirm-text">
          确定要永久删除项目「<strong>{{ deleteTarget.name }}</strong>」吗？
        </p>
        <p class="confirm-desc">此操作将删除项目文件夹及其所有内容，不可恢复。</p>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="cancelDelete">取消</button>
          <button class="btn-delete" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <CreateProjectModal v-if="showCreateModal" @close="showCreateModal = false" />
    <OpenProjectModal v-if="showOpenModal" @close="showOpenModal = false" />
    <ImportBookModal v-if="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<style scoped>
.welcome {
  height: 100vh;
  display: flex;
  background: var(--bg-primary);
}

/* ===== Left panel ===== */
.welcome-left {
  width: 360px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  border-right: 1px solid var(--border-color);
}

.logo {
  text-align: center;
  margin-bottom: 36px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 14px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 260px;
}

.actions-sep {
  height: 1px;
  background: var(--border-color);
  margin: 6px 0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color);
  color: #1e1e2e;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover-bg);
}

.btn-accent {
  background: var(--accent-color);
  color: #1e1e2e;
  opacity: 0.85;
  font-weight: 600;
}

.btn-accent:hover:not(:disabled) {
  opacity: 1;
}

.import-hint {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-top: -4px;
}

/* ===== Right panel ===== */
.welcome-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
  min-width: 0;
}

.right-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.project-list-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.refresh-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.right-header-spacer {
  flex: 1;
}

.settings-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}
.settings-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.empty-projects {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.loading-text {
  font-size: 14px;
  color: var(--text-muted);
}

.project-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.tab-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.tab-btn.active {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}

.tab-icon { font-size: 13px; }

.tab-count {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 0 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}
.tab-btn:not(.active) .tab-count {
  background: var(--bg-surface);
}

.project-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 10px 28px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
}

.project-row:hover {
  background: var(--hover-bg);
}

.project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.project-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.project-path {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s;
}

.project-row:hover .project-actions {
  opacity: 1;
}

.proj-act {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.proj-act:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.proj-act.danger:hover {
  color: var(--danger-color);
  background: rgba(231, 76, 60, 0.08);
}

.proj-rename-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

/* Delete confirmation dialog */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.confirm-dialog {
  width: 380px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 28px 24px 20px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.confirm-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.confirm-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.5;
}

.confirm-text strong {
  color: var(--text-primary);
}

.confirm-desc {
  font-size: 12px;
  color: var(--danger-color);
  margin-bottom: 20px;
  line-height: 1.4;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-cancel {
  padding: 10px 24px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
}

.btn-cancel:hover {
  background: var(--hover-bg);
}

.btn-delete {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--danger-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s;
}

.btn-delete:hover {
  opacity: 0.9;
}
</style>
