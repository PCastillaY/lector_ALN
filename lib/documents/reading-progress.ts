import type { TextSegment } from "./segmentation/types"

export interface ReadingProgress {
  schemaVersion: 1
  documentId: string
  sectionId: string
  sectionIndex: number
  sourceBlockId: string
  blockIndex: number
  segmentIndex: number
  order: number
  blockStartOffset: number
  offsetInBlock: number
  updatedAt: string
}

export function createReadingProgress(
  documentId: string,
  segment: TextSegment,
  blockStartOffset: number,
  updatedAt = new Date().toISOString(),
): ReadingProgress {
  return {
    schemaVersion: 1,
    documentId,
    sectionId: segment.sectionId,
    sectionIndex: segment.sectionIndex,
    sourceBlockId: segment.sourceBlockId,
    blockIndex: segment.blockIndex,
    segmentIndex: segment.segmentIndex,
    order: segment.order,
    blockStartOffset,
    offsetInBlock: segment.startOffset - blockStartOffset,
    updatedAt,
  }
}

/**
 * Restores the closest segment to the saved block-local offset.
 * Stable section/block identity takes precedence over the global segment order,
 * which is only used as a fallback when the source structure has changed.
 */
export function resolveReadingProgressIndex(
  segments: TextSegment[],
  progress: ReadingProgress | null,
): number {
  if (segments.length === 0 || !progress) return 0

  const blockSegments = segments.filter(
    (segment) =>
      segment.sectionId === progress.sectionId &&
      segment.sourceBlockId === progress.sourceBlockId,
  )

  if (blockSegments.length > 0) {
    const exact = blockSegments.find((segment) => {
      const start = segment.startOffset - progress.blockStartOffset
      const end = segment.endOffset - progress.blockStartOffset
      return progress.offsetInBlock >= start && progress.offsetInBlock < end
    })
    const selected = exact ?? blockSegments.reduce((closest, candidate) => {
      const candidateOffset = candidate.startOffset - progress.blockStartOffset
      const closestOffset = closest.startOffset - progress.blockStartOffset
      return Math.abs(candidateOffset - progress.offsetInBlock) <
        Math.abs(closestOffset - progress.offsetInBlock)
        ? candidate
        : closest
    })
    return selected.order
  }

  const sectionSegments = segments.filter(
    (segment) => segment.sectionId === progress.sectionId,
  )
  if (sectionSegments.length > 0) {
    const sameBlockPosition = sectionSegments.filter(
      (segment) => segment.blockIndex === progress.blockIndex,
    )
    const candidates = sameBlockPosition.length > 0 ? sameBlockPosition : sectionSegments
    const selected = candidates.reduce((closest, candidate) =>
      Math.abs(candidate.segmentIndex - progress.segmentIndex) <
        Math.abs(closest.segmentIndex - progress.segmentIndex)
        ? candidate
        : closest,
    )
    return selected.order
  }

  return Math.min(Math.max(progress.order, 0), segments.length - 1)
}
