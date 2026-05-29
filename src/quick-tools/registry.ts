import type { QuickTool } from './types'

const _tools = new Map<string, QuickTool>()

export function registerTool(tool: QuickTool) {
  _tools.set(tool.id, tool)
}

export function getAllTools(): QuickTool[] {
  return Array.from(_tools.values())
}

export function getToolById(id: string): QuickTool | undefined {
  return _tools.get(id)
}
