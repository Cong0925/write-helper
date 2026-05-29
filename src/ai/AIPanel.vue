<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { appState } from '../store'
import { aiChat, cancelAIStream, listenAIChunks, getAIProviders, getKeyStatuses, getSkills } from '../api/ai'
import type { ProviderInfo, ChatMessage, StreamChunk, WritingSkill } from '../api/ai'
import type { UnlistenFn } from '@tauri-apps/api/event'

const categoryLabels: Record<string, string> = {
  finance: '财经', tech: '科技', health: '养生', education: '教育',
  entertainment: '娱乐', sports: '体育', fashion: '时尚', food: '美食',
  travel: '旅游', culture: '文化', emotion: '情感', digital: '数码',
  history: '历史', military: '军事', parenting: '育儿', career: '职场',
}

const emit = defineEmits<{ close: [] }>()

// State
const providers = ref<ProviderInfo[]>([])
const keyStatuses = ref<Record<string, boolean>>({})
const selectedProvider = ref('deepseek')
const selectedModel = ref('deepseek-chat')
const userInput = ref('')
const messages = ref<ChatMessage[]>([])
const isStreaming = ref(false)
const streamingText = ref('')
const error = ref('')
const chatContainer = ref<HTMLElement | null>(null)

let unlistenChunks: UnlistenFn | null = null

// Computed
const availableProviders = computed(() => providers.value.filter(p => keyStatuses.value[p.id]))
const currentProvider = computed(() => providers.value.find(p => p.id === selectedProvider.value))
const availableModels = computed(() => currentProvider.value?.models || [])

const skills = ref<WritingSkill[]>([])

const quickCommands = computed(() => skills.value.map(s => ({
  id: s.id,
  label: s.name,
  icon: s.icon,
  prompt: s.systemPrompt,
  requiresSelection: s.requiresSelection,
})))

// Load providers, keys, and skills on mount
async function loadData() {
  try {
    providers.value = await getAIProviders()
    keyStatuses.value = await getKeyStatuses()
    // Default to first configured provider (prefer builtin)
    for (const p of providers.value) {
      if (keyStatuses.value[p.id]) {
        selectedProvider.value = p.id
        selectedModel.value = p.models[0]?.id || ''
        break
      }
    }
  } catch { /* ignore */ }
  try {
    skills.value = await getSkills()
  } catch { /* ignore */ }
}
loadData()

// Select model when provider changes
watch(selectedProvider, (pid) => {
  const p = providers.value.find(pr => pr.id === pid)
  if (p && p.models.length > 0) {
    selectedModel.value = p.models[0].id
  }
})

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

async function sendMessage(systemPrompt?: string, skillLabel?: string) {
  const customText = userInput.value.trim()
  if ((!systemPrompt && !customText) || isStreaming.value) return

  error.value = ''

  // Build context string from project info
  let contextParts: string[] = []
  const p = appState.project
  if (p) {
    const projectTypeName = p.projectType === 'wechat_article' ? '公众号文章' : p.projectType === 'toutiao_article' ? '头条文章' : p.projectType
    contextParts.push(`项目类型：${projectTypeName}`)
    if (p.description) {
      contextParts.push(`作品简介：${p.description}`)
    }
    const catValue = p.typeConfig?.contentCategory
    if (catValue) {
      const catLabel = categoryLabels[catValue] || catValue
      contextParts.push(`内容分类：${catLabel}`)
    }
  }
  const contextStr = contextParts.length > 0 ? '\n\n当前项目信息：\n' + contextParts.join('\n') : ''
  const projectContext = `你是一个专业的写作助手，帮助用户进行创作。${contextStr}\n\n重要规则：如果用户没有明确说明文章类型，默认就是在撰写当前项目类型的文章（公众号文章或头条文章等），请据此提供针对性的写作建议和内容。请根据用户的指令提供高质量的中文写作辅助。`

  // If using a skill, append project context to the skill system prompt
  const effectiveSystemPrompt = systemPrompt
    ? `${systemPrompt}\n\n${projectContext}`
    : projectContext

  const systemMsg: ChatMessage = {
    role: 'system',
    content: effectiveSystemPrompt,
  }

  let userContent: string
  let displayContent: string

  if (systemPrompt && skillLabel) {
    // Skill was selected — include editor selection if available
    const selectedText = getEditorSelection()
    if (selectedText) {
      userContent = `以下是我需要处理的内容：\n\n${selectedText}`
      displayContent = `${skillLabel}: ${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}`
    } else {
      userContent = customText || skillLabel
      displayContent = `${skillLabel}${customText ? ': ' + customText : ''}`
    }
  } else {
    userContent = customText
    displayContent = customText
  }

  messages.value.push({ role: 'user', content: displayContent })
  userInput.value = ''
  scrollToBottom()

  // Build context: system + history + current user message
  const contextMessages: ChatMessage[] = [
    systemMsg,
    ...messages.value.slice(-10),
  ]

  // Replace the last display message with the full prompt
  if (systemPrompt) {
    // Remove the display message we just added, add the real one
    contextMessages.pop()
    contextMessages.push({ role: 'user', content: userContent })
  }

  isStreaming.value = true
  streamingText.value = ''
  scrollToBottom()

  try {
    const endpoint = currentProvider.value?.defaultEndpoint || ''
    const requestId = await aiChat(selectedProvider.value, selectedModel.value, endpoint, contextMessages, true)

    // Listen for stream chunks
    unlistenChunks = await listenAIChunks((chunk: StreamChunk) => {
      if (chunk.request_id === requestId) {
        if (chunk.done) {
          // Finalize
          messages.value.push({ role: 'assistant', content: streamingText.value })
          streamingText.value = ''
          isStreaming.value = false
          scrollToBottom()
          if (unlistenChunks) { unlistenChunks(); unlistenChunks = null }
        } else {
          streamingText.value += chunk.content
          scrollToBottom()
        }
      }
    })
  } catch (e: any) {
    error.value = e?.message || String(e)
    isStreaming.value = false
  }
}

function cancelStream() {
  if (isStreaming.value) {
    // Store partial content
    if (streamingText.value) {
      messages.value.push({ role: 'assistant', content: streamingText.value + ' [已中断]' })
    }
    streamingText.value = ''
    isStreaming.value = false
    if (unlistenChunks) { unlistenChunks(); unlistenChunks = null }
  }
}

function getEditorSelection(): string {
  const view = (window as any).__cmView
  if (view) {
    const range = view.state.selection.main
    if (range.from !== range.to) {
      return view.state.sliceDoc(range.from, range.to)
    }
  }
  return ''
}

function insertContent(text: string) {
  const view = (window as any).__cmView
  if (view) {
    const pos = view.state.selection.main.to
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos, head: pos + text.length },
    })
    view.focus()
  }
}

function copyContent(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

onUnmounted(() => {
  if (unlistenChunks) unlistenChunks()
})
</script>

<template>
  <div class="ai-panel">
    <!-- Header -->
    <div class="ai-header">
      <span class="ai-header-icon">🤖</span>
      <span class="ai-title">AI 写作助手</span>
      <button class="ai-close-btn" @click="$emit('close')" title="关闭">✕</button>
    </div>

    <!-- Model Selector -->
    <div class="ai-config">
      <select v-model="selectedProvider" class="ai-select">
        <option v-for="p in availableProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <select v-model="selectedModel" class="ai-select" style="flex:2;">
        <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
    </div>

    <!-- Quick Commands -->
    <div class="ai-quick-cmds">
      <button
        v-for="cmd in quickCommands"
        :key="cmd.id"
        class="cmd-chip"
        :disabled="isStreaming"
        @click="sendMessage(cmd.prompt, cmd.label)"
      >
        <span class="cmd-icon">{{ cmd.icon }}</span>
        <span>{{ cmd.label }}</span>
      </button>
    </div>

    <!-- Chat Area -->
    <div class="ai-chat" ref="chatContainer">
      <div v-if="messages.length === 0 && !isStreaming" class="ai-empty">
        <p>在编辑器中选中文本，然后点击上方快捷指令</p>
        <p>或在下方输入框输入自然语言指令</p>
      </div>

      <div v-for="(msg, i) in messages" :key="i" class="ai-msg" :class="msg.role">
        <div class="msg-label">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
        <div class="msg-content">{{ msg.content }}</div>
        <div v-if="msg.role === 'assistant'" class="msg-actions">
          <button @click="insertContent(msg.content)" title="插入到编辑器">📥 插入</button>
          <button @click="copyContent(msg.content)" title="复制">📋 复制</button>
        </div>
      </div>

      <!-- Streaming content -->
      <div v-if="isStreaming || streamingText" class="ai-msg assistant">
        <div class="msg-label">AI {{ isStreaming ? '(生成中...)' : '' }}</div>
        <div class="msg-content">{{ streamingText || '...' }}</div>
        <div v-if="!isStreaming && streamingText" class="msg-actions">
          <button @click="insertContent(streamingText)" title="插入到编辑器">📥 插入</button>
          <button @click="copyContent(streamingText)" title="复制">📋 复制</button>
        </div>
      </div>

      <div v-if="error" class="ai-error">{{ error }}</div>
    </div>

    <!-- Input Area -->
    <div class="ai-input-area">
      <textarea
        v-model="userInput"
        class="ai-input"
        placeholder="输入自定义指令，如：帮我把这段改得更像鲁迅的风格..."
        rows="2"
        :disabled="isStreaming"
        @keydown.enter.exact.prevent="sendMessage()"
      ></textarea>
      <div class="ai-input-actions">
        <button v-if="isStreaming" class="btn-cancel" @click="cancelStream">停止生成</button>
        <button v-else class="btn-send" :disabled="!userInput.trim()" @click="sendMessage()">发送</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.ai-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ai-header-icon { font-size: 16px; margin-right: 8px; }

.ai-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.ai-close-btn {
  width: 28px; height: 28px;
  border: none; border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ai-close-btn:hover { background: var(--hover-bg); color: var(--text-primary); }

/* Config bar */
.ai-config {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ai-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.ai-select:focus { border-color: var(--accent-color); }

/* Quick commands */
.ai-quick-cmds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.cmd-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.1s;
}

.cmd-chip:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-light);
}
.cmd-chip:disabled { opacity: 0.4; cursor: not-allowed; }

.cmd-icon { font-size: 12px; }

/* Chat area */
.ai-chat {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.ai-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 40px 20px;
  line-height: 2;
}

.ai-msg {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.7;
}

.ai-msg.user {
  background: var(--accent-light);
  border: 1px solid rgba(74, 125, 212, 0.15);
}

.ai-msg.assistant {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.msg-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.msg-content {
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.msg-actions button {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.1s;
}

.msg-actions button:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-light);
}

.ai-error {
  padding: 10px 14px;
  margin: 8px 0;
  background: rgba(231, 76, 60, 0.08);
  border-radius: 8px;
  color: var(--danger-color);
  font-size: 12px;
}

/* Input area */
.ai-input-area {
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ai-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.5;
}

.ai-input:focus { border-color: var(--accent-color); }
.ai-input:disabled { opacity: 0.5; }
.ai-input::placeholder { color: var(--text-muted); }

.ai-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.btn-send, .btn-cancel {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
}

.btn-send {
  background: var(--accent-color);
  color: #1e1e2e;
}
.btn-send:hover:not(:disabled) { opacity: 0.85; }
.btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-cancel {
  background: var(--danger-color);
  color: #fff;
}
.btn-cancel:hover { opacity: 0.85; }
</style>
