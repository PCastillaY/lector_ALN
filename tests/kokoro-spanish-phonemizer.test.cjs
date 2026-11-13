const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const buildRoot = process.env.LECTOR_TEST_BUILD
if (!buildRoot) throw new Error("LECTOR_TEST_BUILD no está definido.")

const {
  phonemizeSpanish,
  findUnknownKokoroSymbols,
} = require(path.join(buildRoot, "lib/speech/phonemization/kokoro-spanish.js"))

test("fonemiza español conservando puntuación", () => {
  const phonemes = phonemizeSpanish("Hola, ¿cómo estás?")
  assert.equal(phonemes, "ˈola, ˈkomo esˈtas?")
})

test("aplica seseo, yeísmo y consonantes españolas frecuentes", () => {
  assert.equal(phonemizeSpanish("cielo"), "ˈsielo")
  assert.equal(phonemizeSpanish("llamar"), "ʝaˈmaɾ")
  assert.equal(phonemizeSpanish("chico"), "ˈʧiko")
  assert.equal(phonemizeSpanish("guapo"), "ˈɡwapo")
})

test("resuelve acentos, hiatos, gue/gui y diéresis", () => {
  assert.equal(phonemizeSpanish("país"), "paˈis")
  assert.equal(phonemizeSpanish("guerra"), "ˈɡera")
  assert.equal(phonemizeSpanish("pingüino"), "pinˈɡwino")
})


test("coloca el acento al inicio de ataques cl/cr y elimina secundarios heurísticos", () => {
  assert.equal(phonemizeSpanish("clara"), "ˈklaɾa")
  assert.equal(phonemizeSpanish("escritas"), "esˈkɾitas")
  assert.equal(phonemizeSpanish("páginas"), "ˈpaxinas")
  assert.equal(phonemizeSpanish("cantidades"), "kantiˈðaðes")
  assert.equal(phonemizeSpanish("pronunciación"), "pronunsiaˈsion")
  assert.equal(phonemizeSpanish("con"), "kon")
  const sample = phonemizeSpanish(
    "Buenos días. Esta es una prueba de lectura en español. En este ejemplo, el documento contiene ciento veinticinco páginas, tres capítulos y varias cantidades escritas con palabras. ¿La pronunciación resulta clara y natural?",
  )
  assert.equal(sample.includes("ˌ"), false)
  assert.ok(sample.includes("ˈklaɾa"))
  assert.ok(sample.includes("esˈkɾitas kon paˈlaβɾas"))
})

test("mantiene átonas las palabras funcionales del ejemplo", () => {
  assert.equal(phonemizeSpanish("esta es una prueba"), "ˈesta es una ˈpɾueβa")
})

test("la secuencia producida solo contiene símbolos del inventario Kokoro", () => {
  const phonemes = phonemizeSpanish(
    "Buenos días. La lectura continúa con palabras, pausas y preguntas.",
  )
  assert.deepEqual(findUnknownKokoroSymbols(phonemes), [])
})

test("rechaza cifras en vez de omitirlas silenciosamente", () => {
  assert.throws(
    () => phonemizeSpanish("El año 2026 tiene doce meses."),
    /aún no normaliza cifras/,
  )
})

test("rechaza texto vacío", () => {
  assert.throws(() => phonemizeSpanish("   "), /Escribe un texto/)
})
