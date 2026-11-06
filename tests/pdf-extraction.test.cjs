const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildDir = process.env.LECTOR_TEST_BUILD
if (!buildDir) throw new Error("LECTOR_TEST_BUILD no está definido; ejecuta pnpm test.")

const { extractPdfDocument } = require(path.join(buildDir, "lib/documents/extraction/pdf.js"))

function makeDocument(overrides = {}) {
  const file = new File(["%PDF-test"], "lectura.pdf", { type: "application/pdf" })
  return {
    id: "pdf-1",
    title: "PDF de prueba",
    fileName: "lectura.pdf",
    format: "pdf",
    sizeBytes: file.size,
    storageMode: "local",
    processingStatus: "imported",
    importedAt: new Date(0).toISOString(),
    file,
    ...overrides,
  }
}

function fakePdfJs(pages, options = {}) {
  const state = { workerSrc: "", destroyed: 0, cleanedPages: 0 }
  const pdf = {
    numPages: pages.length,
    async getPage(pageNumber) {
      return {
        async getTextContent() { return { items: pages[pageNumber - 1] } },
        cleanup() { state.cleanedPages += 1 },
      }
    },
    async destroy() { state.destroyed += 1 },
  }
  return {
    state,
    api: {
      GlobalWorkerOptions: { get workerSrc() { return state.workerSrc }, set workerSrc(value) { state.workerSrc = value } },
      getDocument() {
        return {
          promise: options.loadError ? Promise.reject(options.loadError) : Promise.resolve(pdf),
          async destroy() { state.destroyed += 1 },
        }
      },
    },
  }
}

test("extrae texto por página y conserva offsets acumulados", async () => {
  const fake = fakePdfJs([
    [
      { str: "Primera línea", hasEOL: true },
      { str: "Segunda línea", hasEOL: true },
    ],
    [{ str: "Página siguiente", hasEOL: true }],
  ])
  const result = await extractPdfDocument(makeDocument(), fake.api)
  const first = result.sections[0].blocks[0]
  const second = result.sections[1].blocks[0]

  assert.equal(result.title, "PDF de prueba")
  assert.equal(result.sections.length, 2)
  assert.equal(result.sections[0].title, "Página 1")
  assert.equal(first.text, "Primera línea\nSegunda línea")
  assert.equal(result.sections[1].title, "Página 2")
  assert.equal(second.text, "Página siguiente")
  assert.equal(second.startOffset, first.endOffset + 2)
  assert.equal(fake.state.workerSrc, "/pdf.worker.min.mjs")
  assert.equal(fake.state.cleanedPages, 2)
  assert.equal(fake.state.destroyed, 1)
})

test("omite páginas sin texto cuando otras páginas sí contienen texto", async () => {
  const fake = fakePdfJs([[], [{ str: "Texto válido", hasEOL: true }]])
  const result = await extractPdfDocument(makeDocument(), fake.api)
  assert.equal(result.sections.length, 1)
  assert.equal(result.sections[0].title, "Página 2")
})

test("rechaza PDF sin capa de texto y explica que OCR no está disponible", async () => {
  const fake = fakePdfJs([[], [{ str: "   " }]])
  await assert.rejects(
    () => extractPdfDocument(makeDocument(), fake.api),
    /no contiene texto seleccionable.*OCR/i,
  )
  assert.equal(fake.state.destroyed, 1)
})

test("rechaza archivos que no sean PDF", async () => {
  await assert.rejects(
    () => extractPdfDocument(makeDocument({ format: "txt" })),
    /solo admite documentos PDF/,
  )
})

test("informa de PDF protegido con contraseña", async () => {
  const fake = fakePdfJs([], { loadError: Object.assign(new Error("Password required"), { name: "PasswordException" }) })
  await assert.rejects(
    () => extractPdfDocument(makeDocument(), fake.api),
    /protegido con contraseña/,
  )
  assert.equal(fake.state.destroyed, 1)
})

test("informa de un PDF sin páginas", async () => {
  const fake = fakePdfJs([])
  await assert.rejects(() => extractPdfDocument(makeDocument(), fake.api), /no contiene páginas/)
  assert.equal(fake.state.destroyed, 1)
})
