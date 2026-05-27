export interface TemplateItem {
  id: string
  name: string
  category: string
  html: string
  description?: string
}

export interface TemplateCategory {
  id: string
  name: string
  icon: string
}

export const categories: TemplateCategory[] = [
  { id: 'follow', name: '引导关注', icon: '👋' },
  { id: 'title', name: '标题', icon: '🔤' },
  { id: 'body', name: '正文', icon: '📝' },
  { id: 'image-text', name: '图文模板', icon: '🖼' },
  { id: 'svg', name: 'SVG黑科技', icon: '✨' },
  { id: 'divider', name: '分割线', icon: '➖' },
  { id: 'emoji', name: '表情/符号', icon: '😊' },
  { id: 'bg', name: '动态背景', icon: '🌈' },
  { id: 'qrcode', name: '二维码', icon: '📱' },
  { id: 'footer', name: '底部提示', icon: '👣' },
]

export const templates: TemplateItem[] = [
  // ===== 引导关注 =====
  {
    id: 'follow-1',
    name: '蓝字关注',
    category: 'follow',
    html: '<p style="text-align: center; margin: 20px 0; font-size: 14px; color: #888;">- <span style="color: #4a7dd4; cursor: pointer;">点击蓝字关注</span> 获取更多内容 -</p>',
  },
  {
    id: 'follow-2',
    name: '卡片关注',
    category: 'follow',
    html: '<div style="margin: 20px 0; padding: 20px; background: #f5f7fa; border-radius: 8px; text-align: center;"><p style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: #333;">📌 喜欢这篇文章吗？</p><p style="margin: 0 0 14px; font-size: 13px; color: #888;">点击下方关注，不错过每一次更新</p><p style="margin: 0;"><a style="display: inline-block; padding: 8px 28px; background: #4a7dd4; color: #fff; border-radius: 20px; text-decoration: none; font-size: 14px;">关注我们</a></p></div>',
  },
  {
    id: 'follow-3',
    name: '简单提示',
    category: 'follow',
    html: '<p style="text-align: center; margin: 15px 0; font-size: 13px; color: #aaa;">↑ 如果喜欢，请点个「<span style="color: #e74c3c;">♥</span> 在看」</p>',
  },
  {
    id: 'follow-4',
    name: '公众号卡片',
    category: 'follow',
    html: '<div style="margin: 20px 0; padding: 16px; border: 1px solid #e8e8e8; border-radius: 8px; display: flex; align-items: center; gap: 12px;"><div style="width: 50px; height: 50px; background: #4a7dd4; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; flex-shrink: 0;">✎</div><div style="flex: 1;"><p style="margin: 0 0 2px; font-size: 15px; font-weight: bold; color: #333;">写作助手</p><p style="margin: 0; font-size: 12px; color: #999;">分享创作技巧与优质内容</p></div><a style="padding: 6px 16px; background: #4a7dd4; color: #fff; border-radius: 14px; text-decoration: none; font-size: 12px; flex-shrink: 0;">关注</a></div>',
  },

  // ===== 标题 =====
  {
    id: 'title-1',
    name: '简约大标题',
    category: 'title',
    html: '<h1 style="text-align: center; font-size: 22px; font-weight: bold; color: #333; margin: 25px 0 15px; line-height: 1.5;">这里写你的标题</h1>',
  },
  {
    id: 'title-2',
    name: '带装饰线标题',
    category: 'title',
    html: '<div style="display: flex; align-items: center; margin: 25px 0 15px;"><span style="flex: 1; height: 1px; background: #4a7dd4;"></span><h2 style="margin: 0 16px; font-size: 18px; font-weight: bold; color: #4a7dd4; white-space: nowrap;">标题文字</h2><span style="flex: 1; height: 1px; background: #4a7dd4;"></span></div>',
  },
  {
    id: 'title-3',
    name: '序号标题',
    category: 'title',
    html: '<div style="display: flex; align-items: flex-start; gap: 10px; margin: 20px 0;"><span style="display: inline-flex; width: 28px; height: 28px; background: #4a7dd4; color: #fff; border-radius: 50%; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; flex-shrink: 0;">1</span><h3 style="margin: 2px 0 0; font-size: 17px; font-weight: bold; color: #333; line-height: 1.4;">标题内容</h3></div>',
  },
  {
    id: 'title-4',
    name: '渐变背景标题',
    category: 'title',
    html: '<h3 style="text-align: center; padding: 12px 20px; background: linear-gradient(135deg, #4a7dd4, #7c5cbf); color: #fff; border-radius: 6px; font-size: 17px; margin: 20px 0;">标题文字</h3>',
  },
  {
    id: 'title-5',
    name: '左边框标题',
    category: 'title',
    html: '<h3 style="padding: 6px 0 6px 14px; border-left: 4px solid #4a7dd4; font-size: 17px; font-weight: bold; color: #333; margin: 18px 0;">标题文字</h3>',
  },

  // ===== 正文 =====
  {
    id: 'body-1',
    name: '正文段落',
    category: 'body',
    html: '<p style="margin: 12px 0; font-size: 15px; line-height: 1.8; color: #444; text-indent: 2em;">这里是正文内容。微信公众号文章的正文字号建议使用 15px-16px，行高 1.8 左右，这样在手机上阅读体验最佳。</p>',
  },
  {
    id: 'body-2',
    name: '引用框',
    category: 'body',
    html: '<blockquote style="margin: 15px 0; padding: 12px 16px; background: #f5f7fa; border-left: 4px solid #4a7dd4; border-radius: 0 6px 6px 0; color: #666; font-size: 14px; line-height: 1.7;">这是一个引用样式的正文块，适合用来强调某句话或引用某段文字。</blockquote>',
  },
  {
    id: 'body-3',
    name: '背景框正文',
    category: 'body',
    html: '<div style="margin: 15px 0; padding: 16px 18px; background: #f0f4f9; border-radius: 8px; font-size: 14px; line-height: 1.8; color: #444;"><p style="margin: 0; text-indent: 2em;">带灰色背景的正文块，适合需要突出显示的内容段落，与纯白背景形成视觉区分。</p></div>',
  },
  {
    id: 'body-4',
    name: '提示条',
    category: 'body',
    html: '<div style="margin: 15px 0; padding: 10px 14px; display: flex; align-items: flex-start; gap: 8px; background: #fff8e1; border-radius: 6px; border-left: 4px solid #ffc107;"><span style="font-size: 16px; flex-shrink: 0;">💡</span><p style="margin: 0; font-size: 13px; color: #8a7a4a; line-height: 1.6;">温馨提示：这里是提示性文字内容。</p></div>',
  },
  {
    id: 'body-5',
    name: '双栏列表',
    category: 'body',
    html: '<div style="display: flex; gap: 16px; margin: 15px 0;"><div style="flex: 1; padding: 12px; background: #e8f0fe; border-radius: 8px; text-align: center;"><p style="margin: 0; font-size: 13px; color: #4a7dd4; font-weight: bold;">特点一</p></div><div style="flex: 1; padding: 12px; background: #e8f0fe; border-radius: 8px; text-align: center;"><p style="margin: 0; font-size: 13px; color: #4a7dd4; font-weight: bold;">特点二</p></div></div>',
  },

  // ===== 图文模板 =====
  {
    id: 'imgtxt-1',
    name: '左图右文',
    category: 'image-text',
    html: '<div style="display: flex; gap: 14px; margin: 18px 0; align-items: center;"><div style="width: 40%; flex-shrink: 0;"><img src="https://via.placeholder.com/300x200/4a7dd4/ffffff?text=Image" style="width: 100%; border-radius: 6px; display: block;" alt="image"></div><div style="flex: 1;"><h4 style="margin: 0 0 6px; font-size: 15px; font-weight: bold; color: #333;">标题文字</h4><p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">这里是描述文字，简洁明了地说明图片相关内容。</p></div></div>',
  },
  {
    id: 'imgtxt-2',
    name: '上图下文',
    category: 'image-text',
    html: '<div style="margin: 18px 0;"><img src="https://via.placeholder.com/600x300/7c5cbf/ffffff?text=Image" style="width: 100%; border-radius: 8px; display: block;" alt="image"><div style="padding: 12px 0;"><h4 style="margin: 0 0 4px; font-size: 16px; font-weight: bold; color: #333;">标题文字</h4><p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">图片下方的描述文字。</p></div></div>',
  },
  {
    id: 'imgtxt-3',
    name: '多图网格',
    category: 'image-text',
    html: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0;"><img src="https://via.placeholder.com/300x300/e74c3c/ffffff?text=1" style="width: 100%; border-radius: 6px; display: block;" alt="1"><img src="https://via.placeholder.com/300x300/27ae60/ffffff?text=2" style="width: 100%; border-radius: 6px; display: block;" alt="2"><img src="https://via.placeholder.com/300x300/f39c12/ffffff?text=3" style="width: 100%; border-radius: 6px; display: block;" alt="3"><img src="https://via.placeholder.com/300x300/4a7dd4/ffffff?text=4" style="width: 100%; border-radius: 6px; display: block;" alt="4"></div>',
  },
  {
    id: 'imgtxt-4',
    name: '全宽图片',
    category: 'image-text',
    html: '<div style="margin: 18px 0;"><img src="https://via.placeholder.com/800x400/9b59b6/ffffff?text=Full+Width" style="width: 100%; border-radius: 4px; display: block;" alt="full-width"><p style="margin: 4px 0 0; text-align: center; font-size: 12px; color: #aaa;">图片说明文字</p></div>',
  },

  // ===== SVG黑科技 =====
  {
    id: 'svg-1',
    name: '点击展开',
    category: 'svg',
    html: '<div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; text-align: center; color: #fff;"><p style="margin: 0 0 10px; font-size: 18px; font-weight: bold;">✨ 点击展开</p><p style="margin: 0; font-size: 13px; opacity: 0.9;">（SVG 交互动效区域）</p><div style="margin-top: 14px; padding: 12px; background: rgba(255,255,255,0.15); border-radius: 8px; font-size: 13px;">隐藏内容，点击后展开显示</div></div>',
  },
  {
    id: 'svg-2',
    name: '图片对比',
    category: 'svg',
    html: '<div style="margin: 20px 0; position: relative; border-radius: 10px; overflow: hidden;"><img src="https://via.placeholder.com/600x300/e74c3c/ffffff?text=Before" style="width: 100%; display: block;" alt="before"><div style="position: absolute; top: 0; right: 0; bottom: 0; width: 50%; overflow: hidden; border-left: 2px solid #fff;"><img src="https://via.placeholder.com/600x300/27ae60/ffffff?text=After" style="width: 200%; max-width: 600px; display: block;" alt="after"></div><span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">↔</span></div>',
  },
  {
    id: 'svg-3',
    name: '渐变标题特效',
    category: 'svg',
    html: '<h2 style="text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; background: linear-gradient(90deg, #f43b47, #453a94, #4a7dd4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">渐变特效标题</h2>',
  },

  // ===== 分割线 =====
  {
    id: 'divider-1',
    name: '简单横线',
    category: 'divider',
    html: '<hr style="border: none; border-top: 1px solid #e0e2e8; margin: 25px 0;">',
  },
  {
    id: 'divider-2',
    name: '虚线分割',
    category: 'divider',
    html: '<hr style="border: none; border-top: 1px dashed #d0d2d8; margin: 25px 0;">',
  },
  {
    id: 'divider-3',
    name: '装饰花式',
    category: 'divider',
    html: '<div style="text-align: center; margin: 25px 0; font-size: 14px; color: #ccc; letter-spacing: 8px;">✦ ✦ ✦</div>',
  },
  {
    id: 'divider-4',
    name: '渐变分割',
    category: 'divider',
    html: '<div style="margin: 25px 0; height: 2px; background: linear-gradient(90deg, transparent, #4a7dd4, transparent);"></div>',
  },
  {
    id: 'divider-5',
    name: '波浪分割',
    category: 'divider',
    html: '<div style="text-align: center; margin: 20px 0; font-size: 20px; color: #d0d2d8;">~ ~ ~</div>',
  },
  {
    id: 'divider-6',
    name: '图案分割',
    category: 'divider',
    html: '<div style="text-align: center; margin: 20px 0; font-size: 16px; color: #ccc;">◇◆◇◆◇</div>',
  },

  // ===== 表情/符号 =====
  {
    id: 'emoji-1',
    name: 'emoji 列表',
    category: 'emoji',
    html: '<ul style="list-style: none; padding: 0; margin: 15px 0;"><li style="padding: 6px 0; font-size: 15px; color: #444;">✅ 已完成事项</li><li style="padding: 6px 0; font-size: 15px; color: #444;">📌 重要内容</li><li style="padding: 6px 0; font-size: 15px; color: #444;">⭐ 重点推荐</li><li style="padding: 6px 0; font-size: 15px; color: #444;">🔥 热门话题</li></ul>',
  },
  {
    id: 'emoji-2',
    name: '图标标签',
    category: 'emoji',
    html: '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0;"><span style="padding: 4px 12px; background: #e8f0fe; color: #4a7dd4; border-radius: 12px; font-size: 13px;">📖 阅读</span><span style="padding: 4px 12px; background: #fce4ec; color: #e74c3c; border-radius: 12px; font-size: 13px;">❤️ 喜欢</span><span style="padding: 4px 12px; background: #e8f5e9; color: #27ae60; border-radius: 12px; font-size: 13px;">📌 收藏</span><span style="padding: 4px 12px; background: #fff8e1; color: #f39c12; border-radius: 12px; font-size: 13px;">💬 评论</span></div>',
  },
  {
    id: 'emoji-3',
    name: '符号装饰',
    category: 'emoji',
    html: '<p style="text-align: center; margin: 15px 0; font-size: 24px; color: #ccc; letter-spacing: 12px;">♠ ♥ ♦ ♣</p>',
  },

  // ===== 动态背景 =====
  {
    id: 'bg-1',
    name: '渐变背景文字',
    category: 'bg',
    html: '<div style="margin: 20px 0; padding: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; text-align: center;"><p style="margin: 0; font-size: 18px; font-weight: bold; color: #fff;">重点内容</p><p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">背景渐变的高亮内容块</p></div>',
  },
  {
    id: 'bg-2',
    name: '波浪背景',
    category: 'bg',
    html: '<div style="margin: 20px 0; padding: 24px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; text-align: center; color: #fff;"><p style="margin: 0; font-size: 16px; font-weight: bold;">🌸 粉红渐变背景</p><p style="margin: 8px 0 0; font-size: 13px; opacity: 0.9;">适合女性向、生活类内容</p></div>',
  },
  {
    id: 'bg-3',
    name: '深色强调',
    category: 'bg',
    html: '<div style="margin: 20px 0; padding: 20px; background: #2c3e50; border-radius: 10px; text-align: center;"><p style="margin: 0; font-size: 16px; font-weight: bold; color: #ecf0f1;">深色背景强调文字</p><p style="margin: 8px 0 0; font-size: 12px; color: #bdc3c7;">适合科技感、正式内容</p></div>',
  },

  // ===== 二维码 =====
  {
    id: 'qrcode-1',
    name: '简约二维码',
    category: 'qrcode',
    html: '<div style="margin: 20px 0; text-align: center;"><div style="display: inline-block; padding: 14px; background: #fff; border: 1px solid #e0e2e8; border-radius: 8px;"><div style="width: 120px; height: 120px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin: 0 auto;"><span style="font-size: 12px; color: #999;">二维码</span></div></div><p style="margin: 8px 0 0; font-size: 13px; color: #888;">扫码关注公众号</p></div>',
  },
  {
    id: 'qrcode-2',
    name: '带边框二维码',
    category: 'qrcode',
    html: '<div style="margin: 20px 0; text-align: center;"><div style="display: inline-block; padding: 18px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px;"><div style="width: 110px; height: 110px; background: #fff; display: flex; align-items: center; justify-content: center; border-radius: 4px;"><span style="font-size: 12px; color: #999;">QR</span></div></div><p style="margin: 10px 0 0; font-size: 14px; font-weight: bold; color: #333;">扫码关注 更多精彩</p><p style="margin: 4px 0 0; font-size: 12px; color: #999;">长按识别二维码关注我们</p></div>',
  },

  // ===== 底部提示 =====
  {
    id: 'footer-1',
    name: '阅读原文',
    category: 'footer',
    html: '<div style="margin: 25px 0 15px; padding: 16px 0; border-top: 1px solid #e0e2e8; text-align: center;"><p style="margin: 0 0 6px; font-size: 14px; color: #333; font-weight: bold;">📖 阅读原文</p><p style="margin: 0;"><a style="color: #4a7dd4; text-decoration: none; font-size: 13px;">查看完整内容 →</a></p></div>',
  },
  {
    id: 'footer-2',
    name: '推荐阅读',
    category: 'footer',
    html: '<div style="margin: 25px 0 15px; padding: 18px; background: #f5f7fa; border-radius: 8px;"><p style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #333;">📚 推荐阅读</p><p style="margin: 0 0 6px;"><a style="color: #4a7dd4; text-decoration: none; font-size: 13px;">▶ 上一篇精彩文章</a></p><p style="margin: 0;"><a style="color: #4a7dd4; text-decoration: none; font-size: 13px;">▶ 另一篇相关推荐</a></p></div>',
  },
  {
    id: 'footer-3',
    name: '互动引导',
    category: 'footer',
    html: '<div style="margin: 25px 0 15px; text-align: center;"><p style="margin: 0 0 8px; font-size: 14px; font-weight: bold; color: #333;">💬 一起来讨论</p><p style="margin: 0 0 12px; font-size: 13px; color: #888;">欢迎在评论区分享你的看法</p><div style="display: flex; justify-content: center; gap: 16px;"><span style="padding: 6px 18px; border: 1px solid #e0e2e8; border-radius: 16px; font-size: 13px; color: #666; cursor: pointer;">点赞 👍</span><span style="padding: 6px 18px; border: 1px solid #e0e2e8; border-radius: 16px; font-size: 13px; color: #666; cursor: pointer;">在看 ❤</span><span style="padding: 6px 18px; border: 1px solid #e0e2e8; border-radius: 16px; font-size: 13px; color: #666; cursor: pointer;">分享 ↗</span></div></div>',
  },
  {
    id: 'footer-4',
    name: '底部关注引导',
    category: 'footer',
    html: '<div style="margin: 25px 0 10px; padding: 20px; background: #2c3e50; border-radius: 10px; text-align: center; color: #fff;"><p style="margin: 0 0 6px; font-size: 16px; font-weight: bold;">感谢阅读</p><p style="margin: 0 0 14px; font-size: 13px; opacity: 0.8;">如果觉得有帮助，分享给更多朋友吧</p><span style="display: inline-block; padding: 8px 24px; border: 1px solid rgba(255,255,255,0.4); border-radius: 20px; font-size: 13px; color: #fff; cursor: pointer;">分享文章</span></div>',
  },
]

export function getTemplatesByCategory(categoryId: string): TemplateItem[] {
  return templates.filter(t => t.category === categoryId)
}

export function getTemplateById(id: string): TemplateItem | undefined {
  return templates.find(t => t.id === id)
}
