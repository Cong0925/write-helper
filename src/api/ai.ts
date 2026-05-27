import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface ProviderInfo {
  id: string
  name: string
  category: string
  defaultEndpoint: string
  models: ModelInfo[]
  requiresApiKey: boolean
  requiresSecretKey: boolean
}

export interface ModelInfo {
  id: string
  name: string
  description: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function getAIProviders(): Promise<ProviderInfo[]> {
  return invoke<ProviderInfo[]>('cmd_ai_get_providers')
}

export async function getKeyStatuses(): Promise<Record<string, boolean>> {
  return invoke<Record<string, boolean>>('cmd_ai_get_key_statuses')
}

export async function saveAIKey(providerId: string, apiKey: string, endpoint: string, defaultModel: string): Promise<void> {
  return invoke<void>('cmd_ai_save_key', { providerId, apiKey, endpoint, defaultModel })
}

export async function deleteAIKey(providerId: string): Promise<void> {
  return invoke<void>('cmd_ai_delete_key', { providerId })
}

export interface WritingSkill {
  id: string
  name: string
  icon: string
  description: string
  systemPrompt: string
  requiresSelection: boolean
}

export interface SavedKeyInfo {
  providerId: string
  hasKey: boolean
  apiKey: string
  endpoint: string
  defaultModel: string
}

export async function getSavedKeys(): Promise<SavedKeyInfo[]> {
  return invoke<SavedKeyInfo[]>('cmd_ai_get_saved_keys')
}

export async function getSkills(): Promise<WritingSkill[]> {
  return invoke<WritingSkill[]>('cmd_ai_get_skills')
}

export async function testAIConnection(providerId: string, apiKey: string, endpoint: string): Promise<string> {
  return invoke<string>('cmd_ai_test_connection', { providerId, apiKey, endpoint })
}

export async function aiChat(
  providerId: string, model: string, endpoint: string,
  messages: ChatMessage[], stream: boolean,
): Promise<string> {
  return invoke<string>('cmd_ai_chat', { providerId, model, endpoint, messages, stream })
}

export async function cancelAIStream(requestId: string): Promise<void> {
  return invoke<void>('cmd_ai_cancel', { requestId })
}

export interface StreamChunk {
  request_id: string
  content: string
  done: boolean
}

export function listenAIChunks(callback: (chunk: StreamChunk) => void): Promise<UnlistenFn> {
  return listen<StreamChunk>('ai:chunk', (event) => {
    callback(event.payload)
  })
}
