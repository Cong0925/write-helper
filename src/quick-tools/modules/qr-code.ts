import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'qr-code',
  name: '二维码生成',
  icon: '📱',
  description: '二维码生成器',
  action: async () => await dialog.alert('二维码生成器 - 敬请期待'),
}
