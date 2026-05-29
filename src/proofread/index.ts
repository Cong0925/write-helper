import { checkTypos } from './typoDict'
import { checkSensitive } from './sensitiveDict'
import { checkFormat } from './format'
import { checkGrammar } from './grammar'
import { checkCustom, type CustomRuleGroup } from './customDict'

export type { CustomRuleGroup }

export type ProofreadItem = {
  type: 'typo' | 'sensitive' | 'format' | 'grammar' | 'custom'
  message: string
  detail: string
  line: number
  col: number
  lineNum: number
  colNum: number
  confidence: 'high' | 'medium' | 'low'
  wrong?: string
  correct?: string
}

export interface ProofreadResult {
  typos: ProofreadItem[]
  sensitive: ProofreadItem[]
  format: ProofreadItem[]
  grammar: ProofreadItem[]
  custom: ProofreadItem[]
  total: number
}

export interface ProofreadOptions {
  typo?: boolean
  sensitive?: boolean
  format?: boolean
  grammar?: boolean
  custom?: boolean
}

/**
 * Run all (or selected) proofread checks on the given text.
 */
export function proofreadText(
  text: string,
  sensitiveWords: string[],
  customRuleGroups: CustomRuleGroup[],
  options?: ProofreadOptions,
): ProofreadResult {
  const doTypo = options?.typo !== false
  const doSensitive = options?.sensitive !== false
  const doFormat = options?.format !== false
  const doGrammar = options?.grammar !== false
  const doCustom = options?.custom !== false

  const typos = doTypo ? checkTypos(text).map(t => ({ ...t, lineNum: t.line, colNum: t.col })) : []
  const sensitive = doSensitive ? checkSensitive(text, sensitiveWords).map(t => ({ ...t, lineNum: t.line, colNum: t.col })) : []
  const format = doFormat ? checkFormat(text).map(t => ({ ...t, lineNum: t.line, colNum: t.col })) : []
  const grammar = doGrammar ? checkGrammar(text).map(t => ({ ...t, lineNum: t.line, colNum: t.col })) : []
  const custom = doCustom ? checkCustom(text, customRuleGroups).map(t => ({ ...t, lineNum: t.line, colNum: t.col })) : []

  return {
    typos,
    sensitive,
    format,
    grammar,
    custom,
    total: typos.length + sensitive.length + format.length + grammar.length + custom.length,
  }
}
