# Raíces Digitales · Taller IoT para Telemática USM

<p align="center">
  <a href="https://telematica-iot-usm.vercel.app"><img src="https://img.shields.io/badge/abrir-plataforma-315d43?style=for-the-badge&logo=vercel&logoColor=white" alt="Abrir plataforma"></a>
  <a href="https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/crismoraga/Taller-IoT-v2-Raices-Digitales/validate.yml?branch=main&label=CI&logo=githubactions&logoColor=white" alt="Estado de validación continua"></a>
  <a href="https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/commits/main"><img src="https://img.shields.io/github/last-commit/crismoraga/Taller-IoT-v2-Raices-Digitales?branch=main" alt="Último cambio"></a>
  <a href="https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/issues"><img src="https://img.shields.io/github/issues/crismoraga/Taller-IoT-v2-Raices-Digitales" alt="Incidencias abiertas"></a>
</p>

**Descripción corta para GitHub:** Plataforma educativa de IoT para Telemática USM: taller guiado de Raspberry Pi Pico y Arduino, cableado 2D/3D, programación USB y telemetría.

**Plataforma en línea:** [telematica-iot-usm.vercel.app](https://telematica-iot-usm.vercel.app) · **Interfaz:** español · **Licencia:** no declarada todavía.

Raíces Digitales es un taller práctico para conectar electrónica, programación y telemetría alrededor de una planta. Cada participante avanza por instrucciones incrementales, monta circuitos en una guía compartida 2D/3D, ejecuta código en su propia placa y observa datos identificados como hardware o simulación. El equipo docente puede acompañar hasta diez grupos.

## Qué incluye

- Ruta guiada de 60 minutos y biblioteca de actividades de LED, entradas, sensores, calibración, actuadores y telemetría.
- Modelos 3D interactivos y plano 2D con las mismas coordenadas, patas y conexiones; montaje paso a paso y progreso guardado.
- Editor de MicroPython y Arduino, terminal USB, instalación de estación y diagnóstico visible.
- Compatibilidad declarada con Raspberry Pi Pico, Pico W, Pico 2 y Pico 2 W usando MicroPython; Arduino Uno, Nano ATmega328P, Nano ATmega328P con bootloader antiguo y Nano ATmega168.
- Transporte de datos: Wi-Fi opcional en modelos Pico W y puente USB desde el computador en Pico y Arduino.
- API Fastify, almacenamiento SQLite persistente, panel docente, alertas configurables, exportación CSV/JSON y compilación Arduino real.
- Interfaz en español, identidad visual propia, temas claro/oscuro, movimiento reducido y alternativa 2D/textual si WebGL no está disponible.

La selección USB no puede identificar por sí sola el microcontrolador o bootloader de un Nano. La carga verifica la firma del MCU antes de escribir. Mega, ESP32, Arduino R4, Leonardo, Nano Every y placas Raspberry Pi con Linux no son perfiles de carga implementados. Las compilaciones y pruebas de protocolo no certifican una placa física; consulta la [matriz de compatibilidad](docs/SUPPORTED_BOARDS.md).

## Empezar en local

Requisitos: Node.js 24, npm, Python 3.12 para firmware y Chrome o Edge de escritorio para USB Web Serial. Arduino CLI y el core AVR solo son necesarios para compilar/subir Arduino. El modo Pico se puede explorar sin instalar una cadena de compilación.

```sh
git clone https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales.git
cd Taller-IoT-v2-Raices-Digitales
npm ci
cp .env.example .env
```

En `.env`, define una contraseña docente propia en `TEACHER_PASSWORD`. Si configurarás Telegram, crea `SECRETS_KEY` como base64 de 32 bytes aleatorios:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

No uses la salida como contraseña docente. Mantén `.env`, la base de datos y credenciales de placas fuera de Git.

```sh
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). Vite sirve la interfaz y envía `/api` al servidor Fastify local. La base SQLite se crea en `data/raices.sqlite`. Para preparar el entorno Arduino en Windows, consulta [Desarrollo local](docs/DEVELOPMENT.md#herramientas-arduino); para el resto de sistemas sigue la referencia oficial de Arduino CLI y define sus rutas.

Para construir y servir una versión local de producción:

```sh
npm run build
npm start
```

Abre [http://localhost:3001](http://localhost:3001). Esta aplicación necesita un backend residente y almacenamiento persistente para grupos, telemetría y compilación. La portada estática por sí sola no ofrece el taller completo. La topología de producción y sus variables están en [Despliegue](docs/DEPLOYMENT.md).

## Comandos del proyecto

| Comando | Para qué sirve |
| --- | --- |
| `npm run dev` | Vite y API en modo desarrollo |
| `npm run build` | TypeScript, assets, frontend y caché offline |
| `npm test` | Suite Vitest de UI, API, transporte y modelos |
| `npm run test:firmware` | Pruebas Python de drivers y conectividad |
| `npm run check` | Build y pruebas de software/firmware |
| `npm run test:e2e` | Flujos Playwright en Chromium |
| `npm start` | Sirve el build y API local en puerto 3001 |
| `node scripts/smoke-deployment.mjs URL` | Comprueba salud y rutas de un despliegue |

La guía para añadir funciones está en [Desarrollo y contribución](docs/DEVELOPMENT.md). Antes de abrir un PR revisa el workflow de [GitHub Actions](.github/workflows/validate.yml).

## Mapa del repositorio

```text
web/                 Interfaz React, contenido, escenas 3D y cableado 2D/3D
server/              API Fastify, SQLite, reglas, alertas y compilación
shared/              Tipos y perfiles de placas compartidos por web y servidor
firmware/            Firmware MicroPython y sketch Arduino de la estación
hardware/            Inventario y recursos del kit
tests/               Pruebas unitarias, API, firmware y navegador
scripts/             Desarrollo, compilación, preparación y diagnóstico
docs/                Guías de uso, hardware, arquitectura, operación y soporte
docs/wiki/           Fuente versionada para la wiki de GitHub
```

La arquitectura está explicada en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); para orientarse por módulos comienza por [Guía de código](docs/DEVELOPMENT.md#mapa-de-modulos).

## Documentación

| Necesito… | Lee… |
| --- | --- |
| Comenzar a usar la aplicación | [Guía del estudiante](docs/STUDENT_GUIDE.md) |
| Conducir el taller | [Guía docente](docs/TEACHER_GUIDE.md) |
| Conectar una placa o sensor | [Hardware y cableado](docs/HARDWARE.md) y [matriz de placas](docs/SUPPORTED_BOARDS.md) |
| Entender firmware y USB | [Firmware](docs/FIRMWARE.md) y [solución de problemas](docs/TROUBLESHOOTING.md) |
| Modificar el código | [Desarrollo](docs/DEVELOPMENT.md), [arquitectura](docs/ARCHITECTURE.md) y [contrato API](docs/IMPLEMENTATION_CONTRACT.md) |
| Desplegar o respaldar datos | [Despliegue](docs/DEPLOYMENT.md) |
| Revisar límites y controles | [Seguridad](docs/SECURITY.md) |
| Ver historias y evidencia | [Historias de usuario](docs/USER_STORIES.md) y [QA](docs/QA.md) |
| Navegar las páginas wiki | [Índice de wiki](docs/wiki/Home.md) |

## Compatibilidad y límites

USB serial requiere HTTPS o `localhost`, autorización del usuario en el navegador, cable de datos y el puerto libre. La plataforma no puede conceder permisos USB silenciosamente. Pico/Pico W/Pico 2/Pico 2 W comparten el perfil de pines RP2; se selecciona el UF2 MicroPython correspondiente al modelo exacto. Solo Pico W y Pico 2 W ofrecen el camino de red Wi-Fi. Arduino usa un perfil AVR específico; clones pueden requerir seleccionar bootloader Nano antiguo o instalar el driver USB del fabricante.

Consulta [firmware y carga](docs/FIRMWARE.md), [problemas conocidos y diagnóstico](docs/TROUBLESHOOTING.md) y [evidencia de validación](docs/QA.md) antes de interpretar una compilación como una carga física exitosa. No hay datos ni telemetría inventada para representar hardware conectado.

## Participar y reportar problemas

Usa las plantillas de [incidencias](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/issues/new/choose) para describir un bug o proponer una mejora. Incluye navegador/sistema operativo, placa y variante, actividad, texto exacto del error y pasos para reproducir. **No adjuntes** `.env`, claves, Wi-Fi, `config.json`, tokens, capturas con datos privados ni volcados de la base. Lee [cómo contribuir](CONTRIBUTING.md).

## Identidad

La marca combina bosque, lima, papel cálido y trazas de señal en una estética solarpunk. Los tokens, logos, iconos, licencias tipográficas y reglas de accesibilidad se describen en [BRAND_TOKENS.md](BRAND_TOKENS.md). La interfaz y el kit visual son recursos originales del proyecto; consulta los avisos de cada dependencia antes de redistribuir software o assets.
