import type { TemplateItem } from '../types'

export const id = 'qrcode'
export const name = '二维码'
export const icon = '📱'

export const templates: TemplateItem[] = [
  {
    id: 'qrcode-1',
    name: '简约二维码',
    category: 'qrcode',
    html: '<div style="margin: 20px 0; text-align: center;"><div style="display: inline-block; padding: 14px; background: #fff; border: 1px solid #e0e2e8; border-radius: 8px;"><img src="/images/qrcode.svg" style="width: 120px; height: 120px; display: block; margin: 0 auto;" alt="二维码"></div><p style="margin: 8px 0 0; font-size: 13px; color: #888;">扫码关注公众号</p></div>',
  },
  {
    id: 'qrcode-2',
    name: '带边框二维码',
    category: 'qrcode',
    html: '<div style="margin: 20px 0; text-align: center;"><div style="display: inline-block; padding: 18px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px;"><img src="/images/qrcode.svg" style="width: 110px; height: 110px; display: block; margin: 0 auto; border-radius: 4px;" alt="二维码"></div><p style="margin: 10px 0 0; font-size: 14px; font-weight: bold; color: #333;">扫码关注 更多精彩</p><p style="margin: 4px 0 0; font-size: 12px; color: #999;">长按识别二维码关注我们</p></div>',
  },
]
