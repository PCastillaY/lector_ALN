export const SUPPORTED_FORMATS = ["epub", "pdf", "txt", "docx", "mobi"] as const

export type DocumentFormat = (typeof SUPPORTED_FORMATS)[number]
export type StorageMode = "local" | "cloud"
export type ProcessingStatus = "imported" | "processing" | "ready" | "unsupported" | "error"

export interface DocumentRecord {
  id: string
  title: string
  fileName: string
  format: DocumentFormat
  sizeBytes: number
  storageMode: StorageMode
  processingStatus: ProcessingStatus
  importedAt: string
}

export interface StoredDocument extends DocumentRecord {
  file: Blob
}

export interface TextBlock {
  id: string
  text: string
  startOffset: number
  endOffset: number
}

export interface DocumentSection {
  id: string
  title: string
  blocks: TextBlock[]
}

export interface DocumentContent {
  title: string
  language?: string
  sections: DocumentSection[]
}

export interface ImportValidation {
  valid: boolean
  format?: DocumentFormat
  error?: string
}
