const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildDir = process.env.LECTOR_TEST_BUILD
if (!buildDir) throw new Error("LECTOR_TEST_BUILD no está definido; ejecuta pnpm test.")

const { extractEpubDocument } = require(path.join(buildDir, "lib/documents/extraction/epub.js"))

function makeDocument(overrides = {}) {
  const file = new File(["PK\u0003\u0004epub-test"], "lectura.epub", { type: "application/epub+zip" })
  return {
    id: "epub-1",
    title: "Nombre del archivo",
    fileName: "lectura.epub",
    format: "epub",
    sizeBytes: file.size,
    storageMode: "local",
    processingStatus: "imported",
    importedAt: new Date(0).toISOString(),
    file,
    ...overrides,
  }
}

function element(tagName, textContent) {
  return { tagName: tagName.toUpperCase(), textContent, parentElement: null }
}

function fakeSection(index, elements, rawText = "") {
  const document = { querySelectorAll: () => elements, body: { textContent: rawText } }
  return {
    index,
    href: `chapter-${index + 1}.xhtml`,
    document,
    async load() { return document },
    unload() { this.document = undefined },
  }
}

function fakeEpubFactory(sections, options = {}) {
  const state = { destroyed: 0 }
  const book = {
    ready: options.readyError ? Promise.reject(options.readyError) : Promise.resolve(),
    loaded: {
      metadata: Promise.resolve({
        title: options.title ?? "Título EPUB",
        language: options.language ?? "es",
      }),
    },
    spine: {
      each(callback) { sections.forEach(callback) },
    },
    async load() { return {} },
    destroy() { state.destroyed += 1 },
  }
  return { factory: () => book, state }
}

test("extrae capítulos en orden de spine, títulos, párrafos, metadatos y offsets", async () => {
  const first = fakeSection(0, [
    element("h1", "Capítulo uno"),
    element("p", "Primer párrafo con   espacios."),
    element("p", "Segundo párrafo."),
  ])
  const second = fakeSection(1, [
    element("h2", "Capítulo dos"),
    element("p", "Texto del segundo capítulo."),
  ])
  const fake = fakeEpubFactory([first, second])

  const result = await extractEpubDocument(makeDocument(), fake.factory)

  assert.equal(result.title, "Título EPUB")
  assert.equal(result.language, "es")
  assert.equal(result.sections.length, 2)
  assert.equal(result.sections[0].title, "Capítulo uno")
  assert.deepEqual(result.sections[0].blocks.map((block) => block.text), [
    "Primer párrafo con espacios.",
    "Segundo párrafo.",
  ])
  assert.equal(result.sections[1].title, "Capítulo dos")
  assert.equal(result.sections[1].blocks[0].text, "Texto del segundo capítulo.")
  assert.equal(
    result.sections[1].blocks[0].startOffset,
    result.sections[0].blocks[1].endOffset + 4,
  )
  assert.equal(fake.state.destroyed, 1)
})

test("usa el título del archivo y un nombre de capítulo alternativo si faltan metadatos y encabezados", async () => {
  const section = fakeSection(0, [element("p", "Contenido sin encabezado.")])
  const fake = fakeEpubFactory([section], { title: "", language: "" })
  const result = await extractEpubDocument(makeDocument(), fake.factory)

  assert.equal(result.title, "Nombre del archivo")
  assert.equal(result.language, undefined)
  assert.equal(result.sections[0].title, "Capítulo 1")
})

test("omite capítulos sin texto y conserva los capítulos que sí tienen contenido", async () => {
  const empty = fakeSection(0, [])
  const populated = fakeSection(1, [element("p", "Contenido válido.")])
  const fake = fakeEpubFactory([empty, populated])
  const result = await extractEpubDocument(makeDocument(), fake.factory)

  assert.equal(result.sections.length, 1)
  assert.equal(result.sections[0].id, "chapter-2")
  assert.equal(result.sections[0].blocks[0].text, "Contenido válido.")
  assert.equal(fake.state.destroyed, 1)
})

test("rechaza EPUB sin texto legible y libera el libro", async () => {
  const fake = fakeEpubFactory([fakeSection(0, [])])
  await assert.rejects(
    () => extractEpubDocument(makeDocument(), fake.factory),
    /no contiene texto legible/i,
  )
  assert.equal(fake.state.destroyed, 1)
})

test("rechaza documentos que no sean EPUB", async () => {
  await assert.rejects(
    () => extractEpubDocument(makeDocument({ format: "pdf" })),
    /solo admite documentos EPUB/,
  )
})

test("convierte errores de estructura interna en un mensaje entendible y libera el libro", async () => {
  const fake = fakeEpubFactory([], { readyError: new Error("Invalid container.xml") })
  await assert.rejects(
    () => extractEpubDocument(makeDocument(), fake.factory),
    /EPUB válido.*estructura interna/i,
  )
  assert.equal(fake.state.destroyed, 1)
})

test("recupera texto de capítulos EPUB que usan contenedores genéricos", async () => {
  const section = fakeSection(0, [], "Texto dentro de un contenedor genérico.")
  const fake = fakeEpubFactory([section])
  const result = await extractEpubDocument(makeDocument(), fake.factory)

  assert.equal(result.sections.length, 1)
  assert.equal(result.sections[0].blocks[0].text, "Texto dentro de un contenedor genérico.")
  assert.equal(fake.state.destroyed, 1)
})
test("segmenta capítulos EPUB extraídos conservando capítulo, bloque y offsets", async () => {
  const first = fakeSection(0, [
    element("h1", "Capítulo uno"),
    element("p", "Primera oración. Segunda oración."),
  ])
  const second = fakeSection(1, [
    element("h2", "Capítulo dos"),
    element("p", "Tercera oración. Cuarta oración."),
  ])
  const fake = fakeEpubFactory([first, second])
  const content = await extractEpubDocument(makeDocument(), fake.factory)
  const { segmentDocument } = require(path.join(buildDir, "lib/documents/segmentation/segmenter.js"))
  const segments = segmentDocument(content)

  assert.deepEqual([...new Set(segments.map((segment) => segment.sectionId))], ["chapter-1", "chapter-2"])
  assert.equal(segments.map((segment) => segment.text).join(""), content.sections
    .flatMap((section) => section.blocks.map((block) => block.text)).join(""))
  for (const segment of segments) {
    const section = content.sections.find((item) => item.id === segment.sectionId)
    const block = section.blocks.find((item) => item.id === segment.sourceBlockId)
    assert.equal(block.text.slice(
      segment.startOffset - block.startOffset,
      segment.endOffset - block.startOffset,
    ), segment.text)
  }
})

