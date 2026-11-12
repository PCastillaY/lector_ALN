"use client"

import { useEffect, useRef, useState } from "react"

type VoiceId = "ef_dora" | "em_alex" | "em_santa"
type Backend = "wasm" | "webgpu"

interface KokoroInstance {
  tokenizer(text: string, options: { truncation: boolean }): { input_ids: { dims: number[] } }
  model(inputs: {
    input_ids: unknown
    style: unknown
    speed: unknown
  }): Promise<{ waveform: { data: Float32Array } }>
}

interface KokoroModule {
  KokoroTTS: {
    from_pretrained(
      modelId: string,
      options: {
        dtype: "q8" | "fp32"
        device: Backend
        progress_callback?: (event: Record<string, unknown>) => void
      },
    ): Promise<KokoroInstance>
  }
}

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"

const VOICES: Array<{ id: VoiceId; name: string; gender: string; note: string }> = [
  { id: "ef_dora", name: "Dora", gender: "Femenina", note: "Español" },
  { id: "em_alex", name: "Alex", gender: "Masculina", note: "Español" },
  { id: "em_santa", name: "Santa", gender: "Masculina", note: "Español" },
]

const DEFAULT_TEXT =
  "Buenos días. Esta es una prueba de lectura en español latinoamericano. En el año 2026, el documento contiene 125 páginas, tres capítulos y varias cifras: 12,5 %, S/ 1.250,50 y 7:30 p. m. ¿La pronunciación resulta clara y natural?"

const VOICE_ASSET_BASE =
  "https://huggingface.co/skillsafe-ai/kokoro-82m/resolve/main/voices"
const VOICE_CACHE_NAME = "lector-aln-kokoro-spanish-voices-v1"
const STYLE_DIM = 256
const SAMPLE_RATE = 24000
const VOICE_STYLE_ROWS = 510
const VOICE_ASSET_SHA256: Record<VoiceId, string> = {
  ef_dora: "f66ec66bd295acb18372e37008533a9a3228483ccd294e7538d5d9294ac9a532",
  em_alex: "27809e9eafdcbcfff90a3016c697568676531de2a2c39cee29c96c7bd6b83e95",
  em_santa: "ad43b774e1ca24d05c6161297d8aeb770ac3d29bb95daf516727af5f7d543683",
}
const voiceDataMemoryCache = new Map<VoiceId, Float32Array>()

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer.slice(0))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function validateVoiceBuffer(buffer: ArrayBuffer, voice: VoiceId): Promise<void> {
  const expectedBytes = VOICE_STYLE_ROWS * STYLE_DIM * Float32Array.BYTES_PER_ELEMENT
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(`El archivo de voz ${voice} tiene un tamaño inesperado.`)
  }
  const actualHash = await sha256Hex(buffer)
  if (actualHash !== VOICE_ASSET_SHA256[voice]) {
    throw new Error(`La verificación SHA-256 del perfil ${voice} no coincide con el manifiesto.`)
  }
}

async function loadVoiceData(voice: VoiceId): Promise<Float32Array> {
  const inMemory = voiceDataMemoryCache.get(voice)
  if (inMemory) return inMemory

  const url = `${VOICE_ASSET_BASE}/${voice}.bin`
  const cache = await caches.open(VOICE_CACHE_NAME)
  const cached = await cache.match(url)
  if (cached) {
    const cachedBuffer = await cached.arrayBuffer()
    try {
      await validateVoiceBuffer(cachedBuffer, voice)
      const data = new Float32Array(cachedBuffer)
      voiceDataMemoryCache.set(voice, data)
      return data
    } catch {
      await cache.delete(url)
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`No se pudo descargar el perfil de voz ${voice} (HTTP ${response.status}).`)
  }

  const buffer = await response.arrayBuffer()
  await validateVoiceBuffer(buffer, voice)

  await cache.put(url, new Response(buffer.slice(0), {
    headers: { "Content-Type": "application/octet-stream" },
  }))
  const data = new Float32Array(buffer)
  voiceDataMemoryCache.set(voice, data)
  return data
}

function audioToWavBlob(samples: Float32Array): Blob {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeText(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeText(8, "WAVE")
  writeText(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeText(36, "data")
  view.setUint32(40, dataSize, true)

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(44 + index * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export function TtsPocWorkbench() {
  const engineRef = useRef<KokoroInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [voiceId, setVoiceId] = useState<VoiceId>("ef_dora")
  const [backend, setBackend] = useState<Backend>("wasm")
  const [text, setText] = useState(DEFAULT_TEXT)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState("Motor sin descargar")
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [audioUrl, setAudioUrl] = useState("")
  const [persistentStorage, setPersistentStorage] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown")
  const [storageUsage, setStorageUsage] = useState<string>("")

  const selectedVoice = VOICES.find((voice) => voice.id === voiceId) ?? VOICES[0]

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  async function loadEngine() {
    if (engineRef.current || loading) return
    if (backend === "webgpu" && !("gpu" in navigator)) {
      setError("WebGPU no está disponible en este navegador. Selecciona WebAssembly (CPU).")
      return
    }

    setLoading(true)
    setError("")
    setProgress(null)
    setStatus("Preparando el runtime y descargando el modelo…")

    try {
      // Keep model weights and ONNX Runtime WASM artifacts in the browser Cache API.
      // This cache is separate from the service worker app-shell cache.
      const { env } = await import("@huggingface/transformers")
      env.useBrowserCache = true
      env.allowRemoteModels = true
      const wasmBackend = env.backends.onnx.wasm
      if (!wasmBackend) throw new Error("El backend WASM de ONNX Runtime no está disponible.")
      Object.assign(wasmBackend, { wasmPaths: "/onnxruntime/" })

      const module = (await import("kokoro-js")) as unknown as KokoroModule
      const engine = await module.KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: backend === "webgpu" ? "fp32" : "q8",
        device: backend,
        progress_callback: (event) => {
          const value = event.progress
          if (typeof value === "number" && Number.isFinite(value)) {
            setProgress(Math.max(0, Math.min(100, value)))
          }
          const file = event.file
          if (typeof file === "string") setStatus(`Descargando recurso: ${file}`)
          else setStatus("Descargando y preparando archivos del modelo…")
        },
      })

      engineRef.current = engine
      setReady(true)
      setProgress(100)
      const persisted = navigator.storage?.persist ? await navigator.storage.persist().catch(() => false) : undefined
      setPersistentStorage(persisted === true ? "granted" : persisted === false ? "denied" : "unsupported")
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => undefined) : undefined
      if (estimate?.usage !== undefined && estimate.quota !== undefined) {
        setStorageUsage(`${(estimate.usage / 1024 / 1024).toFixed(0)} MB usados de ${(estimate.quota / 1024 / 1024).toFixed(0)} MB disponibles`)
      }
      setStatus(`Motor preparado mediante ${backend === "webgpu" ? "WebGPU" : "WebAssembly (CPU)"}.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error desconocido al cargar el motor."
      setError(message)
      setStatus("No se pudo preparar el motor.")
    } finally {
      setLoading(false)
    }
  }

  async function previewVoice() {
    if (!engineRef.current || generating || !text.trim()) return

    setGenerating(true)
    setError("")
    setStatus(`Generando muestra con la voz ${selectedVoice.name}…`)
    audioRef.current?.pause()

    try {
      const [{ phonemize }, { Tensor }] = await Promise.all([
        import("phonemizer"),
        import("@huggingface/transformers"),
      ])
      const phonemeParts = await phonemize(text.trim(), "es")
      const phonemeText = phonemeParts.join(" ").trim()
      if (!phonemeText) throw new Error("El fonemizador no produjo fonemas para el texto indicado.")

      const { input_ids } = engineRef.current.tokenizer(phonemeText, { truncation: true })
      const tokenCount = input_ids.dims.at(-1) ?? 0
      if (tokenCount < 2) throw new Error("El texto no produjo suficientes tokens para sintetizar audio.")

      const voiceData = await loadVoiceData(voiceId)
      const styleIndex = Math.min(Math.max(tokenCount - 2, 0), VOICE_STYLE_ROWS - 1) * STYLE_DIM
      const styleData = voiceData.slice(styleIndex, styleIndex + STYLE_DIM)
      if (styleData.length !== STYLE_DIM) throw new Error(`El perfil de voz ${voiceId} no contiene el vector de estilo esperado.`)

      const output = await engineRef.current.model({
        input_ids,
        style: new Tensor("float32", styleData, [1, STYLE_DIM]),
        speed: new Tensor("float32", [speed], [1]),
      })
      const blob = audioToWavBlob(output.waveform.data)
      const nextUrl = URL.createObjectURL(blob)

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = nextUrl
      setAudioUrl(nextUrl)
      setStatus(`Muestra generada localmente con ${selectedVoice.name}.`)
      window.setTimeout(() => {
        void audioRef.current?.play().catch(() => {
          setStatus("Muestra generada. Pulsa reproducir en el control de audio.")
        })
      }, 0)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo generar la muestra."
      setError(message)
      setStatus("Falló la generación de audio.")
    } finally {
      setGenerating(false)
    }
  }

  function changeBackend(value: Backend) {
    if (engineRef.current) {
      setError("El motor ya está cargado. Recarga la página para cambiar de backend.")
      return
    }
    setBackend(value)
    setError("")
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Lector ALN · Laboratorio experimental</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Prueba de voces neuronales</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Evalúa Kokoro-82M en Chrome. El texto se sintetiza en este dispositivo; la conexión inicial se utiliza para descargar el runtime y los archivos del modelo.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">1. Preparar el motor</h2>
              <p className="mt-1 text-sm text-slate-500">Modelo: Kokoro-82M · {MODEL_ID}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {ready ? "Preparado en esta pestaña" : "No preparado"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-4 ${backend === "wasm" ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200"}`}>
              <input type="radio" name="backend" value="wasm" checked={backend === "wasm"} onChange={() => changeBackend("wasm")} disabled={loading || ready} className="mr-2"/>
              <span className="font-medium">WebAssembly · CPU</span>
              <p className="mt-1 pl-6 text-xs leading-5 text-slate-500">Modelo cuantizado Q8. Opción de compatibilidad inicial.</p>
            </label>
            <label className={`cursor-pointer rounded-xl border p-4 ${backend === "webgpu" ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200"}`}>
              <input type="radio" name="backend" value="webgpu" checked={backend === "webgpu"} onChange={() => changeBackend("webgpu")} disabled={loading || ready} className="mr-2"/>
              <span className="font-medium">WebGPU · GPU</span>
              <p className="mt-1 pl-6 text-xs leading-5 text-slate-500">Modelo FP32. Requiere GPU y controladores compatibles.</p>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void loadEngine()} disabled={loading || ready} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Descargando / preparando…" : ready ? "Motor preparado" : "Descargar y preparar motor"}
            </button>
            <span className="text-xs text-slate-500" aria-live="polite">{status}</span>
          </div>
          {ready && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
              <p className="font-semibold">Caché local del motor activada</p>
              <p>Transformers.js guarda los pesos del modelo y los binarios WASM en Cache Storage para reutilizarlos entre sesiones.</p>
              <p className="mt-1">Almacenamiento persistente: {persistentStorage === "granted" ? "concedido" : persistentStorage === "denied" ? "no concedido; Chrome podría desalojar datos" : "no confirmado"}.</p>
              {storageUsage && <p>{storageUsage}</p>}
            </div>
          )}
          {loading && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: progress === null ? "12%" : `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{progress === null ? "Esperando progreso de descarga…" : `${Math.round(progress)} % reportado por el runtime`}</p>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold">2. Seleccionar y escuchar una voz</h2>
          <p className="mt-1 text-sm text-slate-500">Las voces españolas usan fonemización eSpeak NG (es) y perfiles de estilo descargados una vez y guardados en una caché local independiente.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {VOICES.map((voice) => (
              <button key={voice.id} type="button" onClick={() => setVoiceId(voice.id)} disabled={!ready || generating} className={`rounded-xl border p-4 text-left transition ${voiceId === voice.id ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className="block text-sm font-semibold">{voice.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{voice.gender} · {voice.note}</span>
                <span className="mt-2 block text-[11px] text-slate-400">{voice.id}</span>
              </button>
            ))}
          </div>

          <label htmlFor="sample-text" className="mt-5 block text-sm font-medium">Texto de prueba</label>
          <textarea id="sample-text" value={text} onChange={(event) => setText(event.target.value)} rows={5} maxLength={1200} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Velocidad
              <input type="range" min="0.8" max="1.2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} disabled={generating}/>
              <span className="w-10 tabular-nums">{speed.toFixed(2)}×</span>
            </label>
            <button type="button" onClick={() => void previewVoice()} disabled={!ready || generating || !text.trim()} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">
              {generating ? "Generando muestra…" : `Previsualizar ${selectedVoice.name}`}
            </button>
          </div>

          {audioUrl && (
            <div className="mt-5 rounded-xl bg-slate-50 p-3">
              <audio ref={audioRef} controls src={audioUrl} className="w-full">Tu navegador no admite el elemento de audio.</audio>
            </div>
          )}
        </section>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm sm:p-6">
          <h2 className="font-semibold text-slate-900">Notas de esta prueba</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>La descarga inicial requiere Internet; la fonemización y la inferencia se ejecutan en el navegador.</li>
            <li>La PWA cachea el app shell y los recursos same-origin utilizados. Transformers.js mantiene por separado los pesos y binarios WASM en Cache Storage; los tres perfiles españoles se guardan en lector-aln-kokoro-spanish-voices-v1.</li>
            <li>La persistencia del almacenamiento se solicita al navegador, pero este puede denegarla o eliminar datos; la prueba tras reiniciar Chrome sigue siendo obligatoria.</li>
            <li>La primera visita, la instalación de la PWA y la descarga inicial del modelo requieren conexión. La prueba offline debe realizarse después de completar la carga del laboratorio y del modelo.</li>
            <li>El laboratorio no accede a los documentos ni modifica el progreso de lectura.</li>
            <li>WebAssembly y WebGPU se evalúan por separado; WebGPU utiliza pesos FP32 y puede descargar más datos.</li>
            <li>La prueba no integra todavía Piper ni constituye una decisión final del motor.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
