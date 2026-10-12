# Inicio rápido

## Usar el taller en línea

Abre [telematica-iot-usm.vercel.app](https://telematica-iot-usm.vercel.app) con Chrome o Edge de escritorio si usarás USB. Crea un grupo, selecciona la placa real y sigue la actividad. USB necesita puerto de datos, HTTPS/localhost, permiso explícito y acceso exclusivo al puerto. La opción Wi-Fi es voluntaria y solo aplica a Pico W/Pico 2 W.

## Ejecutar la aplicación en desarrollo

Requisitos: Node.js 24, npm y Python 3.12 para pruebas de firmware.

```sh
git clone https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales.git
cd Taller-IoT-v2-Raices-Digitales
npm ci
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. Define `TEACHER_PASSWORD` en `.env` si vas a entrar como profesor. Para usar Telegram genera `SECRETS_KEY` localmente; no copies claves a issues o commits.

```sh
npm run check
npm run test:e2e
```

Las cargas Arduino necesitan Arduino CLI y core AVR; en Windows puedes usar `scripts/setup-arduino.ps1`. Instrucciones completas: [Desarrollo](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/DEVELOPMENT.md) y [Configuración](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/SETUP.md).
