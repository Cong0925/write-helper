import { Node } from '@tiptap/core'

export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      html: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="html-block"]' }]
  },

  renderHTML({ node }) {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-type', 'html-block')
    wrapper.style.cssText = 'all:initial;'
    wrapper.innerHTML = node.attrs.html as string
    return wrapper
  },
})
