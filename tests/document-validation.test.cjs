const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildDir = process.env.LECTOR_TEST_BUILD
if (!buildDir) throw new Error("LECTOR_TEST_BUILD no está definido; ejecuta pnpm test.")

const {
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentFile,
} = require(path.join(buildDir, "lib/documents/validation.js"))

function makeFile(bytes, name) {
  return new File([bytes], name)
}

test("rechaza extensiones no admitidas", async () => {
  const result = await validateDocumentFile(makeFile("contenido", "libro.rtf"))
  assert.equal(result.valid, false)
  assert.match(result.error, /Formato no compatible/)
})

test("rechaza archivos vacíos", async () => {
  const result = await validateDocumentFile(makeFile([], "libro.txt"))
  assert.equal(result.valid, false)
  assert.match(result.error, /vacío/)
})

test("rechaza archivos que superan 100 MB antes de leerlos", async () => {
  const oversizedFile = { name: "libro.txt", size: MAX_DOCUMENT_SIZE_BYTES + 1 }
  const result = await validateDocumentFile(oversizedFile)
  assert.equal(result.valid, false)
  assert.match(result.error, /100 MB/)
})

test("acepta TXT no vacío sin asumir una firma binaria", async () => {
  const result = await validateDocumentFile(makeFile("Texto de prueba", "libro.txt"))
  assert.deepEqual(result, { valid: true, format: "txt" })
})

test("acepta PDF con firma %PDF- dentro de los primeros 1024 bytes", async () => {
  const bytes = new Uint8Array(64)
  bytes.set(new TextEncoder().encode("%PDF-1.7"), 20)
  const result = await validateDocumentFile(makeFile(bytes, "libro.pdf"))
  assert.deepEqual(result, { valid: true, format: "pdf" })
})

test("rechaza PDF sin firma reconocible", async () => {
  const result = await validateDocumentFile(makeFile("No es un PDF", "libro.pdf"))
  assert.equal(result.valid, false)
  assert.match(result.error, /firma esperada/)
})

test("acepta contenedores ZIP básicos para EPUB y DOCX", async (t) => {
  for (const extension of ["epub", "docx"]) {
    await t.test(extension, async () => {
      const result = await validateDocumentFile(makeFile(
        new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]),
        `libro.${extension}`,
      ))
      assert.deepEqual(result, { valid: true, format: extension })
    })
  }
})

test("rechaza EPUB y DOCX que no comienzan con una firma ZIP", async () => {
  for (const extension of ["epub", "docx"]) {
    const result = await validateDocumentFile(makeFile("no es zip", `libro.${extension}`))
    assert.equal(result.valid, false)
    assert.match(result.error, /firma esperada/)
  }
})

test("acepta un registro MOBI con identificador en la posición esperada", async () => {
  const bytes = new Uint8Array(124)
  new DataView(bytes.buffer).setUint32(78, 100, false)
  bytes.set(new TextEncoder().encode("MOBI"), 116)
  const result = await validateDocumentFile(makeFile(bytes, "libro.mobi"))
  assert.deepEqual(result, { valid: true, format: "mobi" })
})

test("rechaza MOBI sin un registro MOBI reconocible", async () => {
  const bytes = new Uint8Array(124)
  new DataView(bytes.buffer).setUint32(78, 100, false)
  const result = await validateDocumentFile(makeFile(bytes, "libro.mobi"))
  assert.equal(result.valid, false)
  assert.match(result.error, /firma esperada/)
})
