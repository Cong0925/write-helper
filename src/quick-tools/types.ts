export interface QuickTool {
  id: string
  name: string
  icon: string
  description: string
  action: () => void
}
