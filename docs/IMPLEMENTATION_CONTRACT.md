# Raíces Digitales — contrato de integración

React + TypeScript + Vite + Tailwind, Fastify Node 24 + SQLite persistente, Three.js/R3F, Monaco y MicroPython modular. Backend privado desplegable con volumen y HTTPS (Caddy). UI en español. No hay lecturas precargadas; práctica y animación ilustrativa están identificadas.

## Recorrido y módulos activos

`web/content/` contiene 33 actividades, 68 preguntas y la ruta esencial welcome/led/blink/soil/calibration/cloud (5/8/7/15/10/15 min). Cada actividad reúne 14 bloques en Entiende/Conecta/Programa/Experimenta/Comprueba. Extras cubren inventario comprado y kit MCI. `web/content/route.ts` mantiene aliases para progreso anterior. Las modificaciones y soluciones tienen variantes MicroPython/Arduino cuando difieren.

`web/pages/Lesson.tsx`, `web/lesson/` y `web/circuit/` implementan editor, calibración, quiz, pines y guía incremental. SVG y Three.js comparten endpoints, coordenadas de agujeros, piezas y netlist. `web/experience/` exporta LivingStation (hero/explore) y CircuitExperience (circuit/activeStep/mode). Incluye inspección, cámara, pausa, menor movimiento y fallback sin WebGL. Las animaciones conceptuales nunca sustituyen lecturas reales.

Rutas: `/` taller, `/taller/:id` actividad, `/planta` dashboard, `/explora` catálogo, `/estacion` instalación, `/diagnostico` y `/profesor`. Alias `/dashboard`, `/laboratorio`, `/configuracion` se mantienen. Tema y navegación responsive viven en `web/shell/`, `web/ui/`, `web/lib/theme.ts`. Tokens activos en `web/brand/tokens.css`.

## API

Cookie HttpOnly opaca por navegador. Un ID ajeno nunca concede acceso. Todos los cambios del navegador requieren origen autorizado; device/pair e ingest tienen sus propias credenciales.

- POST/GET/PATCH/DELETE `/api/session`: grupo anónimo 1–10, progreso, borradores, calibraciones, sensores habilitados y último programa ejecutado (`lastRun:{lessonId,board,code,at}`). PATCH mezcla diccionarios parciales sobre el estado vigente; límites sobre datos acumulados.
- POST `/api/bridge/connect`: vincula puente USB del grupo. POST `/api/bridge/ingest` `{readings,diagnostics?}`: sesión derivada de cookie, sin token secreto en JavaScript, siempre hardware. Revocación bloquea futuras muestras hasta reconexión.
- POST `/api/pair`→código de un uso con expiración. POST `/api/device/pair` `{code}`→deviceId/token. POST `/api/device/revoke` `{deviceId}`.
- POST `/api/device/ingest` Bearer `{readings,source:hardware|simulation,diagnostics?}`. POST `/api/simulation` siempre marca origen de práctica, sin alertas Telegram.
- GET `/api/dashboard?range=15m|1h|6h|24h|all`→devices/latest/history/rules/alerts. GET `/api/events` SSE update/heartbeat con reconsulta autorizada. GET `/api/export` CSV completo; GET `/api/session/export` JSON sin secretos.
- POST `/api/rules` `{sensor,min,max,hysteresis,cooldown}` y DELETE `/api/rules/:id`.
- GET `/api/health`→ok/version/telegramConfigured/arduinoAvailable.
- POST `/api/teacher/login`, POST logout, GET `/api/teacher/groups` y GET groups/:id, consulta docente de sólo lectura.
- GET `/api/telegram`; POST `/api/telegram` y `/api/telegram/test` sólo docente. Token cifrado, nunca devuelto al cliente.
- POST `/api/arduino/compile` `{code,board:uno|nano|nano-old}`→HEX/output de ArduinoCLI real; autenticado, sin shell, límites de tamaño/tiempo/concurrencia.
- GET `/api/firmware`→fuentes y CA sin credenciales; configuración final se genera en memoria y escribe por USB.

Sensor IDs canónicos: soil(%), soil_temperature(°C), air_temperature(°C), air_humidity(%), light(%relativo), rain(0/1), water_level(%), distance(cm), motion(0/1). DHT11 habilita air_temperature+air_humidity juntos. Estados READING/NEEDS_CALIBRATION/NO_RESPONSE/OUT_OF_RANGE/UNVERIFIED/DISABLED/ERROR. ADC flotante no prueba ausencia física.

## Ejecución y persistencia

Web Serial ejecuta MicroPython raw-paste y escribe archivos en bloques con renombrado final. STK500v1 carga HEX real Uno/Nano/Nano antiguo y verifica flash. La ejecución ocurre en la placa, no en un simulador oculto. Pico W publica HTTPS con CA/hora verificados; Uno/Nano usa puente USB. El firmware conserva lectura USB durante fallos de Wi-Fi.

El build precachea contenido/editor/recursos para recarga sin red; nunca cachea API o credenciales. Borradores se guardan inmediatamente en el navegador y se sincronizan por sesión autorizada. Cola y recuperación serializadas, revisiones evitan borrar cambios posteriores a una respuesta. Wi-Fi y token de instalación Pico no se persisten en navegador.

## QA y despliegue

TypeScript/build, tests de API/protocolos/circuitos/contenido/offline, drivers Python y flujos Chrome aislado. Compilación AVR real de ejemplos y estación. Simulación de diez grupos rotulada como tal. Evidencia vigente en `docs/QA.md`; guía de preparación física, red y bot allí. Docker/Caddy requieren verificación en el host de destino; no se afirman ejecución eléctrica, entrega Telegram ni despliegue público sin esos recursos.
