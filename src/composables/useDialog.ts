import { reactive } from 'vue'

export type DialogMode = 'alert' | 'confirm' | 'prompt'

interface DialogState {
  show: boolean
  mode: DialogMode
  title: string
  message: string
  value: string
  placeholder: string
  resolve: ((value: any) => void) | null
}

const state = reactive<DialogState>({
  show: false,
  mode: 'alert',
  title: '',
  message: '',
  value: '',
  placeholder: '',
  resolve: null,
})

function useDialog() {
  function alert(msg: string): Promise<void> {
    return new Promise((resolve) => {
      state.mode = 'alert'
      state.title = '提示'
      state.message = msg
      state.value = ''
      state.placeholder = ''
      state.resolve = resolve
      state.show = true
    })
  }

  function confirm(msg: string): Promise<boolean> {
    return new Promise((resolve) => {
      state.mode = 'confirm'
      state.title = '确认'
      state.message = msg
      state.value = ''
      state.placeholder = ''
      state.resolve = resolve
      state.show = true
    })
  }

  function prompt(msg: string, value?: string): Promise<string | null> {
    return new Promise((resolve) => {
      state.mode = 'prompt'
      state.title = msg
      state.message = ''
      state.value = value || ''
      state.placeholder = ''
      state.resolve = resolve
      state.show = true
    })
  }

  function close(result?: any) {
    state.show = false
    if (state.resolve) {
      state.resolve(result)
      state.resolve = null
    }
  }

  return { state, alert, confirm, prompt, close }
}

export const dialog = useDialog()
