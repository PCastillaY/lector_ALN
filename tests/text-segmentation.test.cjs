const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildDir = process.env.LECTOR_TEST_BUILD
if (!buildDir) throw new Error("LECTOR_TEST_BUILD no está definido; ejecuta pnpm test.")

const { segmentDocument } = require(path.join(buildDir, "lib/documents/segmentation/segmenter.js"))

function makeDocument(blocks) {
  return {
    title: "Documento de prueba",
    sections: [{
      id: "section-1",
      title: "Capítulo 1",
      blocks: blocks.map((text, index) => ({
        id: `block-${index + 1}`,
        text,
        startOffset: index * 1000,
        endOffset: index * 1000 + text.length,
      })),
    }],
  }
}

test("segmenta oraciones y conserva exactamente el texto y sus offsets", () => {
  const source = "Primera oración. Segunda oración. ¿Tercera? ¡Cuarta!"
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "Primera oración. ",
    "Segunda oración. ",
    "¿Tercera? ",
    "¡Cuarta!",
  ])
  for (const segment of result) {
    assert.equal(segment.endOffset - segment.startOffset, segment.text.length)
    assert.equal(segment.sectionId, "section-1")
    assert.equal(segment.sectionTitle, "Capítulo 1")
  }
})

test("no divide abreviaturas, iniciales ni decimales", () => {
  const source = "El Dr. Pérez llegó a las 3.14 p. m. con J. R. Tolkien. Luego salió."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 2)
  assert.match(result[0].text, /Dr\. Pérez/)
  assert.match(result[0].text, /3\.14/)
  assert.match(result[0].text, /J\. R\. Tolkien/)
})

test("respeta bloques y secciones sin mezclar sus referencias", () => {
  const document = {
    sections: [
      { id: "a", title: "A", blocks: [{ id: "a1", text: "Uno.", startOffset: 0, endOffset: 4 }] },
      { id: "b", title: "B", blocks: [{ id: "b1", text: "Dos.", startOffset: 6, endOffset: 10 }] },
    ],
  }
  const result = segmentDocument(document)

  assert.deepEqual(result.map((segment) => segment.sectionId), ["a", "b"])
  assert.deepEqual(result.map((segment) => segment.order), [0, 1])
  assert.deepEqual(result.map((segment) => segment.text).join(""), "Uno.Dos.")
})

test("divide párrafos largos en límites de palabra y reconstruye el original", () => {
  const source = "Esta es una oración deliberadamente extensa para comprobar los límites de longitud sin cortar ninguna palabra."
  const result = segmentDocument(makeDocument([source]), { maxLength: 28 })

  assert.ok(result.length > 1)
  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.ok(result.every((segment) => segment.text.length <= 28))
})

test("permite un token individual más largo que el límite sin cortarlo", () => {
  const source = "supercalifragilistico palabra"
  const result = segmentDocument(makeDocument([source]), { maxLength: 8 })

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.ok(result.some((segment) => segment.text.includes("supercalifragilistico")))
})

test("rechaza un límite de longitud inválido", () => {
  assert.throws(() => segmentDocument(makeDocument(["Texto."]), { maxLength: 0 }), /entero positivo/)
})
