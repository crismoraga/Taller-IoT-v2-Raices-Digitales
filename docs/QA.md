# Verificación de Raíces Digitales

La aplicación conserva la distinción entre software verificado, telemetría simulada y hardware físico pendiente. Revisión de la experiencia y del código: 8 de octubre de 2026, America/Santiago.

## Comandos

`npm run check`: TypeScript, build productivo, API/transportes Vitest y drivers Python. `npm run test:e2e`: flujos completos en Chrome headless aislado. El navegador integrado de la sesión no tenía ninguna instancia conectada; se empleó el runner Playwright instalado en el proyecto, sin usar perfiles personales.

Las pruebas de API ejercitan SQLite real, HTTP/SSE real, persistencia tras reinicio, cookie/identidad independiente, denegación a otra sesión, pairing expirado/usado, CSRF, exportación, credenciales Telegram cifradas y evaluación de umbrales con reloj controlado. La suite serial reproduce bytes raw REPL/STK500 y fallos de reconexión/flash. Los tests Python sustituyen únicamente periféricos `machine` para probar drivers y TLS; no certifican sensores conectados.

Arduino CLI oficial 1.4.1 descargado con checksum SHA-256 verificado. Core AVR 1.8.6. Estación completa compilada realmente para Uno, Nano y Nano-old: 7.930 bytes de flash y 233 bytes de SRAM. Los ejemplos individuales se compilan como sketches reales, sin endpoints de compilación simulados.

## Resultados finales

- TypeScript estricto y build Vite completados. Contenido, escenas, tipografías y editor autocontenidos: 45 assets en caché offline, API excluida. La revisión de caché depende del contenido de todos los recursos, incluidas las guías.
- 315 pruebas Vitest aprobadas: 204 de contenido, 71 de circuitos, 18 de backend, 14 de protocolos serial y 8 de sincronización offline. Además, 14 pruebas Python de drivers/conectividad aprobadas.
- 17 flujos Playwright aprobados en Chrome aislado: escritorio/móvil, planta animada, conexiones incrementales 3D/2D, checkpoints con explicación, grupos/progreso/borradores, cambios de código y undo, variantes Arduino, sensores/calibración, telemetría/umbrales/recuperación/CSV, diagnóstico, docente, USB raw-paste/reconexión, instalación/revocación y recarga offline. Los diálogos retienen el foco y lo devuelven al activador.
- La recuperación del servidor sin evento `online` conserva el borrador más reciente. Se prueban modificaciones sucesivas y simultáneas, grupos independientes, almacenamiento no disponible y respuestas antiguas que llegan después de una nueva edición.
- Las 33 actividades contienen 68 preguntas con feedback. Se validan terminales y coordenadas del cableado, pines según placa y sintaxis de los ejemplos MicroPython originales, soluciones y cambios guiados. La ruta esencial suma 60 minutos.
- En esta revisión se completaron 14 compilaciones AVR reales de nuevos sketches, soluciones y cambios guiados. En la construcción anterior compilaron los 29 sketches originales para Uno y la estación integrada para Uno/Nano/Nano-old. El sketch de parada sustituye el programa Arduino por pines en alta impedancia.
- Revisión visual adicional de siete rutas en anchos de 320 y 390 px: sin desbordamiento horizontal ni errores de consola. WebGL deshabilitado conserva explicaciones accesibles y cableado 2D; se respetan movimiento reducido y navegación por teclado.
- El editor Monaco se carga al entrar en Programa o Experimenta. El bloque de lección ronda 117 kB antes de compresión; el editor separado ronda 2,39 MB y genera el aviso esperado de tamaño de Vite. Las tres tipografías latinas son locales e incluyen sus licencias.
- `npm audit` sin vulnerabilidades conocidas al ejecutar la revisión.

La verificación anterior del backend también ejercitó diez estaciones virtuales simultáneas, seis rondas a cinco segundos: 540 lecturas aceptadas, identidad por dispositivo/grupo y cruce/recuperación de umbral comprobados vía API. La herramienta elimina sus propias sesiones con `--cleanup`. La configuración Caddy se adaptó y validó con el ejecutable oficial; no equivale a desplegar un servidor público.

Las capturas y trazas del runner quedan en `test-results/` y el reporte en `playwright-report/`. Las pruebas del peer USB verifican bytes y comportamiento de interfaz; no sustituyen una placa física. El backend no precarga lecturas para la experiencia del estudiante.

## Diez estaciones virtuales

```powershell
node scripts/simulate-stations.mjs --groups 10 --seconds 60 --scenario recovery
```

Opciones de escenario: `normal`, `noise`, `spike`, `sensor-failure`, `offline`, `threshold`, `recovery`. `--cleanup` elimina únicamente las sesiones creadas por esa ejecución. `--origin https://taller.ejemplo.cl` usa una instancia desplegada. Los dispositivos utilizan pairing y token real pero **siempre envían `source:simulation`**. Las alertas de simulación se ven en pantalla y no se envían a Telegram. La cadencia es cinco segundos; el escenario offline interrumpe solo las estaciones virtuales pares, y se observa la antigüedad de las últimas lecturas. Los avisos automatizados DEVICE_OFFLINE se reservan para hardware que transmitía, tras 120 segundos sin telemetría.

## Ensayo físico requerido antes del evento

1. Comprobar los diez cables USB de datos, headers soldados y placas con firmware MicroPython Pico W.
2. Verificar sobre la mesa 3V3/GND y el esquema exacto de cada variante de sensor; no asumir colores de los cables DS18B20 ni polaridad de módulos.
3. Ejecutar LED, cambiar 500 ms por 100 ms y comprobar el cambio real. Interrumpir, guardar y reiniciar para comprobar main.py.
4. Probar los siete sensores comprados individualmente; provocar ausencia DHT11/DS18B20/eco y comprobar que el resto sigue leyendo.
5. Calibrar suelo seco/húmedo con veinte muestras; mantener electrónica seca. Usar los dos pull-ups de 10 kΩ y divisor HC-SR04 según guía.
6. Instalar la estación, conectar Wi-Fi 2,4 GHz, comprobar CA/hora y que el dashboard se actualiza por HTTPS. Cortar la red, observar continuidad USB y reconectar.
7. Medir el presupuesto de alimentación real. SG90 y motores no se presuponen seguros desde USB; la actividad SG90 del kit base explora señal con LED, sin motor alimentado.
8. Configurar el bot/chat docente, cruzar umbral, esperar cooldown, recuperar y comprobar entrega una vez. No hay credenciales Telegram incorporadas en el repo.
9. Ejecutar las diez estaciones simultáneamente durante al menos 15 minutos y comprobar aislamiento y respaldo de sensores.

## Límites de evidencia

No había placas USB físicas ni token/chat Telegram provistos en esta sesión: no se ha afirmado validar ejecución eléctrica ni entrega externa. Docker no estaba instalado: las definiciones de despliegue se revisan y Caddy se valida con su ejecutable oficial, pero la construcción/arranque del compose y la emisión del certificado público se deben verificar en el host de destino. El dominio/servidor público no se provisiona sin datos de infraestructura. El servidor local y el build productivo sí se ejecutan y verifican.
