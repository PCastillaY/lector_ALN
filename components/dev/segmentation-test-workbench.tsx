"use client"

import { useState } from "react"
import { extractDocumentContent } from "@/lib/documents/extract"
import { validateDocumentFile } from "@/lib/documents/validation"
import { segmentDocument } from "@/lib/documents/segmentation/segmenter"
import type { DocumentContent, DocumentFormat, StoredDocument } from "@/lib/documents/types"
import type { TextSegment } from "@/lib/documents/segmentation/types"

interface BlockCheck {
  sectionTitle: string
  blockId: string
  blockText: string
  segments: TextSegment[]
  reconstructed: boolean
  offsetsValid: boolean
  contiguous: boolean
}

interface TestReport {
  fileName: string
  format: DocumentFormat
  content: DocumentContent
  segments: TextSegment[]
  checks: BlockCheck[]
  errors: string[]
  warnings: string[]
}

function inspectSegmentation(content: DocumentContent, segments: TextSegment[]): {
  checks: BlockCheck[]
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const checks: BlockCheck[] = []

  for (const section of content.sections) {
    for (const block of section.blocks) {
      const blockSegments = segments
        .filter((segment) => segment.sectionId === section.id && segment.sourceBlockId === block.id)
        .sort((a, b) => a.segmentIndex - b.segmentIndex)

      const reconstructedText = blockSegments.map((segment) => segment.text).join("")
      const reconstructed = reconstructedText === block.text
      let offsetsValid = true
      let contiguous = true
      let expectedOffset = block.startOffset

      for (const segment of blockSegments) {
        const localStart = segment.startOffset - block.startOffset
        const localEnd = segment.endOffset - block.startOffset
        const exactSlice = block.text.slice(localStart, localEnd) === segment.text
        const lengthMatches = segment.endOffset - segment.startOffset === segment.text.length
        if (!exactSlice || !lengthMatches || localStart < 0 || localEnd > block.text.length) {
          offsetsValid = false
        }
        if (segment.startOffset !== expectedOffset) contiguous = false
        expectedOffset = segment.endOffset

        if (segment.text.length > 500 && /\\s/u.test(segment.text.trim())) {
          warnings.push(
            `El segmento ${segment.id} supera 500 unidades UTF-16 y contiene espacios (${segment.text.length}).`,
          )
        }
      }

      if (blockSegments.length === 0 && block.text.length > 0) contiguous = false
      if (blockSegments.length > 0 && expectedOffset !== block.endOffset) contiguous = false

      if (!reconstructed) errors.push(`El texto reconstruido no coincide con el bloque "${block.id}" (${section.title}).`)
      if (!offsetsValid) errors.push(`Hay offsets incorrectos en el bloque "${block.id}" (${section.title}).`)
      if (!contiguous) errors.push(`Hay huecos o solapamientos en los offsets del bloque "${block.id}" (${section.title}).`)

      checks.push({
        sectionTitle: section.title,
        blockId: block.id,
        blockText: block.text,
        segments: blockSegments,
        reconstructed,
        offsetsValid,
        contiguous,
      })
    }
  }

  return { checks, errors, warnings }
}

export function SegmentationTestWorkbench() {
  const [report, setReport] = useState<TestReport | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function handleFile(file?: File) {
    setReport(null)
    setError("")
    if (!file) return

    const extension = file.name.split(".").pop()?.toLowerCase()
    if (extension !== "txt" && extension !== "pdf" && extension !== "epub") {
      setError("Formato no admitido en esta herramienta. Selecciona un archivo TXT, PDF o EPUB.")
      return
    }

    setBusy(true)
    try {
      const validation = await validateDocumentFile(file)
      if (!validation.valid || !validation.format) {
        throw new Error(validation.error || "El archivo no superó la validación.")
      }

      const format = validation.format
      if (format !== "txt" && format !== "pdf" && format !== "epub") {
        throw new Error("El formato no está habilitado para esta prueba.")
      }

      const document: StoredDocument = {
        id: `manual-test-${Date.now()}`,
        title: file.name.replace(/\\.[^.]+$/u, ""),
        fileName: file.name,
        format,
        sizeBytes: file.size,
        storageMode: "local",
        processingStatus: "imported",
        importedAt: new Date().toISOString(),
        file,
      }

      const content = await extractDocumentContent(document)
      const segments = segmentDocument(content)
      const inspected = inspectSegmentation(content, segments)

      setReport({
        fileName: file.name,
        format,
        content,
        segments,
        ...inspected,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo procesar el archivo.")
    } finally {
      setBusy(false)
    }
  }

  const passed = report !== null && report.errors.length === 0

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Lector ALN · Herramienta interna</p>
          <h1 className="text-3xl font-semibold tracking-tight">Pruebas manuales de segmentación</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Carga un documento local para ejecutar su extractor real y comprobar la segmentación.
            El archivo se procesa en este navegador y no se guarda en la biblioteca.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="segmentation-file" className="mb-2 block text-sm font-semibold">Seleccionar documento</label>
          <input
            id="segmentation-file"
            type="file"
            accept=".txt,.pdf,.epub,text/plain,application/pdf,application/epub+zip"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700"
          />
          <p className="mt-2 text-xs text-slate-500">Formatos: TXT, PDF con texto seleccionable y EPUB. Tamaño máximo según el validador del proyecto: 100 MB.</p>
          {busy && <p role="status" className="mt-4 text-sm font-medium text-indigo-700">Extrayendo y segmentando el documento…</p>}
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </section>

        {report && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{report.fileName}</h2>
                  <p className="text-sm text-slate-500">{report.format.toUpperCase()} · {report.content.sections.length} secciones · {report.checks.length} bloques · {report.segments.length} segmentos</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {passed ? "Integridad aprobada" : "Se encontraron errores"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Texto extraído</p><p className="mt-1 text-xl font-semibold">{report.checks.reduce((sum, item) => sum + item.blockText.length, 0).toLocaleString("es-PE")}</p><p className="text-xs text-slate-500">unidades UTF-16</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Bloques íntegros</p><p className="mt-1 text-xl font-semibold">{report.checks.filter((item) => item.reconstructed && item.offsetsValid && item.contiguous).length}/{report.checks.length}</p><p className="text-xs text-slate-500">reconstrucción y offsets</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Longitud máxima observada</p><p className="mt-1 text-xl font-semibold">{Math.max(0, ...report.segments.map((item) => item.text.length))}</p><p className="text-xs text-slate-500">unidades UTF-16</p></div>
              </div>

              {report.errors.length > 0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3"><h3 className="font-semibold text-red-900">Errores</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">{report.errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              {report.warnings.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><h3 className="font-semibold text-amber-900">Advertencias de longitud</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{report.warnings.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              {report.errors.length === 0 && report.warnings.length === 0 && <p className="mt-4 text-sm text-emerald-700">Todas las comprobaciones automáticas de integridad y offsets han pasado.</p>}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Resultado por sección y bloque</h2>
              {report.content.sections.map((section) => (
                <article key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <header className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-xs text-slate-500">{section.blocks.length} bloques</p>
                  </header>
                  <div className="space-y-4 p-5">
                    {report.checks.filter((item) => item.sectionTitle === section.title).map((block) => (
                      <div key={block.blockId} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{block.blockId}</p>
                          <p className={`text-xs font-medium ${block.reconstructed && block.offsetsValid && block.contiguous ? "text-emerald-700" : "text-red-700"}`}>
                            {block.reconstructed && block.offsetsValid && block.contiguous ? "Integridad y offsets correctos" : "Revisar bloque"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {block.segments.map((segment) => (
                            <details key={segment.id} className="rounded-lg border border-slate-200">
                              <summary className="cursor-pointer px-3 py-2 text-sm">
                                <span className="font-medium">Segmento {segment.segmentIndex + 1}</span>
                                <span className="ml-2 text-xs text-slate-500">{segment.text.length} caracteres · offsets {segment.startOffset}–{segment.endOffset}</span>
                              </summary>
                              <p className="whitespace-pre-wrap break-words border-t border-slate-100 px-3 py-3 text-sm leading-6">{segment.text}</p>
                            </details>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
