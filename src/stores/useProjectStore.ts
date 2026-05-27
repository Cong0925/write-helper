import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { ProjectInfo, FileEntry } from './types'

export const useProjectStore = defineStore('project', () => {
  const view = ref<'welcome' | 'main'>('welcome')
  const project = ref<ProjectInfo | null>(null)
  const fileTree = ref<FileEntry[]>([])
  const volumeEntries = ref<FileEntry[]>([])
  const currentFile = ref<{ path: string; name: string } | null>(null)
  const activeVolume = ref('')

  const projectPath = computed(() => project.value?.path || '')
  const projectType = computed(() => project.value?.projectType || 'novel')
  const contentRoot = computed(() => {
    // Derive content root from project type. For new types, fall back to the
    // first directory entry or the project root itself.
    if (projectType.value === 'novel') return '分卷'
    return 'articles'
  })

  async function setProject(p: ProjectInfo | null) {
    project.value = p
    if (p) {
      view.value = 'main'
    }
  }

  function setFileTree(tree: FileEntry[]) {
    fileTree.value = tree
  }

  function setCurrentFile(file: { path: string; name: string } | null) {
    currentFile.value = file
  }

  function setVolumeEntries(entries: FileEntry[]) {
    volumeEntries.value = entries
  }

  function setActiveVolume(vol: string) {
    activeVolume.value = vol
  }

  return {
    view, project, fileTree, volumeEntries, currentFile, activeVolume,
    projectPath, projectType, contentRoot,
    setProject, setFileTree, setCurrentFile, setVolumeEntries, setActiveVolume,
  }
})
