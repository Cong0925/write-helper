import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'image-maker',
  name: '一键制图',
  icon: '🖼',
  description: '一键制图',
  action: async () => await dialog.alert('一键制图 - 敬请期待'),
}
