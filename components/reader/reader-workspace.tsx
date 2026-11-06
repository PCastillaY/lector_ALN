"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, BookOpen, LoaderCircle } from "lucide-react"
import type { DocumentContent } from "@/lib/documents/types"
import { extractDocumentContent } from "@/lib/documents/extract"
import { getLocalDocument } from "@/lib/storage/local/document-store"

interface ReaderWorkspaceProps {
  documentId: string
}

export function ReaderWorkspace({ documentId }: ReaderWorkspaceProps) {
  const [content, setContent] = useState<DocumentContent | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError("")
      try {
        const document = await getLocalDocument(documentId)
        if (!document) throw new Error("El documento no existe en esta biblioteca local.")
        const extracted = await extractDocumentContent(document)
        if (!cancelled) setContent(extracted)
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Lectura local · TXT</p>
            <h1 className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-base leading-8 shadow-sm sm:p-10">
              {content.sections.flatMap(section => section.blocks).map(block => (
                <p key={block.id} className="whitespace-pre-wrap break-words">{block.text}</p>
              ))}
            </div>
            <p className="mt-5 text-xs text-slate-500">El contenido se extrajo en este dispositivo. El archivo original permanece en la biblioteca local.</p>
          </>
        ) : null}
      </article>
    </main>
  )
}
