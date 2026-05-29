// Types — re-exported for consumers
export type { TemplateItem, TemplateCategory } from './types'

// Registry
export {
  registerCategory,
  registerTemplate,
  registerTemplates,
  getAllCategories,
  getTemplatesByCategory,
  getBuiltinTemplatesByCategory,
  getCustomTemplatesByCategory,
  getTemplateById,
  getAllTemplates,
  initCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  togglePin,
  getStamp,
} from './registry'

// Built-in modules — register them on import
import { registerCategory, registerTemplates } from './registry'
import type { TemplateCategory } from './types'

// Each module exports { id, name, icon, templates[] }
import * as follow from './modules/follow'
import * as title from './modules/title'
import * as body from './modules/body'
import * as imageText from './modules/image-text'
import * as svg from './modules/svg'
import * as divider from './modules/divider'
import * as emoji from './modules/emoji'
import * as bg from './modules/bg'
import * as dynamicBg from './modules/dynamic-bg'
import * as qrcode from './modules/qrcode'
import * as footer from './modules/footer'

const modules = [
  follow, title, body, imageText,
  svg, divider, emoji, bg, dynamicBg, qrcode, footer,
]

for (const mod of modules) {
  registerCategory({ id: mod.id, name: mod.name, icon: mod.icon } as TemplateCategory)
  registerTemplates(mod.templates)
}

