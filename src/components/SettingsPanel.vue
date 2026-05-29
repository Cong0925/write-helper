<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { appState } from '../store'
import { getConfig, setConfig, getAutoStart, setAutoStart } from '../api'
import { getAIProviders, getKeyStatuses, getSavedKeys, saveAIKey, deleteAIKey, testAIConnection } from '../api/ai'
import type { ProviderInfo, SavedKeyInfo } from '../api/ai'
import { dialog } from '../composables/useDialog'

const emit = defineEmits<{
  close: []
}>()

// Nav items
const navItems = [
  { id: 'file-location', label: '文件位置', icon: '📂' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨' },
  { id: 'ai-models', label: 'AI 模型', icon: '🤖' },
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
  'boss-key': true,         // Alt+` — 已实现
  'view-shortcuts': true,   // Ctrl+0
  'outline': true,          // Ctrl+1 — 已实现
  'settings-panel': true,   // Ctrl+2 — 已实现
  'find-replace': true,     // Ctrl+F
  'save': true,             // Ctrl+S
}

const isWelcome = computed(() => !appState.project)
const isNovel = computed(() => appState.project?.projectType === 'novel')
const isArticle = computed(() => {
  const pt = appState.project?.projectType || ''
  return pt === 'wechat_article' || pt === 'toutiao_article'
})

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
  loadAIProviders()
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

// ─── AI Settings ────────────────────────────────────────

interface ModelSlot {
  id: number
  providerId: string
  keyInput: string
  modelInput: string
  endpointInput: string
  testing: boolean
  testResult: { ok: boolean; msg: string } | null
}

const allProviders = ref<ProviderInfo[]>([])
const keyStatuses = ref<Record<string, boolean>>({})
const activeSlotId = ref(0)
const slots = ref<ModelSlot[]>([createSlot(0)])
let nextId = 1

function createSlot(id: number): ModelSlot {
  return { id, providerId: 'deepseek', keyInput: '', modelInput: '', endpointInput: '', testing: false, testResult: null }
}

function getProvider(slot: ModelSlot): ProviderInfo | null {
  return allProviders.value.find(p => p.id === slot.providerId) || null
}

const providerGroups = computed(() => {
  const cats = [
    { label: '国际厂商', providers: [] as ProviderInfo[] },
    { label: '国内厂商', providers: [] as ProviderInfo[] },
    { label: '本地 / 自部署', providers: [] as ProviderInfo[] },
  ]
  for (const p of allProviders.value) {
    if (p.category === 'international') cats[0].providers.push(p)
    else if (p.category === 'domestic') cats[1].providers.push(p)
    else cats[2].providers.push(p)
  }
  return cats.filter(g => g.providers.length > 0)
})

async function loadAIProviders() {
  try {
    allProviders.value = await getAIProviders()
    const statuses = await getKeyStatuses()
    keyStatuses.value = statuses

    // Rebuild slots from saved configs (skip entries without an actual key)
    const savedKeys = await getSavedKeys()
    const validKeys = savedKeys.filter(sk => sk.hasKey)
    if (validKeys.length > 0) {
      slots.value = validKeys.map((sk, i) => {
        const slot = createSlot(i)
        slot.providerId = sk.providerId
        slot.keyInput = sk.apiKey || ''
        slot.endpointInput = sk.endpoint || (allProviders.value.find(p => p.id === sk.providerId)?.defaultEndpoint || '')
        slot.modelInput = sk.defaultModel || (allProviders.value.find(p => p.id === sk.providerId)?.models[0]?.id || '')
        return slot
      })
      nextId = validKeys.length

      // Restore active slot
      const activeProvider = await getConfig('activeAiProvider')
      if (activeProvider) {
        const idx = slots.value.findIndex(s => s.providerId === activeProvider)
        if (idx >= 0) activeSlotId.value = slots.value[idx].id
      }
    } else {
      slots.value = [createSlot(0)]
      nextId = 1
      initSlot(slots.value[0])
    }
  } catch { /* ignore */ }
}

function initSlot(slot: ModelSlot) {
  slot.testResult = null
  const p = allProviders.value.find(x => x.id === slot.providerId)
  if (p) {
    slot.endpointInput = p.defaultEndpoint
    slot.modelInput = p.models[0]?.id || ''
  }
}

function onSlotProviderChange(slot: ModelSlot) {
  initSlot(slot)
}

function addSlot() {
  const id = nextId++
  const slot = createSlot(id)
  initSlot(slot)
  slots.value.push(slot)
}

function removeSlot(slot: ModelSlot) {
  if (slots.value.length <= 1) return
  slots.value = slots.value.filter(s => s.id !== slot.id)
  if (activeSlotId.value === slot.id) {
    activeSlotId.value = slots.value[0].id
  }
  // Also remove from backend if a config was saved
  if (keyStatuses.value[slot.providerId]) {
    deleteAIKey(slot.providerId).catch(() => {})
    keyStatuses.value[slot.providerId] = false
  }
}

function applySlot(slot: ModelSlot) {
  if (!keyStatuses.value[slot.providerId]) return
  activeSlotId.value = slot.id
  try { setConfig('activeAiProvider', slot.providerId) } catch {}
  try { setConfig('activeAiModel', slot.modelInput) } catch {}
}

async function saveSlot(slot: ModelSlot) {
  const p = getProvider(slot)
  if (p?.requiresApiKey && !slot.keyInput) {
    if (keyStatuses.value[slot.providerId]) {
      await dialog.alert('请输入新的 API Key 以覆盖现有密钥，或点击「清除」移除密钥')
    } else {
      await dialog.alert('请先填写 API Key')
    }
    return
  }
  try {
    await saveAIKey(slot.providerId, slot.keyInput, slot.endpointInput, slot.modelInput)
    keyStatuses.value[slot.providerId] = true
    slot.testResult = null
  } catch (e: any) {
    await dialog.alert('保存失败: ' + (e?.message || e))
  }
}

async function clearSlot(slot: ModelSlot) {
  const pid = slot.providerId
  if (!keyStatuses.value[pid]) return
  const ok = await dialog.confirm('确定要清除此模型配置吗？')
  if (!ok) return
  try {
    await deleteAIKey(pid)
    keyStatuses.value[pid] = false
    slot.keyInput = ''
    slot.testResult = null
  } catch (e: any) {
    await dialog.alert('清除失败: ' + (e?.message || e))
  }
}

async function testSlot(slot: ModelSlot) {
  const p = allProviders.value.find(x => x.id === slot.providerId)
  if (!p) return
  if (p.requiresApiKey && !slot.keyInput) {
    if (keyStatuses.value[slot.providerId]) {
      await dialog.alert('密钥已保存但未回显，请重新输入后测试')
    } else {
      await dialog.alert('请先填写 API Key')
    }
    return
  }
  const endpoint = slot.endpointInput || p.defaultEndpoint
  slot.testing = true
  try {
    const resp = await testAIConnection(slot.providerId, slot.keyInput, endpoint)
    slot.testResult = { ok: true, msg: '连接成功！响应: ' + resp }
  } catch (e: any) {
    slot.testResult = { ok: false, msg: '连接失败: ' + (e?.message || e) }
  } finally {
    slot.testing = false
  }
}

function doClose() {
  emit('close')
}

async function toggleAutoStart() {
  try {
    await setAutoStart(autoStartEnabled.value)
  } catch {
    autoStartEnabled.value = !autoStartEnabled.value
    await dialog.alert('设置开机自启失败')
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

                  <!-- Welcome: only basics -->
                  <template v-if="isWelcome">
                    <div class="shortcut-row">
                      <span class="sc-func">全屏 <span class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>.</kbd></span>
                      <span class="sc-func">老板键 <span class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Alt</kbd> + <kbd>`</kbd></span>
                    </div>
                    <div class="shortcut-row">
                      <span class="sc-func">查看快捷键 <span class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>0</kbd></span>
                      <span class="sc-func"></span>
                      <span class="sc-key"></span>
                    </div>
                  </template>

                  <!-- In project: context-appropriate -->
                  <template v-else>
                    <div class="shortcut-row">
                      <span class="sc-func">新建章节 <span v-if="shortcutDone['new-chapter']" class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
                      <span class="sc-func">全屏 <span v-if="shortcutDone['fullscreen']" class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>.</kbd></span>
                    </div>
                    <div class="shortcut-row" v-if="!isArticle">
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
                    <div class="shortcut-row" v-if="isNovel">
                      <span class="sc-func">老板键 <span v-if="shortcutDone['boss-key']" class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Alt</kbd> + <kbd>`</kbd></span>
                      <span class="sc-func">查看快捷键 <span v-if="shortcutDone['view-shortcuts']" class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>0</kbd></span>
                    </div>
                    <div class="shortcut-row" v-else>
                      <span class="sc-func">查看快捷键 <span v-if="shortcutDone['view-shortcuts']" class="sc-done">✓</span></span>
                      <span class="sc-key"><kbd>Ctrl</kbd> + <kbd>0</kbd></span>
                      <span class="sc-func"></span>
                      <span class="sc-key"></span>
                    </div>
                    <div class="shortcut-row" v-if="isNovel">
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
                  </template>
                </div>
              </section>

              <!-- AI 模型 -->
              <section class="setting-section" data-section="ai-models">
                <h3 class="section-title">AI 模型配置</h3>

                <div v-if="allProviders.length === 0" class="empty-providers">加载中...</div>

                <template v-else>
                  <div v-for="slot in slots" :key="slot.id" class="model-slot">
                    <div class="form-group">
                      <label class="form-label">服务商</label>
                      <select v-model="slot.providerId" class="form-input" @change="onSlotProviderChange(slot)">
                        <optgroup v-for="g in providerGroups" :key="g.label" :label="g.label">
                          <option v-for="p in g.providers" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </optgroup>
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label">模型版本</label>
                      <select v-model="slot.modelInput" class="form-input">
                        <option v-for="m in (getProvider(slot)?.models || [])" :key="m.id" :value="m.id">{{ m.name }} — {{ m.description }}</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label">API Key</label>
                      <input
                        v-model="slot.keyInput"
                        type="text"
                        class="form-input"
                        :placeholder="getProvider(slot)?.requiresSecretKey ? '格式: APIKey|SecretKey' : '粘贴 API Key'"
                      />
                    </div>

                    <div class="slot-actions">
                      <button class="btn-test" :disabled="slot.testing" @click="testSlot(slot)">
                        {{ slot.testing ? '测试中...' : '测试连接' }}
                      </button>
                      <div class="actions-right">
                        <button
                          v-if="keyStatuses[slot.providerId]"
                          class="btn-apply"
                          :class="{ active: activeSlotId === slot.id }"
                          @click="applySlot(slot)"
                        >{{ activeSlotId === slot.id ? '已应用' : '应用' }}</button>
                        <button v-if="keyStatuses[slot.providerId]" class="btn-clear" @click="clearSlot(slot)">清除</button>
                        <button v-else-if="slots.length > 1" class="btn-remove" @click="removeSlot(slot)">移除</button>
                        <button class="btn-save" @click="saveSlot(slot)">保存</button>
                      </div>
                    </div>

                    <div v-if="slot.testResult" class="test-result" :class="{ ok: slot.testResult.ok, fail: !slot.testResult.ok }">
                      {{ slot.testResult.msg }}
                    </div>
                  </div>

                  <button class="btn-add-slot" @click="addSlot">+ 添加更多模型服务</button>
                </template>
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

/* ===== AI Model Slots ===== */
.empty-providers {
  text-align: center;
  color: var(--text-muted);
  padding: 16px 0;
  font-size: 13px;
}

.model-slot {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 10px;
}

.model-slot .form-group {
  margin-bottom: 14px;
}

.model-slot .form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.model-slot .form-input:focus { border-color: var(--accent-color); }
.model-slot .form-input::placeholder { color: var(--text-muted); }

.slot-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.actions-right {
  display: flex;
  gap: 6px;
}

.btn-test, .btn-save, .btn-clear, .btn-apply, .btn-remove {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}

.btn-test {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.btn-test:hover:not(:disabled) { background: var(--accent-light); color: var(--accent-color); border-color: var(--accent-color); }
.btn-test:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-save {
  background: var(--accent-color);
  color: #1e1e2e;
  border-color: var(--accent-color);
  font-weight: 500;
}
.btn-save:hover { opacity: 0.85; }

.btn-clear {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
}
.btn-clear:hover { background: var(--hover-bg); color: var(--text-primary); }

.btn-apply {
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border-color);
}
.btn-apply:hover { background: var(--accent-light); color: var(--accent-color); border-color: var(--accent-color); }
.btn-apply.active {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
  font-weight: 600;
}

.btn-remove {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
}
.btn-remove:hover { background: var(--hover-bg); color: var(--danger-color); }

.btn-add-slot {
  width: 100%;
  padding: 10px 0;
  margin-top: 6px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.btn-add-slot:hover { border-color: var(--accent-color); color: var(--accent-color); background: var(--accent-light); }

.test-result {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.test-result.ok {
  background: rgba(39, 174, 96, 0.1);
  color: var(--success-color);
  border: 1px solid rgba(39, 174, 96, 0.2);
}

.test-result.fail {
  background: rgba(231, 76, 60, 0.08);
  color: var(--danger-color);
  border: 1px solid rgba(231, 76, 60, 0.15);
}

/* Transition */
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }
</style>
