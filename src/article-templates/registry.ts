import type { TemplateItem, TemplateCategory } from './types'
import { ref } from 'vue'

// ─── In-memory registry ─────────────────────────────────────
const _categories = new Map<string, TemplateCategory>()
const _templates = new Map<string, TemplateItem>()
const _stamp = ref(0)

function bump() { _stamp.value++ }
export function getStamp() { return _stamp.value }

// ─── Registration API ────────────────────────────────────────

export function registerCategory(cat: TemplateCategory) {
  _categories.set(cat.id, cat)
}

export function registerTemplate(tpl: TemplateItem) {
  _templates.set(tpl.id, tpl)
  bump()
}

export function registerTemplates(tpls: TemplateItem[]) {
  for (const t of tpls) _templates.set(t.id, t)
  bump()
}

// ─── Query API ───────────────────────────────────────────────

export function getAllCategories(): TemplateCategory[] {
  return Array.from(_categories.values())
}

function sortTemplates(list: TemplateItem[]): TemplateItem[] {
  // Pinned first, then by id (insertion order within each group)
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })
}

export function getTemplatesByCategory(categoryId: string): TemplateItem[] {
  return sortTemplates(
    Array.from(_templates.values()).filter(t => t.category === categoryId)
  )
}

export function getBuiltinTemplatesByCategory(categoryId: string): TemplateItem[] {
  return sortTemplates(
    Array.from(_templates.values()).filter(t => t.category === categoryId && !t.custom)
  )
}

export function getCustomTemplatesByCategory(categoryId: string): TemplateItem[] {
  return sortTemplates(
    Array.from(_templates.values()).filter(t => t.category === categoryId && t.custom)
  )
}

export function getTemplateById(id: string): TemplateItem | undefined {
  return _templates.get(id)
}

export function getAllTemplates(): TemplateItem[] {
  return Array.from(_templates.values())
}

// ─── Pin / Unpin ─────────────────────────────────────────────

export async function togglePin(id: string): Promise<void> {
  const tpl = _templates.get(id)
  if (!tpl) return
  tpl.pinned = !tpl.pinned
  bump()
  // Persist custom template pin state
  if (tpl.custom) {
    const customs = await loadCustomTemplates()
    const saved = customs.find(t => t.id === id)
    if (saved) {
      saved.pinned = tpl.pinned
      await _writeCustomTemplates(customs)
    }
  }
}

// ─── Custom templates persistence ────────────────────────────

let customTemplatesPath = ''

export function setCustomTemplatesPath(path: string) {
  customTemplatesPath = path
}

export async function loadCustomTemplates(): Promise<TemplateItem[]> {
  if (!customTemplatesPath) return []
  try {
    const { readFile } = await import('../api/files')
    const content = await readFile(customTemplatesPath)
    return JSON.parse(content) as TemplateItem[]
  } catch {
    return []
  }
}

export async function saveCustomTemplate(tpl: TemplateItem): Promise<void> {
  const customs = await loadCustomTemplates()
  const idx = customs.findIndex(t => t.id === tpl.id)
  if (idx >= 0) {
    customs[idx] = tpl
  } else {
    customs.push(tpl)
  }
  await _writeCustomTemplates(customs)
  // Register into runtime
  registerTemplate({ ...tpl, custom: true })
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const customs = await loadCustomTemplates()
  const filtered = customs.filter(t => t.id !== id)
  await _writeCustomTemplates(filtered)
  _templates.delete(id)
  bump()
}

async function _writeCustomTemplates(tpls: TemplateItem[]): Promise<void> {
  if (!customTemplatesPath) return
  try {
    const { writeFile } = await import('../api/files')
    await writeFile(customTemplatesPath, JSON.stringify(tpls, null, 2))
  } catch { /* ignore */ }
}

// ─── Merge built-in + custom (global, shared across projects) ──

export async function initCustomTemplates() {
  const { getConfigDir } = await import('../api')
  const dir = await getConfigDir()
  const path = dir + '/custom_templates.json'
  setCustomTemplatesPath(path)
  const customs = await loadCustomTemplates()
  for (const t of customs) {
    registerTemplate({ ...t, custom: true })
  }
}
