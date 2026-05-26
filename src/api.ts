import { invoke } from '@tauri-apps/api/core'
import type { ProjectInfo, FileEntry, WordCount, SearchResult } from './store'

export async function createProject(root: string, name: string, description?: string, coverPath?: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_create_project', { root, name, description: description || '', coverPath: coverPath || '' })
}

export async function createImportProject(root: string, name: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_create_import_project', { root, name })
}

export async function openProject(root: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_open_project', { root })
}

export async function readDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('cmd_read_directory', { path })
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>('cmd_read_file', { path })
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke<void>('cmd_write_file', { path, content })
}

export async function createFile(path: string): Promise<void> {
  return invoke<void>('cmd_create_file', { path })
}

export async function createDirectory(path: string): Promise<void> {
  return invoke<void>('cmd_create_directory', { path })
}

export async function renameItem(oldPath: string, newName: string): Promise<void> {
  return invoke<void>('cmd_rename_item', { oldPath, newName })
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('cmd_rename_file', { oldPath, newPath })
}

export async function deleteItem(path: string): Promise<void> {
  return invoke<void>('cmd_delete_item', { path })
}

export async function getRecentProjects(): Promise<ProjectInfo[]> {
  return invoke<ProjectInfo[]>('cmd_get_recent_projects')
}

export async function getWordCount(text: string): Promise<WordCount> {
  return invoke<WordCount>('cmd_get_word_count', { text })
}

export async function exportProject(sourceDir: string, outputPath: string): Promise<void> {
  return invoke<void>('cmd_export_project', { sourceDir, outputPath })
}

export async function searchInProject(root: string, query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('cmd_search_in_project', { root, query })
}

export async function findAndReplace(root: string, query: string, replacement: string, scopeFile: string): Promise<number> {
  return invoke<number>('cmd_find_and_replace', { root, query, replacement, scopeFile })
}

export async function getNextNumber(dir: string, prefix: string, ext: string): Promise<number> {
  return invoke<number>('cmd_get_next_number', { dir, prefix, ext })
}

export async function searchInProjectAdv(
  root: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  useRegex: boolean,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('cmd_search_in_project_adv', { root, query, caseSensitive, wholeWord, useRegex })
}

export async function findAndReplaceAdv(
  root: string,
  query: string,
  replacement: string,
  scopeFile: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  useRegex: boolean,
): Promise<number> {
  return invoke<number>('cmd_find_and_replace_adv', { root, query, replacement, scopeFile, caseSensitive, wholeWord, useRegex })
}

export async function mergeVolumeExport(volumeDir: string, outputPath: string, fmt: string): Promise<void> {
  return invoke<void>('cmd_merge_volume_export', { volumeDir, outputPath, fmt })
}

export async function mergeFilesExport(filePaths: string[], outputPath: string, fmt: string): Promise<void> {
  return invoke<void>('cmd_merge_files_export', { filePaths, outputPath, fmt })
}

export async function moveItem(oldPath: string, newDir: string): Promise<void> {
  return invoke<void>('cmd_move_item', { oldPath, newDir })
}

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

export async function readDocxText(path: string): Promise<string> {
  return invoke<string>('cmd_read_docx_text', { path })
}

export async function removeRecentProject(path: string): Promise<void> {
  return invoke<void>('cmd_remove_recent_project', { path })
}

export async function openInExplorer(path: string): Promise<void> {
  return invoke<void>('cmd_open_in_explorer', { path })
}

export async function deleteProjectFolder(path: string): Promise<void> {
  return invoke<void>('cmd_delete_project_folder', { path })
}

export async function renameProjectConfig(path: string, newName: string): Promise<void> {
  return invoke<void>('cmd_rename_project_config', { path, newName })
}
