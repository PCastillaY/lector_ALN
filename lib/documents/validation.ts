import { SUPPORTED_FORMATS, type DocumentFormat, type ImportValidation } from "./types"

export const MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

async function hasExpectedSignature(file: File, format: DocumentFormat): Promise<boolean> {
  if (format === "txt") return true

  if (format === "pdf") {
    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
    return new TextDecoder("ascii").decode(header).includes("%PDF-")
  }

  if (format === "mobi") {
    const header = new Uint8Array(await file.slice(60, 68).arrayBuffer())
    return new TextDecoder("ascii").decode(header) === "BOOKMOBI"
  }

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return ZIP_SIGNATURES.some((signature) => startsWithBytes(header, signature))
}

export async function validateDocumentFile(file: File): Promise<ImportValidation> {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !SUPPORTED_FORMATS.includes(extension as DocumentFormat)) {
    return { valid: false, error: "Formato no compatible. Admite EPUB, PDF, TXT, DOCX y MOBI." }
  }

  const format = extension as DocumentFormat
  if (file.size === 0) return { valid: false, error: "El archivo está vacío." }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, error: "El archivo supera el límite inicial de 100 MB." }
  }

  try {
    if (!(await hasExpectedSignature(file, format))) {
      return { valid: false, error: "El contenido del archivo no coincide con la firma esperada para su extensión." }
    }
  } catch {
    return { valid: false, error: "No se pudo leer el contenido del archivo para validar su formato." }
  }

  return { valid: true, format }
}
