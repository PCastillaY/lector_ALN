import type { DocumentContent, StoredDocument } from "../types"

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}

interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>
  cleanup?(): void
}

interface PdfDocument {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPage>
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>
  destroy(): Promise<void>
}

export interface PdfJsApi {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument(options: { data: Uint8Array }): PdfLoadingTask
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === "object" && item !== null && "str" in item &&
    typeof (item as { str?: unknown }).str === "string"
}

function extractPageText(items: unknown[]): string {
  const lines: string[] = []
  let currentLine = ""

  for (const item of items) {
    if (!isTextItem(item)) continue
    currentLine += item.str ?? ""
    if (item.hasEOL) {
      if (currentLine.trim()) lines.push(currentLine.trimEnd())
      currentLine = ""
    }
  }

  if (currentLine.trim()) lines.push(currentLine.trimEnd())
  return lines.join("\n").trim()
}

function friendlyPdfError(error: unknown): Error {
  if (error instanceof Error && error.name === "PasswordException") {
    return new Error("Este PDF está protegido con contraseña. Los documentos protegidos todavía no son compatibles.")
  }
  if (error instanceof Error && /worker/i.test(error.message)) {
    return new Error("No se pudo iniciar el motor PDF local. Recarga la aplicación e inténtalo de nuevo.")
  }
  return new Error("No se pudo procesar el PDF. El archivo puede estar dañado o usar una característica no compatible.")
}

export async function extractPdfDocument(
  document: StoredDocument,
  suppliedPdfJs?: PdfJsApi,
): Promise<DocumentContent> {
  if (document.format !== "pdf") {
    throw new Error("El adaptador PDF solo admite documentos PDF.")
  }
  if (document.file.size === 0) {
    throw new Error("El documento PDF está vacío.")
  }

  let pdfjs = suppliedPdfJs
  if (!pdfjs) {
    const pdfjsModule = await import("pdfjs-dist")
    pdfjs = pdfjsModule as unknown as PdfJsApi
  }

  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await document.file.arrayBuffer())
  } catch {
    throw new Error("No se pudo leer el archivo PDF almacenado en este dispositivo.")
  }

  const loadingTask = pdfjs.getDocument({ data: bytes })
  try {
    const pdf = await loadingTask.promise
    if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1) {
      throw new Error("El PDF no contiene páginas.")
    }

    const sections: DocumentContent["sections"] = []
    let offset = 0

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      try {
        const textContent = await page.getTextContent()
        const text = extractPageText(textContent.items)
        if (!text) continue

        const pageTitle = `Página ${pageNumber}`
        sections.push({
          id: `page-${pageNumber}`,
          title: pageTitle,
          blocks: [{
            id: `page-${pageNumber}-text`,
            text,
            startOffset: offset,
            endOffset: offset + text.length,
          }],
        })
        offset += text.length + 2
      } finally {
        page.cleanup?.()
      }
    }

    if (sections.length === 0) {
      throw new Error("Este PDF no contiene texto seleccionable. Los PDF escaneados requieren OCR, que todavía no está disponible.")
    }

    return { title: document.title, sections }
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith("Este PDF") ||
      error.message.startsWith("El PDF")
    )) {
      throw error
    }
    throw friendlyPdfError(error)
  } finally {
    // PDFDocumentLoadingTask owns the worker lifecycle. PDFDocumentProxy
    // does not expose destroy() in the PDF.js API used by this application.
    await loadingTask.destroy()
  }
}
