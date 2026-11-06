# Lector ALN — arquitectura técnica

## Objetivo
Aplicación web de lectura asistida que importa documentos, presenta su contenido y lo narra con voces sintéticas naturales. La interfaz y el dominio deben ser independientes del proveedor de voz y del modo de almacenamiento.

## Decisiones de producto
- Narración híbrida: proveedor remoto para voces neuronales de alta naturalidad y motor local/nativo como alternativa de privacidad y disponibilidad.
- Formatos objetivo: EPUB, PDF con capa de texto, TXT, DOCX y MOBI.
- PDF escaneado/OCR: fuera del alcance inicial. Detectar documentos sin texto extraíble y explicar la limitación; no prometer lectura OCR.
- Biblioteca dual: modo local sin cuenta y modo sincronizado con cuenta.
- Idioma inicial de interfaz: español; el motor debe conservar el idioma del documento para seleccionar voces compatibles.

## Arquitectura por capas

### 1. Presentación (Next.js App Router)
- `app/`: rutas y composición.
- `components/library`: biblioteca, importación y estados vacíos.
- `components/reader`: visor, navegación y preferencias de lectura.
- `components/audio`: reproductor y selector de voz.
- Los componentes no deben llamar directamente a proveedores TTS ni a SDK de almacenamiento.

### 2. Dominio documental
Contrato común `DocumentRecord`: id, nombre, formato, tamaño, fecha de importación, origen de almacenamiento y estado de procesamiento.
- Adaptadores: EPUB (epub.js), PDF (PDF.js), TXT (TextDecoder), DOCX (mammoth).
- MOBI: adaptador/conversión aislada; evaluar compatibilidad y licencias antes de incorporarlo.
- Salida normalizada: `DocumentContent` con título, metadatos, secciones y bloques de texto ordenados.
- Segmentador: divide por párrafos/oraciones y limita longitud de fragmentos para TTS, conservando offsets para sincronización.

### 3. Narración
Contrato `TTSProvider` independiente del proveedor:
- `listVoices()`
- `synthesize(text, options)`
- `supportsStreaming` / capacidades declaradas.
Implementaciones previstas:
- Cloud: API de voz neuronal llamada exclusivamente desde rutas de servidor.
- Local: Web Speech API como fallback inicial; a futuro, motor local dedicado si se requiere calidad/offline consistente.
- `SpeechQueue`: cola de fragmentos, cancelación, pausa/reanudación, reintentos y precarga. No sintetizar un libro completo en una sola petición.
- Nunca exponer API keys en el navegador. Aplicar límites de tamaño, tasa y coste en endpoints cloud.

### 4. Persistencia
- Local: IndexedDB para binarios y metadatos, sin subir documentos.
- Cuenta: Supabase Auth + PostgreSQL para usuarios, biblioteca, progreso y marcadores; Supabase Storage para archivos privados.
- La capa `DocumentRepository` abstrae ambos backends. No duplicar archivos automáticamente al iniciar sesión: ofrecer migración/sincronización explícita.
- Storage privado, RLS por propietario y URLs firmadas de corta duración.

### 5. Backend
- Route Handlers para importación cloud, extracción cuando sea necesario y síntesis TTS.
- Validar extensión, MIME real, tamaño y estructura; tratar documentos como contenido no confiable.
- No ejecutar macros ni contenido embebido. Sanitizar HTML de EPUB antes de renderizarlo.
- OCR deliberadamente deshabilitado en la primera versión.

## Flujo principal
1. Importar documento y validar formato/tamaño.
2. Guardarlo en IndexedDB o Storage privado según el modo elegido.
3. Extraer y normalizar texto mediante el adaptador del formato.
4. Mostrar contenido en el lector y persistir posición.
5. Segmentar texto y enviarlo a la cola TTS.
6. Reproducir audio y sincronizar el bloque activo.
7. Guardar progreso y marcadores localmente o en la cuenta.

## Modelo de datos inicial
- `documents`: id, owner_id nullable, title, file_name, format, size_bytes, storage_mode, storage_key nullable, processing_status, created_at, updated_at.
- `reading_progress`: user_id/document_id, section_index, block_index, character_offset, updated_at.
- `bookmarks`: id, user_id/document_id, section_index, block_index, note nullable, created_at.
- `reader_preferences`: user_id nullable, font_family, font_size, line_height, theme, speech_rate, voice_id.

## Estructura incremental
```
app/
  api/                    # Route Handlers (se añadirán con TTS/cloud)
  reader/[id]/            # lector
  page.tsx                # biblioteca
components/
  library/
  reader/
  audio/
  ui/                     # componentes existentes
lib/
  documents/
    adapters/
    segmentation/
    types.ts
    validation.ts
  speech/
    providers/
    queue/
  storage/
    local/
    cloud/
  repositories/
```

## Fases
1. Fundamentos y biblioteca local (actual): contratos, validación, importación y persistencia IndexedDB.
2. Lectura: extracción y visor EPUB/PDF/TXT/DOCX; detección de PDF sin capa de texto.
3. Narración: Web Speech API, reproductor y cola; después proveedor cloud intercambiable.
4. Cuenta y nube: Supabase Auth/DB/Storage, RLS y sincronización explícita.
5. Continuidad: resaltado sincronizado, marcadores, progreso y preferencias.
6. MOBI y optimización: adaptador/conversión, caché, pruebas de documentos grandes. OCR solo si se aprueba como alcance separado.

## Criterios de calidad
- TypeScript estricto; no ocultar errores de compilación.
- Adaptadores testeables sin UI.
- Manejar archivos corruptos, vacíos, grandes y formatos no compatibles con mensajes accionables.
- Mantener el modo local plenamente útil sin cuenta ni conexión.
- Pruebas unitarias para validación, segmentación y repositorios; pruebas de integración para extracción y TTS.
