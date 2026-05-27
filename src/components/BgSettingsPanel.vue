<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { appState, lightSkins, darkSkins, getSkinColorById } from '../store'
import { getConfig, setConfig } from '../api'

const gridStyles = [
  { id: 'none',   label: '无',     icon: '▢' },
  { id: 'dots',   label: '点阵',   icon: '⋯' },
  { id: 'dashed', label: '横虚线',  icon: '┅' },
  { id: 'lines',  label: '横线',   icon: '≡' },
]

const currentSkins = computed(() => appState.theme === 'dark' ? darkSkins : lightSkins)
const currentSkinId = computed(() => appState.theme === 'dark' ? appState.darkSkin : appState.lightSkin)

function toggleDarkMode() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark'
  scheduleSave()
}

function selectSkin(id: string) {
  if (appState.theme === 'dark') {
    appState.darkSkin = id
  } else {
    appState.lightSkin = id
  }
  scheduleSave()
}

function selectGrid(id: string) {
  appState.gridStyle = id
  scheduleSave()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSettings, 500)
}

async function saveSettings() {
  const data = JSON.stringify({
    theme: appState.theme,
    lightSkin: appState.lightSkin,
    darkSkin: appState.darkSkin,
    gridStyle: appState.gridStyle,
  })
  try {
    await setConfig('bgSettings', data)
  } catch { /* ignore */ }
}

function doClose() {
  appState.showBgSettings = false
}

onMounted(async () => {
  try {
    const raw = await getConfig('bgSettings')
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.theme) appState.theme = saved.theme
      if (saved.lightSkin) appState.lightSkin = saved.lightSkin
      if (saved.darkSkin) appState.darkSkin = saved.darkSkin
      if (saved.gridStyle) appState.gridStyle = saved.gridStyle
    }
  } catch { /* ignore */ }
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="appState.showBgSettings" class="bg-settings-overlay" @click.self="doClose">
        <div class="bg-settings-panel">
          <!-- Dark mode toggle -->
          <div class="section">
            <div class="toggle-row">
              <span class="toggle-label">深色模式</span>
              <label class="toggle-switch">
                <input type="checkbox" :checked="appState.theme === 'dark'" @change="toggleDarkMode" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="section-divider"></div>

          <!-- Skin selection (dynamic: light/dark based on theme) -->
          <div class="section">
            <h3 class="section-title">{{ appState.theme === 'dark' ? '深色皮肤' : '浅色皮肤' }}</h3>

            <!-- Recommended banner -->
            <div class="banner-card" :style="{ background: getSkinColorById(appState.theme, currentSkinId).bg, borderColor: getSkinColorById(appState.theme, currentSkinId).border }">
              <div class="banner-surface" :style="{ background: getSkinColorById(appState.theme, currentSkinId).surface }"></div>
              <div class="banner-text">
                <span class="banner-label">{{ currentSkins.find(s => s.id === currentSkinId)?.label || '' }}</span>
                <span class="banner-desc">{{ currentSkins.find(s => s.id === currentSkinId)?.desc || '' }}</span>
              </div>
            </div>

            <!-- Skin grid -->
            <div class="skin-grid" :class="{ 'grid-3': appState.theme === 'dark' }">
              <div
                v-for="skin in currentSkins"
                :key="skin.id"
                class="skin-card"
                :class="{ active: currentSkinId === skin.id }"
                @click="selectSkin(skin.id)"
              >
                <div class="skin-preview" :style="{ background: getSkinColorById(appState.theme, skin.id).bg }">
                  <div class="skin-preview-surface" :style="{ background: getSkinColorById(appState.theme, skin.id).surface }"></div>
                </div>
                <span class="skin-label">{{ skin.label }}</span>
              </div>
            </div>
          </div>

          <!-- Grid line section -->
          <div class="section">
            <h3 class="section-title">网格线</h3>
            <div class="grid-line-row">
              <div
                v-for="gs in gridStyles"
                :key="gs.id"
                class="grid-option"
                :class="{ active: appState.gridStyle === gs.id }"
                @click="selectGrid(gs.id)"
              >
                <div class="grid-preview">{{ gs.icon }}</div>
                <span class="grid-label">{{ gs.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bg-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 99996;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.bg-settings-panel {
  width: 520px;
  max-height: 80vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.18);
  overflow-y: auto;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Section */
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.section-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0;
}

/* Toggle row */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Banner card */
.banner-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 16px;
  min-height: 80px;
}

.banner-surface {
  width: 60px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.banner-desc {
  font-size: 12px;
  color: var(--text-muted);
}

/* Skin grid */
.skin-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.skin-grid.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.skin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.12s;
  background: var(--bg-secondary);
}

.skin-card:hover {
  border-color: var(--border-color);
}

.skin-card.active {
  border-color: var(--accent-color);
  background: var(--accent-light);
}

.skin-preview {
  width: 100%;
  height: 48px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: flex-end;
  padding: 4px;
  overflow: hidden;
}

.skin-preview-surface {
  width: 100%;
  height: 20px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.skin-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Toggle switch */
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

/* Grid line section */
.grid-line-row {
  display: flex;
  gap: 10px;
}

.grid-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.12s;
  background: var(--bg-secondary);
}

.grid-option:hover {
  border-color: var(--border-color);
}

.grid-option.active {
  border-color: var(--accent-color);
  background: var(--accent-light);
}

.grid-preview {
  font-size: 24px;
  color: var(--text-secondary);
  line-height: 1;
}

.grid-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Transitions */
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }
</style>
