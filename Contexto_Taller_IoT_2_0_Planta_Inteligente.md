# Taller IoT 2.0 - Planta Inteligente
## Contexto maestro del proyecto

**Carrera:** Ingenieria Civil Telematica - UTFSM  
**Objetivo:** taller presencial, educativo e interactivo de electronica, sensores, programacion e IoT usando una planta real por grupo.  
**Escala prevista:** 10 grupos / 10 estaciones.  
**Controlador principal:** Raspberry Pi Pico W.  
**Estado:** hardware base disponible y sensores adicionales comprados.

---

## 1. Vision general

El proyecto busca evolucionar el taller original de sensores Arduino hacia una experiencia completa de IoT aplicada a una planta real.

Cada grupo recibe una planta y una estacion basada en Raspberry Pi Pico W. Los estudiantes construyen la estacion paso a paso, aprenden a cablear componentes, modifican codigo, ejecutan programas sobre hardware real y terminan monitorizando la planta mediante un dashboard web.

La experiencia debe avanzar desde conceptos muy simples hasta una estacion IoT funcional:

1. Conocer la placa y la protoboard.
2. Encender un LED.
3. Hacer parpadear el LED y modificar tiempos.
4. Leer entradas y utilizar actuadores.
5. Probar sensores individualmente.
6. Comprender conexiones, alimentacion, GND, GPIO, entradas analogicas y digitales.
7. Montar sensores alrededor de una planta real.
8. Calibrar sensores.
9. Conectar la Pico W a Wi-Fi.
10. Enviar telemetria a una plataforma web.
11. Visualizar datos en tiempo real.
12. Configurar umbrales y diagnosticos.
13. Como etapa final, enviar alertas por Telegram; Discord queda como alternativa futura.

La plataforma debe ser util tanto para un alumno que sigue el tutorial estrictamente como para uno que quiera experimentar por su cuenta.

---

## 2. Hardware disponible por grupo

Se dispone del **Kit Raspberry Pi Pico W Avanzado de MCI Electronics**.

Cada kit contiene:

- 1x Raspberry Pi Pico W.
- 1x protoboard de 830 puntos.
- 1x pack de jumpers de distintas medidas y colores.
- 1x cable ribbon de 10 pines, 20 cm.
- 1x cable USB a micro USB.
- 1x caja plastica de almacenamiento.
- 1x caja plastica para almacenar el kit.
- 5x LED rojo de 5 mm.
- 5x LED amarillo de 5 mm.
- 5x LED azul de 5 mm.
- 5x resistencias de 220 ohm.
- 5x resistencias de 1 kohm.
- 5x resistencias de 10 kohm.
- 1x buzzer activo.
- 1x buzzer pasivo.
- 4x pulsadores 12x12 mm con tapa.
- 1x display de 7 segmentos de 1 digito.
- 1x display de 7 segmentos de 4 digitos.
- 1x matriz LED 8x8.
- 2x switches/vibradores SW520D.
- 3x fotoresistores modelo 5549.
- 1x potenciometro de 10 kohm.
- 1x sensor de llama.
- 1x receptor infrarrojo.
- 1x sensor de temperatura LM35.
- 1x 74HC595, registro de desplazamiento.
- 1x control remoto IR.
- 1x display LCD 16x2.
- 1x motor paso a paso de 5 V.
- 1x driver ULN2003.
- 1x servomotor SG90.
- 1x soporte para bateria de 9 V con cable.
- 1x tira de 40 pines header macho.
- 1x PCB para soldar de 3x7 cm.

Este kit cubre la mayor parte de los elementos basicos del taller: microcontrolador, protoboard, cableado, indicadores, actuadores y varios sensores simples.

---

## 3. Sensores adicionales ya comprados

Se compraron **12 unidades de cada sensor**, pensando en 10 grupos y 2 repuestos por modelo.

| Componente | Identificador / modelo | Cantidad comprada | Funcion principal |
|---|---|---:|---|
| Sensor de humedad de suelo | Capacitive Soil Moisture Sensor v1.2 | 12 | Humedad relativa del sustrato |
| Sensor de temperatura sumergible | DS18B20 Waterproof 1 m | 12 | Temperatura de suelo / agua |
| Sensor de temperatura y humedad | DHT11 | 12 | Temperatura y humedad ambiente |
| Sensor de lluvia | FC-37 + LM393 | 12 | Presencia de agua / lluvia |
| Sensor de nivel de agua | Water Level Sensor | 12 | Nivel / presencia de agua |
| Sensor ultrasonico | HC-SR04 | 12 | Distancia |
| Sensor de movimiento PIR | HC-SR501 | 12 | Movimiento / presencia |

**Costo total de esta compra:** $159.109 CLP con IVA y despacho, segun cotizacion recibida.

Con 10 grupos quedan 2 unidades de cada sensor como respaldo ante fallos o roturas.

---

## 4. Elementos que NO se deben volver a comprar

Ya estan cubiertos por el kit Pico W:

- Raspberry Pi Pico W.
- Protoboard.
- Jumpers.
- Cable USB.
- Fotoresistores LDR 5549.
- LM35.
- LEDs.
- Resistencias 220 ohm, 1 kohm y 10 kohm.
- Buzzer activo y pasivo.
- LCD 16x2.
- SG90.
- Motor paso a paso + ULN2003.
- Pulsadores.
- SW520D.
- Sensor de llama.
- Receptor IR y control remoto.
- Displays de 7 segmentos.
- Matriz LED.
- 74HC595.
- Caja de almacenamiento.

Los sensores adicionales listados en la seccion anterior ya estan comprados y tampoco deben volver a cotizarse.

---

## 5. Posibles ampliaciones futuras

### Sensor de pH

Se evaluo incorporar un sensor de pH como actividad adicional.

Identificador sugerido:

**PH-4502C + electrodo/sonda BNC**

Consideraciones:

- No esta comprado actualmente.
- El PH-4502C normalmente mide pH de liquidos, no debe enterrarse directamente como si fuese una sonda de suelo industrial.
- Requiere calibracion con soluciones buffer.
- Es considerablemente mas caro que los demas sensores.
- Es mejor comprar 2 o 3 unidades compartidas que 10 si se incorpora al taller.
- Puede utilizarse como experiencia complementaria de quimica + sensores.

### Otras expansiones posibles

- BH1750 para iluminancia en lux.
- BME280 para temperatura, humedad y presion.
- Sensores EC/conductividad.
- Sensores de calidad de aire.
- Automatizacion de riego mediante bomba/valvula en una version futura.

Estas expansiones no son necesarias para la primera version funcional.

---

## 6. Variables que podra observar la estacion

La estacion final debe permitir observar al menos:

### Planta y suelo

- Humedad del suelo.
- Temperatura del suelo.

### Ambiente

- Temperatura del aire.
- Humedad relativa del aire.
- Nivel relativo de iluminacion.

### Agua

- Presencia de lluvia/agua.
- Nivel de agua.

### Sensores adicionales

- Distancia mediante HC-SR04.
- Movimiento/presencia mediante HC-SR501.

El HC-SR04 y HC-SR501 no representan directamente el estado fisiologico de la planta, pero son valiosos como actividades educativas adicionales y como redundancia para mantener a los grupos trabajando si otra actividad falla.

---

## 7. Arquitectura general del sistema

La plataforma debe funcionar en dos modos complementarios.

### Modo laboratorio / USB

```text
Sensor -> Raspberry Pi Pico W -> USB -> Navegador
```

Uso:

- Primeras actividades.
- Ejecucion de codigo.
- Lectura serial.
- Diagnostico.
- Operacion incluso si Internet falla.

### Modo IoT

```text
Sensores -> Pico W -> Wi-Fi -> API -> Base de datos -> Dashboard web
```

Uso:

- Estacion de planta completa.
- Telemetria.
- Dashboard en tiempo real.
- Historicos.
- Umbrales.
- Alertas.

La plataforma no debe depender totalmente de Internet para que el taller pueda continuar.

---

## 8. Tecnologias recomendadas

### Firmware

- MicroPython.
- Arquitectura modular por sensor.
- Comunicacion USB mediante REPL / raw REPL / mecanismo robusto equivalente.

### Plataforma web

- Next.js.
- TypeScript.
- React.
- Tailwind CSS.

### Editor

- Monaco Editor.

### Comunicacion con Pico por USB

- Web Serial API.
- Navegadores recomendados: Chrome y Edge de escritorio.
- Fallback: descarga de `main.py` e instrucciones para Thonny.

### Diagramas

- Three.js / React Three Fiber para 3D.
- Vista 2D/breadboard alternativa.

### Backend

- Supabase.
- PostgreSQL.
- Supabase Anonymous Auth.
- Row Level Security.
- Supabase Realtime.

### Hosting

- Vercel.

### Testing

- Vitest.
- Playwright.

### Alertas

- Telegram Bot API como primera opcion.
- Discord como posible ampliacion.
- WhatsApp no es prioridad por complejidad innecesaria para el MVP.

---

## 9. Sesiones independientes

Cada alumno o grupo debe tener una sesion completamente independiente.

Un cambio realizado por un alumno no puede modificar:

- El codigo base del taller.
- El codigo de otro alumno.
- Las calibraciones de otro grupo.
- Los datos de otra planta.
- Los umbrales de otra estacion.

Se propone usar autenticacion anonima de Supabase.

Al comenzar:

```text
Comenzar taller
       |
       v
Sesion anonima unica
       |
       v
Grupo / dispositivo / progreso propios
```

No se deben solicitar datos personales innecesarios.

Puede pedirse opcionalmente un nombre de grupo.

Persistir por usuario/sesion:

- Progreso.
- Codigo modificado.
- Ultimo codigo ejecutado.
- Calibraciones.
- Dispositivo vinculado.
- Sensores habilitados.
- Telemetria.
- Umbrales.
- Experimentos completados.

Toda tabla expuesta debe utilizar RLS para garantizar aislamiento.

---

## 10. Flujo pedagogico del taller

### Etapa 0 - Bienvenida

- Que es IoT.
- Que vamos a construir.
- Seguridad.
- Identificar Pico W, protoboard, 3V3, GND y GPIO.

### Etapa 1 - Salidas digitales

- LED onboard.
- LED externo.
- Resistencia de 220 ohm.
- Encender/apagar.
- Blink.
- Cambiar tiempo de parpadeo.

### Etapa 2 - Entradas y actuadores simples

- Pulsador.
- LED controlado por pulsador.
- Buzzer activo.

### Etapa 3 - Sensores basicos

- Entrada analogica.
- LDR 5549.
- LM35.

### Etapa 4 - Sensores ambientales

- DHT11.
- Temperatura.
- Humedad relativa.

### Etapa 5 - Planta

- Capacitive Soil Moisture Sensor v1.2.
- Calibracion de humedad.
- DS18B20 Waterproof.
- Temperatura del suelo.

### Etapa 6 - Agua y entorno

- FC-37 + LM393.
- Water Level Sensor.
- HC-SR04.
- HC-SR501.

### Etapa 7 - Estacion integrada

- Conectar varios sensores simultaneamente.
- Validar lecturas.
- Diagnosticar errores.

### Etapa 8 - IoT

- Conectar Pico W a Wi-Fi.
- Pairing de la estacion con su sesion.
- Enviar telemetria.

### Etapa 9 - Dashboard

- Datos en vivo.
- Historicos.
- Estado de sensores.
- Rangos y umbrales.

### Etapa 10 - Automatizacion

- Reglas.
- Alarmas.
- Telegram.

### Zona Explora / Bonus

- SW520D.
- Sensor de llama.
- Receptor IR.
- Control remoto.
- LCD 16x2.
- Display 7 segmentos.
- Display 4 digitos.
- Matriz 8x8.
- 74HC595.
- SG90.
- Motor paso a paso.
- ULN2003.
- Potenciometro.
- Buzzer pasivo.

---

## 11. Estructura obligatoria de cada leccion

Cada actividad debe mantener la misma estructura:

1. Objetivo.
2. Que necesitas.
3. Que hace el componente.
4. Conexion paso a paso.
5. Por que se conecta asi.
6. Diagrama interactivo.
7. Codigo base.
8. Ejecutar.
9. Ver resultado.
10. Modificar.
11. Experimentar.
12. Desafio.
13. Checkpoint.
14. Problemas comunes.

Debe existir:

- Modo guiado.
- Modo libre.
- Restaurar codigo original.
- Pistas.
- Resultado esperado.
- Troubleshooting.

---

## 12. Editor de codigo

El editor web debe permitir que cada alumno experimente realmente.

Funciones esperadas:

- Monaco Editor.
- Syntax highlighting para Python.
- Ejecutar.
- Detener.
- Guardar en Pico.
- Restaurar ejemplo.
- Descargar `.py`.
- Copiar.
- Pantalla completa.
- Terminal serial.
- Autoguardado del borrador.
- Codigo independiente por sesion.

Ejemplo pedagogico:

```python
sleep(1)
```

El alumno cambia a:

```python
sleep(0.1)
```

y observa inmediatamente el cambio fisico del LED.

---

## 13. Diagramas de conexion

La plataforma no debe depender solamente de fotografias o PNG estaticos.

Debe existir un componente reusable de conexiones que permita:

- Vista 3D.
- Rotar.
- Zoom.
- Pan.
- Reset de camara.
- Seleccionar componente.
- Seleccionar pin.
- Mostrar GPIO.
- Mostrar pin fisico.
- Mostrar voltaje.
- Mostrar funcion.
- Resaltar cable actual.
- Atenuar cables de pasos anteriores.
- Mostrar advertencias electricas.

Ejemplo DHT11:

```text
Paso 1: VCC -> 3V3
Paso 2: GND -> GND
Paso 3: DATA -> GP15
Paso 4: verificar conexion
```

Convencion visual:

- Rojo: alimentacion.
- Negro: GND.
- Otros colores: datos/senales.

Nunca depender unicamente del color: cada conexion debe estar rotulada.

Debe existir tambien vista 2D tipo breadboard.

---

## 14. Pin map canonico propuesto

La estacion final debe usar una asignacion fija para evitar que diferentes tutoriales contradigan el montaje final.

| Dispositivo | Pico W | Tipo |
|---|---|---|
| Humedad de suelo v1.2 | GP26 / ADC0 | Analogico |
| LDR 5549 | GP27 / ADC1 | Analogico |
| Water Level Sensor | GP28 / ADC2 | Analogico |
| FC-37 + LM393 | GP14 | Digital |
| DHT11 | GP15 | Digital |
| DS18B20 | GP16 | 1-Wire |
| HC-SR04 TRIG | GP17 | Digital OUT |
| HC-SR04 ECHO | GP18 | Digital IN con divisor |
| HC-SR501 | GP19 | Digital |
| LED externo | GP2 | Digital OUT |
| Buzzer | GP3 | Digital OUT |

La Pico W solo expone tres ADC externos, por lo que los tres ADC quedan ocupados por:

- Humedad de suelo.
- Luz.
- Nivel de agua.

El LM35 se utiliza como actividad individual y no como sensor simultaneo de la estacion final.

---

## 15. Seguridad electrica

### Pico W

Los GPIO trabajan a 3,3 V.

**No se deben aplicar senales de 5 V directamente a GPIO.**

### HC-SR04

El ECHO del HC-SR04 puede trabajar a aproximadamente 5 V.

Debe utilizarse divisor resistivo antes de GP18.

Con los componentes disponibles:

```text
HC-SR04 ECHO
     |
    1 kohm
     |
     +------ GP18
     |
    1 kohm
     |
    1 kohm
     |
    GND
```

Esto reduce aproximadamente 5 V a 3,33 V.

### DS18B20

El bus 1-Wire necesita resistencia pull-up cercana a 4,7 kohm.

Como el kit incluye resistencias de 10 kohm:

```text
10 kohm || 10 kohm = 5 kohm aproximadamente
```

Es suficientemente cercano para un montaje corto de laboratorio.

### Reglas generales

- GND comun.
- Identificar claramente 3V3 y VBUS/5V.
- No modificar conexiones con alimentacion si existe riesgo de cortocircuito.
- Mostrar advertencias electricas dentro del tutorial en el paso exacto donde sean relevantes.

---

## 16. Calibracion

La calibracion debe ser parte del aprendizaje.

### Humedad de suelo

Wizard:

1. Sensor al aire / condicion seca.
2. Capturar varias muestras.
3. Guardar `dry_raw`.
4. Sensor en sustrato humedo.
5. Capturar varias muestras.
6. Guardar `wet_raw`.
7. Convertir lectura a 0-100 %.

La calibracion se guarda por usuario + dispositivo + sensor.

### LDR

No fingir lux reales.

Usar niveles relativos:

- Oscuro.
- Normal.
- Luminoso.

### Nivel de agua

Calibracion:

- Vacio.
- Maximo.

---

## 17. Deteccion de sensores

No se debe prometer una autodeteccion perfecta porque varios sensores analogicos no poseen identidad digital.

Estados propuestos:

- CONNECTED.
- READING.
- NEEDS_CALIBRATION.
- NO_RESPONSE.
- OUT_OF_RANGE.
- UNVERIFIED.
- DISABLED.
- ERROR.

### Deteccion con mayor confianza

- DS18B20: discovery 1-Wire.
- DHT11: respuesta valida/checksum.
- HC-SR04: pulso ECHO valido dentro de timeout.

### Deteccion parcial

- Humedad de suelo.
- LDR.
- Water Level Sensor.

Usar plausibilidad ADC, valores pegados al rail, ruido y calibracion.

### Self-tests guiados

PIR:

> Mueve tu mano frente al sensor.

Lluvia:

> Coloca una gota de agua sobre la placa.

La interfaz debe hablar de confianza de deteccion, no afirmar certeza cuando no exista.

---

## 18. Dashboard de la planta

La vista final debe mostrar claramente el estado de la estacion.

Ejemplo conceptual:

```text
PLANTA 04                             ONLINE
Ultima actualizacion: hace 2 s

Humedad suelo       64 %      NORMAL
Temp. suelo         19.8 C    NORMAL
Temp. ambiente      22.4 C    NORMAL
Humedad ambiente    58 %      NORMAL
Luz                 72 %      BUENA
Nivel agua          41 %      BAJO
Lluvia              No

Sensores adicionales:
Distancia           34 cm
Movimiento          Sin actividad
```

Cada sensor debe tener:

- Valor.
- Unidad.
- Estado.
- Tendencia.
- Ultima lectura.
- Indicador de conexion / verificacion.
- Sparkline pequena cuando corresponda.

Historicos:

- 15 minutos.
- 1 hora.
- 6 horas.
- 24 horas.
- Sesion completa.

No inventar una puntuacion cientifica de salud.

Mostrar algo defendible como:

**Variables dentro del rango configurado: 5/6**

---

## 19. Telemetria

La Pico W no debe conectarse directamente a Supabase utilizando claves administrativas.

Debe existir una API propia de ingreso de datos.

Flujo:

```text
Pico W
  |
  | HTTPS
  v
/api/device/ingest
  |
  v
validacion + autenticacion
  |
  +--> sensor_latest
  |
  +--> historico
  |
  +--> Realtime
```

Requisitos:

- Autenticar dispositivo.
- Validar payload.
- Rate limiting.
- Validar sensor y tipo.
- Manejar batches.
- No almacenar cientos de filas inutiles por segundo.

Cadencia sugerida:

- Lectura local: rapida.
- Envio cloud: aproximadamente cada 5 s.
- Persistencia historica: cada 15-30 s, configurable.

---

## 20. Pairing dispositivo - sesion

El dispositivo debe vincularse de forma sencilla a la sesion del grupo.

Ejemplo:

```text
Web genera: A7F3K2
       |
       v
Pico recibe pairing por USB
       |
       v
Pico vinculada con Grupo 4
```

El codigo temporal:

- Debe ser de un solo uso.
- Debe expirar.

La Pico puede recibir por USB:

- Endpoint.
- Device ID.
- Token de dispositivo.
- SSID.
- Password Wi-Fi.
- Informacion de pairing.

La clave Wi-Fi solo debe almacenarse en la Pico, no en la base de datos.

---

## 21. Firmware

No construir un `main.py` monolitico.

Estructura conceptual:

```text
firmware/
  main.py
  config.py
  wifi_manager.py
  telemetry.py
  sensor_registry.py
  calibration.py
  health.py
  utils.py
  drivers/
    soil.py
    ldr.py
    dht11_sensor.py
    ds18b20_sensor.py
    rain.py
    water_level.py
    hcsr04.py
    pir.py
```

Cada driver debe devolver un formato coherente:

```text
id
type
value
unit
status
raw
timestamp/error
confidence
```

Un sensor defectuoso nunca debe derribar toda la estacion.

---

## 22. Wi-Fi y resiliencia

La Pico W utiliza Wi-Fi de 2,4 GHz.

Antes del taller debe probarse la red real del laboratorio.

Si existe:

- WPA2 Enterprise.
- Portal cautivo.
- Restricciones de dispositivos.

se debe tener un plan B:

**router/hotspot 2,4 GHz dedicado al taller**.

El firmware debe:

- Conectarse con timeout.
- Reintentar con backoff.
- Continuar leyendo sensores aunque Wi-Fi falle.
- Recuperar conexion automaticamente.

Estados sugeridos:

- OFFLINE.
- CONNECTING.
- ONLINE.
- CLOUD_ERROR.

---

## 23. Alertas

Primera integracion recomendada: Telegram.

Flujo:

```text
lectura
  |
  v
evaluar regla
  |
  v
cruzo umbral?
  |
  v
histeresis + cooldown
  |
  v
Telegram
```

Ejemplo:

```text
Planta Grupo 4
Humedad del suelo baja: 18 %
Umbral configurado: 25 %
14:37
```

Tipos de eventos:

- threshold_breach.
- threshold_recovered.
- sensor_offline.
- device_offline.
- periodic_summary.

Los tokens deben existir solo en backend/variables de entorno.

Para un taller con menores, las alertas deberian llegar inicialmente al profesor o a un chat de la clase, no exigir cuentas personales de los alumnos.

---

## 24. Panel profesor

Debe existir un modo profesor opcional con autenticacion real.

Vista general:

```text
Grupo 1   ONLINE
Grupo 2   ONLINE
Grupo 3   SENSOR SUELO ERROR
Grupo 4   OFFLINE
...
```

Mostrar:

- Estado de cada grupo.
- Progreso.
- Sensores con problemas.
- Ultima telemetria.

El profesor puede abrir un grupo en modo lectura.

No debe sobrescribir accidentalmente el codigo del alumno.

Acciones sensibles como reset deben exigir confirmacion.

---

## 25. Pagina de diagnostico

Ruta sugerida:

`/diagnostico`

Debe mostrar:

- Compatibilidad del navegador.
- HTTPS.
- Web Serial disponible.
- Puerto Pico.
- Version MicroPython.
- Estado Wi-Fi.
- Estado cloud.
- Device ID.
- Sensor registry.
- ADC0.
- ADC1.
- ADC2.
- Memoria/heap libre.
- Uptime.
- RSSI.
- Ultima telemetria.

Debe permitir pruebas individuales de sensores.

Esta pagina es critica para resolver problemas durante el taller.

---

## 26. Modo simulacion

La plataforma debe permitir practicar sin hardware.

No hace falta simular electricamente el RP2040 completo.

Crear simuladores conceptuales:

- LDR: slider de luz.
- Humedad suelo: slider seco-humedo.
- DHT11: temperatura y humedad.
- HC-SR04: distancia.
- PIR: boton de movimiento.
- Water Level: slider de nivel.
- Lluvia: seco/mojado.

Esto sirve para:

- Aprender antes de conectar.
- Recuperar un grupo si falla hardware.
- Probar dashboard.
- QA.

---

## 27. Simulador para QA

Crear dispositivos virtuales que puedan simular las 10 estaciones.

Permitir:

- Valores normales.
- Desconectar sensor.
- Desconectar dispositivo.
- Spike.
- Ruido.
- Cruce de umbral.
- Recuperacion.

La telemetria simulada debe estar claramente identificada para no confundirse con datos reales.

---

## 28. UX/UI

La plataforma debe verse:

- Moderna.
- Tecnologica.
- Educativa.
- Explorable.
- Relacionada con Telematica.
- Profesional, pero no excesivamente corporativa.

Evitar:

- Apariencia infantil exagerada.
- Dashboard empresarial generico.
- UI futurista innecesaria.
- Saturacion de elementos.

Landing sugerida:

> **De una planta real a Internet.**

Visualmente:

```text
PLANTA
  |
SENSORES
  |
PICO W
  |
WI-FI
  |
DATOS
  |
DASHBOARD
```

CTA principal:

- Comenzar taller.
- Continuar.

---

## 29. Branding

Usar como fuente primaria el kit de marca indicado para Ingenieria Civil Telematica UTFSM:

`https://claude.ai/artifact/GHwKfGt8Z2dzrpKqhRfqJZ`

Si el agente no puede acceder a ese recurso:

- No debe fingir que lo vio.
- Debe mantener colores, tipografias y tokens desacoplados.
- Puede utilizar el sitio oficial de Telematica UTFSM como referencia secundaria.
- Debe permitir aplicar rapidamente el branding definitivo posteriormente.

Crear idealmente:

- `brand-tokens.css`
- `BRAND_TOKENS.md`

---

## 30. Estructura del repositorio

Estructura recomendada:

```text
web/
firmware/
hardware/
docs/
supabase/
tests/
assets/
```

### hardware/

- pin-map.md
- power-safety.md
- sensor-matrix.md
- wiring/
- 3d/

### docs/

- SETUP.md
- TEACHER_GUIDE.md
- STUDENT_GUIDE.md
- DEPLOYMENT.md
- HARDWARE.md
- TROUBLESHOOTING.md
- ARCHITECTURE.md
- SECURITY.md

---

## 31. Modelo de datos conceptual

Tablas sugeridas:

- profiles
- workshop_sessions
- lesson_progress
- code_snapshots
- devices
- device_pair_codes
- sensor_configs
- sensor_calibrations
- sensor_latest
- sensor_readings
- alert_rules
- alert_events

Usar UUID.

Indexar por:

- user_id.
- session_id.
- device_id.
- timestamp.
- sensor_type.

Debe existir politica de retencion de telemetria y exportacion CSV.

---

## 32. Seguridad y privacidad

### Seguridad

- RLS en tablas expuestas.
- Rate limiting.
- Validacion de schemas.
- Sin secrets en frontend.
- Sin secrets en repositorio.
- `.env.example` sin valores reales.
- Tokens de dispositivo revocables.
- Pairing codes con expiracion.
- No confiar en `session_id` sin autenticacion.

### Privacidad

Por defecto:

- Usuario anonimo.
- Nombre de grupo opcional.
- Sin RUT.
- Sin telefono.
- Sin correo obligatorio.
- Sin trackers publicitarios.

Permitir:

- Exportar progreso.
- Eliminar sesion.

---

## 33. Testing minimo obligatorio

### Seguridad y aislamiento

- Crear sesion A.
- Crear sesion B.
- A no puede leer B.
- A no puede editar B.

### Editor

- Guarda borrador.
- Restaurar recupera template.
- Error de ejecucion no rompe interfaz.

### Hardware/browser

- Web Serial no disponible -> fallback correcto.
- Pico desconectada -> mensaje correcto.
- Sensor timeout -> estacion sigue funcionando.

### Backend

- Payload invalido rechazado.
- Device token invalido rechazado.
- Pair code expirado rechazado.
- Realtime recupera conexion.

### Alertas

- Cooldown funciona.
- Histeresis funciona.
- Recuperacion se informa una sola vez.

### Otros

- Exportacion CSV.
- Responsive 1366x768.
- Dashboard sin telemetria.
- Dashboard con 10 dispositivos simulados.

---

## 34. Preparacion del taller real

Antes del taller deben comprobarse especificamente:

### Hardware

- Todas las Pico W operativas.
- Headers soldados si el kit no los trae soldados.
- Cables USB funcionando.
- 10 protoboards.
- 10 juegos de jumpers.
- 10 unidades operativas de cada sensor.
- 2 repuestos de cada sensor adicional.
- Resistencias para divisores y pull-ups.

### Firmware

- MicroPython instalado.
- REPL accesible.
- Programa de diagnostico cargado.

### Red

- Wi-Fi 2,4 GHz probado.
- Credenciales disponibles.
- Hotspot/router alternativo si fuese necesario.

### Plataforma

- HTTPS funcionando.
- Web Serial probado en Chrome/Edge.
- Supabase operativo.
- Dashboard operativo.
- Modo local probado.
- Simulador probado.

---

## 35. Prioridades del proyecto

### P0 - No negociable

- Seguridad electrica.
- Tutorial LED.
- Editor.
- Web Serial.
- Sesiones aisladas.
- Tutoriales de los sensores comprados.
- Estacion de planta.
- Telemetria.
- Dashboard.
- Diagnostico.
- Deployment HTTPS.

### P1 - Muy importante

- Conexion 3D pulida.
- Panel profesor.
- Historicos.
- Alertas Telegram.
- Simulador.

### P2 - Expansion

- Discord.
- Gamificacion adicional.
- Sensores futuros.
- pH.
- Automatizacion fisica de riego.
- Nuevos actuadores.

No sacrificar P0 para construir P2.

---

## 36. Criterios de aceptacion

El proyecto se considera listo cuando:

1. Se puede crear una sesion independiente.
2. Dos sesiones quedan correctamente aisladas.
3. El tutorial LED funciona.
4. El alumno puede modificar codigo.
5. La web puede conectarse a Pico mediante Web Serial o mostrar fallback correcto.
6. La terminal serial funciona.
7. Los diagramas representan conexiones reales.
8. Cada sensor comprado posee un tutorial.
9. El firmware de estacion soporta todos los sensores finales.
10. Los tres ADC estan asignados correctamente.
11. HC-SR04 esta protegido para entrada de 3,3 V.
12. DS18B20 tiene pull-up correctamente explicado.
13. La calibracion de humedad funciona.
14. El pairing dispositivo-sesion funciona.
15. La telemetria llega al backend.
16. El dashboard actualiza en tiempo real.
17. Un sensor puede fallar sin derribar la estacion.
18. Un dispositivo offline es visible.
19. Las alertas respetan cooldown.
20. Las alertas utilizan histeresis.
21. Telegram funciona si se implementa en esta version.
22. El simulador de QA funciona.
23. Los tests criticos pasan.
24. El build de produccion pasa.
25. No existen secrets en el repositorio.
26. La documentacion permite ejecutar el taller sin depender del desarrollador original.

---

## 37. Principio de diseno final

El proyecto no debe ser simplemente un dashboard con sensores conectados.

La experiencia debe hacer que el alumno comprenda la cadena completa:

```text
fenomeno fisico
     |
     v
sensor
     |
     v
senal electrica
     |
     v
GPIO / ADC
     |
     v
MicroPython
     |
     v
dato
     |
     v
Wi-Fi
     |
     v
API
     |
     v
base de datos
     |
     v
dashboard
     |
     v
regla / alerta
```

El valor pedagogico esta en que los alumnos construyan esa cadena gradualmente y puedan modificarla, romperla, diagnosticarla y entenderla.

---

## 38. Resumen ejecutivo

El Taller IoT 2.0 dispone ya de una base de hardware suficiente para implementar 10 estaciones completas de monitoreo de plantas utilizando Raspberry Pi Pico W.

Cada grupo tendra sensores para humedad y temperatura del suelo, temperatura y humedad ambiente, luz, lluvia, nivel de agua, distancia y movimiento. Ademas, el kit entrega multiples actuadores y sensores adicionales para experimentacion.

La plataforma web debe transformar este hardware en una experiencia guiada: comenzar con un LED, avanzar sensor por sensor, mostrar conexiones interactivas, permitir editar y ejecutar MicroPython directamente desde el navegador, y finalmente convertir el montaje en una estacion IoT con dashboard, diagnostico, historicos y alertas.

La arquitectura debe privilegiar robustez en un taller presencial: funcionamiento USB sin Internet, sesiones aisladas, diagnostico claro, protecciones electricas, simulacion, repuestos fisicos y plan B de conectividad.

El resultado esperado es una plataforma educativa completa donde cada grupo construye una planta conectada real y comprende desde la senal electrica hasta la telemetria y el dashboard.
