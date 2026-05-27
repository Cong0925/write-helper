// ─── Project ────────────────────────────────────────────

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

// ─── File System ─────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

// ─── Word Count ──────────────────────────────────────────

export interface WordCount {
  totalChars: number
  chineseChars: number
  words: number
  lines: number
}

// ─── Search ──────────────────────────────────────────────

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

// ─── Proofread ───────────────────────────────────────────

export interface RuleItem {
  detect: string
  correct: string
}

export interface CustomRuleGroup {
  name: string
  enabled: boolean
  rules: RuleItem[]
}

// ─── Editor ──────────────────────────────────────────────

export interface EditorInterface {
  getContent(): string
  setContent(content: string): void
  getSelectedText(): string
  insertText(text: string, position?: number): void
  replaceSelectedText(text: string): void
  onContentChange(callback: (content: string) => void): void
  focus(): void
  getCursorPosition(): number
  setCursorPosition(pos: number): void
  getWordCount(): WordCount
}
