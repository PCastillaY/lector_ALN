import type { DocumentContent, TextBlock } from "../types"
import type { SegmentationOptions, TextSegment } from "./types"

const DEFAULT_MAX_LENGTH = 500

const ABBREVIATIONS = new Set([
  "a", "adm", "aprox", "atte", "av", "c", "cap", "cía", "coord", "d", "da",
  "dr", "dra", "ee", "ej", "etc", "fig", "gral", "ing", "lic", "máx", "mín",
  "núm", "p", "pág", "págs", "prof", "profa", "sr", "sra", "srta", "ud",
  "uds", "vol",
])

function isAbbreviation(text: string, periodIndex: number): boolean {
  const prefix = text.slice(0, periodIndex)
  const match = prefix.match(/([\p{L}]+)$/u)
  if (!match) return false
  const word = match[1].toLocaleLowerCase("es")
  if (ABBREVIATIONS.has(word)) return true

  // Initials such as "J. R. R. Tolkien" should not end a sentence.
  return word.length === 1 && /\p{Lu}/u.test(match[1])
}

function sentenceBoundaries(text: string): number[] {
  const boundaries: number[] = []
  const punctuation = /[.!?…]+[”’»"')\]]*/gu
  let match: RegExpExecArray | null

  while ((match = punctuation.exec(text)) !== null) {
    const end = match.index + match[0].length
    const next = text.slice(end)
    const whitespace = next.match(/^\s+/u)
    if (!whitespace) continue

    const lastPunctuation = match[0][0]
    if (lastPunctuation === "." && (
      isAbbreviation(text, match.index) ||
      /\d$/u.test(text.slice(0, match.index)) && /^\d/u.test(next.trimStart())
    )) continue

    const following = next.slice(whitespace[0].length)
    if (!following) {
      boundaries.push(text.length)
      continue
    }

    // Avoid splitting ellipses used as a hesitation when the next token is lowercase.
    if (match[0].includes("…") && /^\p{Ll}/u.test(following)) continue

    boundaries.push(end + whitespace[0].length)
  }

  if (boundaries.length === 0 || boundaries[boundaries.length - 1] < text.length) {
    boundaries.push(text.length)
  }
  return [...new Set(boundaries)].filter((value) => value > 0)
}

function splitOversized(text: string, start: number, maxLength: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let cursor = start

  while (cursor < text.length) {
    const remaining = text.length - cursor
    if (remaining <= maxLength) {
      ranges.push({ start: cursor, end: text.length })
      break
    }

    const hardLimit = cursor + maxLength
    let splitAt = -1
    for (let index = hardLimit; index > cursor; index -= 1) {
      if (/\s/u.test(text[index - 1])) {
        splitAt = index
        break
      }
    }

    // If one unbroken token exceeds the limit, preserve it rather than cutting a word.
    if (splitAt <= cursor) {
      const nextWhitespace = text.indexOf(" ", hardLimit)
      const nextLineBreak = text.indexOf("\n", hardLimit)
      const candidates = [nextWhitespace, nextLineBreak].filter((value) => value >= 0)
      splitAt = candidates.length ? Math.min(...candidates) + 1 : text.length
    }

    ranges.push({ start: cursor, end: splitAt })
    cursor = splitAt
  }

  return ranges
}

function segmentBlock(
  block: TextBlock,
  sectionId: string,
  sectionIndex: number,
  sectionTitle: string,
  blockIndex: number,
  maxLength: number,
  initialOrder: number,
): TextSegment[] {
  const sentences = sentenceBoundaries(block.text)
  const ranges: Array<{ start: number; end: number }> = []
  let sentenceStart = 0

  for (const sentenceEnd of sentences) {
    ranges.push(...splitOversized(block.text.slice(sentenceStart, sentenceEnd), sentenceStart, maxLength))
    sentenceStart = sentenceEnd
  }

  return ranges.map(({ start, end }, segmentIndex) => ({
    id: `${sectionId}:${block.id}:${segmentIndex + 1}`,
    text: block.text.slice(start, end),
    startOffset: block.startOffset + start,
    endOffset: block.startOffset + end,
    sectionId,
    sectionIndex,
    sectionTitle,
    sourceBlockId: block.id,
    blockIndex,
    segmentIndex,
    order: initialOrder + segmentIndex,
  }))
}

/**
 * Splits normalized document blocks without changing their text.
 * Offsets are derived from each block's existing offset plus a block-local
 * UTF-16 index; no synthetic document-wide source string is assumed.
 */
export function segmentDocument(
  document: Pick<DocumentContent, "sections">,
  options: SegmentationOptions = {},
): TextSegment[] {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("maxLength debe ser un entero positivo.")
  }

  const result: TextSegment[] = []
  for (const [sectionIndex, section] of document.sections.entries()) {
    for (const [blockIndex, block] of section.blocks.entries()) {
      if (!block.text) continue
      result.push(...segmentBlock(
        block,
        section.id,
        sectionIndex,
        section.title,
        blockIndex,
        maxLength,
        result.length,
      ))
    }
  }
  return result
}
