import type { TemplateItem } from '../types'

export const id = 'svg'
export const name = 'SVG黑科技'
export const icon = '✨'

export const templates: TemplateItem[] = [
  {
    id: 'svg-1',
    name: '三图轮播',
    category: 'svg',
    html: `<div style="width:100%;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <div style="position:relative;width:100%;overflow:hidden;">
    <div style="display:flex;width:300%;animation:carouselAnim 9s infinite ease-in-out;">
      <div style="min-width:33.333%;display:flex;align-items:center;justify-content:center;">
        <img src="/images/carousel-1.svg" style="width:100%;height:auto;display:block;border-radius:0;" data-carousel-slide="0">
      </div>
      <div style="min-width:33.333%;display:flex;align-items:center;justify-content:center;">
        <img src="/images/carousel-2.svg" style="width:100%;height:auto;display:block;border-radius:0;" data-carousel-slide="1">
      </div>
      <div style="min-width:33.333%;display:flex;align-items:center;justify-content:center;">
        <img src="/images/carousel-3.svg" style="width:100%;height:auto;display:block;border-radius:0;" data-carousel-slide="2">
      </div>
    </div>
  </div>
  <div style="display:flex;justify-content:center;gap:8px;padding:8px 0;background:#fafbfc;">
    <span style="width:8px;height:8px;border-radius:50%;background:#4a7dd4;display:inline-block;animation:dotAnim0 9s infinite;"></span>
    <span style="width:8px;height:8px;border-radius:50%;background:#d0d5dd;display:inline-block;animation:dotAnim1 9s infinite;"></span>
    <span style="width:8px;height:8px;border-radius:50%;background:#d0d5dd;display:inline-block;animation:dotAnim2 9s infinite;"></span>
  </div>
  <style>
    @keyframes carouselAnim{0%,28%{transform:translateX(0)}33%,61%{transform:translateX(-33.333%)}66%,94%{transform:translateX(-66.666%)}100%{transform:translateX(0)}}
    @keyframes dotAnim0{0%,28%{background:#4a7dd4}33%,100%{background:#d0d5dd}}
    @keyframes dotAnim1{0%,28%{background:#d0d5dd}33%,61%{background:#4a7dd4}66%,100%{background:#d0d5dd}}
    @keyframes dotAnim2{0%,61%{background:#d0d5dd}66%,94%{background:#4a7dd4}100%{background:#d0d5dd}}
  </style>
</div>`,
  },
]
