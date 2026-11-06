"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookOpen, FilePlus2, FileText, HardDrive, LoaderCircle, Trash2, UploadCloud } from "lucide-react"
import type { DocumentRecord, StoredDocument } from "@/lib/documents/types"
import { validateDocumentFile } from "@/lib/documents/validation"
import { deleteLocalDocument, listLocalDocuments, saveLocalDocument } from "@/lib/storage/local/document-store"

const formatLabels: Record<DocumentRecord["format"], string> = {
  epub: "EPUB",
  pdf: "PDF",
  txt: "TXT",
  docx: "DOCX",
  mobi: "MOBI",
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function LibraryWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listLocalDocuments())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la biblioteca.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setMessage("")
    let imported = 0
    const errors: string[] = []

    for (const file of Array.from(files)) {
      const validation = await validateDocumentFile(file)
      if (!validation.valid || !validation.format) {
        errors.push(`${file.name}: ${validation.error}`)
        continue
      }

      const record: StoredDocument = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        format: validation.format,
        sizeBytes: file.size,
        storageMode: "local",
        processingStatus: "imported",
        importedAt: new Date().toISOString(),
        file,
      }

      try {
        await saveLocalDocument(record)
        imported += 1
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "error de almacenamiento"}`)
      }
    }

    await refresh()
    setBusy(false)
    setMessage([
      imported ? `${imported} archivo(s) guardado(s) en este dispositivo.` : "",
      ...errors,
    ].filter(Boolean).join(" "))
    if (inputRef.current) inputRef.current.value = ""
  }

  async function removeDocument(document: DocumentRecord) {
    if (deletingId || !window.confirm(`¿Eliminar "${document.fileName}" de este dispositivo?`)) return
    setDeletingId(document.id)
    setMessage("")
    try {
      await deleteLocalDocument(document.id)
      await refresh()
      setMessage(`"${document.fileName}" se eliminó de este dispositivo.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el documento.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3" aria-label="Lector ALN inicio">
            <span className="grid size-10 place-items-center rounded-2xl bg-indigo-600 text-white"><BookOpen size={21} /></span>
            <span><span className="block text-lg font-semibold tracking-tight">Lector ALN</span><span className="block text-xs text-slate-500">Tu biblioteca, a tu ritmo</span></span>
          </a>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><HardDrive size={14} /> Biblioteca local</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">LECTURA Y NARRACIÓN</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tu biblioteca personal</h1>
            <p className="mt-3 max-w-xl text-slate-600">Importa tus libros y documentos. Los archivos de esta modalidad permanecen almacenados en este navegador.</p>
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : <FilePlus2 size={18} />} Añadir documentos
          </button>
          <input ref={inputRef} className="hidden" type="file" multiple accept=".epub,.pdf,.txt,.docx,.mobi" onChange={(event) => void importFiles(event.target.files)} />
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Formatos", "EPUB · PDF · TXT · DOCX · MOBI"],
            ["Almacenamiento", "Local en este navegador"],
            ["Tamaño máximo", "100 MB por archivo"],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>)}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documentos importados</h2>
          <span className="text-sm text-slate-500">{documents.length} archivo(s)</span>
        </div>

        {message && <p role="status" className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{message}</p>}

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Cargando biblioteca…</div>
        ) : documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><UploadCloud size={26} /></span>
            <h3 className="text-lg font-semibold">Tu biblioteca está vacía</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Añade un EPUB, PDF, TXT, DOCX o MOBI. La lectura está habilitada para TXT y PDF con texto seleccionable. Los PDF escaneados requieren OCR, todavía no disponible.</p>
            <button onClick={() => inputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"><FilePlus2 size={16} /> Seleccionar archivos</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {documents.map((document) => (
              <article key={document.id} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0 sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><FileText size={20} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{document.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{formatLabels[document.format]} · {formatSize(document.sizeBytes)} · {new Date(document.importedAt).toLocaleDateString("es-PE")}</p>
                  <p className="mt-1 text-xs text-amber-700">{document.format === "txt" ? "TXT · listo para abrir" : document.format === "pdf" ? "PDF · listo para abrir" : "Importado · extracción pendiente"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {document.format === "txt" || document.format === "pdf" ? (
                    <Link href={`/reader/${encodeURIComponent(document.id)}`} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50">Abrir</Link>
                  ) : (
                    <span className="px-2 text-xs text-slate-400" aria-label="Extractor pendiente">Próximamente</span>
                  )}
                  <button onClick={() => void removeDocument(document)} disabled={deletingId !== null} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Eliminar ${document.fileName}`} title="Eliminar"><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs leading-5 text-slate-500">Nota: borrar los datos del sitio o cambiar de navegador puede eliminar esta biblioteca local. La sincronización con cuenta se implementará en la fase cloud.</p>
      </section>
    </main>
  )
}
