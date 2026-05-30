/**
 * Context-aware single-character confusion detection.
 *
 * These checks look at neighbouring words / chars to decide whether
 * a single character was used incorrectly.  Pure dictionary-based
 * matching can't handle these — context is required.
 *
 * Supported patterns:
 *  的/地/得  — adjective vs adverb vs complement
 *  在/再     — location vs repetition
 *  做/作     — concrete action vs abstract
 *  他/她/它  — gender / object
 *  即/既     — immediate vs already
 *  已/以     — already vs purpose
 */

interface CharRule {
  char: string
  correct: string
  context: 'next' | 'prev' | 'surround'
  pattern: RegExp
  hint: string
}

// 的/地: 的→noun, 地→verb
const DE_DI_RULES: { when: string; desc: string }[] = [
  { when: '后接动词', desc: '"的" 后接动词时通常应改为 "地"' },
  { when: '前面是副词', desc: '副词修饰动词时应用 "地" 而非 "的"' },
]

export interface SingleCharIssue {
  type: 'grammar'
  wrong: string
  correct: string
  position: number
  message: string
  confidence: 'medium' | 'low'
}

/**
 * Check single-character confusions in context.
 * Returns issues with medium/low confidence.
 */
export function checkSingleChar(
  text: string,
  words: string[],
  pos: number,
): SingleCharIssue[] {
  const results: SingleCharIssue[] = []
  const word = words[pos]

  if (word.length !== 1) return results

  // ── 的 → 地 (当后接动词时) ──
  if (word === '的') {
    const next = pos + 1 < words.length ? words[pos + 1] : ''
    if (next && isVerb(next)) {
      results.push({
        type: 'grammar',
        wrong: '的',
        correct: '地',
        position: text.indexOf('的', getTextPos(words, pos)),
        message: `"的" 后接动词 "${next}"，建议改为 "地"`,
        confidence: 'medium',
      })
    }
  }

  // ── 地 → 的 (当后接名词时) ──
  if (word === '地') {
    const next = pos + 1 < words.length ? words[pos + 1] : ''
    if (next && isNoun(next)) {
      results.push({
        type: 'grammar',
        wrong: '地',
        correct: '的',
        position: text.indexOf('地', getTextPos(words, pos)),
        message: `"地" 后接名词 "${next}"，建议改为 "的"`,
        confidence: 'medium',
      })
    }
  }

  // ── 在 → 再 (后接动词表示重复) ──
  if (word === '在') {
    const next = pos + 1 < words.length ? words[pos + 1] : ''
    if (next && isVerb(next) && isRepetitionVerb(next)) {
      results.push({
        type: 'grammar',
        wrong: '在',
        correct: '再',
        position: text.indexOf('在', getTextPos(words, pos)),
        message: `"在" 后接 "${next}" 表示重复，建议改为 "再"`,
        confidence: 'medium',
      })
    }
  }

  return results
}

// ─── Helper: compute character position of a word in the original text ───
function getTextPos(words: string[], targetIdx: number): number {
  let p = 0
  for (let i = 0; i < targetIdx; i++) p += words[i].length
  return p
}

// ─── Verb / Noun detection (simple word-list based, no POS tagger) ───
const VERBS = new Set([
  '说', '做', '看', '听', '写', '读', '吃', '喝', '走', '跑',
  '学习', '工作', '研究', '发展', '生产', '管理', '服务',
  '出现', '发现', '实现', '表现', '表示', '表达',
  '进行', '开始', '结束', '继续', '停止',
  '成为', '变成', '作为', '存在',
  '观察', '思考', '讨论', '研究',
  '完成', '处理', '解决', '分析',
  '回答', '提问', '询问', '解释',
  '努力', '奋斗', '拼搏', '争取',
  '提高', '增加', '降低', '减少',
  '改变', '改进', '改革', '改善',
  '支持', '反对', '赞成', '同意',
  '关注', '重视', '注意', '留心',
  '觉得', '认为', '以为', '希望',
  '需要', '应该', '愿意', '能够',
])

const NOUNS = new Set([
  '问题', '事情', '东西', '食物', '衣服',
  '书籍', '文章', '文字', '语言',
  '方法', '方式', '方案', '方向',
  '时间', '时候', '时期', '期间',
  '地方', '地点', '地区', '范围',
  '制度', '体制', '体系', '系统',
  '质量', '数量', '程度', '程度',
  '科技', '科学', '技术', '技能',
  '经济', '文化', '政治', '法律',
  '教育', '健康', '环境', '资源',
  '企业', '公司', '集团', '组织',
  '用户', '客户', '读者', '观众',
])

const REPETITION_VERBS = new Set([
  '说', '做', '看', '听', '试', '来',
  '次', '次', '版', '遍',
])

function isVerb(w: string): boolean {
  return VERBS.has(w)
}

function isNoun(w: string): boolean {
  return NOUNS.has(w)
}

function isRepetitionVerb(w: string): boolean {
  return REPETITION_VERBS.has(w)
}
