import type { TemplateItem } from '../types'

export const id = 'dynamic-bg'
export const name = '动态背景'
export const icon = '✨'

// 仅保留浅色背景的模板 — 深色背景与文字颜色冲突
export const templates: TemplateItem[] = [
  {
    id: 'dyn-1',
    name: '花瓣飘落',
    category: 'dynamic-bg',
    html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#fce4ec,#fff0f5); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; top:-10%; left:10%; font-size:18px; animation:fall 4s linear infinite;">🌸</div><div style="position:absolute; top:-15%; left:35%; font-size:14px; animation:fall 5s linear 1s infinite;">🌸</div><div style="position:absolute; top:-10%; left:60%; font-size:16px; animation:fall 4.5s linear 2s infinite;">🌸</div><div style="position:absolute; top:-12%; left:80%; font-size:15px; animation:fall 5.5s linear 0.5s infinite;">🌸</div><div style="position:absolute; top:-8%; left:50%; font-size:13px; animation:fall 4.2s linear 1.5s infinite;">🌸</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#d81b60;">🌸 花瓣飘落</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#ad1457;">春日浪漫，温柔氛围</p></div>',
  },
  {
    id: 'dyn-2',
    name: '心形浮动',
    category: 'dynamic-bg',
    html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(135deg,#fce4ec,#f8bbd0); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; left:10%; bottom:0; font-size:18px; animation:float-up 3s ease-in-out infinite;">💖</div><div style="position:absolute; left:30%; bottom:0; font-size:14px; animation:float-up 3.5s ease-in-out 0.8s infinite;">💕</div><div style="position:absolute; left:55%; bottom:0; font-size:16px; animation:float-up 4s ease-in-out 1.5s infinite;">💗</div><div style="position:absolute; left:75%; bottom:0; font-size:15px; animation:float-up 3.2s ease-in-out 2s infinite;">💖</div><div style="position:absolute; left:90%; bottom:0; font-size:13px; animation:float-up 3.8s ease-in-out 0.5s infinite;">💕</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#c2185b;">💕 心形浮动</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#880e4f;">浪漫爱心，甜蜜氛围</p></div>',
  },
  {
    id: 'dyn-3',
    name: '气泡上升',
    category: 'dynamic-bg',
    html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#e0f7fa,#b2ebf2); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; left:8%; bottom:-20px; width:20px; height:20px; border:2px solid rgba(0,150,200,0.4); border-radius:50%; animation:float-up 4s ease-in-out infinite;">&nbsp;</div><div style="position:absolute; left:25%; bottom:-20px; width:14px; height:14px; border:2px solid rgba(0,150,200,0.3); border-radius:50%; animation:float-up 3.5s ease-in-out 1s infinite;">&nbsp;</div><div style="position:absolute; left:45%; bottom:-20px; width:24px; height:24px; border:2px solid rgba(0,150,200,0.35); border-radius:50%; animation:float-up 5s ease-in-out 0.5s infinite;">&nbsp;</div><div style="position:absolute; left:65%; bottom:-20px; width:16px; height:16px; border:2px solid rgba(0,150,200,0.3); border-radius:50%; animation:float-up 3.8s ease-in-out 2s infinite;">&nbsp;</div><div style="position:absolute; left:82%; bottom:-20px; width:18px; height:18px; border:2px solid rgba(0,150,200,0.4); border-radius:50%; animation:float-up 4.2s ease-in-out 1.5s infinite;">&nbsp;</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#00838f;">🫧 气泡上升</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#006064;">轻盈气泡，清爽氛围</p></div>',
  },
  {
    id: 'dyn-4',
    name: '树叶摇曳',
    category: 'dynamic-bg',
    html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#e8f5e9,#c8e6c9); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; top:10%; left:8%; font-size:24px; animation:sway 3s ease-in-out infinite; transform-origin:bottom center;">🌿</div><div style="position:absolute; top:5%; left:40%; font-size:20px; animation:sway 3.5s ease-in-out 0.5s infinite; transform-origin:bottom center;">🍃</div><div style="position:absolute; top:8%; left:70%; font-size:22px; animation:sway 2.8s ease-in-out 1s infinite; transform-origin:bottom center;">🌿</div><div style="position:absolute; top:15%; left:88%; font-size:18px; animation:sway 3.2s ease-in-out 1.5s infinite; transform-origin:bottom center;">🍃</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#2e7d32;">🍃 树叶摇曳</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#1b5e20;">自然清新，治愈氛围</p></div>',
  },
  {
    id: 'dyn-5',
    name: '节日彩带',
    category: 'dynamic-bg',
    html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; top:-5%; left:5%; font-size:20px; animation:fall 4s linear infinite;">🎉</div><div style="position:absolute; top:-8%; left:30%; font-size:16px; animation:fall 3.5s linear 0.8s infinite;">🎊</div><div style="position:absolute; top:-5%; left:55%; font-size:18px; animation:fall 4.5s linear 1.5s infinite;">🎉</div><div style="position:absolute; top:-8%; left:78%; font-size:14px; animation:fall 3.8s linear 2s infinite;">🎊</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.3);">🎉 节日彩带</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:rgba(255,255,255,.9);">欢庆时刻，喜气氛围</p></div>',
  },
  // 以下为追加的 20 个浅色动态背景（无深色、无颜色冲突）
{
  id: 'dyn-6',
  name: '樱花飘落',
  category: 'dynamic-bg',
  html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#fff1f2,#fce7f3); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; top:-10%; left:15%; font-size:16px; animation:fall 4s linear infinite;">🌸</div><div style="position:absolute; top:-15%; left:45%; font-size:14px; animation:fall 4.5s linear 1s;">🌸</div><div style="position:absolute; top:-12%; left:75%; font-size:15px; animation:fall 5s linear 0.5s;">🌸</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#be123c;">🌸 樱花飘落</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#9f1239;">温柔浪漫，少女氛围</p></div>',
},
{
  id: 'dyn-7',
  name: '星星上升',
  category: 'dynamic-bg',
  html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#fefce8,#fffbeb); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; bottom:-10%; left:20%; font-size:16px; animation:float-up 3.5s linear infinite;">⭐</div><div style="position:absolute; bottom:-10%; left:50%; font-size:14px; animation:float-up 4s linear 1s;">⭐</div><div style="position:absolute; bottom:-10%; left:80%; font-size:15px; animation:float-up 3.8s linear 0.5s;">⭐</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#d97706;">⭐ 星星上升</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#b45309;">温暖明亮，治愈温馨</p></div>',
},
{
  id: 'dyn-8',
  name: '轻雪飘落',
  category: 'dynamic-bg',
  html: '<div style="margin:20px 0; padding:30px 20px; background:linear-gradient(180deg,#f8fafc,#f1f5f9); border-radius:12px; text-align:center; position:relative; overflow:hidden; min-height:150px;"><div style="position:absolute; top:-10%; left:18%; font-size:14px; animation:fall 4s linear infinite;">❄️</div><div style="position:absolute; top:-15%; left:48%; font-size:12px; animation:fall 4.5s linear 1s;">❄️</div><div style="position:absolute; top:-12%; left:78%; font-size:13px; animation:fall 5s linear 0.5s;">❄️</div><p style="position:relative; z-index:1; margin:30px 0 0; font-size:16px; font-weight:bold; color:#334155;">❄️ 轻雪飘落</p><p style="position:relative; z-index:1; margin:8px 0 0; font-size:13px; color:#475569;">干净极简，冬季氛围</p></div>',
},

]
