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

## Consideraciones de caché

La prueba usa el mecanismo de caché del runtime Transformers.js a través de `kokoro-js`. Esto no equivale todavía a un instalador de modelos administrado por Lector ALN. Debe verificarse:
1. Si los pesos y recursos de voz permanecen disponibles tras recargar Chrome.
2. Si la generación funciona después de desconectar la red.
3. Qué recursos adicionales solicita el runtime y si quedan cacheados.
4. Qué sucede si el navegador elimina la caché.

Una futura integración de producción debe administrar modelos y embeddings con versiones, hashes, progreso, cuotas y almacenamiento persistente explícito (preferentemente OPFS para archivos grandes), sin depender únicamente de la caché HTTP.

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
4. Recargar la página y repetir sin descargar deliberadamente los recursos.
5. Desconectar Internet y repetir la generación.
6. Cerrar y volver a abrir Chrome, sin red, y comprobar si el runtime conserva los recursos.
7. Registrar fallos, solicitudes de red, tamaño total descargado y backend efectivo.

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
