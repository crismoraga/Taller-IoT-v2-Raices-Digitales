# Raíces Digitales — contrato de integración

React + TypeScript + Vite, Fastify Node 24 + SQLite persistente (API privada), Three.js/R3F, Monaco, MicroPython modular. Backend autocontenido desplegable en contenedor con volumen y HTTPS (Caddy). No se necesita una cuenta cloud para usarlo. Se sustituye la recomendación Supabase por almacenamiento privado autocontenido: todas las consultas pasan por autorización de sesión, sin tablas expuestas. UI en español; datos reales vacíos hasta conexión, simulación rotulada explícitamente.

## Responsabilidades y criterios
Frontend raíz: recorrido de seis etapas / 60 minutos, laboratorio, editor, USB, calibración, configuración, dashboard, profesor, diagnósticos, marca. Backend: persistencia y aislamiento, pairing, validación, SSE, umbrales/alertas Telegram, exportación y retención, profesor. Firmware: ocho drivers finales, serial/browser Pico y Arduino Uno/Nano, códigos de ejemplos, configuración y reconexión, seguridad. Escena/contenido: planta y protoboard 3D seleccionables, cableado exacto en 3D/2D, todos los sensores comprados, docs de hardware y formación.

## API común
Session {id,name,groupNumber,progress: string[],drafts:Record<string,string>,calibrations:Record<string,{dry:number,wet:number}>,sensorEnabled:Record<string,boolean>,createdAt}. Cookie httpOnly opaca independiente por navegador. Todos los endpoints /api salvo device requieren cookie; ningún ID ajeno concede acceso.
POST /api/session {name?,groupNumber?} -> {session}; GET /api/session -> {session}; PATCH /api/session {name?,groupNumber?,progress?,drafts?,calibrations?,sensorEnabled?} -> {session}; DELETE /api/session -> {ok}.
POST /api/pair -> {code,expiresAt}; POST /api/device/pair {code} -> {deviceId,token}; POST /api/device/revoke {deviceId}.
POST /api/device/ingest Bearer token {readings: Reading[],source:'hardware'|'simulation',diagnostics?} -> {ok}.
POST /api/simulation {readings:Reading[]} -> {ok}; explicitly source simulation, never masquerades as hardware.
GET /api/dashboard?range=15m|1h|6h|24h|all -> {devices:Device[],latest:Reading[],history:Reading[],rules:Rule[],alerts:Alert[]}; GET /api/events -> SSE 'update' + heartbeat (client refetch dashboard).
GET /api/export -> CSV; GET /api/session/export -> JSON.
POST /api/rules {sensor,min,max,hysteresis,cooldown} -> {rule}; DELETE /api/rules/:id.
GET /api/health -> {ok,version,telegramConfigured,arduinoAvailable}.
POST /api/teacher/login {password} -> {ok}; POST /api/teacher/logout; GET /api/teacher/groups -> {groups}; GET /api/teacher/groups/:id -> {session,devices,latest,alerts} read-only.
GET /api/telegram -> {configured,chatId?}; POST /api/telegram {token,chatId} teacher only -> {ok}; POST /api/telegram/test teacher only -> {ok}. Secrets encrypted at rest with environment key and never returned.
POST /api/arduino/compile {code,board:'uno'|'nano'|'nano-old'} -> {hex,output}, uses arduino-cli child process, no shell, bounded timeout and size, authenticated + limited concurrency. Native tool setup script in tools ignored.
GET /api/firmware -> {files:Record<string,string>} public/downloadable source, excludes credentials; root install config generated in browser only.

Reading {sensor:string,value:number|null,unit:string,status:string,raw?:number,confidence?:string,error?:string,timestamp?:string,deviceId?:string,source?:string}. Sensor ids: soil (%), soil_temperature (°C), air_temperature (°C), air_humidity (%), light (% relativo), rain (0/1), water_level (%), distance (cm), motion (0/1). Status READING, NEEDS_CALIBRATION, NO_RESPONSE, OUT_OF_RANGE, UNVERIFIED, DISABLED, ERROR. Device {id,name,source,lastSeen,diagnostics,revoked?}. Rule {id,sensor,min,max,hysteresis,cooldown}; Alert {id,sensor,type,message,createdAt,delivery?}.

## Component/data interfaces
web/components/StationScene.tsx default export props {variant?:'hero'|'wiring',sensor?:string,activeStep?:number,onSelect?:(label:string)=>void,board?:'pico'|'uno',view?:'3d'|'2d'}; self-contained safe fallback on WebGL error.
web/data/lessons.ts exports lessons: Lesson[] and sensors: SensorInfo[]. Lesson {id,title,kicker,duration,description,objective,materials:string[],steps:WiringStep[],why,code,arduinoCode?,expected,challenge,hints:string[],troubleshooting:string[],sensor?}; WiringStep {title,detail,from,to,color}; SensorInfo {id,name,model,description,unit,gpio,pin,type,confidence,safety,lessonId}. Six core lessons welcome/led/blink/sensors/calibration/cloud (durations 5/8/7/15/10/15). Additional lab lessons soil/dht11/ds18b20/ldr/rain/water_level/distance/motion/LM35/button/buzzer and kit bonus.
web/lib/serial.ts exports serial: MicroPythonSerial object with supported, connected, onOutput:(s:string)=>void, onDisconnect:()=>void, connect(), disconnect(), run(code), stop(), saveFile(path,content), exec(code):Promise<string>, install(files), write(text). ArduinoSerial separate export connect(board),upload(hex),disconnect,write,onOutput. No simulation inside transport.

## QA
Build + automated API tests (two sessions isolation, invalid tokens and payloads, expired and reused pairing, real SSE, hysteresis/cooldown/recovery, CSV and persistence). Browser interaction plus 1366×768 responsive screenshot. Python tests mock machine pins only and explicitly mark that they do not establish electrical validation. Physical boards and Telegram require actual connected devices / credentials; report unverified external requirements honestly.
