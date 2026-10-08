# Guía docente · Taller IoT 2.0 — Raíces Digitales

Ingeniería Civil Telemática — UTFSM. Duración central: **60 minutos**. Diez grupos, una planta por grupo. Objetivo observable: cada grupo enciende un LED, cambia su ritmo, lee una sonda real, guarda referencias y ve telemetría propia y una alerta en el dashboard.

La hora está diseñada para un montaje central sencillo: **LED + humedad del suelo**, con DHT11 o DS18B20 como ampliación según ritmo. El laboratorio contiene todos los modelos comprados y actividades del kit. Si quieres demostrar la estación de ocho drivers completa durante esa hora, deja los sensores adicionales montados y validados antes de la sesión y deshabilita los que no estén conectados. Pedir a principiantes que monten y depuren ocho sensores distintos en quince minutos no es una meta del recorrido.

## Antes de recibir los grupos

1. Despliega el servidor con persistencia y HTTPS según README; guarda credenciales docentes fuera del código. Comprueba salud, exportación, dos grupos separados y reinicio con datos conservados.
2. En cada mesa: Pico W con MicroPython estable de Pico W, headers ya soldados, protoboard, LED y 220 Ω, sonda suelo, USB de datos, jumpers y maceta. Para Arduino, confirma Uno/Nano y variante de bootloader, compilador Arduino instalado en el servidor y carga por el navegador.
3. Usa Chrome o Edge de escritorio que exponga Web Serial; prueba los diez computadores, permiso USB y drivers del sistema. Cierra Thonny/IDE/monitor serial para liberar puertos. Un navegador móvil o Safari puede mostrar contenido pero no ejecutar el transporte USB.
4. Comprueba cada montaje contra [HARDWARE.md](HARDWARE.md). Separa 3V3 y VBUS. Sonda y electrónica permanecen secas. Verifica la variante DHT11 a 3.3 V y el divisor HC-SR04 **2 kΩ arriba / 3 kΩ abajo** si lo usas. Reparte diez sensores por modelo, guarda dos repuestos etiquetados.
5. Prepara tierra seca y húmeda sin inundación. Evita comparar plantas de especies distintas usando un mismo umbral universal.
6. Para Pico Wi-Fi, prepara una red 2.4 GHz sin portal cautivo accesible desde el servidor. Prueba URL, certificado y conexión real con ese firmware. Evita depender de una red institucional que aísle clientes. `localhost` desde Pico significa la propia Pico, no el computador: la URL debe ser accesible por la placa.
7. Para la prueba final de bot, crea un bot con BotFather, inicia conversación desde la cuenta/chat que recibirá mensajes y obtén el chat ID. Configura token/chat en la sección docente y prueba su entrega. No muestra el token en la proyección. [Instrucciones oficiales Telegram](https://core.telegram.org/bots/tutorial).

## Guion de 60 minutos

| Tiempo | Acción de estudiantes | Evidencia de aprendizaje |
|---|---|---|
| 0–5 | Crear nombre de estación, reconocer placa/protoboard y conectar USB | Pueden señalar sensor, código y red en la ruta |
| 5–13 | Cablear LED con 220 Ω, ejecutar encendido y apagar cambiando código | LED real cambia, no solo una animación |
| 13–20 | Ejecutar parpadeo y editar intervalo | Predicen el ciclo completo de encendido/apagado |
| 20–35 | Cablear sonda suelo y leer raw; añadir DHT/DS si el grupo tiene tiempo | Distinguen ADC y mensaje digital; provocan cambio físico |
| 35–45 | Guardar seco/húmedo, probar condición intermedia | Explican qué significa porcentaje relativo |
| 45–60 | Instalar la estación con sensores y referencias, ver telemetría Wi-Fi o puente USB automático, crear umbral y probar alerta | Señalan dónde viajan los datos y por qué pertenecen a su grupo |

Roles sugeridos por mesa: responsable de cableado, responsable de código, observador de datos y relator. Rotan al pasar de LED a sensores. No conectes otra estación al mismo perfil de navegador por accidente: una sesión identifica un grupo; usa perfiles separados para grupos en un mismo computador.

## Acompañamiento

Pregunta primero qué debería pasar y después qué pasó. Una hipótesis útil puede ser “la lectura cambia al mojar la tierra”, sin prometer que siempre aumenta. Explica que ingeniería incluye comprobar supuestos: cables, voltaje, versión de firmware, disponibilidad de red y precisión de un instrumento.

El panel docente permite observar progreso y últimos datos de las sesiones. Grupo sin datos todavía no implica falta de participación: puede estar en la etapa del LED. Una curva marcada como simulación sirve para enseñar interfaz o ensayar alertas; nunca se presenta como lectura de la planta.

La vinculación se realiza automáticamente al conectar USB o instalar la estación; el estudiante no copia un código manual. Después de guardar o cambiar calibraciones, debe instalar o reinstalar la estación para incluir las nuevas referencias en Pico o Arduino. Los ejemplos individuales analógicos muestran RAW; el programa de estación convierte a porcentaje. El puente USB transmite automáticamente mientras permanecen conectados la página y el dispositivo.

## Cuando algo falla

| Síntoma | Orden de comprobación |
|---|---|
| No aparece puerto USB | USB de datos → driver del sistema → placa alimentada → otra app con el puerto abierto → Web Serial y HTTPS |
| LED apagado | Detener y quitar USB → resistencia → polaridad → misma fila accidental → GP2 / pin físico 4 |
| DHT sin respuesta | Variante/tensión → pinout → pull-up → GP15 → esperar dos segundos |
| DS sin ROM | Colores/pinout → dos 10 kΩ en paralelo → GP16 → alimentación de tres hilos |
| ADC tiene datos pero no cambia | Desconectar USB → señal real → 3V3/GND → otra unidad; nunca inferir presencia por un número |
| Wi-Fi falla | Red 2.4 GHz y contraseña → portal cautivo → URL accesible desde Pico → certificado → aislamiento clientes |
| Arduino no compila/carga | Salud del compilador → Uno/Nano correcto → bootloader Nano antiguo → drivers USB → puerto libre |
| Alerta no llega al bot | Alerta registrada → token/chat docente → conversación iniciada → red del servidor → estado de entrega |

Si un sensor falla, usa uno de los dos repuestos de ese modelo y marca lo retirado. Si la red del aula falla, continúa con USB y el servidor accesible por HTTPS/local seguro. Un Uno/Nano no obtiene Wi-Fi al instalar firmware: requiere el puente serial abierto. Si no se logra un canal real, demuestra una simulación explícita y registra que el resultado hardware quedó pendiente.

## Cierre y preparación del siguiente taller

Cada grupo exporta sus datos y puede explicar una conexión física, una línea de código y una etapa de red. Apaga y seca sensores de agua, revisa jumpers, revoca dispositivos que no deban seguir enviando y guarda componentes en sus cajas. La eliminación de una sesión borra sus datos: exporta primero si quieres conservar evidencias.

Los porcentajes y umbrales son una exploración del montaje, no una receta agronómica. No se hace riego automático: el inventario no incluye bomba/relé y el taller se centra en observar y comunicar.

## Acta de ensayo físico

Antes de anunciar el taller como validado, anota para cada grupo: placa/firmware, cable y navegador, LED, sonda y calibración, DHT/DS si montados, red/URL, telemetría, alerta local y entrega bot. Conserva notas del modelo exacto y de cambios de pinout. Las pruebas automáticas del repositorio cubren software y aislamiento; esta acta cubre los elementos externos que necesitan hardware real.
