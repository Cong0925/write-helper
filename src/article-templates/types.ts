export interface TemplateItem {
  id: string
  name: string
  category: string
  html: string
  description?: string
  /** Sub-category for category-internal grouping (e.g. emoji: colorful / kaomoji / mono) */
  subCategory?: string
  /** Whether this is a user-custom template */
  custom?: boolean
  /** Whether this template is pinned to top */
  pinned?: boolean
}

export interface TemplateCategory {
  id: string
  name: string
  icon: string
}

export interface QuickTool {
  id: string
  name: string
  icon: string
  description: string
  /** Called when the tool is clicked */
  action: () => void
}
