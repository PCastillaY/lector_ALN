"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react"
import type { DocumentContent, DocumentFormat } from "@/lib/documents/types"
import type { TextSegment } from "@/lib/documents/segmentation/types"
import { segmentDocument } from "@/lib/documents/segmentation/segmenter"
import { extractDocumentContent } from "@/lib/documents/extract"
import { getLocalDocument } from "@/lib/storage/local/document-store"

interface ReaderWorkspaceProps {
  documentId: string
}

function getBlockKey(sectionId: string, blockId: string): string {
  return `${sectionId}:${blockId}`
}

export function ReaderWorkspace({ documentId }: ReaderWorkspaceProps) {
  const [content, setContent] = useState<DocumentContent | null>(null)
  const [format, setFormat] = useState<DocumentFormat | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
  const segmentElements = useRef<Map<string, HTMLSpanElement>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError("")
      setContent(null)
      setFormat(null)
      setActiveSegmentIndex(0)
      segmentElements.current.clear()

      try {
        const document = await getLocalDocument(documentId)
        if (!document) throw new Error("El documento no existe en esta biblioteca local.")
        const extracted = await extractDocumentContent(document)
        if (!cancelled) {
          setContent(extracted)
          setFormat(document.format)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No se pudo abrir el documento.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDocument()
    return () => { cancelled = true }
  }, [documentId])

  const segments = useMemo(
    () => content ? segmentDocument(content) : [],
    [content],
  )

  const segmentsByBlock = useMemo(() => {
    const grouped = new Map<string, TextSegment[]>()
    for (const segment of segments) {
      const key = getBlockKey(segment.sectionId, segment.sourceBlockId)
      const blockSegments = grouped.get(key) ?? []
      blockSegments.push(segment)
      grouped.set(key, blockSegments)
    }
    return grouped
  }, [segments])

  const activeSegment = segments[activeSegmentIndex] ?? null

  useEffect(() => {
    if (!activeSegment) return
    segmentElements.current.get(activeSegment.id)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, [activeSegment?.id])

  function moveSegment(direction: -1 | 1) {
    setActiveSegmentIndex((current) => Math.min(
      Math.max(current + direction, 0),
      Math.max(segments.length - 1, 0),
    ))
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
            <ArrowLeft size={17} /> Biblioteca
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><BookOpen size={17} /> Lector ALN</span>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <LoaderCircle className="animate-spin" size={18} /> Extrayendo texto localmente…
          </div>
        ) : error ? (
          <section role="alert" className="rounded-2xl border border-amber-200 bg-white p-6">
            <h1 className="text-lg font-semibold">No se pudo abrir el documento</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
            <Link href="/" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Volver a la biblioteca</Link>
          </section>
        ) : content ? (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Lectura local · {format?.toUpperCase()}</p>
            <h1 className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>

            {segments.length > 0 && activeSegment && (
              <nav aria-label="Navegación por segmentos" className="mb-6 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div aria-live="polite">
                    <p className="text-sm font-semibold text-slate-800">
                      Segmento {activeSegmentIndex + 1} de {segments.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{activeSegment.sectionTitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveSegment(-1)}
                      disabled={activeSegmentIndex === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSegment(1)}
                      disabled={activeSegmentIndex >= segments.length - 1}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Progreso de lectura"
                  aria-valuemin={0}
                  aria-valuemax={segments.length}
                  aria-valuenow={activeSegmentIndex + 1}
                >
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width]"
                    style={{ width: `${((activeSegmentIndex + 1) / segments.length) * 100}%` }}
                  />
                </div>
              </nav>
            )}

            <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 text-base leading-8 shadow-sm sm:p-10">
              {content.sections.map(section => (
                <section key={section.id} aria-label={section.title}>
                  {(format === "pdf" || format === "epub") && (
                    <h2 className="mb-4 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {section.title}
                    </h2>
                  )}
                  {section.blocks.map(block => {
                    const blockSegments = segmentsByBlock.get(getBlockKey(section.id, block.id)) ?? []
                    return (
                      <p key={block.id} className="whitespace-pre-wrap break-words">
                        {blockSegments.length > 0 ? blockSegments.map(segment => {
                          const isActive = segment.id === activeSegment?.id
                          return (
                            <span
                              key={segment.id}
                              ref={(element) => {
                                if (element) segmentElements.current.set(segment.id, element)
                                else segmentElements.current.delete(segment.id)
                              }}
                              aria-current={isActive ? "location" : undefined}
                              className={isActive ? "rounded bg-amber-100 ring-1 ring-amber-200" : undefined}
                            >
                              {segment.text}
                            </span>
                          )
                        }) : block.text}
                      </p>
                    )
                  })}
                </section>
              ))}
            </div>
            <p className="mt-5 text-xs text-slate-500">El contenido se extrajo en este dispositivo. El archivo original permanece en la biblioteca local.</p>
          </>
        ) : null}
      </article>
    </main>
  )
}
