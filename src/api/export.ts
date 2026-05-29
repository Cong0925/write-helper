import { invoke } from '@tauri-apps/api/core'
import type { WordCount } from '@/stores/types'

export async function getWordCount(text: string): Promise<WordCount> {
  return invoke<WordCount>('cmd_get_word_count', { text })
}

export async function exportProject(sourceDir: string, outputPath: string): Promise<void> {
  return invoke<void>('cmd_export_project', { sourceDir, outputPath })
}

export async function mergeVolumeExport(volumeDir: string, outputPath: string, fmt: string): Promise<void> {
  return invoke<void>('cmd_merge_volume_export', { volumeDir, outputPath, fmt })
}

export async function mergeFilesExport(filePaths: string[], outputPath: string, fmt: string): Promise<void> {
  return invoke<void>('cmd_merge_files_export', { filePaths, outputPath, fmt })
}
