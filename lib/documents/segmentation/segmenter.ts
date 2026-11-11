import type { DocumentContent, TextBlock } from "../types"
import type { SegmentationOptions, TextSegment } from "./types"

const DEFAULT_MAX_LENGTH = 500

const COMMON_SENTENCE_STARTERS = new Set([
  "además", "ahora", "al", "allí", "aunque", "ayer", "cada", "como", "con",
  "cuando", "después", "donde", "el", "ella", "ellas", "ellos",
  "en", "entonces", "es", "esa", "esas", "ese", "eso", "esos", "esta", "está",
  "estas", "este", "esto", "estos", "finalmente", "fue", "hay", "hoy", "la", "las", "luego",
  "mañana", "mientras", "no", "o", "para", "pero", "por", "porque", "primero",
  "primera", "se", "según", "será", "son", "si", "sin", "su", "sus", "también",
  "tampoco", "tras", "un", "una", "unas", "unos", "ya",
])

const ABBREVIATIONS = new Set([
  "a", "adm", "aprox", "atte", "av", "c", "cap", "cía", "coord", "d", "da",
  "dr", "dra", "ee", "ej", "etc", "fig", "gral", "ing", "lic", "m", "máx", "mín",
  "núm", "p", "pág", "págs", "prof", "profa", "sr", "sra", "srta", "ud",
  "uds", "vol",
])

function isAbbreviation(
  text: string,
  periodIndex: number,
  following: string,
): boolean {
  const prefix = text.slice(Math.max(0, periodIndex - 64), periodIndex)
  const match = prefix.match(/([\p{L}]+)$/u)
  if (!match) return false

  const word = match[1].toLocaleLowerCase("es")
  const nextToken = following.replace(/^[«"“¿¡(\[]+/u, "")
  const prefixBeforeWord = prefix.slice(0, -match[1].length)

  // Compound abbreviations: EE. UU. and p. ej.
  if (word === "ee" && /^UU\./iu.test(following)) return true
  if (word === "uu" && /(?:^|\s)EE\.\s*$/iu.test(prefixBeforeWord)) {
    return !/^\p{Lu}/u.test(nextToken)
  }
  if (word === "p" && /^ej\./iu.test(following)) return true
  if (word === "ej" && /(?:^|\s)p\.\s*$/iu.test(prefixBeforeWord)) {
    return !/^\p{Lu}/u.test(nextToken)
  }

  // "Etc." can also close a sentence when the next sentence starts uppercase.
  if (word === "etc") return !/^\p{Lu}/u.test(nextToken)

  // A one-letter token followed by another initial and a period is part of
  // a compound abbreviation (e.g. S. A.) or a multi-part proper name.
  if (word.length === 1) {
    if (/^\p{Lu}\.\s*/u.test(nextToken)) return true

    const nextWord = nextToken.match(/^[\p{L}]+/u)?.[0].toLocaleLowerCase("es")
    const startsNewSentence = nextWord !== undefined && COMMON_SENTENCE_STARTERS.has(nextWord)
    const singleInitialName = /^\p{Lu}\p{Ll}+/u.test(nextToken)

    return (!startsNewSentence && singleInitialName) ||
      !/^\p{Lu}/u.test(nextToken)
  }

  if (ABBREVIATIONS.has(word)) return true
  return false
}

function listMarkerCategory(line: string): string | null {
  const match = line.match(/^\s*(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\.\s+\S/u)
  if (!match) return null

  const marker = match[1]
  if (/^\d+$/u.test(marker)) return "numeric"
  if (marker.length > 1) return "roman"
  if (/^[ivxlcdm]$/iu.test(marker)) return "ambiguous"
  return "alpha"
}

function compatibleMarkerCategories(left: string | null, right: string | null): boolean {
  if (!left || !right) return false
  if (left === right) return true
  return left === "ambiguous" && (right === "roman" || right === "alpha") ||
    right === "ambiguous" && (left === "roman" || left === "alpha")
}

function findListMarkerPeriods(text: string): Set<number> {
  const lines: Array<{
    category: string | null
    periodIndex: number | null
  }> = []
  let lineStart = 0

  while (lineStart <= text.length) {
    const lineEndIndex = text.indexOf("\n", lineStart)
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
    const line = text.slice(lineStart, lineEnd)
    const markerMatch = line.match(/^\s*(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\./u)
    const category = listMarkerCategory(line)

    lines.push({
      category,
      periodIndex: markerMatch ? lineStart + markerMatch[0].length - 1 : null,
    })

    if (lineEndIndex === -1) break
    lineStart = lineEndIndex + 1
  }

  const periods = new Set<number>()
  for (const [index, line] of lines.entries()) {
    if (!line.category || line.periodIndex === null) continue

    const previousCategory = index > 0 ? lines[index - 1].category : null
    const nextCategory = index + 1 < lines.length ? lines[index + 1].category : null

    if (
      compatibleMarkerCategories(previousCategory, line.category) ||
      compatibleMarkerCategories(line.category, nextCategory)
    ) {
      periods.add(line.periodIndex)
    }
  }

  return periods
}

function sentenceBoundaries(text: string): number[] {
  const boundaries: number[] = []
  const listMarkerPeriods = findListMarkerPeriods(text)
  const punctuation = /[.!?…]+[”’»"')\]]*/gu
  let match: RegExpExecArray | null

  while ((match = punctuation.exec(text)) !== null) {
    const end = match.index + match[0].length
    const next = text.slice(end)
    const whitespace = next.match(/^\s+/u)
    const lastPunctuation = match[0][0]

    // Question and exclamation marks can close a sentence even without
    // whitespace when the next sentence starts immediately with a letter.
    if (!whitespace) {
      if (/[?!]/u.test(match[0]) && /^\p{L}/u.test(next)) {
        boundaries.push(end)
      }
      continue
    }

    const following = next.slice(whitespace[0].length)
    if (lastPunctuation === "." && (
      isAbbreviation(text, match.index, following) ||
      listMarkerPeriods.has(match.index) ||
      /\d$/u.test(text.slice(0, match.index)) && /^\d/u.test(following)
    )) continue

    if (!following) {
      boundaries.push(text.length)
      continue
    }

    // Avoid splitting Unicode and ASCII ellipses used as a hesitation before lowercase text.
    const isEllipsis = match[0].includes("…") || match[0].startsWith("...")
    if (isEllipsis && /^\p{Ll}/u.test(following)) continue

    boundaries.push(end + whitespace[0].length)
  }

  if (boundaries.length === 0 || boundaries[boundaries.length - 1] < text.length) {
    boundaries.push(text.length)
  }
  return [...new Set(boundaries)].filter((value) => value > 0)
}

function splitOversized(
  text: string,
  start: number,
  end: number,
  maxLength: number,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let cursor = start

  while (cursor < end) {
    if (end - cursor <= maxLength) {
      ranges.push({ start: cursor, end })
      break
    }

    const hardLimit = cursor + maxLength
    let splitAt = -1

    // Prefer the last whitespace within the preferred limit.
    for (let index = hardLimit; index > cursor; index -= 1) {
      if (/\s/u.test(text[index - 1])) {
        splitAt = index
        break
      }
    }

    // If no whitespace exists before the limit, extend to the next word boundary.
    if (splitAt <= cursor) {
      const whitespace = /\s/u.exec(text.slice(hardLimit, end))
      splitAt = whitespace ? hardLimit + whitespace.index + whitespace[0].length : end
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
    ranges.push(...splitOversized(block.text, sentenceStart, sentenceEnd, maxLength))
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
