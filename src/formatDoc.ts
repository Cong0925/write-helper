import { getEditorView } from './editorHelper'

export function formatCurrentDoc() {
  const view = getEditorView()
  if (!view) return

  const doc = view.state.doc
  const text = doc.toString()
  const formatted = formatText(text)
  if (formatted === text) return

  view.dispatch({
    changes: { from: 0, to: doc.length, insert: formatted },
  })
  view.focus()
}

function formatText(text: string): string {
  let s = text

  // 1. Trim leading/trailing whitespace on each line
  s = s.split('\n').map(line => line.trim()).join('\n')

  // 2. Collapse 3+ consecutive blank lines into 2
  s = s.replace(/\n{3,}/g, '\n\n')

  // 3. Renumber ordered lists and align list continuation lines
  s = formatLists(s)

  // 4. Unify half-width punctuation to full-width (CJK context)
  //    Skip URLs, code blocks, and inline code
  const lines = s.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }
    if (inCodeBlock || trimmed.startsWith('    ') || trimmed.startsWith('\t')) {
      result.push(line)
      continue
    }
    // Convert punctuation but preserve URL patterns
    if (/^https?:\/\//i.test(trimmed)) {
      result.push(line)
      continue
    }
    let processed = line
    processed = replacePunctuation(processed)
    // 5. Add space between CJK and Latin characters
    processed = addCjkSpacing(processed)
    result.push(processed)
  }
  s = result.join('\n')

  // 6. First-line indent: add 全角空格 to paragraphs not already indented
  const paragraphs = s.split(/\n\n+/)
  const indented = paragraphs.map(p => {
    const trimmed = p.trim()
    if (!trimmed) return p
    // Skip headings, blockquotes, list items, code
    if (/^(# |>|\* |- |\d+\. |\t| {4})/.test(trimmed)) return p
    if (trimmed.startsWith('　　')) return p // already indented
    return '　　' + trimmed
  })
  s = indented.join('\n\n')

  return s
}

function formatLists(s: string): string {
  const lines = s.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (olMatch) {
      // Collect the ordered list block
      const blockLines: { indent: string; num: string; text: string }[] = []
      const baseIndent = olMatch[1]
      let numDigits = olMatch[2].length
      blockLines.push({ indent: baseIndent, num: olMatch[2], text: olMatch[3] })
      i++
      // Collect continuation lines and subsequent ordered items
      while (i < lines.length) {
        const next = lines[i]
        const nextMatch = next.match(/^(\s*)(\d+)\.\s+(.*)$/)
        if (nextMatch && nextMatch[1].length === baseIndent.length) {
          blockLines.push({ indent: baseIndent, num: nextMatch[2], text: nextMatch[3] })
          numDigits = Math.max(numDigits, nextMatch[2].length)
          i++
        } else if (next.trim() === '') {
          // Blank line ends the list block
          break
        } else {
          // Continuation line (multi-line list item) — determine indent
          // For continuation lines, indent to align with text after "1. "
          // Single digit: "1. text" → text starts at position 3
          // Multi digit: "10. text" → text starts at position 4
          // Calculate proper indent: baseIndent.padEnd + "1.".length + 1 space
          const alignCol = baseIndent.length + numDigits.toString().length + 2
          const contentIndent = ' '.repeat(alignCol)
          blockLines.push({ indent: contentIndent, num: '', text: next.trim() })
          i++
        }
      }
      // Renumber sequentially starting from 1
      let counter = 1
      const paddedLines = blockLines.map(li => {
        if (li.num) {
          const num = counter++
          const padded = num.toString().padStart(numDigits, ' ')
          return `${li.indent}${padded}. ${li.text}`
        } else {
          // Continuation line — indent to align after the number
          return `${li.indent}${li.text}`
        }
      })
      result.push(...paddedLines)
    } else {
      result.push(line)
      i++
    }
  }
  return result.join('\n')
}

function replacePunctuation(s: string): string {
  const punctMap: Record<string, string> = {
    ',': '，',
    '!': '！',
    '?': '？',
    ':': '：',
    ';': '；',
  }
  let result = ''
  for (const c of s) {
    if (c in punctMap) {
      result += punctMap[c]
    } else {
      result += c
    }
  }
  return result
}

function addCjkSpacing(s: string): string {
  // Add space between CJK and Latin characters
  // CJK followed by Latin
  s = s.replace(/([一-鿿㐀-䶿＀-￯])([A-Za-z0-9@])/g, '$1 $2')
  // Latin followed by CJK
  s = s.replace(/([A-Za-z0-9])([一-鿿㐀-䶿＀-￯])/g, '$1 $2')
  return s
}
