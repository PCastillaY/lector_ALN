import { SUPPORTED_FORMATS, type DocumentFormat, type ImportValidation } from "./types"

export const MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024

const MIME_BY_FORMAT: Record<DocumentFormat, string[]> = {
  epub: ["application/epub+zip", "application/zip", "application/octet-stream"],
  pdf: ["application/pdf", "application/octet-stream"],
  txt: ["text/plain", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"],
  mobi: ["application/x-mobipocket-ebook", "application/vnd.amazon.ebook", "application/octet-stream"],
}

export function validateDocumentFile(file: File): ImportValidation {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !SUPPORTED_FORMATS.includes(extension as DocumentFormat)) {
    return { valid: false, error: "Formato no compatible. Admite EPUB, PDF, TXT, DOCX y MOBI." }
  }

  const format = extension as DocumentFormat
  if (file.size === 0) return { valid: false, error: "El archivo está vacío." }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, error: "El archivo supera el límite inicial de 100 MB." }
  }

  const acceptedMimeTypes = MIME_BY_FORMAT[format]
  if (file.type && !acceptedMimeTypes.includes(file.type)) {
    return { valid: false, error: "El tipo MIME no coincide con el formato del archivo." }
  }

  return { valid: true, format }
}
