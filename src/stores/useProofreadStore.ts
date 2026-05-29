import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RuleItem, CustomRuleGroup } from './types'

export const useProofreadStore = defineStore('proofread', () => {
  const sensitiveWords = ref<string[]>([])
  const sensitiveTemplates = ref<{ name: string; words: string[] }[]>([])
  const customRuleGroups = ref<CustomRuleGroup[]>([
    { name: '词库1', enabled: true, rules: [] as RuleItem[] },
  ])

  return { sensitiveWords, sensitiveTemplates, customRuleGroups }
})
