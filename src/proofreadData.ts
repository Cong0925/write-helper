import { appState, type CustomRuleGroup } from './store'

interface SensitiveData {
  words: string[]
  templates: { name: string; words: string[] }[]
}

/* ========= Persisted Ignore ========= */
export interface IgnoredEntry {
  filePath: string
  /** The identifying text: the wrong text for typo/custom, or message for sensitive */
  text: string
  lineContent: string
}

let dataDir = ''

async function ensureDir(): Promise<string> {
  if (dataDir) return dataDir
  const { getConfigDir, writeFile } = await import('./api')
  const cfgDir = await getConfigDir()
  dataDir = cfgDir.replace(/\\/g, '/') + '/proofread'
  try { await writeFile(dataDir + '/.gitkeep', '') } catch { /* ignore */ }
  return dataDir
}

export async function loadIgnored(): Promise<IgnoredEntry[]> {
  try {
    const { readFile } = await import('./api')
    const dir = await ensureDir()
    const raw = await readFile(dir + '/ignored.json')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveIgnored(entries: IgnoredEntry[]): Promise<void> {
  try {
    const { writeFile } = await import('./api')
    const dir = await ensureDir()
    await writeFile(dir + '/ignored.json', JSON.stringify(entries, null, 2))
  } catch { /* ignore */ }
}

export async function addIgnored(entry: IgnoredEntry): Promise<void> {
  const entries = await loadIgnored()
  const dup = entries.some(e =>
    e.filePath === entry.filePath &&
    e.text === entry.text &&
    e.lineContent === entry.lineContent
  )
  if (!dup) {
    entries.push(entry)
    await saveIgnored(entries)
  }
}

export async function removeIgnored(filePath: string, text: string, lineContent: string): Promise<void> {
  const entries = await loadIgnored()
  const filtered = entries.filter(e =>
    !(e.filePath === filePath && e.text === text && e.lineContent === lineContent)
  )
  if (filtered.length !== entries.length) {
    await saveIgnored(filtered)
  }
}

/* ========= Sensitive Data ========= */

export async function loadSensitiveData(): Promise<void> {
  try {
    const { readFile } = await import('./api')
    const dir = await ensureDir()
    const raw = await readFile(dir + '/sensitive_data.json')
    const data: SensitiveData = JSON.parse(raw)
    if (data.words && Array.isArray(data.words)) {
      appState.sensitiveWords = data.words
    }
    if (data.templates && Array.isArray(data.templates)) {
      appState.sensitiveTemplates = data.templates
    }
  } catch {
    // File doesn't exist yet or parse error — keep defaults
  }
}

export async function saveSensitiveData(): Promise<void> {
  try {
    const { writeFile } = await import('./api')
    const dir = await ensureDir()
    const data: SensitiveData = {
      words: appState.sensitiveWords,
      templates: appState.sensitiveTemplates,
    }
    await writeFile(dir + '/sensitive_data.json', JSON.stringify(data, null, 2))
  } catch { /* ignore */ }
}

export async function loadCustomRules(): Promise<void> {
  try {
    const { readFile } = await import('./api')
    const dir = await ensureDir()
    const raw = await readFile(dir + '/custom_rules.json')
    const data: CustomRuleGroup[] = JSON.parse(raw)
    if (Array.isArray(data) && data.length) {
      appState.customRuleGroups = data
    }
  } catch {
    // File doesn't exist yet or parse error — keep defaults
  }
}

export async function saveCustomRules(): Promise<void> {
  try {
    const { writeFile } = await import('./api')
    const dir = await ensureDir()
    await writeFile(dir + '/custom_rules.json', JSON.stringify(appState.customRuleGroups, null, 2))
  } catch { /* ignore */ }
}

export async function loadAllProofreadData(): Promise<void> {
  await Promise.all([loadSensitiveData(), loadCustomRules()])
}
