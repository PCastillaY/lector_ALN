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

test("conserva diálogos, comillas y signos de cierre", () => {
  const source = "—No lo sé —dijo Ana—. «Quizá mañana», respondió Luis. Luego veremos."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 3)
  assert.match(result[0].text, /dijo Ana/)
  assert.match(result[1].text, /respondió Luis/)
  assert.match(result[2].text, /^Luego/)
})

test("no divide puntos suspensivos de vacilación, ni Unicode ni ASCII", () => {
  const source = "No sé… quizá mañana. No estoy seguro... tal vez después. Finalmente, sí."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 3)
  assert.match(result[0].text, /No sé… quizá mañana/)
  assert.match(result[1].text, /No estoy seguro\.\.\. tal vez después/)
})

test("no confunde enumeraciones al inicio de línea con finales de oración", () => {
  const source = "Elementos:\n1. Agua\n2. Fuego\n3. Tierra\nFin."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 1)
})

test("conserva saltos de línea dentro de una oración y separa las siguientes", () => {
  const source = "Primera línea\nque continúa. Segunda línea.\nTercera."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "Primera línea\nque continúa. ",
    "Segunda línea.\n",
    "Tercera.",
  ])
})

test("reconoce etc. como cierre de oración solo ante un nuevo inicio", () => {
  const source = "Incluye libros, revistas, etc. Luego continúa la explicación. También incluye mapas, etc. y otros recursos."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "Incluye libros, revistas, etc. ",
    "Luego continúa la explicación. ",
    "También incluye mapas, etc. y otros recursos.",
  ])
})

test("distingue una inicial de oración de una lista alfabética", () => {
  const source = "A. Es la respuesta correcta.\nLuego veremos la justificación.\n\nOpciones:\nA. Primera opción\nB. Segunda opción\nC. Tercera opción"
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "A. ",
    "Es la respuesta correcta.\n",
    "Luego veremos la justificación.\n\n",
    "Opciones:\nA. Primera opción\nB. Segunda opción\nC. Tercera opción",
  ])
})

test("mantiene offsets UTF-16 exactos con caracteres suplementarios", () => {
  const source = "😀 Inicio. Fin."
  const blockStart = 1000
  const document = {
    sections: [{
      id: "unicode",
      title: "Unicode",
      blocks: [{
        id: "unicode-1",
        text: source,
        startOffset: blockStart,
        endOffset: blockStart + source.length,
      }],
    }],
  }
  const result = segmentDocument(document)

  assert.equal(result.map((segment) => segment.text).join(""), source)
  for (const segment of result) {
    const localStart = segment.startOffset - blockStart
    const localEnd = segment.endOffset - blockStart
    assert.equal(source.slice(localStart, localEnd), segment.text)
    assert.equal(segment.endOffset - segment.startOffset, segment.text.length)
  }
})

test("reconoce abreviaturas compuestas sin cortar su interior", () => {
  const source = "La sede está en EE. UU. y la empresa es S. A. que mantiene, p. ej. los registros. Después continúa."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "La sede está en EE. UU. y la empresa es S. A. que mantiene, p. ej. los registros. ",
    "Después continúa.",
  ])
})

test("permite cerrar oración después de abreviaturas compuestas", () => {
  const source = "La reunión será en EE. UU. Luego viajaremos. La entidad es S. A. Después veremos el contrato. Usa p. ej. este formato."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "La reunión será en EE. UU. ",
    "Luego viajaremos. ",
    "La entidad es S. A. ",
    "Después veremos el contrato. ",
    "Usa p. ej. este formato.",
  ])
})

test("reconoce enumeraciones romanas con marcadores ambiguos de una letra", () => {
  const source = "Apartados:\nI. Introducción\nII. Desarrollo\nIII. Conclusión\nFin."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 1)
})

test("mantiene títulos y párrafos en sus bloques de origen", () => {
  const document = {
    sections: [{
      id: "chapter",
      title: "Capítulo I",
      blocks: [
        { id: "heading", text: "Fundamentos del capítulo", startOffset: 0, endOffset: 24 },
        { id: "paragraph", text: "Este es el primer párrafo. Este es el segundo.", startOffset: 30, endOffset: 77 },
      ],
    }],
  }
  const result = segmentDocument(document)

  assert.deepEqual(result.map((segment) => segment.sourceBlockId), [
    "heading",
      "paragraph",
      "paragraph",
  ])
  assert.equal(result.map((segment) => segment.text).join(""), "Fundamentos del capítuloEste es el primer párrafo. Este es el segundo.")
})

test("conserva signos de cierre anidados y puntuación de diálogo", () => {
  const source = "Ella preguntó: «¿Vendrás mañana (si puedes)?». Él respondió: —Sí, claro—. Luego se despidieron."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.equal(result.length, 3)
  assert.match(result[0].text, /¿Vendrás mañana \(si puedes\)\?/)
  assert.match(result[1].text, /Sí, claro/)
})

test("reconoce iniciales únicas antes de apellidos", () => {
  const source = "El informe fue revisado por M. Vargas. A continuación, se publicó."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "El informe fue revisado por M. Vargas. ",
    "A continuación, se publicó.",
  ])
})

test("cierra abreviaturas societarias antes de determinantes de una nueva oración", () => {
  const source = "La entidad es S. A. El contrato está vigente. La filial es S. R. L. La actividad continúa."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "La entidad es S. A. ",
    "El contrato está vigente. ",
    "La filial es S. R. L. ",
    "La actividad continúa.",
  ])
})

test("mantiene abreviaturas editoriales junto a cifras", () => {
  const source = "El Dr. Pérez consultó la pág. 12, núm. 4. Luego llamó."
  const result = segmentDocument(makeDocument([source]))

  assert.equal(result.map((segment) => segment.text).join(""), source)
  assert.deepEqual(result.map((segment) => segment.text), [
    "El Dr. Pérez consultó la pág. 12, núm. 4. ",
    "Luego llamó.",
  ])
})

