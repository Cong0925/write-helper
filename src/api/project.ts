import { invoke } from '@tauri-apps/api/core'
import type { ProjectInfo, ProjectTypeDefinition } from '@/stores/types'

export async function getProjectTypes(): Promise<ProjectTypeDefinition[]> {
  return invoke<ProjectTypeDefinition[]>('cmd_get_project_types')
}

export async function createProject(root: string, name: string, description?: string, coverPath?: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_create_project', { root, name, description: description || '', coverPath: coverPath || '' })
}

export async function createProjectV2(
  root: string, name: string, description: string, coverPath: string,
  projectType: string, typeConfig: Record<string, any>,
): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_create_project_v2', { root, name, description, coverPath, projectType, typeConfig })
}

export async function createImportProject(root: string, name: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_create_import_project', { root, name })
}

export async function openProject(root: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('cmd_open_project', { root })
}

export async function removeRecentProject(path: string): Promise<void> {
  return invoke<void>('cmd_remove_recent_project', { path })
}

export async function renameProjectConfig(path: string, newName: string): Promise<void> {
  return invoke<void>('cmd_rename_project_config', { path, newName })
}

export async function deleteProjectFolder(path: string): Promise<void> {
  return invoke<void>('cmd_delete_project_folder', { path })
}

export async function openInExplorer(path: string): Promise<void> {
  return invoke<void>('cmd_open_in_explorer', { path })
}
