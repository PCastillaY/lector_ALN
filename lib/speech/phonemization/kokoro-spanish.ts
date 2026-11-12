/**
 * Fonemización española para el vocabulario de Kokoro-82M.
 *
 * Implementación TypeScript independiente para el navegador. La referencia
 * fonética y de compatibilidad es el front-end Romance de kokoro-micro:
 * https://github.com/DavidValin/kokoro-micro (Apache-2.0).
 *
 * Perfil: español seseante y yeísta. No pretende resolver todavía nombres
 * extranjeros, siglas ni normalización de cifras.
 */

const KOKORO_SPANISH_SYMBOLS = new Set(
  Array.from(
    " ;:,.!?—…\"()“”ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
      "ˈˌʧɡɣxʝɾrɲβð",
  ),
)

const UNSTRESSED_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "de", "en", "y", "o", "u", "que", "se", "le", "les",
  "lo", "me", "te", "nos", "mi", "mis", "tu", "tus", "su", "sus",
])

const STRONG_VOWELS = new Set(["a", "e", "o", "á", "é", "ó"])
const WEAK_VOWELS = new Set(["i", "u", "ü", "í", "ú"])
const STRESS_MARK = "ˈ"
const SECONDARY_STRESS_MARK = "ˌ"

function stripAccent(letter: string): string {
  const map: Record<string, string> = {
    á: "a", é: "e", í: "i", ó: "o", ú: "u",
  }
  return map[letter] ?? letter
}

function isVowel(letter: string): boolean {
  return STRONG_VOWELS.has(letter) || WEAK_VOWELS.has(letter)
}

function startsHiatus(left: string, right: string): boolean {
  // Dos vocales fuertes forman hiato. Una vocal débil tónica (í/ú)
  // también rompe el diptongo.
  if (STRONG_VOWELS.has(left) && STRONG_VOWELS.has(right)) return true
  if (left === "í" || left === "ú" || right === "í" || right === "ú") return true
  return false
}

function isSilentU(letters: string[], index: number): boolean {
  return letters[index] === "u" &&
    (letters[index - 1] === "q" || letters[index - 1] === "g") &&
    ["e", "i", "é", "í"].includes(letters[index + 1] ?? "")
}

function vowelNuclei(letters: string[]): Array<{ start: number; end: number }> {
  const nuclei: Array<{ start: number; end: number }> = []
  let index = 0

  while (index < letters.length) {
    if (!isVowel(letters[index]) || isSilentU(letters, index)) {
      index += 1
      continue
    }

    const start = index
    index += 1
    while (
      index < letters.length &&
      isVowel(letters[index]) &&
      !isSilentU(letters, index) &&
      !startsHiatus(letters[index - 1], letters[index])
    ) {
      index += 1
    }
    nuclei.push({ start, end: index })
  }

  return nuclei
}

function primaryStressStart(
  letters: string[],
  nuclei: Array<{ start: number; end: number }>,
): number | undefined {
  if (nuclei.length === 0) return undefined

  for (const nucleus of nuclei) {
    if (letters.slice(nucleus.start, nucleus.end).some((letter) =>
      ["á", "é", "í", "ó", "ú"].includes(letter),
    )) {
      return nucleus.start
    }
  }

  const last = letters.at(-1) ?? ""
  const endsInVowel = isVowel(last)
  const stressFinal = !endsInVowel && last !== "n" && last !== "s"
  if (stressFinal || nuclei.length === 1) return nuclei[nuclei.length - 1].start
  return nuclei[nuclei.length - 2].start
}

function secondaryStressStarts(
  nuclei: Array<{ start: number; end: number }>,
  primaryStart: number | undefined,
): Set<number> {
  const result = new Set<number>()
  if (primaryStart === undefined) return result

  const primaryIndex = nuclei.findIndex((nucleus) => nucleus.start === primaryStart)
  nuclei.forEach((nucleus, index) => {
    if (index % 2 === 0 && index !== primaryIndex && Math.abs(index - primaryIndex) !== 1) {
      result.add(nucleus.start)
    }
  })
  return result
}

function phonemizeWord(source: string): string {
  const letters = Array.from(source.toLocaleLowerCase("es")).filter((letter) =>
    /\p{L}/u.test(letter),
  )
  if (letters.length === 0) return ""

  const nuclei = vowelNuclei(letters)
  const isFunctionWord = UNSTRESSED_WORDS.has(source.toLocaleLowerCase("es"))
  const stressStart = isFunctionWord ? undefined : primaryStressStart(letters, nuclei)
  const secondary = secondaryStressStarts(nuclei, stressStart)

  let output = ""
  let index = 0

  while (index < letters.length) {
    if (index === stressStart) output += STRESS_MARK
    else if (secondary.has(index)) output += SECONDARY_STRESS_MARK

    const current = letters[index]
    const next = letters[index + 1]
    const next2 = letters[index + 2]
    const previous = letters[index - 1]

    if (current === "c" && next === "h") {
      output += "ʧ"
      index += 2
      continue
    }
    if (current === "c") {
      output += next && ["e", "i", "é", "í"].includes(next) ? "s" : "k"
      index += 1
      continue
    }
    if (current === "q" && next === "u") {
      output += "k"
      index += 2
      continue
    }
    if (current === "g" && next === "u" && ["a", "o"].includes(next2 ?? "")) {
      output += "ɡw"
      if (stressStart === index + 1) output += STRESS_MARK
      index += 2
      continue
    }
    if (current === "g" && (next === "u" || next === "ü") && ["e", "i", "é", "í"].includes(next2 ?? "")) {
      if (next === "ü") output += "ɡw"
      else output += "ɡ"
      index += next === "ü" ? 1 : 2
      continue
    }
    if (current === "g" && ["e", "i", "é", "í"].includes(next ?? "")) {
      output += "x"
      index += 1
      continue
    }
    if (current === "g") {
      output += !previous || previous === "n" ? "ɡ" : "ɣ"
      index += 1
      continue
    }
    if (current === "h") {
      index += 1
      continue
    }
    if (current === "l" && next === "l") {
      output += "ʝ"
      index += 2
      continue
    }
    if (current === "r" && next === "r") {
      output += "r"
      index += 2
      continue
    }
    if (current === "r") {
      output += !previous || ["n", "l", "s"].includes(previous) ? "r" : "ɾ"
      index += 1
      continue
    }
    if (current === "ñ") {
      output += "ɲ"
      index += 1
      continue
    }
    if (current === "b" || current === "v") {
      output += !previous || ["n", "m"].includes(previous) ? "b" : "β"
      index += 1
      continue
    }
    if (current === "d") {
      output += !previous || ["n", "l"].includes(previous) ? "d" : "ð"
      index += 1
      continue
    }
    if (current === "y") {
      output += next && isVowel(next) ? "ʝ" : "i"
      index += 1
      continue
    }
    if (current === "x") {
      output += "ks"
      index += 1
      continue
    }
    if (current === "j") {
      output += "x"
      index += 1
      continue
    }
    if (current === "z") {
      output += "s"
      index += 1
      continue
    }
    if ("stpfklmnw".includes(current)) {
      output += current
      index += 1
      continue
    }
    if (isVowel(current)) {
      output += stripAccent(current === "ü" ? "u" : current)
      index += 1
      continue
    }

    // La letra q fuera de "qu" y las grafías no contempladas no deben
    // convertirse silenciosamente en una pronunciación inventada.
    if (current === "q") {
      output += "k"
      index += 1
      continue
    }

    index += 1
  }

  return output
}

function isDecimalSeparator(characters: string[], index: number): boolean {
  return (characters[index] === "." || characters[index] === ",") &&
    index > 0 &&
    index < characters.length - 1 &&
    /\d/.test(characters[index - 1]) &&
    /\d/.test(characters[index + 1])
}

/**
 * Convierte texto español a la secuencia fonética que espera Kokoro.
 * Conserva puntuación compatible y rechaza cifras para evitar que el
 * tokenizador las descarte silenciosamente.
 */
export function phonemizeSpanish(text: string): string {
  const input = text.trim()
  if (!input) throw new Error("Escribe un texto para generar la muestra.")
  if (/\d/u.test(input)) {
    throw new Error(
      "Esta prueba aún no normaliza cifras. Escribe los números con palabras para evaluar la fonemización.",
    )
  }

  const characters = Array.from(input)
  const output: string[] = []
  let word = ""

  const flushWord = () => {
    if (word) {
      const phonemes = phonemizeWord(word)
      if (phonemes) output.push(phonemes)
      word = ""
    }
  }

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]

    if (isDecimalSeparator(characters, index)) {
      word += character
      continue
    }

    if (/\p{L}/u.test(character) || character === "'" || character === "’") {
      word += character
      continue
    }

    flushWord()

    if (character === "¿" || character === "¡") continue
    if (";:,.!?—…\"()“”".includes(character)) {
      output.push(character === "–" ? "—" : character)
    } else if (/\s/u.test(character)) {
      if (output.length > 0 && output[output.length - 1] !== " ") output.push(" ")
    }
  }

  flushWord()

  const phonemes = output.join("").replace(/\s+/g, " ").trim()
  if (!phonemes) throw new Error("El texto no produjo fonemas.")
  const unknown = Array.from(new Set(Array.from(phonemes).filter((symbol) =>
    !KOKORO_SPANISH_SYMBOLS.has(symbol),
  )))
  if (unknown.length > 0) {
    throw new Error(`El fonemizador produjo símbolos fuera del vocabulario Kokoro: ${unknown.join(" ")}`)
  }

  return phonemes
}

/** Devuelve los símbolos que la prueba no reconoce como tokens de Kokoro. */
export function findUnknownKokoroSymbols(phonemes: string): string[] {
  return Array.from(new Set(Array.from(phonemes).filter((symbol) =>
    !KOKORO_SPANISH_SYMBOLS.has(symbol),
  )))
}
