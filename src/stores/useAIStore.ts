import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface AISession {
  id: string
  name: string
  projectPath: string
  startedAt: string
  model: string
  provider: string
  messages: AIMessage[]
}

export const useAIStore = defineStore('ai', () => {
  const sessions = ref<AISession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const streamingContent = ref('')
  const selectedProvider = ref('deepseek')
  const selectedModel = ref('deepseek-chat')

  function createSession(projectPath: string, provider: string, model: string): AISession {
    const id = crypto.randomUUID()
    const session: AISession = {
      id,
      name: `会话 ${sessions.value.length + 1}`,
      projectPath,
      startedAt: new Date().toISOString(),
      model,
      provider,
      messages: [],
    }
    sessions.value.unshift(session)
    activeSessionId.value = id
    return session
  }

  function addMessage(sessionId: string, msg: AIMessage) {
    const s = sessions.value.find(s => s.id === sessionId)
    if (s) s.messages.push(msg)
  }

  function appendStreamChunk(chunk: string) {
    streamingContent.value += chunk
  }

  return {
    sessions, activeSessionId, isStreaming, streamingContent,
    selectedProvider, selectedModel,
    createSession, addMessage, appendStreamChunk,
  }
})
