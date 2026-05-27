import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'dark' | 'light'>('light')
  const sidebarWidth = ref(260)
  const isFullscreen = ref(false)
  const activeSidePanel = ref('')
  const showFindReplace = ref(false)
  const showSettings = ref(false)
  const settingsSection = ref('')
  const showFontSettings = ref(false)
  const showBgSettings = ref(false)

  // Font settings
  const fontFamily = ref('\'JetBrains Mono\', Consolas, \'PingFang SC\', monospace')
  const fontSize = ref(15)
  const lineHeight = ref(1.5)
  const lineWidth = ref(1000)
  const fontBold = ref(false)
  const fontColor = ref('')
  const paraGap = ref(false)
  const firstIndent = ref(false)

  // Background / skin settings
  const lightSkin = ref('default')
  const darkSkin = ref('default')
  const gridStyle = ref('none')

  // Context menu
  const ctxZone = ref<'tree' | 'editor' | 'none'>('none')
  const ctxMenuStamp = ref(0)

  function toggleSidePanel(panelId: string) {
    activeSidePanel.value = activeSidePanel.value === panelId ? '' : panelId
  }

  function setTheme(t: 'dark' | 'light') {
    theme.value = t
  }

  return {
    theme, sidebarWidth, isFullscreen, activeSidePanel,
    showFindReplace, showSettings, settingsSection, showFontSettings, showBgSettings,
    fontFamily, fontSize, lineHeight, lineWidth, fontBold, fontColor, paraGap, firstIndent,
    lightSkin, darkSkin, gridStyle,
    ctxZone, ctxMenuStamp,
    toggleSidePanel, setTheme,
  }
})
