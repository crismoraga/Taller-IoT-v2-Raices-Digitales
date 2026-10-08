# Raíces Digitales · Taller IoT 2.0

Plataforma educativa funcional para Ingeniería Civil Telemática — UTFSM. Un recorrido guiado de 60 minutos lleva al grupo desde el LED a una estación de planta con sensores reales, MicroPython o Arduino, conexión USB, telemetría persistente, gráficos y alertas Telegram.

## Ejecutar en este equipo

Requiere Node.js 24 LTS, npm y Python 3.12 para tests de firmware.

```powershell
npm ci
node scripts/init-local.mjs
npm run dev
```

Abre **http://localhost:5173** en Chrome/Edge de escritorio. Crea un grupo (1–10). La contraseña docente está en `.env`, no hay credencial pública predeterminada.

Para compilar y cargar Arduino Uno/Nano desde la web:

```powershell
pwsh -File scripts/setup-arduino.ps1
```

El instalador comprueba SHA-256 oficial del CLI e instala AVR y bibliotecas. Pico usa firmware MicroPython Pico W oficial y Web Serial directamente; no necesita un compilador servidor.

```powershell
npm run check
npm run test:e2e
npm run build
npm start
```

El build productivo queda en `dist/`; `npm start` sirve web y API en http://localhost:3001. SQLite se guarda en `data/` con WAL; sesiones y grupos se autorizan en cada consulta. Los assets, ejemplos, tipografías y editor son locales; el build incluye caché offline de contenido, sin guardar API ni credenciales de red.

Tras la primera carga del build, un grupo existente puede recargar las lecciones, editar y conservar borradores y usar USB sin red. Progreso y borradores pendientes se guardan en ese navegador y se sincronizan con su sesión autorizada al reconectar. Crear grupos, compilar Arduino, instalar el bundle por primera vez, consultar históricos y enviar alertas requiere el servidor. MicroPython ya cargado y la terminal USB siguen disponibles; la contraseña Wi-Fi del instalador no se guarda en el navegador.

## Lo que puedes hacer

- Crear sesiones anónimas independientes, guardar progreso y borradores, exportar y eliminar datos.
- Seguir seis etapas o explorar todos los sensores comprados y componentes del kit MCI.
- Girar y seleccionar componentes/pines 3D, resaltar conexiones paso a paso y usar alternativa SVG 2D.
- Editar, ejecutar, detener, guardar y descargar código; ver y enviar serial real.
- Calibrar suelo/agua con veinte muestras de ADC o valores RAW manuales.
- Instalar estación modular en Pico W con Wi-Fi, TLS validado, identidad de dispositivo y token revocable.
- Instalar estación Arduino Uno/Nano con los ocho drivers y puente USB hacia el servidor.
- Recibir dashboard en vivo por SSE, históricos por rango, CSV y estados de respuesta por sensor.
- Configurar umbrales con histéresis/cooldown, alertas y Telegram para el chat de clase.
- Practicar con simulación explícita y ver diez estaciones desde el panel docente con autenticación real.

## Despliegue HTTPS

El servidor necesita almacenamiento persistente. Incluye Docker, SQLite en volumen, Caddy con TLS automático y servicio aislado de compilación Arduino. No se puede desplegar el backend SQLite sobre funciones efímeras de Vercel. Consulta [DEPLOYMENT](docs/DEPLOYMENT.md) para un VPS o equipo de laboratorio con dominio. No exige Supabase ni módulos físicos adicionales.

## Preparar el taller

[Guía docente](docs/TEACHER_GUIDE.md), [guía estudiante](docs/STUDENT_GUIDE.md), [hardware](docs/HARDWARE.md), [firmware](docs/FIRMWARE.md), [diagnóstico](docs/TROUBLESHOOTING.md), [seguridad](docs/SECURITY.md), [arquitectura](docs/ARCHITECTURE.md).

Los tests de software verifican protocolos, persistencia y aislamiento; no certifican el montaje eléctrico. Antes del taller se deben probar las diez placas, variantes reales de sensores, red 2,4 GHz y entrega al chat Telegram. Revisa [QA](docs/QA.md) para resultados y el procedimiento físico. No se han inventado lecturas ni afirmado pruebas con placas no conectadas.

La marca es propia provisional, documentada en [BRAND_TOKENS](BRAND_TOKENS.md). El artifact SoyTEL original no fue accesible.
