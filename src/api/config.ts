import { invoke } from '@tauri-apps/api/core'

export async function getConfig(key: string): Promise<string> {
  return invoke<string>('cmd_get_config', { key })
}

export async function getConfigDir(): Promise<string> {
  return invoke<string>('cmd_get_config_dir')
}

export async function getAllConfig(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('cmd_get_all_config')
}

export async function setConfig(key: string, value: string): Promise<void> {
  return invoke<void>('cmd_set_config', { key, value })
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  return invoke<void>('cmd_set_auto_start', { enabled })
}

export async function getAutoStart(): Promise<boolean> {
  return invoke<boolean>('cmd_get_auto_start')
}
