import { invoke } from '@tauri-apps/api/core'
import type { SearchResult } from '@/stores/types'

export async function searchInProject(root: string, query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('cmd_search_in_project', { root, query })
}

export async function searchInProjectAdv(
  root: string, query: string,
  caseSensitive: boolean, wholeWord: boolean, useRegex: boolean,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('cmd_search_in_project_adv', { root, query, caseSensitive, wholeWord, useRegex })
}

export async function findAndReplace(root: string, query: string, replacement: string, scopeFile: string): Promise<number> {
  return invoke<number>('cmd_find_and_replace', { root, query, replacement, scopeFile })
}

export async function findAndReplaceAdv(
  root: string, query: string, replacement: string, scopeFile: string,
  caseSensitive: boolean, wholeWord: boolean, useRegex: boolean,
): Promise<number> {
  return invoke<number>('cmd_find_and_replace_adv', { root, query, replacement, scopeFile, caseSensitive, wholeWord, useRegex })
}
