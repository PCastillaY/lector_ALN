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
  assert.equal(phonemizeSpanish("cielo"), "ˈsjelo")
  assert.equal(phonemizeSpanish("llamar"), "ʝaˈmaɾ")
  assert.equal(phonemizeSpanish("chico"), "ˈʧiko")
})

test("resuelve acentos, hiatos, gue/gui y diéresis", () => {
  assert.equal(phonemizeSpanish("país"), "paˈis")
  assert.equal(phonemizeSpanish("guerra"), "ɡˈera")
  assert.equal(phonemizeSpanish("pingüino"), "piŋˈɡwuino".replace("ŋ", "n"))
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
