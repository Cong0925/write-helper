import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'wechat-emoji',
  name: '微信表情',
  icon: '😊',
  description: '微信表情',
  action: async () => await dialog.alert('微信表情 - 敬请期待'),
}
