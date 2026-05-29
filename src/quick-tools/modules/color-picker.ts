import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'color-picker',
  name: '配色神器',
  icon: '🌈',
  description: '配色神器',
  action: async () => await dialog.alert('配色神器 - 敬请期待'),
}
