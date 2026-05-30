/**
 * Word-level Chinese typo detection pipeline.
 *
 *  1. Chinese word segmentation (FMM → segment words)
 *  2. Word-level error dictionary matching
 *  3. Context-aware single-character checks (的/地/得, 在/再, …)
 *  4. Whitelist filtering
 *
 * No external dependencies, all runs locally in the browser.
 */

import typoData from './typo-data.json'
import { segment, expandVocab } from './segmenter'
import { isWhitelisted } from './whitelist'
import { checkSingleChar } from './singleChar'

export interface TypoEntry {
  wrong: string
  correct: string
}

export interface TypoResult {
  type: 'typo' | 'grammar'
  wrong: string
  correct: string
  line: number
  col: number
  message: string
  detail: string
  confidence: 'high' | 'medium' | 'low'
}

// ─── Build error dictionary (flatten grouped JSON) ───
const rawGroups = typoData as Record<string, Record<string, string>>
const errorDict: Record<string, string> = {}
for (const entries of Object.values(rawGroups)) {
  Object.assign(errorDict, entries)
}

// ─── Expand segmenter vocabulary with all dictionary words ───
expandVocab(Object.keys(errorDict))
expandVocab(Object.values(errorDict))

/**
 * Check text for Chinese typos using word-level matching.
 * Returns an array of detected issues.
 */
export function checkTypos(text: string): TypoResult[] {
  if (!text) return []
  const results: TypoResult[] = []

  // 1. Segment into words
  const words = segment(text)

  // 2. Build line/col tracking
  //    We need to map each word back to its original position in the full text
  let charPos = 0
  const wordPositions: { word: string; start: number; end: number }[] = []
  for (const word of words) {
    // Find this word in the remaining text
    const found = text.indexOf(word, charPos)
    if (found >= 0) {
      wordPositions.push({ word, start: found, end: found + word.length })
      charPos = found + word.length
    } else {
      wordPositions.push({ word, start: charPos, end: charPos + word.length })
      charPos += word.length
    }
  }

  // 3. Check each word against error dictionary
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const pos = wordPositions[i]

    // Skip whitelisted words
    if (isWhitelisted(word)) continue

    // Word-level dictionary check
    const correction = errorDict[word]
    if (correction) {
      // Calculate line number and column
      const lineNum = text.slice(0, pos.start).split('\n').length
      const lastNewline = text.slice(0, pos.start).lastIndexOf('\n')
      const colNum = lastNewline >= 0 ? pos.start - lastNewline : pos.start + 1

      results.push({
        type: 'typo',
        wrong: word,
        correct: correction,
        line: lineNum,
        col: colNum,
        message: `"${word}" 疑似错别字`,
        detail: `建议改为：${correction}`,
        confidence: 'high',
      })
      continue
    }

    // Context-aware single-character checks
    const charIssues = checkSingleChar(text, words, i)
    for (const issue of charIssues) {
      const lineNum = text.slice(0, pos.start).split('\n').length
      const lastNewline = text.slice(0, pos.start).lastIndexOf('\n')
      const colNum = lastNewline >= 0 ? pos.start - lastNewline : pos.start + 1

      results.push({
        type: 'grammar',
        wrong: issue.wrong,
        correct: issue.correct,
        line: lineNum,
        col: colNum,
        message: issue.message,
        detail: '',
        confidence: issue.confidence,
      })
    }
  }

  return results
}

export { errorDict }
