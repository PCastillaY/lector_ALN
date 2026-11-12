import type { DocumentRecord, StoredDocument } from "@/lib/documents/types"
import type { ReadingProgress } from "@/lib/documents/reading-progress"

const DATABASE_NAME = "lector-aln"
const DATABASE_VERSION = 2
const STORE_NAME = "documents"
const PROGRESS_STORE_NAME = "reading_progress"

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("El almacenamiento local no está disponible en este navegador."))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
        database.createObjectStore(PROGRESS_STORE_NAME, { keyPath: "documentId" })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      if (settled) {
        database.close()
        return
      }
      database.onversionchange = () => database.close()
      settled = true
      resolve(database)
    }
    request.onerror = () => {
      if (settled) return
      settled = true
      reject(request.error ?? new Error("No se pudo abrir la biblioteca local."))
    }
    request.onblocked = () => {
      if (settled) return
      settled = true
      reject(new Error("La actualización de la biblioteca está bloqueada por otra pestaña. Cierra otras pestañas de Lector ALN e inténtalo de nuevo."))
    }
  })
}

export async function getLocalDocument(id: string): Promise<StoredDocument | null> {
  const database = await openDatabase()
  try {
    return await new Promise<StoredDocument | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly")
      const request = transaction.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve((request.result as StoredDocument | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el documento."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló la lectura del documento."))
    })
  } finally {
    database.close()
  }
}

export async function saveLocalDocument(document: StoredDocument): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      transaction.objectStore(STORE_NAME).put(document)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar el documento."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló el guardado del documento."))
    })
  } finally {
    database.close()
  }
}

export async function listLocalDocuments(): Promise<DocumentRecord[]> {
  const database = await openDatabase()
  try {
    const records = await new Promise<StoredDocument[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly")
      const request = transaction.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result as StoredDocument[])
      request.onerror = () => reject(request.error ?? new Error("No se pudo leer la biblioteca local."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló la lectura de la biblioteca."))
    })

    return records
      .map(({ file: _file, ...record }) => record)
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  } finally {
    database.close()
  }
}

export async function deleteLocalDocument(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME, PROGRESS_STORE_NAME], "readwrite")
      transaction.objectStore(STORE_NAME).delete(id)
      transaction.objectStore(PROGRESS_STORE_NAME).delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo eliminar el documento."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló la eliminación del documento."))
    })
  } finally {
    database.close()
  }
}


export async function getReadingProgress(documentId: string): Promise<ReadingProgress | null> {
  const database = await openDatabase()
  try {
    return await new Promise<ReadingProgress | null>((resolve, reject) => {
      const transaction = database.transaction(PROGRESS_STORE_NAME, "readonly")
      const request = transaction.objectStore(PROGRESS_STORE_NAME).get(documentId)
      request.onsuccess = () => resolve((request.result as ReadingProgress | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error("No se pudo recuperar el progreso de lectura."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló la recuperación del progreso."))
    })
  } finally {
    database.close()
  }
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PROGRESS_STORE_NAME, "readwrite")
      transaction.objectStore(PROGRESS_STORE_NAME).put(progress)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar el progreso de lectura."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló el guardado del progreso."))
    })
  } finally {
    database.close()
  }
}
