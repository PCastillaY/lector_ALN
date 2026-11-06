# Lector ALN — estado del proyecto

> **Última actualización:** 2026-11-06  
> **Rama de trabajo:** `feat/lector-foundation`  
> **Pull Request:** [#1 — Fundamentos de Lector ALN](https://github.com/PCastillaY/lector_ALN/pull/1)  
> **Estado del PR:** abierto, Draft; la rama está 15 commits por delante de `main` y 0 por detrás. La última comprobación de Vercel quedó `pending`; una comprobación anterior reportó `failure`.  
> **Criterio rector:** buscar excelencia verificable; no confundir una demo funcional con un producto terminado.

Este documento es el registro operativo del proyecto. Debe actualizarse al cerrar tareas, descubrir riesgos, cambiar decisiones o incorporar nuevas propuestas. Los estados describen lo que está implementado, no lo que está meramente documentado.

## 1. Estado ejecutivo

Lector ALN se encuentra en una **fase de fundación técnica**. La aplicación permite importar documentos y almacenarlos en IndexedDB, pero todavía no extrae ni presenta su contenido y no narra audio.

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

**Alcance real de la biblioteca:** importa y conserva archivos. No los abre, no valida todavía su estructura interna y no extrae texto. El estado mostrado como pendiente de procesamiento es correcto.

## 3. Pendientes prioritarios

### P0 — Bloqueantes de calidad y fiabilidad

- [ ] Ejecutar instalación reproducible con el lockfile existente y registrar versiones/entorno. Se añadió CI con `pnpm install --frozen-lockfile`; primera ejecución aún no observada.
- [ ] Ejecutar `pnpm build`; corregir todos los errores TypeScript y de compilación. El workflow ejecutará build y typecheck, pero no hay resultado confirmado todavía.
- [ ] Añadir lint y pruebas automatizadas. Ya existe script `typecheck` y workflow de CI para typecheck/build; aún no se han incorporado linter ni tests.
- [ ] Probar IndexedDB en navegadores objetivo, incluyendo cierre/reapertura, archivos grandes, cuota agotada y errores de transacción.
- [x] Corregido en código: cerrar conexiones IndexedDB en `finally`, cerrar conexiones tardías tras aperturas bloqueadas y manejar abortos de transacción. Pendiente de pruebas en navegador.
- [x] Corregido en código: la eliminación captura errores, informa el resultado y bloquea acciones concurrentes. Pendiente de prueba manual.
- [ ] Comprobar cuota disponible antes de importaciones grandes y manejar explícitamente `QuotaExceededError`.
- [x] Añadida inspección preliminar de firma: PDF, contenedor ZIP para EPUB/DOCX y cabecera Palm/MOBI; TXT sigue sin firma verificable. **No equivale a validar la estructura interna**. Pendientes pruebas con corpus real y archivos malformados.
- [ ] Definir una política de privacidad y retención clara para archivos locales; nunca enviar documentos a servicios remotos sin consentimiento explícito.

### P1 — Convertir la biblioteca en un lector

- [ ] Implementar extracción de TXT, PDF con capa de texto, DOCX y EPUB mediante adaptadores aislados.
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

## 4. Observaciones críticas y riesgos conocidos

### 4.1 La validación actual es preliminar
La función ahora inspecciona firmas básicas: cabecera PDF, contenedor ZIP para EPUB/DOCX y estructura Palm/MOBI. EPUB y DOCX comparten contenedor ZIP, por lo que todavía no se inspeccionan `mimetype`, `META-INF/container.xml`, `[Content_Types].xml` ni `word/document.xml`. TXT no tiene una firma fiable y no se valida su codificación. Un ZIP arbitrario todavía puede pasar como EPUB/DOCX. La inspección estructural debe ocurrir antes de procesar/renderizar.

### 4.2 El límite de 100 MB no es una garantía de almacenamiento
El límite por archivo no considera la cuota total disponible, los demás datos del origen ni el coste de conservar simultáneamente libros y modelos TTS. La aplicación debe anticipar falta de espacio y ofrecer errores recuperables.

### 4.3 IndexedDB requiere endurecimiento
Las funciones actuales cierran la conexión tras operaciones exitosas, pero deben garantizar su cierre también en errores. Faltan pruebas de cuota agotada, abortos, actualizaciones de esquema y concurrencia. La persistencia del navegador no equivale a una copia de seguridad.

### 4.4 La interfaz puede inducir expectativas superiores a la capacidad real
La página presenta formatos admitidos y una biblioteca, pero aún no existe lectura. Debe mantener visible que el archivo solo está almacenado y que todavía no se ha procesado. No anunciar narración, soporte offline o sincronización como capacidades disponibles hasta superar pruebas de aceptación.

### 4.5 El objetivo de voces españolas aún no está resuelto
Kokoro es candidato, no decisión final. La presencia de voces etiquetadas como español no garantiza acento latinoamericano, prosodia de audiolibro ni pronunciación correcta. Piper tampoco debe asumirse como mejor sin comparar runtime, calidad, tamaño y licencias.

### 4.6 PWA offline no es simplemente instalar la web
Una PWA instalable no garantiza que el modelo neural quepa en memoria, que WebGPU funcione o que el navegador conserve los archivos. Se debe demostrar el flujo completo en dispositivos objetivo, incluidos fallos y recuperación.

### 4.7 Falta evidencia automatizada
El PR registra que no se han ejecutado build, lint ni pruebas. No se debe integrar una base de código sin una validación reproducible. La ausencia de errores observados no equivale a calidad verificada.

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

1. **Cerrar calidad de la fundación:** instalar, compilar, añadir lint/tests y corregir persistencia/validación.
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
