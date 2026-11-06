const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildDir = process.env.LECTOR_TEST_BUILD
if (!buildDir) throw new Error("LECTOR_TEST_BUILD no está definido; ejecuta pnpm test.")

const { extractDocumentContent } = require(path.join(buildDir, "lib/documents/extract.js"))

function makeDocument(text, overrides = {}) {
  const file = new File([text], "lectura.txt", { type: "text/plain" })
  return {
    id: "doc-1",
    title: "Lectura de prueba",
    fileName: "lectura.txt",
    format: "txt",
    sizeBytes: file.size,
    storageMode: "local",
    processingStatus: "imported",
    importedAt: new Date(0).toISOString(),
    file,
    ...overrides,
  }
}

test("extrae TXT UTF-8 y conserva párrafos y offsets", async () => {
  const source = "Primera línea\r\nsegunda línea\r\n\r\n  Segundo párrafo  "
  const result = await extractDocumentContent(makeDocument(source))
  const blocks = result.sections[0].blocks

  assert.equal(result.title, "Lectura de prueba")
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].text, "Primera línea\r\nsegunda línea")
  assert.equal(blocks[1].text, "Segundo párrafo")
  assert.equal(source.slice(blocks[0].startOffset, blocks[0].endOffset), blocks[0].text)
  assert.equal(source.slice(blocks[1].startOffset, blocks[1].endOffset), blocks[1].text)
})

test("decodifica UTF-8 con BOM", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Texto con BOM")])
  const file = new File([bytes], "bom.txt")
  const result = await extractDocumentContent(makeDocument(file, { file }))
  assert.equal(result.sections[0].blocks[0].text, "Texto con BOM")
})

test("rechaza contenido vacío o solo espacios", async () => {
  await assert.rejects(() => extractDocumentContent(makeDocument("  \n\t")), /no contiene texto/i)
})

test("rechaza secuencias UTF-8 inválidas", async () => {
  const file = new File([new Uint8Array([0xc3, 0x28])], "invalid.txt")
  await assert.rejects(() => extractDocumentContent(makeDocument(file, { file })), /UTF-8/)
})

test("rechaza archivos con bytes NUL", async () => {
  const file = new File([new Uint8Array([0x41, 0x00, 0x42])], "binary.txt")
  await assert.rejects(() => extractDocumentContent(makeDocument(file, { file })), /bytes NUL/)
})

test("informa cuando un formato todavía no tiene adaptador", async () => {
  await assert.rejects(
    () => extractDocumentContent(makeDocument("data", { format: "pdf" })),
    /PDF todavía no está disponible/,
  )
})
