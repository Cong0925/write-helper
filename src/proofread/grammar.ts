/**
 * Grammar pattern checks (shallow, rule-based).
 * These are low-confidence and marked as "需接入AI模型" in the UI.
 */

export interface GrammarIssue {
  type: 'grammar'
  desc: string
  line: number
  col: number
  message: string
  detail: string
  confidence: 'low'
}

interface GrammarPattern {
  pattern: RegExp
  message: string
  detail: string
}

const patterns: GrammarPattern[] = [
  // "通过...使..." construction
  { pattern: /通过[^。，！？；\n]{3,}使(得)?/g, message: '"通过……使……" 句式略显欧化', detail: '可考虑简化句式' },
  // "由于...因此..." redundant
  { pattern: /由于[^。，！？；\n]{3,}因此/g, message: '"由于……因此……" 语义重复', detail: '"由于" 和 "因此" 保留一个即可' },
  // "因为...所以..." — fine but can be simplified
  // "为...所..." passive
  { pattern: /为[^。，！？；\n]{2,}所[^。，！？；\n]{1,5}(了|的)?/g, message: '"为……所……" 被动句式', detail: '书面语较重，可考虑改为更自然的表达' },
  // Consecutive "了"
  { pattern: /了[^。，！？；\n]{0,5}了/g, message: '连续出现 "了" 字', detail: '"了" 字堆叠，建议精简' },
  // "被" without agent
  { pattern: /被(了|的|他|她|它|我|你|给)/g, message: '"被" 字句缺少施动者', detail: '"被" 后通常应指明动作发出者' },
  // Ambiguous "在" usage
  { pattern: /在[^。，！？；\n]{0,3}中/g, message: '"在……中" 可精简', detail: '可考虑直接去掉 "在……中" 使句子更简洁' },
  // Repeated "不"
  { pattern: /不[^。，！？；\n]{0,5}不/g, message: '双重否定或重复否定', detail: '检查是否否定使用不当' },
  // "有着" — often redundant
  { pattern: /有着/g, message: '"有着" 略显冗余', detail: '建议改为 "有" 或 "具有"' },
  // "进行" — often unnecessary
  { pattern: /进行[了着]?(一个|一项|一次)?[^。，！？；\n]{2,10}/g, message: '"进行" 可省略', detail: '"进行" 在多数情况下是赘词，可直接删除' },
  // "一个" before nouns in Chinese (often redundant)
  { pattern: /是(一个|一名|一位)/g, message: '"是一个/一名/一位" 可精简', detail: '中文中 "是" 后直接跟名词即可' },
  // "所" before verbs (often formal/archaic)
  { pattern: /所[能会要][^。，！？；\n]{1,8}的/g, message: '"所……的" 可精简', detail: '书面语较重，可考虑简化' },
  // "其" used awkwardly
  { pattern: /其[中有]的?[^。，！？；\n]{0,5}是/g, message: '"其……" 代词指代不明', detail: '"其" 作主语时可能指代不明，建议明确主语' },
  // "便" vs "就" — style check
  // "顿时" / "忽然" / "突然" → suddenness marker collisions
  { pattern: /顿时[^。，！？；\n]{0,10}突然/g, message: '"顿时" 和 "突然" 语义重叠', detail: '两个表示突然的词连续使用，建议只保留一个' },
  // "大约...左右" redundant
  { pattern: /大约[^。，！？；\n]{1,10}左右/g, message: '"大约……左右" 语义重复', detail: '"大约" 和 "左右" 保留一个即可' },
  // "几乎...差不多" redundant
  { pattern: /几乎[^。，！？；\n]{1,10}差不多/g, message: '"几乎……差不多" 语义重复', detail: '"几乎" 和 "差不多" 保留一个即可' },
]

/**
 * Check text for shallow grammar/style issues.
 */
export function checkGrammar(text: string): GrammarIssue[] {
  const results: GrammarIssue[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('#')) continue

    for (const p of patterns) {
      p.pattern.lastIndex = 0
      const match = p.pattern.exec(line)
      if (match) {
        results.push({
          type: 'grammar',
          desc: p.message,
          line: i + 1,
          col: match.index + 1,
          message: p.message,
          detail: p.detail,
          confidence: 'low',
        })
        // Only one grammar issue per line per pattern
        break
      }
    }
  }

  return results.sort((a, b) => a.line - b.line || a.col - b.col)
}
