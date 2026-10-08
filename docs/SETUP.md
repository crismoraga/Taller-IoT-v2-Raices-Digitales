# Ejecutar Raíces Digitales

Requisitos: Node.js 24, npm, navegador Chrome/Edge de escritorio para Web Serial, cable USB con datos y Pico W con MicroPython o Arduino Uno/Nano. La guía y el dashboard funcionan sin placa; la sección de simulación se etiqueta y almacena como simulación. No se inventan lecturas de hardware.

Desde la raíz del repositorio, en PowerShell:

```powershell
npm ci
Copy-Item -LiteralPath .env.example -Destination .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Pon el resultado en `SECRETS_KEY` de `.env` y establece tu propio `TEACHER_PASSWORD`. Sin contraseña configurada el inicio de profesor devuelve un error explícito; no existe contraseña universal. El acceso de los grupos funciona desde el inicio. `SECRETS_KEY` es necesaria para cifrar la configuración del bot.

```powershell
npm run dev
```

Abre `http://localhost:5173`. Vite reenvía `/api` al servidor en `127.0.0.1:3001`. SQLite crea `data/raices.sqlite` automáticamente. Cada navegador tiene una cookie opaca privada de grupo; dos equipos no comparten lecturas, borradores, umbrales ni configuración. Varios navegadores con el mismo número de grupo siguen siendo sesiones independientes; el número es una etiqueta de taller. El profesor puede verlas por separado.

Para servir el frontend construido en el mismo proceso:

```powershell
npm run build
npm start
```

Abre `http://localhost:3001`. Producción remota requiere HTTPS; consulta [DEPLOYMENT.md](DEPLOYMENT.md).

## Pico W

1. Instala el firmware MicroPython oficial para **Pico W**, con BOOTSEL y su UF2; una Pico sin W no tiene Wi-Fi.
2. Cierra Thonny y otras aplicaciones que ocupen el puerto USB.
3. En la plataforma selecciona Pico W, conecta USB y autoriza su puerto serial.
4. Ejecuta LED y parpadeo, luego el ejemplo de sensor correspondiente al cableado.
5. Para instalar la estación usa el instalador de la plataforma. Descarga archivos reales de `firmware/` desde `/api/firmware`; `config.json` con los datos de tu estación se genera en el navegador y se envía a la placa.
6. Usa Wi-Fi 2.4 GHz con salida al dominio HTTPS de la plataforma. La Pico empareja su token y publica `/api/device/ingest`. Comprueba primero la dirección, el código de un uso y su vencimiento de cinco minutos.

El USB permite leer telemetría y controlar código sin red Wi-Fi. La misma estación debe usar una única vía de envío para no publicar duplicados. La etapa Arduino usa USB hacia el navegador como puente de telemetría; Uno/Nano no incluyen radio Wi-Fi.

## Arduino Uno/Nano

El backend compila C++ real con el toolchain AVR; el navegador programa el bootloader por Web Serial. En Windows instala la herramienta y bibliotecas verificadas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-arduino.ps1
```

El instalador descarga el archivo oficial Arduino CLI 1.4.1, valida SHA-256 con los checksums de esa misma publicación e instala AVR 1.8.6 y las bibliotecas DHT, Unified Sensor, OneWire, DallasTemperature y Servo. Los archivos permanecen en `tools/`, fuera de Git. La configuración por defecto del backend detecta esos directorios.

Selecciona Uno, Nano o Nano con bootloader antiguo según tu placa. La subida requiere el bootloader original STK500v1, un cable de datos, puerto disponible y un puente USB compatible. Si una Nano lleva CH340, el sistema operativo debe tener su controlador. Una placa con bootloader distinto puede compilar correctamente y fallar al subir; la interfaz comunica el fallo real del transporte.

El compilador local admite bibliotecas `Arduino.h`, `DHT.h`, `Adafruit_Sensor.h`, `OneWire.h`, `DallasTemperature.h`, `Servo.h`, `Wire.h`, `SPI.h` y `math.h`. Es un servicio de compilación supervisado para el taller local. El despliegue público utiliza un contenedor privado separado, sin datos ni secretos del servidor.

La referencia de comandos y configuración es la documentación oficial de [Arduino CLI](https://docs.arduino.cc/arduino-cli/getting-started/) y [variables de directorios](https://docs.arduino.cc/arduino-cli/configuration/).

## Bot Telegram

En Telegram crea un bot con BotFather, inicia una conversación con ese bot y consigue el ID numérico del chat de destino con la API oficial `getUpdates` después de enviarle un mensaje. Para un grupo, agrega el bot y usa el ID negativo del grupo. No publiques el token ni lo pegues en repositorios.

En la plataforma entra a Profesor con `TEACHER_PASSWORD`, guarda token y chat ID y pulsa Enviar prueba. La prueba hace una solicitud real a Telegram y muestra un error si el bot no tiene acceso. Las alertas de telemetría real se entregan a ese chat compartido; las de simulación se muestran en el dashboard y no se envían. El token queda cifrado AES-256-GCM en SQLite y nunca se devuelve por la API. Los campos `delivery` indican `pending`, `delivered`, `failed`, `not_configured` o `simulation`.

La configuración depende de la [API oficial de Telegram Bot](https://core.telegram.org/bots/api#sendmessage).

## Comprobaciones

```powershell
npm run check
```

Las pruebas API ejecutan Fastify y SQLite reales, incluidos dos grupos, reinicio y persistencia, pairing, autorización, CSRF, CSV, retención, alertas y SSE por HTTP. Cuando Arduino CLI está instalado, una prueba compila realmente Blink. Las pruebas Python aíslan `machine`; no reemplazan una validación eléctrica con sensores físicos. USB, Wi-Fi y entrega Telegram requieren cableado, placas y credenciales reales.
