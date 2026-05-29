import type { QuickTool } from '../types'
import { dialog } from '../../composables/useDialog'

export const tool: QuickTool = {
  id: 'ocr',
  name: 'OCR 识别',
  icon: '🔍',
  description: 'OCR 文字识别',
  action: async () => await dialog.alert('OCR 文字识别 - 敬请期待'),
}
