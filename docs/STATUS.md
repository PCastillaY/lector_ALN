# Lector ALN — estado del proyecto

> **Última actualización:** 2026-11-09  
> **Rama de trabajo vigente:** `feat/text-segmentation` (basada en `main`)  
> **Último PR integrado:** PR #5 — extracción EPUB local (Squash and merge).  
> **Commit de PR #5:** `b29cfc4f769ab66921adefb6fe458605d396efaf`  
> **Fase en curso:** segmentación de texto, antes de implementar TTS.  
> **Criterio rector:** buscar excelencia verificable; no confundir una demo funcional con un producto terminado.

Este documento es el registro operativo del proyecto. La sección «Estado vigente» prevalece sobre los registros históricos posteriores, que conservan el contexto de cada fase y pueden contener decisiones ya superadas.

## Estado vigente — 2026-11-06

### Estado ejecutivo

La ruta **importar → extraer → leer** está implementada para los tres formatos incluidos en el alcance actual: TXT, PDF con capa de texto y EPUB. Las tres implementaciones están integradas en `main`. La extracción se realiza localmente.

- [x] TXT: extracción local y lectura.
- [x] PDF: extracción local de la capa de texto y lectura mediante PDF.js.
- [x] EPUB: extracción local siguiendo el orden del spine, con metadatos, capítulos y offsets.
- [x] PR #4 — PDF: fusionado en `main` mediante squash; commit `937897de5350295da5c4f6b81141197032ec634c`.
- [x] PR #5 — EPUB: fusionado en `main` mediante squash; commit `b29cfc4f769ab66921adefb6fe458605d396efaf`.
- [x] Validación manual de EPUB: casos sencillos, multicapítulo, español, estructura, texto con imágenes, archivo con firma incorrecta, contenido sin texto legible y EPUB extenso. La prueba de archivo dañado comprobó específicamente el rechazo por firma incompatible con la extensión; no equivale a probar toda posible corrupción interna del ZIP.
- [x] En el último ciclo de EPUB se verificaron localmente `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test` (31 pruebas) y `pnpm build`; CI de GitHub Actions y despliegue Vercel reportaron éxito para el commit de la rama antes de fusionar.

### Decisiones de alcance vigentes

- **Formatos:** limitar el producto por ahora a TXT, PDF con capa de texto y EPUB. No añadir DOCX, MOBI ni otros formatos en esta etapa.
- **OCR:** aplazado para todos los formatos. Los PDF escaneados y el texto contenido exclusivamente en imágenes no se reconocerán mediante OCR.
- **Narración:** todavía no implementada.
- **Arquitectura:** mantener extracción específica por formato y normalización común mediante `DocumentContent`.
- **Privacidad:** conservar el enfoque local-first; no enviar documentos a servicios externos como parte de la extracción.

### Fase en curso: segmentación de texto

La rama `feat/text-segmentation` se creó desde el último commit de `main`. El objetivo es implementar una capa independiente que transforme el contenido normalizado en segmentos adecuados para narración futura, sin integrar todavía un motor TTS.

**Validación incremental (2026-11-09):** el usuario confirmó en Codespaces que `pnpm typecheck`, `pnpm test` (37/37) y `pnpm build` pasan en el commit `b145d5f6f2514c4191afe2ffafb96fb8e5c7874d`. Después se añadieron cinco pruebas adicionales y ajustes heurísticos para puntos suspensivos ASCII, enumeraciones y conservación de offsets UTF-16. Estos últimos cambios aún están pendientes de ejecución y revisión; la fase sigue abierta y no autoriza integrar TTS ni fusionar la rama.

**Implementación inicial en la rama:** contrato `TextSegment`, segmentador por bloques/oraciones, referencias a sección y bloque, orden global y partición por longitud preferida. La salida conserva cada fragmento como un slice exacto del bloque original. Los offsets se calculan sumando el índice UTF-16 local al offset inicial del bloque; no se presupone que TXT, PDF y EPUB compartan una única cadena fuente global. La implementación y sus pruebas aún deben superar typecheck, suite completa, build y revisión de casos límite.

Alcance propuesto para esa fase:

- [x] Definir el contrato `TextSegment` y sus identificadores (implementación inicial en revisión).
- [x] Segmentar bloques por oraciones, respetando el orden del documento (implementación inicial; pendiente de validación).
- [x] Preservar offsets relativos al bloque y referencias a sección/capítulo (semántica documentada; pendiente de validar con todos los extractores).
- [x] Establecer límite configurable preferido sin cortar palabras ni perder puntuación (tokens individuales pueden exceder el límite).
- [ ] Tratar abreviaturas, decimales, diálogos, listas, encabezados y puntuación compleja.
- [ ] Añadir pruebas para TXT, PDF y EPUB, incluyendo documentos extensos y textos en español.
- [ ] Verificar que la segmentación no altera el texto original ni rompe la continuidad entre segmentos.

**Criterio de cierre:** los segmentos deben reconstruir el texto original en el orden correcto, mantener offsets coherentes, respetar límites de sección y superar pruebas automatizadas. Solo después se iniciará la integración TTS.

### Fases posteriores (no iniciar todavía)

1. Diseñar el contrato desacoplado `TTSProvider` y evaluar motores/voices.
2. Implementar reproducción, pausa, reanudación, cancelación, cola y manejo de errores.
3. Sincronizar narración con resaltado y desplazamiento del lector.
4. Evaluar persistencia de progreso y funcionamiento offline de voces.

### Pendientes transversales no bloqueantes para la siguiente fase

- [ ] Añadir lint compatible con Next.js 16.
- [ ] Ampliar pruebas reales de IndexedDB en navegador, cuota agotada y ciclo de vida de transacciones.
- [ ] Revisar manejo de cuota y errores de almacenamiento.
- [ ] Mantener pruebas de regresión de importación, extracción y lectura de TXT/PDF/EPUB.

---

## Registro histórico

Los apartados siguientes documentan decisiones y estados de etapas anteriores. Sus listas de pendientes y descripciones de formatos reflejan el momento en que fueron escritos; no deben interpretarse como el estado actual si contradicen la sección «Estado vigente».

## 1. Estado ejecutivo

Lector ALN completó la fundación técnica y su endurecimiento de calidad mediante PR #1 y PR #2, ambos integrados en `main`. Esta rama inicia la lectura real con extracción TXT local y una primera vista de lectura. PDF, EPUB y DOCX todavía requieren sus adaptadores; no existe narración TTS.

La arquitectura objetivo está definida como **local-first**, instalable como PWA y centrada en voces neuronales en español. La narración offline es un requisito de producto, no una promesa ya implementada.

**No considerar el proyecto listo para usuarios finales.** Antes de ampliar funcionalidades, se debe validar la base técnica, corregir los riesgos de persistencia/importación y construir una prueba de lectura real.

## 2. Implementado y verificable en la rama actual

- [x] Proyecto Next.js App Router con React y TypeScript.
- [x] Interfaz inicial de biblioteca en español.
- [x] Contratos TypeScript para documentos, contenido, secciones y bloques.
- [x] Validación preliminar de extensión, MIME declarado, archivo vacío y límite de 100 MB.
- [x] Persistencia local de archivos y metadatos en IndexedDB.
- [x] Listado y eliminación de documentos almacenados localmente.
- [x] Metadatos de aplicación e idioma de documento raíz configurados en español.
- [x] Eliminada la opción que ocultaba errores de TypeScript durante el build.
- [x] Arquitectura documentada con prioridad TTS local, voces españolas, PWA y cloud opcional.

**Alcance real de la biblioteca:** importa y conserva archivos. Esta rama añade extracción y lectura local para TXT. PDF, EPUB, DOCX y MOBI todavía no tienen adaptadores; no se deben presentar como formatos legibles hasta implementarlos.

## 3. Pendientes prioritarios

### P0 — Bloqueantes de calidad y fiabilidad

- [x] Instalación reproducible con `pnpm install --frozen-lockfile`, `pnpm typecheck` y `pnpm build` completados en CI para la base integrada (PR #1); Vercel reportó `success` para el commit de merge.
- [x] La nueva rama completó en GitHub Actions `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test` y `pnpm build` correctamente.
- [ ] Añadir lint con configuración compatible con Next.js 16, sin introducir una configuración obsoleta (`next lint` no debe asumirse disponible).
- [x] Añadida una suite inicial de pruebas de validación documental con Node.js `node:test`, sin dependencias de runtime nuevas. La suite pasó en GitHub Actions para el commit `d83df4bd200da8eca48e6a6b5cc3f8f42c179503`.
- [ ] Añadir pruebas de comportamiento para IndexedDB en un navegador o con un adaptador de pruebas mantenido; no confundir mocks simplificados con cobertura real de IndexedDB.
- [ ] Probar IndexedDB en navegadores objetivo, incluyendo cierre/reapertura, archivos grandes, cuota agotada y errores de transacción.
- [x] Corregido en código: cerrar conexiones IndexedDB en `finally`, cerrar conexiones tardías tras aperturas bloqueadas y manejar abortos de transacción. Pendiente de pruebas en navegador.
- [x] Corregido en código: la eliminación captura errores, informa el resultado y bloquea acciones concurrentes. Pendiente de prueba manual.
- [ ] Comprobar cuota disponible antes de importaciones grandes y manejar explícitamente `QuotaExceededError`.
- [x] Añadida inspección preliminar de firma: PDF, contenedor ZIP para EPUB/DOCX y cabecera Palm/MOBI; TXT sigue sin firma verificable. **No equivale a validar la estructura interna**. Pendientes pruebas con corpus real y archivos malformados.
- [ ] Definir una política de privacidad y retención clara para archivos locales; nunca enviar documentos a servicios remotos sin consentimiento explícito.

### P1 — Convertir la biblioteca en un lector

- [x] Implementar extracción TXT mediante un adaptador local UTF-8 y contrato común de contenido (esta rama; pendiente de CI y revisión manual).\n- [ ] Implementar extracción de PDF con capa de texto mediante PDF.js; requiere fijar dependencia y actualizar lockfile de forma reproducible.\n- [ ] Implementar extracción DOCX y EPUB mediante adaptadores aislados.
- [ ] Evaluar MOBI por separado; no prometer compatibilidad hasta demostrar extracción fiable y revisar dependencias/licencias.
- [ ] Detectar PDF sin capa de texto y explicar que OCR no está soportado.
- [ ] Normalizar el resultado a `DocumentContent`, con secciones y bloques estables.
- [ ] Implementar visor de lectura con navegación, tipografía, tamaño, interlineado y temas.
- [ ] Persistir posición de lectura y restaurarla después de cerrar/abrir.
- [ ] Diseñar estados de procesamiento: importado, procesando, listo, no compatible y error.
- [ ] Añadir pruebas con documentos reales de distintos tamaños, idiomas, estructuras, tablas, notas y caracteres especiales.

### P1 — Prueba comparativa de voces en español

- [ ] Crear un laboratorio de evaluación TTS independiente del lector principal.
- [ ] Probar Kokoro-82M y sus voces españolas candidatas: `ef_dora`, `em_alex`, `em_santa`.
- [ ] Comparar con voces Piper regionales, incluyendo `es_MX`, `es_AR` y `es_ES` cuando estén disponibles.
- [ ] Verificar compatibilidad real de los runtimes con navegador, Next.js y ejecución local; no asumir que una demo de modelo implica integración web viable.
- [ ] Escuchar muestras equivalentes con textos narrativos, diálogos, nombres propios, cifras, fechas, siglas y párrafos extensos.
- [ ] Evaluar pronunciación, inteligibilidad, prosodia, pausas, voces femeninas/masculinas, estabilidad y artefactos.
- [ ] Medir tiempo de inicialización, latencia del primer fragmento, velocidad de generación, RAM/VRAM y rendimiento en CPU/WASM y WebGPU.
- [ ] Registrar tamaño real de descarga, compatibilidad de dispositivos y comportamiento en modo offline.
- [ ] Auditar por separado licencias del motor, pesos, voces, datasets y dependencias antes de distribuir.
- [ ] Seleccionar motor principal solo con evidencia comparativa; no declarar una voz como latinoamericana sin validación auditiva.

### P2 — Narración y experiencia de audio

- [ ] Definir contrato estable `TTSProvider` y capacidades declarativas por proveedor/voz.
- [ ] Implementar cola por fragmentos con pausa, reanudación, salto, cancelación y recuperación de errores.
- [ ] Evitar cortes audibles entre fragmentos; gestionar precarga y continuidad de audio.
- [ ] Sincronizar resaltado con el bloque que se está narrando.
- [ ] Permitir velocidad, voz, variante regional y preferencias de pronunciación.
- [ ] Resolver pronunciación de números, fechas, abreviaturas, siglas, símbolos y texto mixto.
- [ ] Probar sesiones prolongadas y documentos extensos sin crecimiento de memoria ni degradación progresiva.

### P2 — PWA y funcionamiento sin conexión

- [ ] Incorporar manifiesto, iconos y service worker con estrategia de actualización segura.
- [ ] Cachear app shell y recursos imprescindibles sin cachear indiscriminadamente documentos privados.
- [ ] Diseñar descarga explícita de modelos/paquetes de voz desde fuentes verificadas.
- [ ] Guardar versión, idioma, variante, licencia, tamaño, hash y estado de cada paquete.
- [ ] Mostrar progreso, espacio ocupado, estado offline y opción de eliminar cada voz.
- [ ] Consultar cuota y solicitar almacenamiento persistente cuando el navegador lo permita.
- [ ] Probar instalación, actualización y lectura/narración tras desconectar la red, reiniciar el navegador y reabrir la PWA.
- [ ] Definir recuperación ante descargas parciales, archivos corruptos, cambios de versión y eliminación de caché.

### P3 — Cuenta, sincronización y funciones futuras

- [ ] Evaluar Supabase Auth, PostgreSQL y Storage solo cuando el modo local esté sólido.
- [ ] Diseñar RLS, propiedad de documentos, eliminación, exportación y recuperación de cuenta.
- [ ] Implementar sincronización explícita y resolución de conflictos; nunca subir automáticamente la biblioteca local.
- [ ] Añadir marcadores, notas, historial, estadísticas y progreso entre dispositivos.
- [ ] Evaluar TTS cloud opcional con límites de coste, cuotas, privacidad y fallback transparente.
- [ ] Considerar OCR como módulo separado, con coste de CPU, privacidad y calidad medidos.
- [ ] Considerar app de escritorio Tauri/Electron solo si la PWA no satisface las necesidades de almacenamiento o ejecución.

## 12. Primer lector y extracción TXT — 2026-11-06

- Se creó la rama `feat/document-extraction-txt` desde el commit integrado de PR #2; `main` permanece intacta.
- Se incorpora recuperación individual de un documento almacenado en IndexedDB.
- Se define un punto de entrada común `extractDocumentContent` y un adaptador TXT local basado en UTF-8 estricto.
- La extracción conserva el texto visible y separa párrafos en bloques con offsets sobre el texto decodificado. Rechaza archivos vacíos, UTF-8 inválido y contenido con bytes NUL que sugieran un archivo binario.
- Se añade una ruta de lectura para documentos TXT y se evita ofrecer la acción de abrir para formatos cuyo adaptador todavía no existe.
- No se añade ninguna dependencia ni se modifica `pnpm-lock.yaml`.
- **Pendiente de validación:** ejecutar typecheck, pruebas y build en Codespaces/CI; probar TXT con BOM, saltos de línea CRLF, párrafos largos, caracteres acentuados y UTF-8 inválido.
- **Limitación deliberada:** PDF aún no se procesa. Se añadirá PDF.js como dependencia fijada en un PR posterior o continuación de esta rama, con actualización real del lockfile. No se usará un CDN como sustituto del parser.

## 4. Observaciones críticas y riesgos conocidos

### 4.1 La validación actual es preliminar
La función ahora inspecciona firmas básicas: cabecera PDF, contenedor ZIP para EPUB/DOCX y estructura Palm/MOBI. EPUB y DOCX comparten contenedor ZIP, por lo que todavía no se inspeccionan `mimetype`, `META-INF/container.xml`, `[Content_Types].xml` ni `word/document.xml`. TXT no tiene una firma fiable y no se valida su codificación. Un ZIP arbitrario todavía puede pasar como EPUB/DOCX. La inspección estructural debe ocurrir antes de procesar/renderizar.

### 4.2 El límite de 100 MB no es una garantía de almacenamiento
El límite por archivo no considera la cuota total disponible, los demás datos del origen ni el coste de conservar simultáneamente libros y modelos TTS. La aplicación debe anticipar falta de espacio y ofrecer errores recuperables.

### 4.3 IndexedDB requiere endurecimiento
Las funciones actuales cierran la conexión tras operaciones exitosas, pero deben garantizar su cierre también en errores. Faltan pruebas de cuota agotada, abortos, actualizaciones de esquema y concurrencia. La persistencia del navegador no equivale a una copia de seguridad.

### 4.4 La interfaz puede inducir expectativas superiores a la capacidad real
La biblioteca ahora distingue TXT listo para abrir de otros formatos pendientes de extracción. No anunciar lectura de PDF/EPUB/DOCX/MOBI, narración, soporte offline o sincronización como capacidades disponibles hasta superar pruebas de aceptación.

### 4.5 El objetivo de voces españolas aún no está resuelto
Kokoro es candidato, no decisión final. La presencia de voces etiquetadas como español no garantiza acento latinoamericano, prosodia de audiolibro ni pronunciación correcta. Piper tampoco debe asumirse como mejor sin comparar runtime, calidad, tamaño y licencias.

### 4.6 PWA offline no es simplemente instalar la web
Una PWA instalable no garantiza que el modelo neural quepa en memoria, que WebGPU funcione o que el navegador conserve los archivos. Se debe demostrar el flujo completo en dispositivos objetivo, incluidos fallos y recuperación.

### 4.7 Evidencia automatizada parcial
La base integrada ya pasó instalación congelada, typecheck y build en CI, y Vercel reportó un despliegue correcto. La base integrada incorpora pruebas iniciales para la validación de extensiones, tamaño y firmas de TXT/PDF/ZIP/MOBI. La rama actual añade pruebas unitarias de extracción TXT. Aún falta lint y pruebas de comportamiento de IndexedDB en navegador. No se debe interpretar la suite inicial como cobertura completa de importación ni persistencia.

### 4.8 El alcance es amplio
Cinco formatos, extracción, biblioteca dual, PWA, TTS neural local, catálogo de voces, cloud y sincronización son un alcance considerable. Intentar desarrollarlo todo en paralelo aumenta el riesgo de una arquitectura compleja sin un flujo de lectura sólido. La secuencia debe priorizar un recorrido vertical funcional: importar → extraer → leer → narrar localmente → continuar offline.

## 5. Propuestas para el futuro

Estas propuestas no están aprobadas ni deben implementarse automáticamente. Requieren evaluación de valor, coste y complejidad.

- **Prueba de aceptación offline de extremo a extremo:** instalar la PWA, descargar una voz, importar un libro, cerrar el navegador, desactivar Internet y continuar leyendo/narrando.
- **Banco de pruebas TTS reproducible:** corpus español versionado, misma puntuación y texto para cada voz, métricas técnicas y evaluación humana ciega.
- **Perfiles regionales de pronunciación:** español latinoamericano general como perfil inicial; opciones regionales solo cuando la voz y sus reglas fonéticas estén validadas.
- **Diccionario personal de pronunciación:** permitir corregir nombres propios, siglas, tecnicismos y términos extranjeros sin modificar el documento original.
- **Normalización configurable:** distinguir texto visible y texto hablado para adaptar cifras, abreviaturas, unidades y símbolos.
- **Reanudación robusta:** conservar bloque, offset, voz y velocidad; recuperar sesión después de cierres inesperados.
- **Gestor de almacenamiento:** separar espacio de libros, caché y modelos; mostrar cuotas y ofrecer limpieza selectiva.
- **Importación por lotes con cola:** progreso individual, cancelación, reintentos y reporte descargable de errores.
- **Accesibilidad:** navegación completa por teclado, lector de pantalla, contraste, controles semánticos y preferencias de movimiento.
- **Exportación y portabilidad:** permitir respaldar biblioteca, progreso, marcadores y preferencias sin quedar atado a una cuenta o navegador.
- **Observabilidad respetuosa con la privacidad:** diagnósticos locales y métricas técnicas opt-in; nunca recopilar contenido de libros ni audio sin consentimiento explícito.

## 6. Decisiones que deben mantenerse explícitas

| Tema | Decisión vigente |
|---|---|
| Idioma prioritario | Español |
| Variante preferida | Español latinoamericano natural y comprensible para Perú |
| Narración | Local-first; cloud opcional |
| Motor TTS | Sin decisión definitiva; Kokoro y Piper en evaluación |
| Formatos | EPUB, PDF con texto, TXT, DOCX y MOBI sujeto a validación |
| OCR | Fuera del alcance inicial |
| Biblioteca | Local sin cuenta y cloud/sincronizada en fase posterior |
| Instalación | PWA primero; escritorio nativo, futuro opcional |
| Modelos | Descarga bajo demanda; no incluir pesos grandes en Git |
| Sincronización | Explícita, nunca automática sin consentimiento |

## 7. Secuencia recomendada de ejecución

1. **Cerrar calidad de la fundación:** confirmar CI en esta rama, ampliar pruebas, añadir lint compatible y validar persistencia/cuotas en navegador.
2. **Completar un primer flujo documental:** comenzar por TXT y PDF con texto; añadir EPUB y DOCX después de estabilizar adaptadores. Evaluar MOBI por separado.
3. **Crear corpus y laboratorio TTS español:** comparar Kokoro/Piper y decidir con datos.
4. **Implementar narración local por fragmentos:** probar estabilidad y calidad antes de pulir la interfaz.
5. **Hacer instalable la PWA y verificar offline real:** voz + libro + narración tras reinicio y desconexión.
6. **Solo entonces ampliar:** sincronización, cloud TTS, estadísticas, OCR u otras funciones.

## 8. Regla de actualización del status

- Marcar una tarea como completada solo cuando exista implementación y evidencia verificable (prueba, build, captura, medición o revisión).
- Mantener separadas las categorías **implementado**, **pendiente**, **bloqueado**, **propuesto** y **descartado**.
- Registrar fecha y motivo al cambiar decisiones de arquitectura.
- Añadir problemas concretos con impacto, prioridad y criterio de cierre; evitar listas vagas como “mejorar rendimiento”.
- Cada nueva función debe justificar su valor y no degradar privacidad, funcionamiento offline, accesibilidad, estabilidad ni mantenibilidad.
- Revisar este documento al cerrar cada fase y antes de fusionar un Pull Request.


## 9. Auditoría inicial e implementación de endurecimiento — 2026-11-06

- Rama `feat/lector-foundation`: 15 commits por delante de `main`, 0 por detrás; no se modificó `main`.
- Se corrigió el cierre de conexiones IndexedDB en rutas de éxito y error. También se cierra una conexión que llegue tarde después de que una apertura haya sido rechazada por bloqueo.
- Se añadió manejo de abortos de transacción y cierre por cambio de versión.
- La UI ahora informa fallos y confirmaciones al eliminar documentos, y evita iniciar eliminaciones simultáneas.
- La validación ahora es asíncrona e inspecciona firmas básicas para PDF, ZIP y MOBI. No se debe presentar como validación completa de EPUB/DOCX ni como análisis antimalware.
- Se añadió el script `pnpm typecheck` sin introducir dependencias ni alterar `pnpm-lock.yaml`.
- Se añadió `.github/workflows/ci.yml` para instalar con lockfile congelado, ejecutar TypeScript y compilar en Node 22. La ejecución de CI aún no está confirmada.
- El último estado consultado de Vercel quedó pendiente; un estado anterior del mismo PR fue `failure`. El motivo del fallo anterior no está disponible en el contexto actual y debe investigarse desde los logs de despliegue.
- No se ejecutaron build, lint, tests ni pruebas de navegador desde este entorno. Los cambios anteriores son **implementados, todavía no validados**.

### Riesgos que siguen abiertos tras esta iteración

1. Verificar que la CI se dispare y que el lockfile congelado sea compatible con pnpm 12.3.4.
2. Obtener logs del despliegue Vercel y resolver el estado fallido anterior.
3. Añadir pruebas automatizadas para validación de archivos y persistencia IndexedDB.
4. Validar internamente EPUB/DOCX con un lector ZIP seguro; las firmas actuales solo confirman que parecen archivos ZIP.
5. Revisar cuota disponible y manejo de `QuotaExceededError` antes de importar lotes o archivos grandes.
6. Añadir lint sin introducir dependencias innecesarias y con configuración compatible con Next.js 16.


## 10. Corrección de instalación congelada — 2026-11-06

- Se investigó el log de Vercel aportado: `ERR_PNPM_OUTDATED_LOCKFILE` durante `pnpm install`.
- Causa confirmada: cuatro especificadores en `package.json` no coincidían con los especificadores del importer raíz de `pnpm-lock.yaml`: `react`, `react-dom`, `@types/react` y `@types/react-dom`.
- Se alineó `package.json` con las versiones exactas ya fijadas en el lockfile: React/React DOM `19.2.4`, tipos React `19.2.14` y tipos React DOM `19.2.3`.
- No se modificó ni regeneró `pnpm-lock.yaml`; no se actualizaron versiones transitivas ni se añadieron dependencias.
- Verificación estática posterior: los cuatro valores de `package.json` coinciden con los cuatro `specifier` del importer raíz del lockfile.
- El commit de corrección es `e6ab01ba3db883adc82cef9e80620a29973a44a2`.
- La comprobación de Vercel para este commit todavía aparece `pending`; por tanto, **la corrección está aplicada pero aún no está confirmada por una instalación real en Vercel**.


## 11. Endurecimiento de calidad — 2026-11-06

- Se confirmó que el PR #1 fue fusionado a `main`. El commit de merge registrado es `1bd121ef0bf3938512a77e822571f4f14254559d`.
- La base integrada completó en GitHub Actions la instalación con lockfile congelado, `pnpm typecheck` y `pnpm build`. Vercel reportó `success` para el commit de merge.
- Se creó la rama `feat/foundation-quality` a partir de `main`; los cambios de esta fase no se escriben directamente en `main`.
- Se añadió `pnpm test`, ejecutado mediante Node.js `node:test` y el compilador TypeScript ya instalado. No se añadieron dependencias ni se modificó `pnpm-lock.yaml`.
- La suite inicial cubre: extensión no admitida, archivo vacío, límite de 100 MB, TXT no vacío, firma PDF, firmas ZIP para EPUB/DOCX y firma MOBI según el criterio actual del validador.
- El runner compila temporalmente los módulos TypeScript requeridos en una carpeta del sistema y elimina esa carpeta al terminar. Los errores de compilación o de pruebas devuelven código distinto de cero.
- El workflow CI ahora ejecuta `pnpm test` después de `pnpm typecheck` y antes del build.
- **Validado en CI:** instalación congelada, typecheck, suite de pruebas y build completaron con éxito en el commit `d83df4bd200da8eca48e6a6b5cc3f8f42c179503`. Vercel también reportó despliegue correcto.
- **Pendiente:** pruebas de integración reales para IndexedDB, cuota agotada, concurrencia y ciclo de vida de transacciones. No se añadió una implementación fake casera porque podría dar una falsa sensación de cobertura.
- **Pendiente:** lint. Next.js 16 no debe configurarse con el antiguo comando `next lint`; se evaluará una configuración ESLint compatible y se regenerará el lockfile de forma reproducible si se justifica incorporar dependencias.
- **Pendiente:** validación estructural ZIP para EPUB/DOCX, incluida inspección de entradas obligatorias; la firma ZIP actual no garantiza que el archivo sea un EPUB o DOCX válido.
- **Pendiente:** consulta de cuota y manejo explícito de `QuotaExceededError` en la experiencia de importación.


## 12. Primer lector y extracción TXT — 2026-11-06

- Se creó la rama `feat/document-extraction-txt` desde el commit integrado de PR #2; `main` permanece intacta.
- Se incorpora recuperación individual de un documento almacenado en IndexedDB.
- Se define un punto de entrada común `extractDocumentContent` y un adaptador TXT local basado en UTF-8 estricto.
- La extracción conserva el texto visible y separa párrafos en bloques con offsets sobre el texto decodificado. Rechaza archivos vacíos, UTF-8 inválido y contenido con bytes NUL que sugieran un archivo binario.
- Se añade una ruta de lectura para documentos TXT y se evita ofrecer la acción de abrir para formatos cuyo adaptador todavía no existe.
- No se añade ninguna dependencia ni se modifica `pnpm-lock.yaml`.
- **Pendiente de validación:** ejecutar typecheck, pruebas y build en Codespaces/CI; probar TXT con BOM, saltos de línea CRLF, párrafos largos, caracteres acentuados y UTF-8 inválido.
- **Limitación deliberada:** PDF aún no se procesa. Se añadirá PDF.js como dependencia fijada en un PR posterior o continuación de esta rama, con actualización real del lockfile. No se usará un CDN como sustituto del parser.


## 13. Extracción PDF local con PDF.js — 2026-11-06

- Se fijó `pdfjs-dist@6.5.438` en `package.json` y `pnpm-lock.yaml`; el lockfile fue generado por pnpm en Codespaces.
- Se implementó un adaptador PDF.js que extrae texto página por página en el navegador, sin enviar el documento a un servidor ni depender de un CDN.
- Cada página con texto se representa como una sección independiente; los offsets se acumulan sobre el texto normalizado extraído.
- El worker se copia desde la dependencia instalada a `public/pdf.worker.min.mjs` al ejecutar `pnpm dev` o `pnpm build`. El artefacto generado queda fuera de Git y se sirve desde el mismo origen.
- Se añadieron pruebas unitarias con un PDF.js simulado para validar páginas, offsets, páginas sin texto, PDF sin capa textual, contraseña y liberación de recursos.
- La biblioteca permite abrir TXT y PDF. La extracción de PDF escaneados/OCR, PDFs protegidos con contraseña y extracción avanzada de estructura/columnas/tablas no está soportada.
- **Pendiente de validación:** CI, typecheck y build con la dependencia real; prueba manual en Codespaces con PDF digital de varias páginas, PDF escaneado, PDF protegido y archivo corrupto; comprobar que `/pdf.worker.min.mjs` responde correctamente y que la extracción funciona sin enviar archivos fuera del navegador.
- No marcar esta fase como validada ni fusionar hasta superar las verificaciones automatizadas y manuales.
