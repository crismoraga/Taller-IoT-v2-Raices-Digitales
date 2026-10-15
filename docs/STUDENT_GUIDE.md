# Tu primera planta conectada

Abre [Raíces Digitales](https://telematica-iot-usm.vercel.app) en Chrome o Edge de escritorio y crea o recupera el grupo. Arduino Uno es la opción principal; elige otra variante solamente si corresponde a tu placa. El taller conserva tu avance y tus borradores.

## El recorrido

1. **Entiende las conexiones.** Explora la protoboard: a–e de una misma fila comparten conexión; f–j forman otro grupo. El canal central los separa. Los rieles pueden estar divididos al centro. Reconoce señal, alimentación y GND en Arduino.
2. **Enciende un LED.** Sigue cada pata y cada extremo del cable: D2 → resistencia de 220 Ω → ánodo del LED → cátodo → GND. Carga el programa y comprueba el LED físico.
3. **Hazlo parpadear.** Conserva ese montaje y cambia el intervalo del programa.
4. **Contrólalo con un pulsador.** Añade el pulsador en D4 y observa cómo cambia el LED al presionarlo.
5. **Mide la luz.** Añade la LDR con su resistencia de 10 kΩ y señal en A1. Tápala y destápala: RAW debe cambiar; no es una medida en lux.
6. **Mide temperatura y humedad.** Retira el pulsador y su cable de D4; ahora D4 corresponde a DATA del DHT11. En Uno/Nano, alimenta este módulo a 5 V siguiendo su serigrafía. Espera al menos dos segundos entre muestras.
7. **Comienza tu estación en la maceta.** Conserva LED, LDR y DHT11; deja la protoboard junto a la planta, la LDR expuesta a la luz y la rejilla del DHT11 al aire. Selecciona únicamente los sensores montados e instala el programa de estación desde la actividad.
8. **Añade la humedad del suelo.** Sonda capacitiva v1.2: VCC a 3,3 V, GND común y AOUT a A0. Introduce sólo la zona sensora en la tierra. El conector y la electrónica quedan sobre la tierra.
9. **Calibra la sonda.** Guarda una referencia seca y otra húmeda de tu propio montaje. En Uno/Nano puedes tomar una lectura USB reciente o escribir el RAW de la terminal: 0–1023, con al menos 8 unidades de diferencia. Reinstala la estación para aplicar las referencias; el ejemplo individual sigue mostrando RAW.
10. **Monitorea tu planta.** En Mi planta comprueba origen Hardware, hora reciente, unidad y estado. Mantén USB y la página abiertos: Arduino usa el navegador como puente a Internet.

## Una acción a la vez

Cada actividad contiene **Entiende → Conecta → Programa → Experimenta → Comprueba**. La guía de conexión muestra un extremo pendiente a la vez y las mismas ubicaciones en 2D y 3D. Confirma físicamente cada extremo antes de avanzar. Cambiar el editor requiere volver a cargar para cambiar el programa de Arduino.

El porcentaje de suelo representa tus referencias, no una cantidad absoluta de agua ni una recomendación universal de riego. Una entrada analógica puede variar incluso si no hay un sensor conectado: provoca un cambio físico repetible para comprobarla.

## Amplía la estación

Después añade un sensor por vez desde la actividad Estación. Están disponibles DS18B20, FC-37 + LM393, nivel de agua, HC-SR04 y HC-SR501, además de luz, suelo y DHT11. La selección determina el plano de conexión y los drivers instalados; vuelve a instalar después de cambiar sensores o calibración.

La cápsula del DS18B20 mide temperatura donde la pongas. FC-37 detecta gotas, no milímetros de lluvia. Nivel de agua necesita referencias propias. HC-SR04 mide distancia en centímetros y HC-SR501 detecta cambios de movimiento, no presencia permanente; espera su primer minuto de estabilización.

Las actividades adicionales del kit siguen disponibles en Explora. LM35 y potenciómetro se prueban individualmente: comparten A0 con la sonda y no se añaden simultáneamente en ese pin.

## Si una lectura no llega

Sigue la ayuda del error mostrado. Para USB, usa un cable de datos y libera el puerto de Arduino IDE u otro monitor serial. La terminal permite leer el historial y volver a las lecturas en vivo. Mi planta distingue Hardware, Simulación, valores antiguos y sensores sin respuesta; los datos de práctica no verifican conexiones físicas.

Raspberry Pi 3/4 con Linux tiene una comprobación GPIO opcional dentro de Estación, separada del taller Arduino. No se carga como Uno ni como Pico; los sensores analógicos necesitan un ADC MCP3008.
