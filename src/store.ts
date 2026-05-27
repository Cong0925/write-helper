import { reactive } from 'vue'

export interface ProjectInfo {
  path: string
  name: string
  description: string
  coverPath: string
  createdAt: string
  lastOpenedAt: string
  version: string
  projectType: string
  typeConfig: Record<string, any>
}

export interface ProjectTypeDefinition {
  typeId: string
  displayName: string
  description: string
  icon: string
  version: string
  directoryTemplate: DirEntry[]
  defaultFiles: DefaultFile[]
  editorType: 'code_mirror' | 'tip_tap' | 'mixed'
  enabledPanels: string[]
  contentRoot: string
}

export interface DirEntry {
  name: string
  children?: DirEntry[]
}

export interface DefaultFile {
  relativePath: string
  content: string
}

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

export interface WordCount {
  totalChars: number
  chineseChars: number
  words: number
  lines: number
}

export interface SearchMatch {
  filePath: string
  fileName: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export interface SearchResult {
  filePath: string
  fileName: string
  matches: SearchMatch[]
}

export interface RuleItem {
  detect: string
  correct: string
}

export interface CustomRuleGroup {
  name: string
  enabled: boolean
  rules: RuleItem[]
}

export const appState = reactive({
  view: 'welcome' as 'welcome' | 'main',
  project: null as ProjectInfo | null,
  fileTree: [] as FileEntry[],
  volumeEntries: [] as FileEntry[],
  currentFile: null as { path: string; name: string } | null,
  currentContent: '',
  isDirty: false,
  wordCount: { totalChars: 0, chineseChars: 0, words: 0, lines: 0 } as WordCount,
  theme: 'light' as 'dark' | 'light',
  sidebarWidth: 260,
  searchQuery: '',
  searchResults: [] as SearchResult[],
  searchExpanded: new Set<string>(),
  isSearching: false,
  showFindReplace: false,
  findScope: 'chapter' as 'chapter' | 'all',
  isFullscreen: false,
  // Jump to line in editor
  jumpToLine: null as number | null,
  // Current active volume (for new chapter creation)
  activeVolume: '' as string,
  // For the app shell context menu
  ctxZone: '' as 'tree' | 'editor' | 'none',
  // Global stamp to enforce single context menu at a time
  ctxMenuStamp: 0,
  // Settings panel
  showSettings: false,
  settingsSection: '' as string,
  // Auto-save
  autoSave: true,
  showAutoSaveWarning: false,
  // Font settings panel
  showFontSettings: false,
  fontFamily: '\'JetBrains Mono\', Consolas, \'PingFang SC\', monospace',
  fontSize: 15,
  lineHeight: 1.5,
  lineWidth: 1000,
  fontBold: false,
  fontColor: '',
  paraGap: false,
  firstIndent: false,
  // Side panel
  activeSidePanel: '',
  sidePanelMode: 'float' as 'float' | 'docked',
  // Background settings panel
  showBgSettings: false,
  lightSkin: 'default',
  darkSkin: 'default',
  gridStyle: 'none',
  // Sensitive words (persisted)
  sensitiveWords: [] as string[],
  sensitiveTemplates: [] as { name: string; words: string[] }[],
  // Custom rule groups (自定义纠错)
  customRuleGroups: [{ name: '词库1', enabled: true, rules: [] as RuleItem[] }],
  // Article editor shared state (for RightPanel integration)
  articleShowMobilePreview: false,
  articleShowQuickTools: false,
  articleActionStamp: 0,
  articlePendingAction: '',
})

// Skin palette data
export interface SkinInfo {
  id: string
  label: string
  color: string
  desc: string
}

export const lightSkins: SkinInfo[] = [
  { id: 'default', label: '薄雾灰', color: '#f5f5f7', desc: '偏白的浅灰色，带一点冷调' },
  { id: 'green',   label: '护眼绿', color: '#d4e9d4', desc: '柔和的薄荷绿，低饱和度护眼' },
  { id: 'yellow',  label: '古典黄', color: '#e9ddc4', desc: '偏暖的浅米黄色，纸张质感' },
  { id: 'blue',    label: '静谧蓝', color: '#dce4ee', desc: '淡灰蓝色，偏冷调的浅色系' },
  { id: 'pink',    label: '浪漫粉', color: '#f1e0e6', desc: '低饱和浅粉色，柔和不刺眼' },
]

export const darkSkins: SkinInfo[] = [
  { id: 'default', label: '暗夜黑', color: '#1a1a1a', desc: '纯深黑 / 近黑色，低亮度' },
  { id: 'cyan',    label: '深空青', color: '#1e293b', desc: '偏冷调的深蓝色，类似夜空的暗青色' },
  { id: 'gray',    label: '育阳染', color: '#333842', desc: '偏中性的深灰色，带一点冷调' },
]

const skinPalettes: Record<string, Record<string, { bg: string; surface: string; border: string }>> = {
  light: {
    default: { bg: '#f5f5f7', surface: '#ffffff', border: '#e0e2e8' },
    green:   { bg: '#d4e9d4', surface: '#e2f0e2', border: '#bcd6bc' },
    yellow:  { bg: '#e9ddc4', surface: '#f2e8d4', border: '#d5c9ae' },
    blue:    { bg: '#dce4ee', surface: '#eaf0f6', border: '#c4cedc' },
    pink:    { bg: '#f1e0e6', surface: '#f8edf0', border: '#dcc8d0' },
  },
  dark: {
    default: { bg: '#1c1814', surface: '#25211c', border: '#3d352e' },
    cyan:    { bg: '#1e293b', surface: '#283548', border: '#3d4a5e' },
    gray:    { bg: '#333842', surface: '#3d424d', border: '#4e535e' },
  },
}

export function getSkinColors(theme: 'light' | 'dark', lightSkin: string, darkSkin: string) {
  const id = theme === 'dark' ? darkSkin : lightSkin
  return getSkinColorById(theme, id)
}

export function getSkinColorById(theme: 'light' | 'dark', skinId: string) {
  const p = skinPalettes[theme]?.[skinId] || skinPalettes[theme].default
  return { bg: p.bg, surface: p.surface, border: p.border }
}

export function getSkinCssVars(theme: 'light' | 'dark', lightSkin: string, darkSkin: string): Record<string, string> {
  const c = getSkinColors(theme, lightSkin, darkSkin)
  return {
    '--skin-bg-primary': c.bg,
    '--skin-bg-secondary': c.surface,
    '--skin-border-color': c.border,
  }
}
