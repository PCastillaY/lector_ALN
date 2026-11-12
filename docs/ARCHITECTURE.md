# Lector ALN — arquitectura técnica

## Objetivo
Aplicación web instalable de lectura asistida que importa documentos, presenta su contenido y lo narra con voces sintéticas naturales. El idioma prioritario es el español. La aplicación debe poder instalarse como PWA, descargar voces/modelos y continuar leyendo y narrando sin conexión. La interfaz y el dominio deben ser independientes del motor TTS y del modo de almacenamiento.

## Decisiones de producto
- **Español primero:** interfaz, catálogo inicial de voces, mensajes y pruebas de calidad en español. La selección debe considerar variantes regionales; se priorizará español latinoamericano natural y comprensible para lectores de Perú, sin excluir otras variantes.
- **Local-first para narración:** el motor neuronal local descargable será la opción principal. La narración básica no debe depender de una API remota, cuotas gratuitas, claves ni conexión permanente.
- **Cloud opcional:** los proveedores remotos podrán añadirse como complemento para ofrecer voces alternativas o mayor naturalidad, siempre con límites y condiciones transparentes. Nunca serán requisito para leer un documento ya disponible localmente.
- **Motor inicial candidato: Kokoro-82M:** probar primero su ejecución en navegador mediante un runtime compatible. Voces españolas identificadas: `ef_dora`, `em_alex` y `em_santa`. No asumir que su acento es latinoamericano ni que la calidad es suficiente hasta realizar pruebas auditivas.
- **Alternativa de comparación: Piper:** evaluar voces regionales como `es_MX` y `es_AR`, además de `es_ES`. La disponibilidad, runtime web, rendimiento y licencia deben verificarse por modelo y voz; no asumir que todas las voces de un catálogo comparten licencia.
- **Criterio de selección TTS:** naturalidad, inteligibilidad, pronunciación de español latinoamericano, prosodia narrativa, lectura de números/fechas/siglas, rendimiento en CPU/WebGPU, memoria, tamaño descargable, funcionamiento offline y licencias.
- **Formatos vigentes:** EPUB, PDF con capa de texto y TXT. DOCX y MOBI están fuera del alcance actual.
- **PDF escaneado/OCR:** fuera del alcance inicial. Detectar documentos sin texto extraíble y explicar la limitación; no prometer lectura OCR.
- **Biblioteca dual:** modo local sin cuenta y modo sincronizado con cuenta.
- **Instalación:** PWA instalable como primera entrega offline. Una aplicación nativa de escritorio (Tauri/Electron) queda como posible evolución, no como requisito inicial.

## Arquitectura por capas

### 1. Presentación (Next.js App Router)
- `app/`: rutas y composición.
- `components/library`: biblioteca, importación y estados vacíos.
- `components/reader`: visor, navegación y preferencias de lectura.
- `components/audio`: reproductor, selector y gestión de voces.
- Los componentes no deben llamar directamente a proveedores TTS ni a SDK de almacenamiento.

### 2. Dominio documental
Contrato común `DocumentRecord`: id, nombre, formato, tamaño, fecha de importación, origen de almacenamiento y estado de procesamiento.
- Adaptadores vigentes: EPUB (epub.js), PDF (PDF.js) y TXT (TextDecoder). DOCX y MOBI no están implementados ni forman parte del alcance actual.
- El adaptador PDF procesa localmente la capa de texto con PDF.js; cada página con contenido se conserva como sección independiente. El worker de PDF.js se sirve desde el mismo origen, preparado desde la dependencia fijada durante `pnpm dev` y `pnpm build`.
- PDF protegidos con contraseña y PDF sin texto seleccionable se informan como no compatibles; OCR queda fuera del alcance inicial.
- MOBI: adaptador/conversión aislada; evaluar compatibilidad y licencias antes de incorporarlo.
- Salida normalizada: `DocumentContent` con título, metadatos, secciones y bloques de texto ordenados.
- Segmentador independiente en `lib/documents/segmentation/`: consume `DocumentContent` y produce `TextSegment` ordenados, vinculados a sección y bloque de origen. Divide bloques en oraciones y subdivide segmentos largos en límites de palabra. Conserva el texto mediante slices exactos y deriva offsets como `block.startOffset + índiceLocal`; no concatena bloques ni inventa una fuente global porque los offsets de TXT son posiciones sobre el texto decodificado, mientras PDF/EPUB usan offsets acumulados sobre contenido normalizado.
- Normalización de texto para locución: tratar números, fechas, abreviaturas, siglas, signos y espacios sin alterar el texto visible del documento.

### 3. Narración
Contrato `TTSProvider` independiente del proveedor:
- `listVoices()`
- `synthesize(text, options)`
- Capacidades declaradas: streaming, idiomas/variantes, cancelación, backend y requisitos de hardware.
Implementaciones previstas:
- `KokoroBrowserProvider`: primer candidato local para prueba de concepto en español.
- `PiperProvider`: alternativa local a evaluar, especialmente por su catálogo de voces regionales.
- `BrowserSpeechProvider`: fallback de compatibilidad; no prometer disponibilidad offline ni calidad uniforme, porque depende del navegador y del sistema operativo.
- `RemoteTTSProvider`: complemento opcional, invocado desde rutas de servidor.
- `SpeechQueue`: cola de fragmentos, cancelación, pausa/reanudación, reintentos y precarga. No sintetizar un libro completo en una sola petición.
- Mantener la voz seleccionada asociada al idioma/variante del documento y permitir cambiarla durante la lectura.
- No exponer API keys en el navegador. Aplicar límites de tamaño, tasa y coste en endpoints cloud.

### 4. PWA, modelos y almacenamiento local
- Implementar manifiesto y service worker para instalar la aplicación y cachear el app shell y recursos estáticos necesarios.
- Los modelos TTS y paquetes de voz se descargan bajo demanda desde fuentes verificadas; nunca se guardan pesos grandes dentro del repositorio Git.
- Guardar modelos/archivos de voz en almacenamiento local apropiado (Cache Storage, IndexedDB u OPFS según compatibilidad y tamaño); guardar metadatos, versiones, hashes y estado de descarga.
- Descargar voces de forma explícita, mostrar progreso/tamaño/estado y permitir eliminarlas sin borrar los libros.
- Verificar integridad mediante hash cuando la fuente lo permita y validar versión/compatibilidad del modelo.
- Solicitar almacenamiento persistente cuando el navegador lo admita y consultar cuota/uso disponible. Informar que el navegador o el usuario aún pueden borrar datos.
- La aplicación debe detectar si el modelo está disponible localmente y ofrecer un estado claro: descargado, descargando, no disponible o requiere conexión.
- Tras instalar la app, descargar al menos una voz y un libro debe permitir lectura y narración sin Internet, dentro de las capacidades del dispositivo.

### 5. Persistencia y sincronización
- Local: IndexedDB para binarios y metadatos documentales; almacenamiento adecuado para modelos y paquetes de voz.
- El progreso local se almacena en un object store independiente `reading_progress`, identificado por `documentId`; la migración de base de datos debe conservar íntegro el object store de documentos.
- El ancla de lectura conserva versión de esquema, sección y bloque de origen, offset UTF-16 local dentro del bloque, índices auxiliares, orden y fecha de actualización. La restauración prioriza sección/bloque/offset y usa el orden como fallback; no depende únicamente del índice global de segmento.
- El guardado se realiza con debounce y en `pagehide` como mejor esfuerzo. El progreso se elimina atómicamente junto con el documento local.
- Cuenta: Supabase Auth + PostgreSQL para usuarios, biblioteca, progreso y marcadores; Supabase Storage para archivos privados.
- La capa `DocumentRepository` abstrae ambos backends. No duplicar archivos automáticamente al iniciar sesión: ofrecer migración/sincronización explícita.
- Storage privado, RLS por propietario y URLs firmadas de corta duración.
- La biblioteca local debe seguir funcionando sin cuenta y sin conexión.

### 6. Backend
- Route Handlers para importación cloud, extracción cuando sea necesario y síntesis TTS remota opcional.
- Validar extensión, MIME real, tamaño y estructura; tratar documentos como contenido no confiable.
- No ejecutar macros ni contenido embebido. Sanitizar HTML de EPUB antes de renderizarlo.
- OCR deliberadamente deshabilitado en la primera versión.
- No hacer proxy de síntesis local a través del backend; el modelo local se ejecuta en el dispositivo.

## Flujo principal
1. Instalar/abrir la PWA e importar un documento.
2. Validar formato/tamaño y guardarlo en IndexedDB o Storage privado según el modo elegido.
3. Extraer y normalizar texto mediante el adaptador del formato.
4. Mostrar contenido en el lector y persistir posición.
5. Elegir una voz española compatible; descargarla si aún no está instalada.
6. Segmentar texto y enviarlo a la cola TTS local.
7. Reproducir audio y sincronizar el bloque activo.
8. Guardar progreso y marcadores localmente o en la cuenta.
9. Si el usuario lo elige y hay conexión, permitir cambiar a un proveedor remoto compatible.

## Modelo de datos inicial
- `documents`: id, owner_id nullable, title, file_name, format, size_bytes, storage_mode, storage_key nullable, processing_status, created_at, updated_at.
- `reading_progress`: user_id/document_id, section_index, block_index, character_offset, updated_at.
- `bookmarks`: id, user_id/document_id, section_index, block_index, note nullable, created_at.
- `reader_preferences`: user_id nullable, font_family, font_size, line_height, theme, speech_rate, voice_id, speech_mode.
- `voice_packs` (metadatos locales): id, provider, voice_id, language_tag, locale, version, source, license, size_bytes, checksum, installed_at.

## Estructura incremental
```
app/
  api/                    # Route Handlers (TTS remoto opcional)
  reader/[id]/            # lector
  page.tsx                # biblioteca
components/
  library/
  reader/
  audio/
  ui/
lib/
  documents/
    adapters/
    extraction/
    segmentation/
    types.ts
    validation.ts
  speech/
    providers/
    queue/
    voice-packs/
  storage/
    local/
    cloud/
  repositories/
public/
  manifest.json
```

## Fases
1. **Fundamentos y biblioteca local (en curso):** contratos, validación, importación y persistencia IndexedDB.
2. **Lectura:** extracción y visor EPUB/PDF/TXT/DOCX; detección de PDF sin capa de texto.
3. **Prueba de voces españolas:** prototipo comparativo de Kokoro y Piper; probar muestras narrativas, acento, pronunciación, rendimiento, consumo y licencias. Elegir motor principal solo tras evaluación.
4. **Narración local y PWA offline:** proveedor elegido, cola de reproducción, selector y descarga/gestión de paquetes de voz; app shell instalable y prueba sin conexión.
5. **Cuenta y nube opcional:** Supabase Auth/DB/Storage, RLS y sincronización explícita; proveedor remoto opcional si aporta valor.
6. **Continuidad y optimización:** resaltado sincronizado, marcadores, progreso, preferencias, MOBI y documentos grandes. OCR solo si se aprueba como alcance separado.

## Criterios de aceptación
- Una voz española local puede descargarse, seleccionarse y utilizarse sin cuenta.
- Tras descargar la PWA, una voz y un libro, la lectura y narración funcionan con la red desconectada.
- La prueba de voces cubre textos narrativos en español con diálogos, nombres propios, números, fechas, siglas y párrafos largos.
- Se evalúa explícitamente la variante regional; no se etiqueta una voz como latinoamericana sin evidencia auditiva.
- La voz, el motor, los pesos, los datasets y las dependencias se revisan por separado en cuanto a licencia y redistribución.
- Los modelos no se incorporan al repositorio Git; se descargan desde una fuente versionada y verificable.
- La aplicación informa tamaño, progreso, espacio utilizado y estado offline de cada paquete.
- El usuario puede borrar paquetes de voz sin perder documentos ni progreso.

## Criterios generales de calidad
- TypeScript estricto; no ocultar errores de compilación.
- Adaptadores testeables sin UI.
- Manejar archivos corruptos, vacíos, grandes y formatos no compatibles con mensajes accionables.
- Mantener el modo local plenamente útil sin cuenta ni conexión.
- Pruebas unitarias para validación, segmentación y repositorios; pruebas de integración para extracción y TTS.


## Integración de segmentación en el visor — 2026-11-11

- `ReaderWorkspace` consume el segmentador de `lib/documents/segmentation` después de la extracción local.
- Los segmentos se renderizan como spans dentro de sus bloques originales; la jerarquía de secciones y párrafos no se aplana ni se reconstruye mediante offsets globales.
- La navegación actual permite avanzar/retroceder por segmentos, muestra el progreso y resalta/desplaza hasta el segmento activo.
- Esta capa es visual y de navegación. No constituye todavía una cola TTS, no reproduce audio y no persiste la posición de lectura.
