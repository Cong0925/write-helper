/**
 * Format checks — text quality issues detectable by pattern.
 */

export interface FormatIssue {
  type: 'format'
  desc: string
  line: number
  col: number
  message: string
  detail: string
  confidence: 'high' | 'medium'
}

/**
 * Check text for format issues.
 */
export function checkFormat(text: string): FormatIssue[] {
  const results: FormatIssue[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines, headings, code fences
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('#')) continue

    // 1. Repeated characters (3+ same consecutive CJK)
    const repeatMatch = line.match(/([一-鿿㐀-䶿])\1{3,}/)
    if (repeatMatch) {
      const ch = repeatMatch[1]
      const full = repeatMatch[0]
      results.push({
        type: 'format',
        desc: `重复字 "${full}"`,
        line: i + 1,
        col: repeatMatch.index! + 1,
        message: `连续重复字 "${full}"`,
        detail: `包含 ${full.length} 个连续的 "${ch}"，疑似笔误`,
        confidence: 'high',
      })
    }

    // 2. Repeated punctuation (3+ same consecutive)
    const puncRepeat = line.match(/([，。！？、；：])\1{2,}/)
    if (puncRepeat) {
      results.push({
        type: 'format',
        desc: `重复标点 "${puncRepeat[0]}"`,
        line: i + 1,
        col: puncRepeat.index! + 1,
        message: `连续重复标点符号`,
        detail: `"${puncRepeat[0]}" 连续出现 ${puncRepeat[0].length} 次`,
        confidence: 'high',
      })
    }

    // 3. Mixed CJK punctuation with spaces (全角符号前后有多余空格)
    const spaceBeforePunc = line.match(/ (，|。|！|？|：|；|、|」|』|】|】|》|’|”)/)
    if (spaceBeforePunc) {
      results.push({
        type: 'format',
        desc: `标点前多余空格`,
        line: i + 1,
        col: spaceBeforePunc.index! + 1,
        message: '全角标点前不应有空格',
        detail: `" ${spaceBeforePunc[1]}" 中的空格建议删除`,
        confidence: 'medium',
      })
    }

    // 4. Long paragraph without punctuation (>80 CJK chars without 。！？)
    if (/[一-鿿]/.test(trimmed)) {
      const noEndPunc = trimmed.replace(/[。！？、，：；]/g, '')
      if (noEndPunc.length > 80 && noEndPunc.length === trimmed.length) {
        // Check if it's actually a long continuous text
        results.push({
          type: 'format',
          desc: `段落缺少断句标点`,
          line: i + 1,
          col: 1,
          message: '段落过长且无断句标点',
          detail: `本段 ${trimmed.length} 字未使用句号、问号、感叹号等断句标点`,
          confidence: 'medium',
        })
      }
    }

    // 5. Unmatched brackets / quotes
    const pairs: [RegExp, string, string, string][] = [
      [/「/g, '「', '」', '左引号「 未闭合'],
      [/」/g, '」', '「', '多余的右引号 」'],
      [/『/g, '『', '』', '左引号『 未闭合'],
      [/』/g, '』', '『', '多余的右引号 』'],
      [/\(/g, '(', ')', '左括号 ( 未闭合'],
      [/\)/g, ')', '(', '多余的右括号 )'],
      [/\[/g, '[', ']', '左括号 [ 未闭合'],
      [/\]/g, ']', '[', '多余的右括号 ]'],
      [/【/g, '【', '】', '左括号【 未闭合'],
      [/】/g, '】', '【', '多余的右括号 】'],
    ]

    for (const [regex, open, close, msg] of pairs) {
      const opens = (line.match(regex) || []).length
      // Count the closing ones — we need the inverse regex
      const closeRegex = new RegExp(close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const closes = (line.match(closeRegex) || []).length
      if (opens !== closes) {
        results.push({
          type: 'format',
          desc: msg,
          line: i + 1,
          col: 1,
          message: msg,
          detail: `行内 ${open} 出现 ${opens} 次，${close} 出现 ${closes} 次`,
          confidence: 'high',
        })
        break // one issue per line for brackets
      }
    }

    // 6. Consecutive ellipsis dots — use … instead of ....
    const dotMatch = line.match(/\.{4,}/)
    if (dotMatch) {
      results.push({
        type: 'format',
        desc: `建议使用中文省略号`,
        line: i + 1,
        col: dotMatch.index! + 1,
        message: '连续英文句点建议改为中文省略号 ……',
        detail: `"${dotMatch[0]}" → "……"`,
        confidence: 'medium',
      })
    }
  }

  return results.sort((a, b) => a.line - b.line || a.col - b.col)
}
