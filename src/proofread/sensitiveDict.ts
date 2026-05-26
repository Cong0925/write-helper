/**
 * Sensitive / dangerous word detection.
 * Built-in minimal list; the user manages the real list via the UI.
 */

export interface SensitiveEntry {
  word: string
  category: string
}

/** Minimal built-in defaults — user is expected to add their own. */
export const defaultSensitiveWords: string[] = []

/**
 * Check text for sensitive words.
 */
export function checkSensitive(
  text: string,
  wordList: string[],
): {
  type: 'sensitive'
  word: string
  line: number
  col: number
  message: string
  detail: string
  confidence: 'high'
}[] {
  const results: {
    type: 'sensitive'
    word: string
    line: number
    col: number
    message: string
    detail: string
    confidence: 'high'
  }[] = []

  if (!wordList.length) return results

  // Sort by length descending for longest-match-first
  const sorted = [...wordList].sort((a, b) => b.length - a.length)

  const lines = text.split('\n')
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    for (const word of sorted) {
      let startIdx = 0
      while (true) {
        const idx = line.indexOf(word, startIdx)
        if (idx === -1) break
        results.push({
          type: 'sensitive',
          word,
          line: lineIdx + 1,
          col: idx + 1,
          message: `包含敏感词 "${word}"`,
          detail: `第 ${lineIdx + 1} 行第 ${idx + 1} 列`,
          confidence: 'high',
        })
        startIdx = idx + word.length
      }
    }
  }

  return results.sort((a, b) => a.line - b.line || a.col - b.col)
}
