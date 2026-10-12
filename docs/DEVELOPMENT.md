# Desarrollo y mantenimiento

Esta guía orienta cambios en Raíces Digitales. Lee primero [arquitectura](ARCHITECTURE.md), [contrato funcional/API](IMPLEMENTATION_CONTRACT.md) y [matriz de placas](SUPPORTED_BOARDS.md). El proyecto tiene módulos de cliente, servidor y firmware que comparten datos; una mejora de placa suele cruzar más de una capa.

## Requisitos y arranque

- Node.js **24** y npm, según `.nvmrc`/configuración de CI (usa Node 24 aunque tu administrador de versiones tenga otro valor predeterminado).
- Python **3.12** para la suite MicroPython con periféricos simulados.
- Chrome/Edge para comprobar Web Serial y WebGL. El taller normal funciona sin puerto conectado.
- Opcional para cargas Arduino: Arduino CLI y core AVR. En Windows, `scripts/setup-arduino.ps1` descarga versiones fijadas y valida el checksum publicado.

```sh
npm ci
cp .env.example .env
npm run dev
```

La interfaz queda en `http://localhost:5173`, el API en `http://localhost:3001` y la base local en `data/raices.sqlite`. `APP_ORIGIN` limita mutaciones al origen configurado. La contraseña de profesor no tiene valor de muestra; créala localmente. Para guardar credenciales Telegram define `SECRETS_KEY` como base64 de 32 bytes aleatorios. No pongas secretos en cambios, capturas, issues ni comandos que queden guardados en el historial.

## Mapa de módulos

| Ruta | Responsabilidad | Cuando la cambies… |
| --- | --- | --- |
| `web/App.tsx`, `web/shell/`, `web/pages/`, `web/ui/` | Rutas, navegación y componentes de interfaz | Conserva navegación por teclado, foco, tema y estados de carga/error. |
| `web/content/` | Biblioteca de actividades y tipos pedagógicos | Usa IDs existentes si es continuación para no perder progreso guardado. |
| `web/circuit/` | Modelo eléctrico, netlist, coordenadas y piezas | Trata el modelo como fuente compartida de 2D/3D; añade una prueba de circuito. |
| `web/experience/`, `web/components/StationScene.tsx` | Escenas Three.js/React Three Fiber | Mantén fallback 2D/textual, movimiento reducido y recursos locales. |
| `web/lib/serial.ts`, `web/lib/arduino.ts`, `web/lib/usb-support.ts` | Web Serial, MicroPython raw REPL y STK500v1 | Modela cancelación, cierre, escritura parcial, tiempo límite y no repetir cargas a ciegas. |
| `web/lib/api.ts`, `web/lib/context.tsx`, `web/lib/progress.ts` | Estado del grupo, sincronización y API cliente | Mantén aislamiento de sesión y recuperación offline. |
| `shared/boards.ts` | Lista canónica de placas y perfiles AVR | Actualiza aquí los tipos y perfiles compartidos; no dupliques IDs de MCU en la UI. |
| `server/app.ts`, `server/validation.ts`, `server/database.ts` | Rutas Fastify, límites de datos y persistencia | Autoriza por cookie/token en servidor; el ID de sesión del cliente no prueba identidad. |
| `server/arduino.ts`, `server/compiler-service.ts`, `server/compile-queue.ts` | Compilador local/aislado y cola de compilación | No ejecutes código C++ de estudiantes como un proceso de aplicación sin aislamiento. |
| `firmware/*.py` | Firmware MicroPython, drivers, Wi-Fi y lectura | El error de un sensor/red no debe detener el USB ni otros drivers. |
| `firmware/arduino/station.ino` | Estación Arduino AVR | Conserva telemetría serial y comportamiento de cada driver documentado. |
| `tests/` | Pruebas de modelo, API, transporte, firmware y navegador | Asegura el nuevo comportamiento y el caso de fallo correspondiente. |

## Cambios transversales

### Incorporar una placa

No anuncies compatibilidad solo porque el puerto USB enumera. Separa detección, compilación y carga. Define MCU/FQBN, firma, velocidad(es), flash/RAM, clock, protocolo y pinout respaldados por fuentes del fabricante. Si USB no distingue variantes, exige selección explícita y conserva la variante elegida al cambiar de vista. Rechaza una firma distinta **antes** de entrar al bootloader/escribir. Añade escenarios de éxito, timeout, cancelación, bootloader lento y lectura corrupta. Para hardware sin perfil conocido deja el dispositivo visible como no soportado, sin intentar flashearlo.

Actualiza `shared/boards.ts`, validación API, generación y selección del firmware, calibración/migración, importación/exportación, vistas 2D/3D, tipos de telemetría, ejemplos y esta documentación. Añade una prueba con compilador real cuando haya toolchain y declara qué pruebas requieren placa física. No transformes automáticamente un UF2 de una familia en otra ni presentes protocolo simulado como compatibilidad real.

### Añadir una actividad o sensor

Las actividades de `web/content/lessons/` declaran objetivos, fases, materiales ya presentes, pasos y variantes por placa. El circuito debe usar piezas/endpoints de `web/circuit/` para que vista y guía representen los mismos agujeros. Un sensor nuevo requiere esquema de payload en `shared/`, validación del servidor, unidad/rango/estados, drivers firmware, UI de diagnóstico y una prueba de desconexión/lectura inválida. No infieras presencia de un sensor analógico solo por tener un número ADC.

### Cambiar una ruta de API

Define el esquema de entrada en `server/validation.ts`, aplica autorización en el handler de `server/app.ts`, persiste con consultas parametrizadas y prueba acceso cruzado entre sesiones. No devuelvas secretos. Para APIs nuevas enlaza el contrato en `docs/IMPLEMENTATION_CONTRACT.md`; para cambios incompatibles describe la migración y el comportamiento de copias antiguas.

## Compilación y calidad

```sh
npm run build
npm test
npm run test:firmware
npm run test:e2e
```

O `npm run check` ejecuta build, pruebas Vitest y firmware. Playwright inicia el flujo configurado en `playwright.config.ts`; para pruebas USB se usa un peer serial falso y/o un bootloader virtual. Eso valida el protocolo y la UI, no conecta una placa física. La acción `Validate workshop` en GitHub Actions valida instalación limpia, suite, rutas web, Chromium y construcción de contenedores; revisa el resultado de la ejecución real en la rama antes de publicar.

Si cambias la geometría 3D o Web Serial, realiza pruebas enfocadas y una revisión visual interactiva en al menos un tamaño de escritorio y uno pequeño. Ejecuta un solo navegador con WebGL por vez para evitar pérdidas de contexto GPU. Cada prueba y captura debe usar su propio directorio de resultados.

## Convenciones de la interfaz

- Español claro, una acción principal visible y mensajes que expliquen qué ocurrió y qué puede hacer el grupo.
- Mantén la identidad bosque/lima/crema en `web/brand/tokens.css`; usa tokens antes de introducir nuevos colores.
- Conserva contraste, foco visible, teclado, etiquetas accesibles, tema oscuro y `prefers-reduced-motion`.
- No describas estado ilustrativo como lectura física. Toda simulación se etiqueta.
- Mantén HTML, iconos, fuentes, imágenes y sonidos servidos localmente; la experiencia esencial no depende de un CDN.
- Los pasos de cableado deben nombrar origen y destino usando la misma coordenada en SVG y Three.js.

## Pull request y versiones

Divide cambios grandes por comportamiento revisable. Describe problema, resultado visible, placas afectadas, pruebas ejecutadas y límites del ensayo físico. Adjunta screenshots solo si no contienen nombres, códigos de grupo, IP privada, SSID ni credenciales. No subas `dist/`, `node_modules/`, `data/`, `tools/`, secretos, cachés de compilación ni archivos de configuración de placas.

Actualiza documentos cercanos al código en el mismo cambio. La guía principal está en `README.md`; las páginas de wiki se mantienen en `docs/wiki/`. No declares soporte de hardware sin pruebas adecuadas y alcance explícito. El repositorio no contiene declaración de licencia de distribución: no añadas una licencia implícita mediante un badge.

## Desarrollo del firmware Arduino en host

La estación usa `firmware/arduino/station.ino`. Su suite compila y ejecuta la lógica con una capa HAL anfitriona en `tests/firmware/`; revisa `tests/firmware/arduino-generation.test.ts` para el código generado por lección y `tests/e2e/arduino-upload.spec.ts` para transporte de carga. Arduino CLI debe tener el core AVR y bibliotecas que se listan en [Firmware](FIRMWARE.md). Comprueba tamaño de binario contra el perfil ATmega antes de aceptar el cambio.

## Desarrollo de una integración USB

`web/lib/serial.ts` controla el ciclo de vida del puerto y raw REPL MicroPython. `web/lib/arduino.ts` y `web/lib/usb-support.ts` manejan Intel HEX, STK500v1, sincronización, firma y lectura de verificación. Conserva cancelación con `AbortSignal`, libera locks en toda ruta y evita reintentar un bloque de escritura cuyo resultado no se conoce. Añade pruebas que comprueben tanto el error como el estado físico/digital final observable por el peer.
