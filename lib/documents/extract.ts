import type { DocumentContent, StoredDocument } from "./types"
import { extractPlainTextDocument } from "./extraction/plain-text"

export async function extractDocumentContent(document: StoredDocument): Promise<DocumentContent> {
  switch (document.format) {
    case "txt":
      return extractPlainTextDocument(document)
    case "pdf": {
      const { extractPdfDocument } = await import("./extraction/pdf")
      return extractPdfDocument(document)
    }
    case "epub": {
      const { extractEpubDocument } = await import("./extraction/epub")
      return extractEpubDocument(document)
    }
    default:
      throw new Error(`La extracción de ${document.format.toUpperCase()} todavía no está disponible.`)
  }
}
