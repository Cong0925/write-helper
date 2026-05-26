import type { ProofreadItem } from './index'

export interface CustomRuleGroup {
  name: string
  enabled: boolean
  rules: { detect: string; correct: string }[]
}

export function checkCustom(text: string, groups: CustomRuleGroup[]): ProofreadItem[] {
  const results: ProofreadItem[] = []

  // Collect all enabled rules
  const rules: { detect: string; correct: string }[] = []
  for (const g of groups) {
    if (!g.enabled) continue
    for (const r of g.rules) {
      const d = r.detect.trim()
      if (d) rules.push({ detect: d, correct: r.correct.trim() })
    }
  }
  if (!rules.length) return results

  for (const rule of rules) {
    const detect = rule.detect
    let searchFrom = 0

    while (true) {
      const idx = text.indexOf(detect, searchFrom)
      if (idx === -1) break

      const textBefore = text.slice(0, idx)
      const lineNum = textBefore.split('\n').length
      const lastNewline = textBefore.lastIndexOf('\n')
      const colNum = lastNewline === -1 ? idx + 1 : idx - lastNewline

      results.push({
        type: 'custom',
        message: `"${detect}"${rule.correct ? ` → ${rule.correct}` : '（待修正）'}`,
        detail: `自定义纠错: ${detect}`,
        line: lineNum,
        col: colNum,
        lineNum,
        colNum,
        confidence: 'high',
        wrong: detect,
        correct: rule.correct || '',
      })

      searchFrom = idx + 1
    }
  }

  return results
}
