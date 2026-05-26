<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { appState } from '../store'
import { getConfig, setConfig } from '../api'

const colorPresets = [
  { label: '默认', value: '' },
  { label: '红色', value: '#e74c3c' },
  { label: '橙色', value: '#e67e22' },
  { label: '金色', value: '#d4a853' },
  { label: '绿色', value: '#27ae60' },
  { label: '蓝色', value: '#4a7dd4' },
  { label: '紫色', value: '#8e44ad' },
  { label: '灰色', value: '#7f8c8d' },
]

const showColorPicker = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

const fontOptions = [
  { label: '微软雅黑', value: '\'Microsoft YaHei\', sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: '仿宋', value: 'FangSong, serif' },
  { label: 'JetBrains Mono', value: '\'JetBrains Mono\', monospace' },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: '等宽字体', value: 'monospace' },
]

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSettings, 500)
}

async function saveSettings() {
  const data = JSON.stringify({
    fontFamily: appState.fontFamily,
    fontSize: appState.fontSize,
    lineHeight: appState.lineHeight,
    lineWidth: appState.lineWidth,
    fontBold: appState.fontBold,
    fontColor: appState.fontColor,
    paraGap: appState.paraGap,
    firstIndent: appState.firstIndent,
  })
  try {
    await setConfig('fontSettings', data)
  } catch { /* ignore */ }
}

function onFontChange(e: Event) {
  appState.fontFamily = (e.target as HTMLSelectElement).value
  scheduleSave()
}

function toggleBold() {
  appState.fontBold = !appState.fontBold
  scheduleSave()
}

function pickColor(value: string) {
  appState.fontColor = value
  showColorPicker.value = false
  scheduleSave()
}

function onSliderChange() {
  scheduleSave()
}

function onCheckboxChange() {
  scheduleSave()
}

function resetDefaults() {
  appState.fontFamily = '\'JetBrains Mono\', Consolas, \'PingFang SC\', monospace'
  appState.fontSize = 15
  appState.lineHeight = 1.5
  appState.lineWidth = 1000
  appState.fontBold = false
  appState.fontColor = ''
  appState.paraGap = false
  appState.firstIndent = false
  showColorPicker.value = false
  scheduleSave()
}

function doClose() {
  appState.showFontSettings = false
  showColorPicker.value = false
}

// Load saved settings
onMounted(async () => {
  try {
    const raw = await getConfig('fontSettings')
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.fontFamily) appState.fontFamily = saved.fontFamily
      if (saved.fontSize) appState.fontSize = saved.fontSize
      if (saved.lineHeight) appState.lineHeight = saved.lineHeight
      if (saved.lineWidth) appState.lineWidth = saved.lineWidth
      if (typeof saved.fontBold === 'boolean') appState.fontBold = saved.fontBold
      if (typeof saved.fontColor === 'string') appState.fontColor = saved.fontColor
      if (typeof saved.paraGap === 'boolean') appState.paraGap = saved.paraGap
      if (typeof saved.firstIndent === 'boolean') appState.firstIndent = saved.firstIndent
    }
  } catch { /* ignore */ }
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

// Close color picker on outside click
function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.color-btn') && !target.closest('.color-popup')) {
    showColorPicker.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="appState.showFontSettings" class="font-settings-overlay" @click.self="doClose">
        <div class="font-settings-panel">
          <!-- Top: tab bar -->
          <div class="tab-bar">
            <div class="tab-item active">章节内容</div>
          </div>

          <div class="settings-body">
            <!-- Font row -->
            <div class="setting-row">
              <span class="row-label">字体</span>
              <div class="row-controls">
                <select class="form-select" :value="appState.fontFamily" @change="onFontChange">
                  <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <button
                  class="action-btn bold-btn"
                  :class="{ active: appState.fontBold }"
                  title="加粗"
                  @click="toggleBold"
                >B</button>
                <div class="color-wrapper">
                  <button
                    class="action-btn color-btn"
                    title="字体颜色"
                    @click.stop="showColorPicker = !showColorPicker"
                  >
                    <span
                      class="color-swatch"
                      :style="appState.fontColor ? { background: appState.fontColor } : {}"
                    ></span>
                  </button>
                  <Transition name="popup-fade">
                    <div v-if="showColorPicker" class="color-popup" @click.stop>
                      <div
                        v-for="c in colorPresets"
                        :key="c.value"
                        class="color-item"
                        :class="{ active: appState.fontColor === c.value }"
                        @click="pickColor(c.value)"
                      >
                        <span class="color-dot" :style="c.value ? { background: c.value } : { background: 'var(--text-primary)', opacity: 0.4 }"></span>
                        <span class="color-label">{{ c.label }}</span>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Font size row -->
            <div class="setting-row">
              <span class="row-label">字号</span>
              <div class="row-controls">
                <input
                  type="range"
                  class="form-slider"
                  min="10"
                  max="24"
                  step="1"
                  v-model.number="appState.fontSize"
                  @input="onSliderChange"
                />
                <span class="slider-value">{{ appState.fontSize }}</span>
              </div>
            </div>

            <!-- Line height row -->
            <div class="setting-row">
              <span class="row-label">行高</span>
              <div class="row-controls">
                <input
                  type="range"
                  class="form-slider"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  v-model.number="appState.lineHeight"
                  @input="onSliderChange"
                />
                <span class="slider-value">{{ appState.lineHeight.toFixed(1) }}</span>
              </div>
            </div>

            <!-- Line width row -->
            <div class="setting-row">
              <span class="row-label">行宽</span>
              <div class="row-controls">
                <input
                  type="range"
                  class="form-slider"
                  min="400"
                  max="1200"
                  step="10"
                  v-model.number="appState.lineWidth"
                  @input="onSliderChange"
                />
                <span class="slider-value">{{ appState.lineWidth }}</span>
              </div>
            </div>

            <!-- Bottom checkboxes -->
            <div class="checkbox-row">
              <label class="chk-item">
                <input type="checkbox" v-model="appState.paraGap" @change="onCheckboxChange" />
                <span class="chk-label">段间空行</span>
              </label>
              <label class="chk-item">
                <input type="checkbox" v-model="appState.firstIndent" @change="onCheckboxChange" />
                <span class="chk-label">首行缩进</span>
              </label>
            </div>

            <!-- Reset button -->
            <button class="reset-btn" @click="resetDefaults">恢复默认</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.font-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 99996;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 120px;
}

.font-settings-panel {
  width: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

/* Tab bar */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
}

.tab-item {
  position: relative;
  padding: 14px 4px 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: default;
  user-select: none;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--accent-color);
  border-radius: 1px 1px 0 0;
}

/* Settings body */
.settings-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Setting row */
.setting-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.row-label {
  width: 48px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.row-controls {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Select */
.form-select {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
  appearance: auto;
}
.form-select:focus { border-color: var(--accent-color); }

/* Action buttons (bold, color) */
.action-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  flex-shrink: 0;
}
.action-btn:hover { background: var(--hover-bg); }
.action-btn.active {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}

.bold-btn {
  font-weight: 700;
  font-size: 15px;
  font-family: 'Times New Roman', serif;
}

.color-swatch {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

/* Color picker popup */
.color-wrapper {
  position: relative;
}

.color-popup {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  width: 140px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  z-index: 10;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.08s;
  font-size: 13px;
  color: var(--text-primary);
}
.color-item:hover { background: var(--hover-bg); }
.color-item.active { background: var(--accent-light); }

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.color-label { white-space: nowrap; }

/* Slider */
.form-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
  outline: none;
  cursor: pointer;
}
.form-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  border: 2px solid var(--bg-secondary);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.form-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  border: 2px solid var(--bg-secondary);
  cursor: pointer;
}
.form-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }

.slider-value {
  width: 36px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  flex-shrink: 0;
}

/* Checkbox row */
.checkbox-row {
  display: flex;
  gap: 32px;
  padding-top: 4px;
}

.chk-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.chk-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-color);
  cursor: pointer;
}

.chk-label {
  font-size: 13px;
  color: var(--text-primary);
}

/* Reset button */
.reset-btn {
  align-self: center;
  padding: 6px 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
}
.reset-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

/* Transitions */
.panel-fade-enter-active { transition: opacity 0.2s ease; }
.panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from,
.panel-fade-leave-to { opacity: 0; }

.popup-fade-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.popup-fade-leave-active { transition: opacity 0.1s ease; }
.popup-fade-enter-from { opacity: 0; transform: translateY(-4px); }
.popup-fade-leave-to { opacity: 0; }
</style>
