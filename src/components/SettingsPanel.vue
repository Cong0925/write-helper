<script setup lang="ts">
import { ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { appState } from '../store'
import { getConfig, setConfig, getAutoStart, setAutoStart } from '../api'

const emit = defineEmits<{
  close: []
}>()

// Nav items
const navItems = [
  { id: 'file-location', label: '文件位置', icon: '📂' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨' },
  { id: 'other', label: '其他', icon: '⚙' },
]

const activeNav = ref('file-location')
const scrollRef = ref<HTMLElement | null>(null)
const defaultDir = ref('')
const autoStartEnabled = ref(false)

// If settingsSection was pre-set (e.g. by Ctrl+0), scroll to that section
watch(() => appState.settingsSection, (section) => {
  if (section && scrollRef.value) {
    nextTick(() => {
      const el = scrollRef.value?.querySelector(`[data-section="${section}"]`)
      if (el) {
        el.scrollIntoView({ block: 'start' })
        activeNav.value = section
      }
      appState.settingsSection = ''
    })
  }
})

// Shortcut completion flags
const shortcutDone: Record<string, boolean> = {
  'new-chapter': true,      // Ctrl+N
  'fullscreen': true,       // Ctrl+.
  'format': false,          // Ctrl+K — not yet implemented
  'separator': true,        // Ctrl+Alt+S
  'chapter-start': true,    // Ctrl+↑
  'chapter-end': true,      // Ctrl+↓
  'boss-key': false,        // Alt+` — not yet implemented
  'view-shortcuts': true,   // Ctrl+0
  'outline': false,         // Ctrl+1 — not yet implemented
  'settings-panel': false,  // Ctrl+2 — not yet implemented
  'find-replace': true,     // Ctrl+F
  'save': true,             // Ctrl+S
}

// Load config
onMounted(async () => {
  try {
    defaultDir.value = await getConfig('defaultProjectDir')
  } catch { /* ignore */ }
  try {
    autoStartEnabled.value = await getAutoStart()
  } catch { /* ignore */ }
  try {
    const val = await getConfig('autoSave')
    if (val === 'false') appState.autoSave = false
  } catch { /* ignore */ }
  await nextTick()
  setupObserver()
})

// IntersectionObserver: right scroll → left nav highlight
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (!scrollRef.value) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section')
          if (id) activeNav.value = id
        }
      }
    },
    { root: scrollRef.value, threshold: 0.35 }
  )
  scrollRef.value.querySelectorAll('[data-section]').forEach((el) => {
    observer?.observe(el)
  })
}

onUnmounted(() => observer?.disconnect())

// Left nav click → right scroll
function scrollToSection(id: string) {
  activeNav.value = id
  const el = scrollRef.value?.querySelector(`[data-section="${id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Browse directory
async function browseDefaultDir() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const dir = await open({ directory: true, multiple: false })
    if (dir) {
      defaultDir.value = dir
      await setConfig('defaultProjectDir', dir)
    }
  } catch {}
}

async function saveDefaultDir() {
  try {
    await setConfig('defaultProjectDir', defaultDir.value)
  } catch {}
}

function doClose() {
  emit('close')
}

async function toggleAutoStart() {
  try {
    await setAutoStart(autoStartEnabled.value)
  } catch {
    autoStartEnabled.value = !autoStartEnabled.value
    alert('设置开机自启失败')
  }
}

async function toggleAutoSave() {
  try {
    await setConfig('autoSave', appState.autoSave ? 'true' : 'false')
  } catch { /* ignore */ }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="appState.showSettings" class="settings-overlay" @click.self="doClose">
        <div class="settings-panel">
          <!-- Header -->
          <div class="settings-header">
            <span class="settings-header-icon">⚙</span>
            <span class="settings-title">设置</span>
            <button class="settings-close-btn" @click="doClose" title="关闭">✕</button>
          </div>

          <div class="settings-body">
            <!-- Left: fixed nav -->
            <nav class="settings-nav">
              <div
                v-for="item in navItems"
                :key="item.id"
                class="nav-item"
                :class="{ active: activeNav === item.id }"
                @click="scrollToSection(item.id)"
              >
                <span class="nav-icon">{{ item.icon }}</span>
                <span class="nav-label">{{ item.label }}</span>
              </div>
            </nav>

            <!-- Right: scrollable content -->
            <div class="settings-content" ref="scrollRef">
              <!-- 文件位置 -->
              <section class="setting-section" data-section="file-location">
                <h3 class="section-title">默认项目目录</h3>
                <div class="form-group">
                  <label class="form-label">根目录路径</label>
                  <div class="input-row">
                    <input
                      v-model="defaultDir"
                      class="form-input"
                      placeholder="选择或输入默认项目保存路径"
                      @change="saveDefaultDir"
                    />
                    <button class="browse-btn" @click="browseDefaultDir">选择目录</button>
                  </div>
                  <p class="form-hint">新建项目时将自动填入此路径作为默认位置</p>
                </div>
              </section>

              <!-- 快捷键 -->
              <section class="setting-section" data-section="shortcuts">
                <h3 class="section-title">快捷键一览</h3>
                <div class="shortcuts-grid">
                  <div class="shortcut-row header-row">
                    <span class="sc-func">功能</span>
                    <span class="sc-key">快捷键</span>
                    <span class="sc-func">功能</span>
                    <span class="sc-key">快捷键</span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">新建章节 <span v-if="shortcutDone['new-chapter']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
                    <span class="sc-func">全屏 <span v-if="shortcutDone['fullscreen']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>.</kbd></span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">一键排版 <span v-if="shortcutDone['format']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
                    <span class="sc-func">插入分隔线 <span v-if="shortcutDone['separator']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd></span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">定位章首 <span v-if="shortcutDone['chapter-start']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>↑</kbd></span>
                    <span class="sc-func">定位章尾 <span v-if="shortcutDone['chapter-end']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>↓</kbd></span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">老板键 <span v-if="shortcutDone['boss-key']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Alt</kbd> + <kbd>`</kbd></span>
                    <span class="sc-func">查看快捷键 <span v-if="shortcutDone['view-shortcuts']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>0</kbd></span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">大纲 <span v-if="shortcutDone['outline']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>1</kbd></span>
                    <span class="sc-func">设定 <span v-if="shortcutDone['settings-panel']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>2</kbd></span>
                  </div>
                  <div class="shortcut-row">
                    <span class="sc-func">查找替换 <span v-if="shortcutDone['find-replace']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>F</kbd></span>
                    <span class="sc-func">保存章节 <span v-if="shortcutDone['save']" class="sc-done">✓</span></span>
                    <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
                  </div>
                </div>
              </section>

              <!-- 其他 -->
              <section class="setting-section" data-section="other">
                <h3 class="section-title">其他设置</h3>
                <div class="form-group">
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <label class="form-label">自动保存</label>
                      <p class="form-hint">编辑时自动保存内容到文件（关闭后需手动 Ctrl+S 保存）</p>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="appState.autoSave" @change="toggleAutoSave" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
                <div class="form-group">
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <label class="form-label">开机自启动</label>
                      <p class="form-hint">系统启动时自动运行写作助手</p>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="autoStartEnabled" @change="toggleAutoStart" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 99997;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-panel {
  width: 700px;
  height: 520px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.settings-header-icon { font-size: 18px; margin-right: 10px; }

.settings-title {
  flex: 1;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.settings-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.settings-close-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

/* Body: left nav + right content */
.settings-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* Left nav */
.settings-nav {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin: 0 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.12s;
  user-select: none;
}
.nav-item:hover { background: var(--hover-bg); color: var(--text-primary); }
.nav-item.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; opacity: 0.8; }
.nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Right scrollable content */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.setting-section {
  margin-bottom: 40px;
}

.setting-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus { border-color: var(--accent-color); }
.form-input::placeholder { color: var(--text-muted); }
.form-input:disabled { opacity: 0.5; cursor: not-allowed; }

.browse-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  background: var(--accent-light);
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
  white-space: nowrap;
}
.browse-btn:hover { background: var(--accent-color); color: #fff; }

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* ===== Shortcuts Grid ===== */
.shortcuts-grid {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.shortcut-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  gap: 12px;
}
.shortcut-row:last-child { border-bottom: none; }
.shortcut-row.header-row {
  background: var(--hover-bg);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 12px;
}

.sc-func { color: var(--text-primary); }
.sc-done {
  color: var(--success-color);
  font-weight: 700;
  font-size: 13px;
  margin-left: 2px;
}
.sc-key {
  color: var(--text-secondary);
  font-family: inherit;
  white-space: nowrap;
}

/* Distribute: func | key | func | key across the row */
.shortcut-row > :nth-child(1) { flex: 1; }
.shortcut-row > :nth-child(2) { flex: 0 0 auto; min-width: 120px; }
.shortcut-row > :nth-child(3) { flex: 1; }
.shortcut-row > :nth-child(4) { flex: 0 0 auto; min-width: 120px; }

.shortcut-row kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 12px;
  font-family: 'Segoe UI', 'SF Pro', sans-serif;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  white-space: nowrap;
  line-height: 1.4;
}

/* ===== Toggle Switch ===== */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
}

.toggle-info {
  flex: 1;
}
.toggle-info .form-label { margin-bottom: 2px; }
.toggle-info .form-hint { margin-top: 2px; }

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}
.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border-color);
  border-radius: 12px;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  left: 2px;
  bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider {
  background: var(--accent-color);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* Transition */
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }
</style>
