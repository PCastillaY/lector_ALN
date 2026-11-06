import type { DocumentContent, DocumentSection, StoredDocument, TextBlock } from "../types"

interface EpubMetadata {
  title?: string
  language?: string
}

interface EpubSection {
  index: number
  href: string
  document?: Document
  load(request?: (path: string) => Promise<unknown>): Promise<Document>
  unload?(): void
}

interface EpubBook {
  ready: Promise<void>
  loaded: { metadata: Promise<EpubMetadata> }
  spine: { each(callback: (section: EpubSection) => void): void }
  load(path: string): Promise<unknown>
  destroy(): void
}

type EpubFactory = (input: ArrayBuffer) => EpubBook

const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,dt,dd"

function normalizeBlockText(element: Element): string {
  const text = element.textContent ?? ""
  if (element.tagName.toLowerCase() === "pre") {
    return text.replace(/\r\n?/g, "\n").trim()
  }
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function isNestedBlock(element: Element): boolean {
  return Boolean(element.parentElement?.closest(BLOCK_SELECTOR))
}

function getSectionBlocks(
  section: EpubSection,
  sectionId: string,
  offset: number,
): { blocks: TextBlock[]; title: string; nextOffset: number } {
  const document = section.document
  if (!document) {
    throw new Error("No se pudo leer el contenido de un capítulo EPUB.")
  }

  const elements = Array.from(document.querySelectorAll(BLOCK_SELECTOR))
    .filter((element) => !isNestedBlock(element))

  const heading = elements.find((element) => /^H[1-3]$/.test(element.tagName))
  const title = heading ? normalizeBlockText(heading) : ""
  const blocks: TextBlock[] = []
  let cursor = offset

  for (const element of elements) {
    const text = normalizeBlockText(element)
    if (!text) continue
    // The first chapter heading is represented by the section title in the reader.
    if (element === heading) continue

    blocks.push({
      id: `${sectionId}-block-${blocks.length + 1}`,
      text,
      startOffset: cursor,
      endOffset: cursor + text.length,
    })
    cursor += text.length + 2
  }

  return { blocks, title, nextOffset: cursor }
}

function friendlyEpubError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("Este EPUB")) return error
  return new Error(
    "No se pudo procesar el EPUB. Comprueba que sea un libro EPUB válido y que su estructura interna no esté dañada.",
  )
}

export async function extractEpubDocument(
  document: StoredDocument,
  suppliedFactory?: EpubFactory,
): Promise<DocumentContent> {
  if (document.format !== "epub") {
    throw new Error("El adaptador EPUB solo admite documentos EPUB.")
  }
  if (document.file.size === 0) {
    throw new Error("El documento EPUB está vacío.")
  }

  let bytes: ArrayBuffer
  try {
    bytes = await document.file.arrayBuffer()
  } catch {
    throw new Error("No se pudo leer el archivo EPUB almacenado en este dispositivo.")
  }

  let book: EpubBook | undefined
  try {
    let factory = suppliedFactory
    if (!factory) {
      const epubModule = await import("epubjs")
      factory = epubModule.default as unknown as EpubFactory
    }

    book = factory(bytes)
    await book.ready
    const metadata = await book.loaded.metadata
    const sections: DocumentSection[] = []
    let offset = 0

    const spineSections: EpubSection[] = []
    book.spine.each((section) => spineSections.push(section))

    for (const spineSection of spineSections) {
      const sectionId = `chapter-${spineSection.index + 1}`
      await spineSection.load(book.load.bind(book))
      const extracted = getSectionBlocks(spineSection, sectionId, offset)
      if (extracted.blocks.length === 0) continue

      sections.push({
        id: sectionId,
        title: extracted.title || `Capítulo ${spineSection.index + 1}`,
        blocks: extracted.blocks,
      })
      offset = extracted.nextOffset + 2
      spineSection.unload?.()
    }

    if (sections.length === 0) {
      throw new Error("Este EPUB no contiene texto legible en sus capítulos.")
    }

    return {
      title: metadata.title?.trim() || document.title,
      language: metadata.language?.trim() || undefined,
      sections,
    }
  } catch (error) {
    throw friendlyEpubError(error)
  } finally {
    book?.destroy()
  }
}
