import type { DocumentContent, StoredDocument, TextBlock } from "../types"

function createParagraphBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = []
  const separator = /\r?\n(?:[ \t]*\r?\n)+/g
  let cursor = 0
  let match: RegExpExecArray | null
  let index = 0

  const addBlock = (segment: string, segmentStart: number) => {
    const leadingWhitespace = segment.length - segment.trimStart().length
    const content = segment.trim()
    if (!content) return

    const startOffset = segmentStart + leadingWhitespace
    blocks.push({
      id: `paragraph-${index++}`,
      text: content,
      startOffset,
      endOffset: startOffset + content.length,
    })
  }

  while ((match = separator.exec(text)) !== null) {
    addBlock(text.slice(cursor, match.index), cursor)
    cursor = match.index + match[0].length
  }
  addBlock(text.slice(cursor), cursor)

  return blocks
}

export async function extractPlainTextDocument(document: StoredDocument): Promise<DocumentContent> {
  if (document.format !== "txt") {
    throw new Error("El adaptador de texto plano solo admite documentos TXT.")
  }

  if (document.file.size === 0) {
    throw new Error("El documento TXT está vacío.")
  }

  let text: string
  try {
    const bytes = await document.file.arrayBuffer()
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new Error("No se pudo decodificar el TXT como UTF-8. Guarda el archivo con codificación UTF-8 e inténtalo de nuevo.")
  }

  if (!text.trim()) {
    throw new Error("El documento no contiene texto legible.")
  }

  if (text.includes("\u0000")) {
    throw new Error("El archivo contiene bytes NUL y no parece ser un documento TXT válido.")
  }

  const blocks = createParagraphBlocks(text)
  if (blocks.length === 0) {
    throw new Error("No se encontraron bloques de texto legibles.")
  }

  return {
    title: document.title,
    language: "es",
    sections: [{
      id: "section-1",
      title: document.title,
      blocks,
    }],
  }
}
