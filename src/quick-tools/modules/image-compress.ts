import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'image-compress',
  name: '图片压缩',
  icon: '📦',
  description: '图片压缩',
  action: async () => await dialog.alert('图片压缩 - 敬请期待'),
}
