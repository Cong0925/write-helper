export type { QuickTool } from './types'

export {
  registerTool,
  getAllTools,
  getToolById,
} from './registry'

import { registerTool } from './registry'

import { tool as svgGallery } from './modules/svg-gallery'
import { tool as qrCode } from './modules/qr-code'
import { tool as ocr } from './modules/ocr'
import { tool as wechatEmoji } from './modules/wechat-emoji'
import { tool as colorPicker } from './modules/color-picker'
import { tool as imageMaker } from './modules/image-maker'
import { tool as imageCompress } from './modules/image-compress'
import { tool as gifAnimation } from './modules/gif-animation'

const tools = [
  svgGallery, qrCode, ocr, wechatEmoji,
  colorPicker, imageMaker, imageCompress, gifAnimation,
]

for (const tool of tools) {
  registerTool(tool)
}
