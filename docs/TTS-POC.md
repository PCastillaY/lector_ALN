# Laboratorio TTS — prueba de concepto

## Objetivo

Evaluar síntesis neuronal local en Chrome para Lector ALN sin conectar todavía el motor al lector, a la cola de segmentos ni a `ReadingProgress`.

La página experimental se sirve en `/lab/tts`. La ruta candidata continúa siendo Kokoro-82M, pero la integración española requiere una capa propia de fonemización e inferencia porque `kokoro-js@1.2.1` no expone soporte español en su API estándar.

## Hallazgo: incompatibilidad de la API estándar

El error `Voice "em_santa" not found` no era un fallo de la descarga ni de Chrome. La implementación estándar de `kokoro-js` 1.2.1 mantiene una lista de voces inglesa/británica y su fonemizador selecciona únicamente `en-us` o `en`. Los registros de `ef_dora`, `em_alex` y `em_santa` aparecen comentados en el código de voces y no están habilitados en la biblioteca publicada.

Por tanto, no se deben cambiar los IDs españoles por voces inglesas. La PoC ahora evita `KokoroTTS.generate()` y utiliza directamente las piezas de bajo nivel:

1. `kokoro-js` carga el modelo ONNX y el tokenizador mediante Transformers.js.
2. `phonemizer@1.2.1` genera fonemas con eSpeak NG usando el locale `es`.
3. El tokenizador de Kokoro convierte la secuencia fonética en `input_ids`.
4. Se carga el embedding español de la voz seleccionada y se extrae el vector de estilo correspondiente a la longitud del texto.
5. El modelo ONNX genera la forma de onda; la PoC la convierte a WAV en el navegador.

Esta es una adaptación experimental del flujo de inferencia, no una integración oficial de español en `kokoro-js`.

## Componentes y fuentes

- Modelo: `onnx-community/Kokoro-82M-v1.0-ONNX`.
- Runtime de modelo/tokenizador: `kokoro-js@1.2.1` + `@huggingface/transformers@3.8.1`.
- Fonemizador: `phonemizer@1.2.1`, eSpeak NG con locale `es`.
- Embeddings españoles: `skillsafe-ai/kokoro-82m/voices`.
- Voces: `ef_dora` (Dora), `em_alex` (Alex), `em_santa` (Santa).
- Backend inicial: WebAssembly con Q8.
- Backend alternativo: WebGPU con FP32.
- Texto editable de prueba, velocidad y preview local.
- No se accede a documentos de la biblioteca ni se persiste progreso.
- No se envía texto a un servicio de síntesis remoto.

### Integridad de embeddings

La PoC verifica tamaño y SHA-256 antes de guardar los perfiles de voz en Cache Storage:

| Voz | SHA-256 |
|---|---|
| `ef_dora` | `f66ec66bd295acb18372e37008533a9a3228483ccd294e7538d5d9294ac9a532` |
| `em_alex` | `27809e9eafdcbcfff90a3016c697568676531de2a2c39cee29c96c7bd6b83e95` |
| `em_santa` | `ad43b774e1ca24d05c6161297d8aeb770ac3d29bb95daf516727af5f7d543683` |

Los hashes se contrastan con el manifiesto publicado por el repositorio de modelos. La URL de descarga usa actualmente la rama `main`, pero la comprobación SHA-256 impide aceptar silenciosamente un archivo distinto. Antes de producción, fijar también una revisión inmutable del repositorio de voces.

## Decisión sobre servicios remotos

El proyecto no ofrecerá síntesis cloud. La conexión inicial se utiliza exclusivamente para descargar la biblioteca, el modelo, los recursos ONNX y los perfiles de voz. El contenido escrito para la prueba permanece en el dispositivo.

## Disponibilidad offline y caché

La PoC utiliza tres mecanismos independientes:

1. **App shell (Service Worker):** `public/sw.js` cachea las rutas HTML y los recursos estáticos same-origin solicitados mientras el Service Worker controla la página.
2. **Modelo y runtime (Transformers.js):** se activa explícitamente `env.useBrowserCache`. Los pesos y archivos del modelo se almacenan en Cache Storage. Los binarios ONNX Runtime WASM se copian durante `predev`/`prebuild` desde la dependencia instalada a `public/onnxruntime/`.
3. **Perfiles de voz españoles:** los archivos `.bin` se descargan desde el repositorio de modelos, se verifican por SHA-256 y se guardan en la caché `lector-aln-kokoro-spanish-voices-v1`.

Después de la carga del motor, la aplicación solicita `navigator.storage.persist()` y muestra el resultado y la estimación de uso/cuota. La concesión no está garantizada y el navegador aún puede eliminar datos en determinadas circunstancias.

Esto constituye una base de prueba, no una garantía offline ya validada. Debe verificarse:
1. Que el Service Worker esté activo y controle la página.
2. Que la navegación a `/lab/tts` se restaure offline después de una visita online controlada.
3. Que todos los chunks JS/CSS requeridos se hayan cacheado tras recargar con el Service Worker activo.
4. Que el runtime, pesos, archivos de configuración, tokenizador y recursos ONNX queden en Cache Storage.
5. Que los tres embeddings españoles estén cacheados y pasen la verificación SHA-256.
6. Que la generación funcione sin red tras recargar y después de cerrar/reabrir Chrome.
7. Qué sucede si Chrome deniega persistencia o el usuario elimina los datos del sitio.

No se debe confundir la caché del app shell con la caché del modelo ni con la caché de perfiles de voz. Tampoco se debe afirmar que el modelo está instalado offline solo porque el botón de descarga terminó: la generación offline tras reinicio es la prueba decisiva.

## Licencias y distribución

- `kokoro-js`: Apache-2.0.
- `@huggingface/transformers`: revisar la licencia de la versión fijada y sus dependencias.
- Modelo Kokoro-82M y perfiles de voz: el repositorio de modelos declara Apache-2.0 y atribuye pesos/voz al proyecto upstream; conservar avisos y revisar los términos de cada artefacto.
- `phonemizer`: el paquete npm declara Apache-2.0. Antes de distribuir, auditar expresamente la licencia del código eSpeak NG y de los datos fonéticos incluidos en el bundle WASM; no asumir que la licencia del wrapper cubre todos los componentes.
- No incorporar modelos ni embeddings al repositorio Git.

## Protocolo de evaluación

1. Ejecutar `pnpm install --no-frozen-lockfile` para actualizar el lockfile con la dependencia directa `phonemizer`.
2. Ejecutar `pnpm typecheck`, `pnpm test` y `pnpm build`.
3. Ejecutar `pnpm start` y abrir `/lab/tts` en Chrome.
4. Preparar Kokoro mediante WebAssembly Q8 y comprobar que el fonemizador reconoce español.
5. Generar una muestra con Dora, Alex y Santa. Confirmar que cada archivo de voz supera la verificación SHA-256.
6. Escuchar y evaluar pronunciación, inteligibilidad, acento percibido, ritmo, prosodia, artefactos y números.
7. Repetir en WebGPU FP32, si está disponible.
8. Medir descarga, inicialización, tiempo hasta el primer audio, velocidad de generación y memoria aproximada.
9. Recargar con Internet y confirmar que los recursos se reutilizan desde caché.
10. Desconectar Internet y comprobar la carga del laboratorio y la síntesis.
11. Cerrar completamente Chrome, mantener la red desconectada, reabrir la PWA y repetir la síntesis.

### Texto común de evaluación

> Buenos días. Esta es una prueba de lectura en español latinoamericano. En el año 2026, el documento contiene 125 páginas, tres capítulos y varias cifras: 12,5 %, S/ 1.250,50 y 7:30 p. m. ¿La pronunciación resulta clara y natural?

Añadir después un párrafo narrativo largo con diálogo, nombres propios, abreviaturas y números. Comparar también una versión del mismo texto con cifras y cantidades escritas con palabras para separar la calidad de voz de la normalización numérica.

## Riesgos y criterios de decisión

La nueva ruta de síntesis aún no está validada en navegador. En particular, se debe comprobar que los fonemas generados por eSpeak NG `es` coinciden con el inventario esperado por el tokenizador/modelo y que la salida conserva calidad suficiente. La referencia de Kokoro en español utiliza Misaki `EspeakG2P(language="es")`; el fonemizador JS debe compararse auditivamente y con un pequeño corpus de referencia antes de aceptar la equivalencia.

No seleccionar motor principal hasta comprobar:
- Calidad auditiva aceptable para lectura prolongada.
- Español comprensible para lectores de Perú, sin atribuir una variante regional sin evidencia.
- Normalización correcta de cifras, moneda, fechas, siglas y abreviaturas.
- Síntesis suficientemente rápida para no interrumpir la reproducción.
- Uso de memoria razonable en Chrome.
- Funcionamiento offline después de instalación.
- Licencias compatibles con el uso y distribución previstos.
