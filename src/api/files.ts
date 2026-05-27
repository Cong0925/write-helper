import { invoke } from '@tauri-apps/api/core'
import type { FileEntry } from '@/stores/types'

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

export async function moveItem(oldPath: string, newDir: string): Promise<void> {
  return invoke<void>('cmd_move_item', { oldPath, newDir })
}

export async function getNextNumber(dir: string, prefix: string, ext: string): Promise<number> {
  return invoke<number>('cmd_get_next_number', { dir, prefix, ext })
}

export async function readDocxText(path: string): Promise<string> {
  return invoke<string>('cmd_read_docx_text', { path })
}
