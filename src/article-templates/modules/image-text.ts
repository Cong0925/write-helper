import type { TemplateItem } from '../types'

export const id = 'image-text'
export const name = '图文模板'
export const icon = '🖼'

export const templates: TemplateItem[] = [
  {
    id: 'imgtxt-1',
    name: '左图右文',
    category: 'image-text',
    html: '<div style="display: flex; gap: 14px; margin: 18px 0; align-items: center;"><div style="width: 40%; flex-shrink: 0;"><img src="/images/img-left.svg" style="width: 100%; border-radius: 6px; display: block;" alt="图片"></div><div style="flex: 1;"><h4 style="margin: 0 0 6px; font-size: 15px; font-weight: bold; color: #333;">标题文字</h4><p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">这里是描述文字，简洁明了地说明图片相关内容。</p></div></div>',
  },
  {
    id: 'imgtxt-2',
    name: '上图下文',
    category: 'image-text',
    html: '<div style="margin: 18px 0;"><img src="/images/img-top.svg" style="width: 100%; border-radius: 8px; display: block;" alt="图片"><div style="padding: 12px 0;"><h4 style="margin: 0 0 4px; font-size: 16px; font-weight: bold; color: #333;">标题文字</h4><p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">图片下方的描述文字。</p></div></div>',
  },
  {
    id: 'imgtxt-3',
    name: '多图网格',
    category: 'image-text',
    html: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0;"><img src="/images/img-grid-1.svg" style="width: 100%; border-radius: 6px; display: block;" alt="1"><img src="/images/img-grid-2.svg" style="width: 100%; border-radius: 6px; display: block;" alt="2"><img src="/images/img-grid-3.svg" style="width: 100%; border-radius: 6px; display: block;" alt="3"><img src="/images/img-grid-4.svg" style="width: 100%; border-radius: 6px; display: block;" alt="4"></div>',
  },
  {
    id: 'imgtxt-4',
    name: '全宽图片',
    category: 'image-text',
    html: '<div style="margin: 18px 0;"><img src="/images/img-full.svg" style="width: 100%; border-radius: 4px; display: block;" alt="全宽图片"><p style="margin: 4px 0 0; text-align: center; font-size: 12px; color: #aaa;">图片说明文字</p></div>',
  },
]
