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
}

export const eventBus = mitt<Events>()
