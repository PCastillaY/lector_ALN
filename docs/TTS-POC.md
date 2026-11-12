# Laboratorio TTS — prueba de concepto

## Objetivo

Evaluar síntesis neuronal local en Chrome para Lector ALN sin conectar todavía el motor al lector, a la cola de segmentos ni a `ReadingProgress`.

La página experimental se sirve en `/lab/tts` y utiliza Kokoro-82M mediante `kokoro-js`.

## Alcance

- Modelo: `onnx-community/Kokoro-82M-v1.0-ONNX`.
- Voces españolas: `ef_dora` (femenina), `em_alex` y `em_santa` (masculinas).
- Backend inicial: WebAssembly con Q8.
- Backend alternativo: WebGPU con FP32.
- Texto editable de prueba y control de velocidad.
- Descarga/preparación explícita y previsualización de voz.
- No se accede a documentos de la biblioteca ni se persiste progreso.
- No se envía texto a un servicio de síntesis remoto.

## Decisión sobre servicios remotos

El proyecto no ofrecerá síntesis cloud. La conexión inicial se utiliza exclusivamente para descargar la biblioteca, el modelo y los recursos de voz. El contenido escrito para la prueba permanece en el dispositivo.

## Disponibilidad offline y caché

La PoC incorpora dos mecanismos independientes:

1. **App shell (Service Worker):** `public/sw.js` cachea las rutas HTML `/` y `/lab/tts`, el manifiesto, el icono y los recursos estáticos same-origin de Next.js que se solicitan mientras el Service Worker controla la página. Las navegaciones usan red primero y recurren a la copia local si no hay conexión.
2. **Modelo y runtime (Transformers.js):** se activa explícitamente `env.useBrowserCache` y `env.useWasmCache`. Transformers.js almacena pesos y artefactos WASM en Cache Storage; esta caché es distinta de la caché del Service Worker. Los recursos del modelo pueden proceder de Hugging Face y el runtime gestiona su caché de navegador.

Después de la descarga, la aplicación solicita `navigator.storage.persist()` y muestra el resultado y la estimación de uso/cuota. La concesión no está garantizada y el navegador aún puede eliminar datos en determinadas circunstancias.

Esto constituye una base de prueba, no una garantía offline ya validada. Debe verificarse:
1. Que el Service Worker esté activo y controle la página.
2. Que la navegación a `/lab/tts` se restaure offline después de una visita online controlada.
3. Que todos los chunks JS/CSS requeridos se hayan cacheado tras recargar con el Service Worker activo.
4. Que el runtime, pesos, archivos de configuración, tokenizador y recursos de voz queden en Cache Storage.
5. Que la generación funcione sin red tras recargar y después de cerrar/reabrir Chrome.
6. Qué sucede si Chrome deniega persistencia o el usuario elimina los datos del sitio.

No se debe confundir la caché del app shell con la caché de modelo. Tampoco se debe afirmar que el modelo está instalado offline solo porque el botón de descarga terminó: la generación offline tras reinicio es la prueba decisiva.

Una futura integración de producción debe administrar paquetes de voz/modelo con versiones, hashes, progreso, cuotas, eliminación selectiva y almacenamiento persistente explícito (evaluar OPFS para archivos grandes), sin depender únicamente de caché HTTP.

## Licencias y distribución

- `kokoro-js`: Apache-2.0.
- Pesos del modelo `onnx-community/Kokoro-82M-v1.0-ONNX`: revisar el model card y conservar sus avisos.
- Cada embedding/voz debe verificarse con la licencia del modelo y la fuente correspondiente antes de distribuirlo.
- No incorporar modelos ni embeddings al repositorio Git.

Piper permanece como candidato alternativo de investigación. No se deben incorporar voces Piper a una distribución hasta revisar la cadena de entrenamiento y el MODEL_CARD de cada voz. En particular, no asumir que una licencia de catálogo se aplica a todas las voces.

## Protocolo de evaluación

Realizar las pruebas en Chrome de escritorio sobre el mismo equipo y con el mismo texto:

1. Primera carga con WebAssembly (Q8): medir descarga, tiempo de inicialización, tiempo hasta generar audio y memoria aproximada.
2. Repetir preview de Dora, Alex y Santa; registrar naturalidad, inteligibilidad, acento percibido y pronunciación de cifras.
3. Repetir en WebGPU (FP32), si está disponible.
4. Esperar a que la capa PWA indique que el Service Worker está activo; recargar una vez con Internet para que la página y sus chunks queden bajo control del Service Worker.
5. Instalar la PWA desde Chrome (si el navegador ofrece la opción) y abrirla al menos una vez con conexión.
6. Desconectar Internet y navegar/recargar `/lab/tts`; comprobar que se carga el app shell.
7. Volver a preparar el motor y generar audio sin red.
8. Cerrar completamente Chrome, mantener la red desconectada, reabrir la PWA y repetir la síntesis.
9. Registrar fallos, solicitudes de red, tamaño total descargado, estado de persistencia y backend efectivo.

### Texto común de evaluación

> Buenos días. Esta es una prueba de lectura en español latinoamericano. En el año 2026, el documento contiene 125 páginas, tres capítulos y varias cifras: 12,5 %, S/ 1.250,50 y 7:30 p. m. ¿La pronunciación resulta clara y natural?

Añadir después un párrafo narrativo largo con diálogo, nombres propios, abreviaturas y números.

## Criterios de decisión

No seleccionar motor principal hasta comprobar:
- Calidad auditiva aceptable para lectura prolongada.
- Español comprensible para lectores de Perú, sin atribuir una variante regional sin evidencia.
- Síntesis suficientemente rápida para no interrumpir la reproducción.
- Uso de memoria razonable en Chrome.
- Funcionamiento offline después de instalación.
- Licencias compatibles con el uso y distribución previstos.
