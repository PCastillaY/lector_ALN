import type { DocumentContent } from "../types"

export interface TextSegment {
  id: string
  text: string
  startOffset: number
  endOffset: number
  sectionId: string
  sectionIndex: number
  sectionTitle: string
  sourceBlockId: string
  blockIndex: number
  segmentIndex: number
  order: number
}

export interface SegmentationOptions {
  /** Maximum preferred segment length, measured in UTF-16 code units. */
  maxLength?: number
}

export type SegmentationResult = TextSegment[]

export type SegmentableDocument = Pick<DocumentContent, "sections">
