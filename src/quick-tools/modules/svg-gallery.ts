import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'svg-gallery',
  name: 'SVG 图库',
  icon: '🎨',
  description: 'SVG 图库',
  action: async () => await dialog.alert('SVG 图库 - 敬请期待'),
}
