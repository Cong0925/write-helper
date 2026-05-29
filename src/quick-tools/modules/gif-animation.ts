import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'gif-animation',
  name: 'GIF 动画',
  icon: '🎬',
  description: 'GIF 动画',
  action: async () => await dialog.alert('GIF 动画 - 敬请期待'),
}
