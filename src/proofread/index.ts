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
  fixed?: string       // Full corrected sentence (from AI), replaces wrong entirely
}

/** Raw AI proofread result item (parsed from JSON) */
export interface AIProofreadResult {
  type: 'typo' | 'grammar' | 'format' | 'sensitive'
  message: string
  wrong: string
  correct: string      // Brief fix description, e.g. "的应为得"
  fixed: string        // Full corrected sentence
}

/** AI provider configuration for proofread calls */
export interface AIProofreadConfig {
  providerId: string
  model: string
  endpoint: string
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

/* ── AI-powered proofread ── */

/**
 * Call AI to proofread text for the specified types.
 * Uses non-streaming chat for reliable JSON parsing.
 */
export async function aiProofread(
  text: string,
  config: AIProofreadConfig,
  types: ('typo' | 'grammar' | 'format' | 'sensitive')[],
  sensitiveWords?: string[],
): Promise<AIProofreadResult[]> {
  const typeLabels: Record<string, string> = {
    typo: '错别字',
    grammar: '病句/语法',
    format: '格式标点',
    sensitive: '敏感词/风险',
  }
  const typeDesc = types.map(t => typeLabels[t] || t).join('、')

  const typeList = types.map(t => `"${t}"`).join('、')
  let extra = ''
  if (sensitiveWords?.length && types.includes('sensitive')) {
    extra = `\n注意，以下为自定义敏感词/风险词列表，请重点检查文本中是否包含这些词（包含原始词、同音字、形近字、拆分等形式均需标记为敏感词/风险）：\n${sensitiveWords.join('、')}`
  }
  const systemPrompt = `你是一个专业的文本校对助手。对文本进行${typeDesc}检测。${extra}
以JSON数组格式返回结果，每个元素包含：
- type: 问题类型（${typeList}）
- message: 问题描述
- wrong: 原文中出错的完整句子，必须与原文完全一致
- correct: 简要修改说明，如"的应为得"
- fixed: 将wrong替换为正确内容后的完整正确句子

要求：只返回JSON数组，无问题返回[]，不要包含其他文字。`

  try {
    const { aiChat } = await import('../api/ai')
    const response = await aiChat(config.providerId, config.model, config.endpoint, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请检测以下文本的${typeDesc}问题：\n\n${text}` },
    ], false)

    const json = extractJSON(response)
    const items = JSON.parse(json)
    return Array.isArray(items) ? items : []
  } catch (e) {
    console.error('AI proofread failed:', e)
    return []
  }
}

function extractJSON(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  return match ? match[0] : text
}
