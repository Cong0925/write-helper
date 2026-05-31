import mitt from 'mitt'
import type { ProjectInfo, SearchResult } from '@/stores/types'

type Events = {
  'project:opened': { project: ProjectInfo }
  'project:closed': void
  'file:changed': { path: string; content: string }
  'file:saved': { path: string }
  'file:renamed': { oldPath: string; newPath: string }
  'editor:contentChange': { content: string }
  'ui:themeChanged': { theme: 'light' | 'dark' }
  'search:resultsChanged': { results: SearchResult[] }
  /** Ask FolderPanel/CharacterPanel to open a file and optionally position to a match. */
  'panel:openFile': { folderDir: string; filePath: string; fileName: string; matchIndex?: number; query?: string }
  /** Ask FolderPanel/CharacterPanel to reload the currently-open file from disk. */
  'panel:refreshContent': { folderDir: string }
}

export const eventBus = mitt<Events>()
