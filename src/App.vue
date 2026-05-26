<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { appState, getSkinCssVars } from './store'
import { initKeyboardShortcuts } from './useKeyboardShortcuts'
import Welcome from './components/Welcome.vue'
import Toolbar from './components/Toolbar.vue'
import LeftPanel from './components/LeftPanel.vue'
import EditorArea from './components/EditorArea.vue'
import RightPanel from './components/RightPanel.vue'
import SidePanel from './components/SidePanel.vue'
import BottomBar from './components/BottomBar.vue'
import FindReplace from './components/FindReplace.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import FontSettingsPanel from './components/FontSettingsPanel.vue'
import BgSettingsPanel from './components/BgSettingsPanel.vue'

const themeClass = computed(() => appState.theme === 'dark' ? 'theme-dark' : 'theme-light')

const skinStyle = computed(() => getSkinCssVars(appState.theme, appState.lightSkin, appState.darkSkin))

// Sync theme class to body so Teleported menus inherit CSS custom properties
watch(themeClass, (cls) => {
  document.body.classList.remove('theme-light', 'theme-dark')
  document.body.classList.add(cls)
}, { immediate: true })

onMounted(() => {
  initKeyboardShortcuts()
  loadAutoSaveConfig()
  loadProofreadData()
})

async function loadAutoSaveConfig() {
  try {
    const { getConfig } = await import('./api')
    const val = await getConfig('autoSave')
    if (val === 'false') {
      appState.autoSave = false
    }
  } catch { /* ignore */ }
}

async function loadProofreadData() {
  try {
    const { loadAllProofreadData } = await import('./proofreadData')
    await loadAllProofreadData()
  } catch { /* ignore */ }
}
</script>

<template>
  <!-- Root: prevent browser right-click everywhere; zones add their own custom menus -->
  <div :class="themeClass" :style="skinStyle" @contextmenu.prevent>
    <Welcome v-if="appState.view === 'welcome'" />

    <div v-else class="app-shell">
      <Toolbar />
      <div class="app-body">
        <LeftPanel />
        <EditorArea />
        <RightPanel />
      </div>
      <BottomBar />

      <!-- SidePanel: fixed overlay on the right, does not affect layout -->
      <SidePanel />
    </div>

    <!-- Overlay components -->
    <FindReplace v-if="appState.showFindReplace" @close="appState.showFindReplace = false" />
    <SettingsPanel @close="appState.showSettings = false" />
    <FontSettingsPanel />
    <BgSettingsPanel />
  </div>
</template>

<style>
:root {
  --toolbar-height: 48px;
  --left-panel-width: 260px;
  --right-panel-width: 52px;
  --bottom-bar-height: 32px;
}

/* ===== Light Theme (default) ===== */
.theme-light {
  --bg-primary: var(--skin-bg-primary, #f5f6f8);
  --bg-secondary: var(--skin-bg-secondary, #ffffff);
  --bg-surface: #ebecef;
  --bg-toolbar: var(--skin-bg-primary, #ffffff);
  --text-primary: #1a1a2e;
  --text-secondary: #5a5a7a;
  --text-muted: #9999b0;
  --border-color: var(--skin-border-color, #e0e2e8);
  --accent-color: #4a7dd4;
  --accent-hover: #3a6dc4;
  --accent-light: rgba(74, 125, 212, 0.08);
  --hover-bg: #f0f1f4;
  --active-bg: #e8eaf0;
  --danger-color: #e74c3c;
  --success-color: #27ae60;
  --warning-color: #f39c12;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* ===== Warm Dark Theme ===== */
.theme-dark {
  --bg-primary: var(--skin-bg-primary, #1c1814);
  --bg-secondary: var(--skin-bg-secondary, #25211c);
  --bg-surface: #2d2822;
  --bg-toolbar: var(--skin-bg-primary, #1c1814);
  --text-primary: #cfc3b4;
  --text-secondary: #9e9082;
  --text-muted: #6c6257;
  --border-color: var(--skin-border-color, #3d352e);
  --accent-color: #d4a853;
  --accent-hover: #c49a45;
  --accent-light: rgba(212, 168, 83, 0.12);
  --hover-bg: #332d26;
  --active-bg: #3d352e;
  --danger-color: #e06c5a;
  --success-color: #8bba7a;
  --warning-color: #d9a85e;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  font-size: 14px;
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  color: var(--text-primary);
  background: var(--bg-primary);
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* Removed global ::selection — CodeMirror handles its own; default browser is fine for UI */

/* ===== Global Context Menu Styles ===== */
.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px;
  width: 172px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  user-select: none;
}
.ctx-menu .ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 12px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.08s;
}
.ctx-menu .ctx-item:hover { background: var(--hover-bg); }
.ctx-menu .ctx-item:active { background: var(--active-bg); }
.ctx-menu .ctx-item.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ctx-menu .ctx-item.disabled:hover { background: transparent; }
.ctx-menu .ctx-item.disabled:active { background: transparent; }
.ctx-menu .ctx-item-icon {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
}
.ctx-menu .ctx-item.danger { color: var(--danger-color); }
.ctx-menu .ctx-item.danger:hover { background: rgba(231, 76, 60, 0.1); }
.ctx-menu .ctx-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}

/* ===== Light Theme Context Menu ===== */
.theme-light .ctx-menu {
  background: #ffffff;
}

/* ===== Warm Dark Theme Context Menu ===== */
body.theme-dark .ctx-menu {
  background: #2d2822;
  border-color: #3d352e;
}
body.theme-dark .ctx-menu .ctx-item {
  color: #e8dccc;
}
body.theme-dark .ctx-menu .ctx-item:hover {
  background: #3d352e;
}
body.theme-dark .ctx-menu .ctx-item:active {
  background: #4a4038;
}
body.theme-dark .ctx-menu .ctx-item.danger {
  color: #e06c5a;
}
body.theme-dark .ctx-menu .ctx-item.danger:hover {
  background: rgba(224, 108, 90, 0.12);
}
body.theme-dark .ctx-menu .ctx-divider {
  background: #4a4038;
}
body.theme-dark .ctx-menu .ctx-item.disabled {
  color: #7a6f62;
}

/* Dim tree icons in dark mode — emoji are too bright */
body.theme-dark .tree-icon,
body.theme-dark .root-icon,
body.theme-dark .toggle-icon {
  opacity: 0.65;
  filter: grayscale(0.25);
}
</style>
