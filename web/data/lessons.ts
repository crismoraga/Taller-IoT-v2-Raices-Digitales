export interface WiringStep { title: string; detail: string; from: string; to: string; color: string }
export interface Lesson { id: string; title: string; kicker: string; duration: number; description: string; objective: string; materials: string[]; steps: WiringStep[]; why: string; code: string; arduinoCode?: string; expected: string; challenge: string; hints: string[]; troubleshooting: string[]; sensor?: string }
export interface SensorInfo { id: string; name: string; model: string; description: string; unit: string; gpio: string; pin: number; type: string; confidence: string; safety: string; lessonId: string }

const step = (title: string, detail: string, from: string, to: string, color = '#b18b3e'): WiringStep => ({ title, detail, from, to, color });
const power = (model: string): WiringStep[] => [
  step('Primero, alimentación', `Con USB desconectado, conecta VCC de ${model} a 3V3 de la Pico (pin 36). En Uno/Nano usa 3.3V si el sensor lo permite; revisa siempre las etiquetas de tu unidad.`, '3V3 · pin 36', 'VCC del sensor', '#bf6a50'),
  step('Un suelo común', 'Conecta GND del sensor al riel negativo y este a GND de la placa. Los rieles largos pueden estar cortados en el centro: une sus dos mitades si necesitas usarlas.', 'GND · pin 38', 'GND del sensor', '#53645b'),
];
const analogPy = (pin: number, sensor: string, unit: string, extra = '') => `from machine import ADC, Pin
from time import sleep
import json

sensor = ADC(Pin(${pin}))
${extra}
while True:
    raw = sum(sensor.read_u16() for _ in range(16)) // 16
    print(json.dumps({"sensor": "${sensor}", "value": None, "raw": raw,
                      "unit": "${unit}", "status": "NEEDS_CALIBRATION"}))
    sleep(1)
`;
const analogIno = (pin: string, sensor: string, unit: string) => `void setup() { Serial.begin(115200); }
void loop() {
  long total = 0;
  for (int i = 0; i < 16; i++) total += analogRead(${pin});
  int raw = total / 16;
  Serial.print("{\\\"sensor\\\":\\\"${sensor}\\\",\\\"value\\\":null,\\\"raw\\\":");
  Serial.print(raw);
  Serial.println(",\\\"unit\\\":\\\"${unit}\\\",\\\"status\\\":\\\"NEEDS_CALIBRATION\\\"}");
  delay(1000);
}
`;
const digitalPy = (pin: number, sensor: string, inverted = false) => `from machine import Pin
from time import sleep
import json

sensor = Pin(${pin}, Pin.IN, Pin.PULL_DOWN)
while True:
    value = ${inverted ? '1 - sensor.value()' : 'sensor.value()'}
    print(json.dumps({"sensor": "${sensor}", "value": value, "unit": "0/1", "status": "UNVERIFIED"}))
    sleep(0.5)
`;
const digitalIno = (pin: number, sensor: string, inverted = false) => `void setup() { Serial.begin(115200); pinMode(${pin}, INPUT); }
void loop() {
  int value = ${inverted ? '1 - ' : ''}digitalRead(${pin});
  Serial.print("{\\\"sensor\\\":\\\"${sensor}\\\",\\\"value\\\":"); Serial.print(value);
  Serial.println(",\\\"unit\\\":\\\"0/1\\\",\\\"status\\\":\\\"UNVERIFIED\\\"}"); delay(500);
}
`;
const common = {
  hints: ['Los cinco agujeros de cada fila se comunican entre sí; el canal central los separa.', 'Detén el programa antes de cargar otro. Ctrl+C interrumpe un bucle en MicroPython.'],
  troubleshooting: ['Revisa VCC, GND y señal con USB desconectado.', 'Comprueba que GP significa GPIO, no el número físico del pin.', 'Usa un cable USB de datos; un cable de carga no abre el puerto serial.'],
};

const ledCode = `from machine import Pin
led = Pin(2, Pin.OUT)
led.value(1)
print("LED encendido. Cambia 1 por 0 y vuelve a ejecutar.")
`;
const ledIno = `void setup() { Serial.begin(115200); pinMode(2, OUTPUT); digitalWrite(2, HIGH); Serial.println("LED encendido"); }
void loop() {}
`;
const blinkCode = `from machine import Pin
from time import sleep

led = Pin(2, Pin.OUT)
intervalo = 0.5  # segundos: prueba 0.1 o 1
try:
    while True:
        led.toggle()
        print("LED:", led.value())
        sleep(intervalo)
finally:
    led.off()
`;
const blinkIno = `const unsigned long intervalo = 500; // milisegundos
void setup() { Serial.begin(115200); pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); Serial.println("LED: 1"); delay(intervalo); digitalWrite(2, LOW); Serial.println("LED: 0"); delay(intervalo); }
`;
const ledSteps = [
  step('Protege el LED', 'Sin USB, lleva GP2 (pin físico 4) a una resistencia de 220 Ω. En Arduino usa D2. La resistencia limita la corriente.', 'GP2 · pin 4 / D2', 'Resistencia 220 Ω', '#c39545'),
  step('Respeta la polaridad', 'Conecta el otro extremo de la resistencia al ánodo: la pata larga del LED. Evita poner ambas patas en una misma fila conectada.', 'Resistencia 220 Ω', 'LED · ánodo (+)', '#bf6a50'),
  step('Cierra el circuito', 'Conecta el cátodo, pata corta o lado plano, a GND. Elige el LED rojo, amarillo o azul; cambia su color físico, no el código.', 'LED · cátodo (−)', 'GND · pin 3 / GND', '#53645b'),
];

export const sensors: SensorInfo[] = [
  { id: 'soil', name: 'Humedad del suelo', model: 'Capacitive v1.2', description: 'La tierra cambia la capacitancia de la sonda. Aprende a distinguir una señal cruda de un porcentaje calibrado.', unit: '% relativo', gpio: 'GP26 · ADC0', pin: 31, type: 'Analógico', confidence: 'La entrada analógica no demuestra presencia del sensor.', safety: 'Alimenta a 3V3. Entierra solo la zona de la sonda; la electrónica superior queda seca.', lessonId: 'soil' },
  { id: 'soil_temperature', name: 'Temperatura del suelo', model: 'DS18B20 impermeable', description: 'Un termómetro digital con identidad propia habla por un bus 1-Wire.', unit: '°C', gpio: 'GP16', pin: 21, type: '1-Wire', confidence: 'La búsqueda de ROM y CRC sí permiten comprobar respuesta digital.', safety: 'Dos resistencias de 10 kΩ en paralelo entre DATA y 3V3 forman un pull-up de 5 kΩ. Confirma colores del cable.', lessonId: 'ds18b20' },
  { id: 'air_temperature', name: 'Temperatura del aire', model: 'DHT11', description: 'Temperatura y humedad del aire en un único mensaje digital.', unit: '°C', gpio: 'GP15', pin: 20, type: 'Digital con protocolo', confidence: 'Tiempo de espera y checksum detectan ausencia de respuesta.', safety: 'Usa 3V3 solo si la ficha de tu unidad admite ≥3 V. Sensor desnudo: agrega 10 kΩ de DATA a 3V3; módulo: verifica su pull-up.', lessonId: 'dht11' },
  { id: 'air_humidity', name: 'Humedad del aire', model: 'DHT11', description: 'Comparte sensor, conexión y actividad con la temperatura del aire.', unit: '% HR', gpio: 'GP15', pin: 20, type: 'Digital con protocolo', confidence: 'El checksum verifica un mensaje, no su exactitud ambiental.', safety: 'Espera al menos dos segundos entre mediciones. Mantén el sensor seco.', lessonId: 'dht11' },
  { id: 'light', name: 'Luz ambiente', model: 'Fotoresistor 5549', description: 'Una resistencia sensible a la luz se convierte en voltaje con un divisor.', unit: '% relativo', gpio: 'GP27 · ADC1', pin: 32, type: 'Analógico', confidence: 'No mide lux y no tiene una identidad digital.', safety: 'LDR hacia 3V3; resistencia 10 kΩ desde el nodo de señal a GND. No conectar a 5 V.', lessonId: 'ldr' },
  { id: 'rain', name: 'Gotas sobre la placa', model: 'FC-37 + LM393', description: 'Detecta contacto de agua en una placa conductora y aprende qué hace un comparador.', unit: '0/1', gpio: 'GP14', pin: 19, type: 'Digital', confidence: 'Un 0 o 1 estable puede ser válido o un cable ausente.', safety: 'Alimenta el módulo a 3V3 y usa DO, no AO. Mantén seca la electrónica y retira gotas al terminar.', lessonId: 'rain' },
  { id: 'water_level', name: 'Nivel de agua', model: 'Water Level Sensor', description: 'La superficie mojada cambia una señal analógica. Su porcentaje representa tu propia escala.', unit: '% relativo', gpio: 'GP28 · ADC2', pin: 34, type: 'Analógico', confidence: 'Una entrada flotante puede parecer una lectura real.', safety: 'Alimenta a 3V3. Sumerge únicamente las pistas; protege los conectores. Es resistivo y se corroe con uso prolongado.', lessonId: 'water_level' },
  { id: 'distance', name: 'Distancia', model: 'HC-SR04', description: 'Mide el tiempo de ida y vuelta de un pulso de sonido.', unit: 'cm', gpio: 'GP17 TRIG · GP18 ECHO', pin: 22, type: 'Pulso digital', confidence: 'Sin eco no implica ausencia: el objeto puede estar lejos o absorber sonido.', safety: 'VCC a VBUS 5 V. ECHO exige divisor: 2×1 kΩ en serie arriba, 3×1 kΩ en serie abajo, salida ≈3 V a GP18.', lessonId: 'distance' },
  { id: 'motion', name: 'Movimiento', model: 'HC-SR501', description: 'Percibe cambios de radiación infrarroja y avisa con un nivel digital.', unit: '0/1', gpio: 'GP19', pin: 25, type: 'Digital', confidence: 'No detecta personas quietas ni demuestra que el sensor está presente.', safety: 'VCC a VBUS 5 V; OUT es normalmente 3.3 V: confirmar modelo. Espera 60 s de estabilización.', lessonId: 'motion' },
];

const soil: Lesson = {
  id: 'soil', title: 'Escuchar a la tierra', kicker: 'Sensor · suelo', duration: 7, sensor: 'soil',
  description: 'Inserta la sonda capacitiva en la maceta y observa la lectura cruda.', objective: 'Leer ADC0 y comprobar cómo cambia al mover la sonda entre tierra seca y húmeda.',
  materials: ['Pico W o Uno/Nano', 'Sonda capacitiva v1.2', '3 jumpers', 'Maceta con tierra'],
  steps: [...power('la sonda capacitiva'), step('La señal se convierte en un número', 'Conecta AOUT a GP26 / pin 31. En Arduino usa A0. Solo la parte inferior de la sonda entra en la tierra.', 'AOUT de sonda', 'GP26 · pin 31 / A0')],
  why: 'El ADC convierte un voltaje entre 0 y 3.3 V en un número. Aún no sabemos qué número significa suelo húmedo: eso se aprende al calibrar.',
  code: analogPy(26, 'soil', '%'), arduinoCode: analogIno('A0', 'soil', '%'), expected: 'Una línea JSON por segundo con raw: 0–65535 en Pico o 0–1023 en Arduino. El porcentaje queda vacío hasta calibrar.',
  challenge: 'Compara aire, tierra seca y tierra húmeda. ¿El número aumenta o disminuye?', ...common,
};

const dht: Lesson = {
  id: 'dht11', title: 'El aire también habla', kicker: 'Sensor · ambiente', duration: 5, sensor: 'air_temperature',
  description: 'Recibe temperatura y humedad del DHT11 en una misma conexión.', objective: 'Comprender una lectura digital y un error de respuesta.', materials: ['DHT11', 'Jumpers', '1 resistencia 10 kΩ si el sensor no lleva pull-up'],
  steps: [step('Una tensión para cada placa', 'Pico: VCC a 3V3/pin36 solo si tu DHT11 admite 3.3V; DATA nunca a pull-up5V. Arduino Uno/Nano: VCC a 5V y pull-up a 5V si la ficha lo admite; la biblioteca DHT puede conducir DATA a 5V. No mezcles DHT alimentado3.3V con señales5V de Arduino.', '3V3 Pico / 5V Uno/Nano', 'DHT11 · VCC', '#bf6a50'), power('DHT11')[1], step('DATA y pull-up', 'DATA a GP15 (pin 20) / Arduino D4. Sensor desnudo, rejilla hacia ti: 1 VCC, 2 DATA, 3 NC, 4 GND. Une 10 kΩ de DATA a su VCC (3V3 Pico o 5V Arduino). En módulos sigue su serigrafía, no este orden.', 'DATA · pull-up 10 kΩ a VCC', 'GP15 · pin 20 / D4')],
  why: 'El DHT11 manda bits con temperatura, humedad y checksum. Un timeout identifica falta de respuesta; su precisión es limitada y no sustituye un instrumento de laboratorio.',
  code: `from machine import Pin
from time import sleep
import dht, json

sensor = dht.DHT11(Pin(15))
sleep(2)
while True:
    try:
        sensor.measure()
        for name, value, unit in (("air_temperature", sensor.temperature(), "°C"), ("air_humidity", sensor.humidity(), "%")):
            print(json.dumps({"sensor": name, "value": value, "unit": unit, "status": "READING"}))
    except OSError as error:
        for name, unit in (("air_temperature", "°C"), ("air_humidity", "%")):
            print(json.dumps({"sensor": name, "value": None, "unit": unit, "status": "NO_RESPONSE", "error": str(error)}))
    sleep(2)
`,
  arduinoCode: `#include <DHT.h>
DHT sensor(4, DHT11);
void emit(const char* name, float value, const char* unit) {
  Serial.print("{\\\"sensor\\\":\\\""); Serial.print(name); Serial.print("\\\",\\\"value\\\":");
  if (isnan(value)) Serial.print("null"); else Serial.print(value);
  Serial.print(",\\\"unit\\\":\\\""); Serial.print(unit);
  Serial.print("\\\",\\\"status\\\":\\\""); Serial.print(isnan(value) ? "NO_RESPONSE" : "READING"); Serial.println("\\\"}");
}
void setup() { Serial.begin(115200); sensor.begin(); }
void loop() { delay(2000); emit("air_temperature", sensor.readTemperature(), "°C"); emit("air_humidity", sensor.readHumidity(), "%"); }
`, expected: 'Temperatura y humedad cada dos segundos; NO_RESPONSE si no llega un mensaje válido.', challenge: 'Acerca tu mano sin tocar la rejilla. Describe el cambio sin afirmar que es instantáneo.',
  ...common, troubleshooting: [...common.troubleshooting, 'Confirma que tu DHT11 admite 3.3 V; variantes pueden requerir otra alimentación y adaptación de nivel.', 'Comprueba el pull-up y deja dos segundos entre lecturas.'],
};

const ds: Lesson = {
  id: 'ds18b20', title: 'Temperatura entre las raíces', kicker: 'Sensor · 1-Wire', duration: 6, sensor: 'soil_temperature',
  description: 'Busca la identidad del termómetro y espera una conversión real.', objective: 'Conocer el bus 1-Wire y comprobar presencia por su ROM.', materials: ['DS18B20 impermeable', '2 resistencias 10 kΩ', 'Jumpers'],
  steps: [...power('DS18B20'), step('Construye el pull-up', 'Une dos resistencias 10 kΩ en paralelo entre DATA y 3V3: ambas comparten sus dos extremos. Equivalen a 5 kΩ. No pongas una detrás de otra.', '3V3 · 2×10 kΩ paralelo', 'DATA · GP16'), step('Un bus de un hilo', 'DATA a GP16 / pin 21; Arduino D5. Confirma el pinout del proveedor: los colores de los cables no son una norma.', 'DATA de DS18B20', 'GP16 · pin 21 / D5')],
  why: 'Cada DS18B20 tiene una ROM propia. La conversión de 12 bits puede tardar 750 ms. Los 85 °C tras encender no cuentan como medición hasta pedir una conversión.',
  code: `from machine import Pin
from time import sleep, sleep_ms
import onewire, ds18x20, json

sensor = ds18x20.DS18X20(onewire.OneWire(Pin(16)))
while True:
    try:
        roms = [r for r in sensor.scan() if r[0] == 0x28]
        if not roms:
            raise OSError("No se encontró DS18B20 en GP16")
        sensor.convert_temp()
        sleep_ms(750)
        value = sensor.read_temp(roms[0])
        print(json.dumps({"sensor": "soil_temperature", "value": value, "unit": "°C", "status": "READING"}))
    except Exception as error:
        print(json.dumps({"sensor": "soil_temperature", "value": None, "unit": "°C", "status": "NO_RESPONSE", "error": str(error)}))
    sleep(1)
`,
  arduinoCode: `#include <OneWire.h>
#include <DallasTemperature.h>
OneWire bus(5);
DallasTemperature sensor(&bus);
void setup() { Serial.begin(115200); sensor.begin(); }
void loop() {
  sensor.requestTemperatures(); float value = sensor.getTempCByIndex(0);
  bool ok = value != DEVICE_DISCONNECTED_C;
  Serial.print("{\\\"sensor\\\":\\\"soil_temperature\\\",\\\"value\\\":");
  if (ok) Serial.print(value); else Serial.print("null");
  Serial.print(",\\\"unit\\\":\\\"°C\\\",\\\"status\\\":\\\""); Serial.print(ok ? "READING" : "NO_RESPONSE"); Serial.println("\\\"}"); delay(1000);
}
`, expected: 'Temperatura en °C o NO_RESPONSE. Una búsqueda vacía no derriba los otros sensores.', challenge: 'Abraza la punta metálica unos segundos y observa su respuesta lenta.', ...common,
};

const ldr: Lesson = {
  id: 'ldr', title: 'Una ventana a la luz', kicker: 'Sensor · luz', duration: 5, sensor: 'light', description: 'Construye un divisor resistivo con el fotoresistor del kit.', objective: 'Leer una señal que cambia al tapar la LDR.', materials: ['LDR 5549', '1 resistencia 10 kΩ', 'Jumpers'],
  steps: [step('Del positivo a la LDR', 'Une una pata de la LDR a 3V3 de Pico / 3.3V de Arduino. La LDR no tiene polaridad.', '3V3 · pin 36', 'LDR · pata 1', '#bf6a50'), step('Crea un punto de medida', 'Une la otra pata a GP27 (pin 32) / Arduino A1 y a un extremo de una resistencia 10 kΩ.', 'LDR · pata 2', 'GP27 · pin 32 / A1'), step('Completa el divisor', 'El otro extremo de la resistencia 10 kΩ va a GND. Más luz reduce la resistencia de la LDR y eleva el voltaje del nodo.', 'Resistencia 10 kΩ', 'GND', '#53645b')],
  why: 'El ADC no mide resistencia: mide voltaje. El divisor transforma la resistencia de la LDR en un voltaje. Este experimento entrega RAW; la estación puede mostrar un nivel relativo del ADC, nunca lux sin calibración fotométrica.', code: analogPy(27, 'light', '%'), arduinoCode: analogIno('A1', 'light', '%'), expected: 'El raw sube normalmente con más luz, usando este divisor. Tapa y destapa la LDR.', challenge: 'Registra el RAW con la LDR tapada y con la luz del aula. Compara los números y explica por qué no representan lux.', ...common,
};

const rain: Lesson = {
  id: 'rain', title: '¿Hay gotas?', kicker: 'Sensor · agua', duration: 4, sensor: 'rain', description: 'Compara una señal con un umbral físico usando el LM393.', objective: 'Distinguir el umbral del potenciómetro y la lectura digital.', materials: ['FC-37', 'Módulo LM393', 'Jumpers', 'Una gota de agua'],
  steps: [...power('LM393'), step('Conecta la placa de gotas', 'El cable de dos hilos une FC-37 y su módulo LM393. Usa la salida DO del módulo hacia GP14 / pin 19; Arduino D6.', 'DO · LM393', 'GP14 · pin 19 / D6'), step('Ajusta el umbral', 'Añade una gota solo a la placa de pistas. Gira el trimmer hasta que DO cambie. En módulos comunes DO es activo bajo: el código convierte 0 eléctrico en 1 = mojado.', 'Trimmer del LM393', 'Umbral de gotas')],
  why: 'El comparador convierte una señal analógica en sí/no. Un 1 representa contacto de agua, no milímetros de precipitación.', code: digitalPy(14, 'rain', true), arduinoCode: digitalIno(6, 'rain', true), expected: '0 seco y 1 mojado si el módulo es activo bajo. UNVERIFIED recuerda que un cable ausente no puede identificarse por un único nivel.', challenge: 'Cambia el trimmer. ¿El mismo tamaño de gota activa siempre la señal?', ...common,
};

const water: Lesson = {
  id: 'water_level', title: 'El agua deja una huella', kicker: 'Sensor · nivel', duration: 4, sensor: 'water_level', description: 'Explora un sensor resistivo de superficie mojada.', objective: 'Registrar dos referencias y reconocer sus límites.', materials: ['Water Level Sensor', 'Recipiente pequeño', 'Jumpers'],
  steps: [...power('Water Level Sensor'), step('Lee su señal', 'S o SIG a GP28 / pin 34, Arduino A2. Sumerge únicamente la zona de pistas y seca el sensor al terminar. Mantén USB, placa y conectores lejos del agua.', 'S / SIG', 'GP28 · pin 34 / A2')],
  why: 'La conductividad del agua modifica la señal. La lectura depende del agua y del sensor: calibrar no la convierte automáticamente en centímetros.', code: analogPy(28, 'water_level', '%'), arduinoCode: analogIno('A2', 'water_level', '%'), expected: 'Una señal cruda que cambia al mojar más superficie. El sensor no declara por sí mismo si está conectado.', challenge: 'Define seco y tu nivel máximo seguro. ¿Qué pasa si cambias el agua?', ...common,
};

const distance: Lesson = {
  id: 'distance', title: 'Medir con un eco', kicker: 'Sensor · ultrasonido', duration: 7, sensor: 'distance', description: 'Mide tiempo de vuelo y adapta una señal de 5 V a la Pico.', objective: 'Medir distancia sin aplicar 5 V a un GPIO de 3.3 V.', materials: ['HC-SR04', '5 resistencias 1 kΩ del kit', 'Jumpers'],
  steps: [step('Alimentación separada de la señal', 'VCC a VBUS (pin 40, 5 V solo con USB conectado); GND a GND. En Arduino VCC a 5V.', 'VBUS · pin 40 / 5V', 'HC-SR04 · VCC', '#bf6a50'), step('Envía el disparo', 'TRIG a GP17 (pin 22); Arduino D7. El pulso será de 10 microsegundos.', 'GP17 · pin 22 / D7', 'HC-SR04 · TRIG'), step('Reduce ECHO antes de GP18', 'Pico: ECHO → 1 kΩ → 1 kΩ → nodo → 1 kΩ → 1 kΩ → 1 kΩ → GND. El nodo va a GP18 (pin 24): 5×3/(2+3)=3 V. Arduino Uno/Nano 5 V: ECHO puede ir a D8 sin divisor.', 'ECHO · divisor 2 kΩ / 3 kΩ', 'GP18 · pin 24 / D8', '#6c8d7a')],
  why: 'El sonido recorre ida y vuelta. Distancia = tiempo × velocidad / 2. Un timeout también puede significar objeto fuera de alcance; no garantiza sensor desconectado.',
  code: `from machine import Pin, time_pulse_us
from time import sleep, sleep_us
import json

trig = Pin(17, Pin.OUT, value=0)
echo = Pin(18, Pin.IN)
while True:
    trig.off(); sleep_us(2)
    trig.on(); sleep_us(10); trig.off()
    try:
        duration = time_pulse_us(echo, 1, 30000)
        if duration < 0: raise OSError("Sin eco dentro de 30 ms")
        cm = round(duration * 0.0343 / 2, 1)
        status = "READING" if 2 <= cm <= 400 else "OUT_OF_RANGE"
        print(json.dumps({"sensor": "distance", "value": cm, "unit": "cm", "status": status}))
    except OSError as error:
        print(json.dumps({"sensor": "distance", "value": None, "unit": "cm", "status": "NO_RESPONSE", "error": str(error)}))
    sleep(0.2)
`,
  arduinoCode: `void setup() { Serial.begin(115200); pinMode(7, OUTPUT); pinMode(8, INPUT); }
void loop() {
  digitalWrite(7, LOW); delayMicroseconds(2); digitalWrite(7, HIGH); delayMicroseconds(10); digitalWrite(7, LOW);
  unsigned long us = pulseIn(8, HIGH, 30000); float cm = us * 0.0343 / 2;
  Serial.print("{\\\"sensor\\\":\\\"distance\\\",\\\"value\\\":"); if (us) Serial.print(cm); else Serial.print("null");
  Serial.print(",\\\"unit\\\":\\\"cm\\\",\\\"status\\\":\\\""); Serial.print(!us ? "NO_RESPONSE" : (cm >= 2 && cm <= 400 ? "READING" : "OUT_OF_RANGE")); Serial.println("\\\"}"); delay(200);
}
`, expected: 'Distancia en cm de un objeto plano entre 2 y 400 cm. Superficies blandas o inclinadas pueden no devolver eco.', challenge: 'Compara con una regla. Explica por qué una tela puede dar un resultado diferente.', ...common,
};

const motion: Lesson = {
  id: 'motion', title: 'Movimiento a nuestro alrededor', kicker: 'Sensor · presencia', duration: 5, sensor: 'motion', description: 'Un PIR detecta cambios infrarrojos, no imágenes ni identidad.', objective: 'Observar una salida digital con calentamiento y retención.', materials: ['HC-SR501', 'Jumpers'],
  steps: [step('Alimenta el PIR', 'VCC a VBUS (pin 40) / Arduino 5V y GND a GND. Confirma el orden en la placa: no se deduce mirando la cúpula.', 'VBUS 5 V', 'HC-SR501 · VCC', '#bf6a50'), step('Lee OUT', 'OUT a GP19 (pin 25); Arduino D9. El HC-SR501 habitual entrega 3.3 V. Confirma ese nivel/modelo antes de conectarlo a Pico.', 'HC-SR501 · OUT', 'GP19 · pin 25 / D9'), step('Dale tiempo', 'Espera 60 segundos tras alimentar. Mueve una mano frente al sensor; los trimmers modifican sensibilidad y duración. No te quedes quieto esperando una lectura de presencia.', 'Movimiento frente a la cúpula', 'OUT · alto temporal')],
  why: 'El PIR responde a cambios de radiación infrarroja. Una persona quieta puede dejar de detectarse. Un nivel constante no permite diagnosticar un cable ausente.', code: digitalPy(19, 'motion'), arduinoCode: digitalIno(9, 'motion'), expected: '0 o 1 con estado UNVERIFIED. Un 1 puede permanecer un tiempo aunque ya no haya movimiento.', challenge: 'Compara mover la mano y mantenerla inmóvil.', ...common,
};

const core: Lesson[] = [
  { id: 'welcome', title: 'Una planta. Un pequeño mundo conectado.', kicker: '01 · Descubrir', duration: 5, description: 'De una señal eléctrica a una decisión: conoce la estación que vas a construir.', objective: 'Identificar placa, protoboard y el viaje sensor → código → red → datos.', materials: ['Pico W o Arduino Uno/Nano', 'Cable USB de datos', 'Protoboard 830 puntos', 'Una planta viva'], steps: [step('Reconoce la placa', 'Localiza USB, 3V3 y GND. En Pico el número físico del pin es distinto de GP. En Arduino los pines digitales usan D y los analógicos A.', 'USB del computador', 'USB de la placa', '#53645b'), step('Conoce la protoboard', 'Cada grupo de cinco agujeros comparte conexión. El canal central separa ambos lados y los rieles laterales distribuyen alimentación. No unas positivo y negativo.', 'Una fila de cinco agujeros', 'Un mismo nodo eléctrico'), step('Piensa como telemático', 'La sonda percibe, el microcontrolador interpreta y la red transporta. El dashboard te permite decidir con datos de tu grupo.', 'Planta → sensor → placa', 'Red → dashboard')], why: 'Ingeniería Civil Telemática conecta hardware, software y redes. Hoy veremos ese viaje completo en una maceta.', code: `import sys
from machine import Pin
print("Raíces Digitales | MicroPython", sys.version)
print("Placa lista. Próxima misión: un LED externo en GP2.")
`, arduinoCode: `void setup() { Serial.begin(115200); Serial.println("Raices Digitales | Arduino listo"); }
void loop() {}
`, expected: 'La consola confirma que puedes ejecutar código en tu placa. No necesitas sensores todavía.', challenge: 'Explica con tus palabras qué parte conecta el mundo físico con la web.', ...common },
  { id: 'led', title: 'Tu primera señal', kicker: '02 · Encender', duration: 8, description: 'Tres conexiones y una instrucción para encender un LED real.', objective: 'Construir un circuito con resistencia y controlar una salida digital.', materials: ['LED 5 mm', 'Resistencia 220 Ω', 'Jumpers', 'Protoboard'], steps: ledSteps, why: 'La salida digital entrega un nivel alto o bajo. El LED solo conduce en una dirección y la resistencia limita su corriente.', code: ledCode, arduinoCode: ledIno, expected: 'El LED se enciende al ejecutar. Cambia value(1) por value(0), o HIGH por LOW en Arduino, y repite.', challenge: 'Prueba apagarlo sin desconectar ningún cable.', sensor: 'led', ...common },
  { id: 'blink', title: 'El ritmo lo escribes tú', kicker: '03 · Programar', duration: 7, description: 'Edita el tiempo y observa el efecto en el circuito que acabas de construir.', objective: 'Comprender un bucle, una variable y una pausa.', materials: ['El circuito LED anterior'], steps: ledSteps, why: 'El mismo hardware cambia de comportamiento cuando cambia el software. Una pausa de 0.5 s encendido y 0.5 s apagado produce un ciclo completo de un segundo.', code: blinkCode, arduinoCode: blinkIno, expected: 'El LED cambia de estado y la consola lo registra. Detener interrumpe el bucle MicroPython.', challenge: 'Consigue tres ritmos distintos: lento, rápido y un pulso por segundo.', sensor: 'led', ...common },
  { ...soil, id: 'sensors', title: 'De luz a raíces', kicker: '04 · Sentir', duration: 15, description: 'Conecta primero la sonda de suelo. Si tu grupo avanza rápido, añade DHT11 o explora un sensor del laboratorio.', objective: 'Observar datos físicos reales y explicar por qué un número crudo necesita contexto.' },
  { id: 'calibration', title: 'Los números necesitan significado', kicker: '05 · Calibrar', duration: 10, description: 'Guarda una referencia seca y otra húmeda para tu propia sonda.', objective: 'Transformar una escala ADC en un porcentaje relativo reproducible.', materials: ['Sonda conectada', 'Tierra seca', 'Tierra húmeda sin inundar', 'Papel para secar'], steps: [step('Referencia seca', 'Coloca la sonda en tierra seca, espera estabilidad y registra el valor crudo en Calibración. Si usas aire como referencia, anótalo: no es igual que tierra seca.', 'Sonda · condición seca', 'Guardar referencia seca'), step('Referencia húmeda', 'Coloca la sonda en tierra húmeda y registra el raw. Mantén la electrónica seca. No tiene que ser mayor que seco: la fórmula acepta ambas direcciones.', 'Sonda · condición húmeda', 'Guardar referencia húmeda'), step('Comprueba la escala', 'El porcentaje es 100 × (raw − seco)/(húmedo − seco), limitado a 0–100. Si las referencias son casi iguales, repite. Solo compara lecturas de la misma placa y montaje.', 'Dos referencias distintas', 'Humedad relativa 0–100 %')], why: 'Un 40 % relativo no es contenido volumétrico de agua ni una recomendación universal de riego. Observa la planta y documenta el montaje.', code: analogPy(26, 'soil', '%'), arduinoCode: analogIno('A0', 'soil', '%'), expected: 'El formulario guarda dos referencias distintas. En la siguiente etapa, instala o reinstala la estación desde Configuración para incluirlas en el firmware de Pico o el sketch Arduino. Ese programa calcula el porcentaje; este ejemplo individual continúa mostrando RAW.', challenge: 'Coloca la sonda en una condición intermedia. Calcula su porcentaje con tus referencias; después compara con la estación instalada.', sensor: 'soil', ...common },
  { id: 'cloud', title: 'Tu maceta ya tiene una red', kicker: '06 · Conectar', duration: 15, description: 'Vincula tu placa a tu grupo, envía telemetría y crea una alerta con un umbral propio.', objective: 'Completar el viaje físico → código → Wi-Fi/USB → servidor → dashboard.', materials: ['Pico W con firmware de estación', 'Red Wi-Fi 2.4 GHz con acceso al servidor', 'O Arduino conectado por USB a este navegador'], steps: [step('Vincula tu grupo', 'Pulsa Conectar USB: la vinculación con tu grupo se gestiona automáticamente. En Configuración, usa Vincular e instalar estación para Pico o Compilar e instalar estación USB para Arduino. No compartas credenciales ni configures otro grupo.', 'Navegador de tu grupo', 'Tu dispositivo autorizado'), step('Activa los sensores montados', 'Habilita solamente lo que hayas cableado y luego instala la estación para aplicar sensores y calibraciones. Pico W usa Wi-Fi de 2.4 GHz; Arduino Uno/Nano transmite automáticamente por el puente USB mientras mantienes esta página y la placa conectadas.', 'Sensores y referencias del grupo', 'Programa de estación → telemetría'), step('Observa y decide', 'Abre Mi planta y verifica origen, hora y estado. Crea un umbral del suelo y provoca un cambio suave. El docente puede configurar Telegram y probar el bot con sus propias credenciales.', 'Telemetría real', 'Dashboard → alerta')], why: 'La red lleva datos a un servidor persistente. La autorización separa grupos. Una alerta solo tiene sentido con sensores verificados y calibración conocida.', code: `# Instala primero los archivos de estación desde Conectar.
# La configuración Wi-Fi y URL se genera allí, sin publicarla.
import os
if "main.py" in os.listdir():
    print("Firmware de estación instalado. Reinicia para iniciar la telemetría.")
    import machine
    machine.reset()
else:
    print("Abre Conectar e instala el firmware con tus datos Wi-Fi y vinculación.")
`, arduinoCode: analogIno('A0', 'soil', '%'), expected: 'El dashboard recibe datos de tu dispositivo. Arduino requiere mantener abierta la página con el puente USB. La primera lectura nunca se inventa.', challenge: 'Crea una alerta de suelo seco y describe dónde ocurre cada paso de la red.', ...common },
];

const extras: Lesson[] = [
  { id: 'lm35', title: 'Temperatura en voltios', kicker: 'Kit · LM35', duration: 5, sensor: 'lm35', description: 'El LM35 convierte temperatura en 10 mV por °C.', objective: 'Aplicar una escala física a un ADC.', materials: ['LM35', 'Jumpers'], steps: [step('Alimenta con 5 V', 'LM35 necesita al menos 4 V: usa VBUS pin 40 / Arduino 5V. Confirma encapsulado y ficha. En TO-92 habitual, cara plana hacia ti: +VS, VOUT, GND.', 'VBUS 5 V', 'LM35 · +VS', '#bf6a50'), step('ADC compartido', 'Retira la sonda de suelo antes de conectar VOUT a GP26 / pin 31, Arduino A0. GND común. La salida del LM35 está muy por debajo de 3.3 V en su rango de temperatura.', 'LM35 · VOUT', 'GP26 · pin 31 / A0')], why: 'El LM35 es una actividad individual: los tres ADC de la estación final ya están ocupados. La referencia ADC y la alimentación afectan la precisión.', code: `from machine import ADC, Pin
from time import sleep
adc = ADC(Pin(26))
while True:
    raw = sum(adc.read_u16() for _ in range(16)) / 16
    volts = raw * 3.3 / 65535
    print("Temperatura LM35:", round(volts * 100, 1), "°C (aproximada)")
    sleep(1)
`, arduinoCode: `void setup() { Serial.begin(115200); }
void loop() { float volts = analogRead(A0) * 5.0 / 1023.0; Serial.print("LM35 °C: "); Serial.println(volts * 100); delay(1000); }
`, expected: 'Temperatura aproximada del aula. Requiere quitar el sensor que ocupa ese ADC.', challenge: 'Calcula el voltaje esperado a 25 °C: 0.25 V.', ...common },
  { id: 'button', title: 'Una decisión con un dedo', kicker: 'Kit · pulsador', duration: 4, sensor: 'button', description: 'Lee un pulsador con pull-up interno y aprende lógica activa baja.', objective: 'Entender una entrada digital que cambia al cerrar un circuito.', materials: ['Pulsador 12×12', 'Jumpers'], steps: [step('Cruza el canal', 'Inserta el pulsador cruzando el canal central. Las dos patas de cada lado pueden estar unidas: identifica el par que conecta al pulsar.', 'Pulsador · par de contactos', 'Canal de protoboard'), step('Una entrada segura', 'Une un contacto a GP4 (pin 6) / Arduino D4 y el contacto opuesto a GND. No conectes el pulsador directamente entre 3V3 y GND.', 'GP4 · pin 6 / D4', 'Pulsador → GND')], why: 'El pull-up interno mantiene un 1 sin pulsar. Al cerrar hacia GND leemos 0. Un breve tiempo estable reduce el rebote mecánico.', code: `from machine import Pin
from time import sleep_ms
button = Pin(4, Pin.IN, Pin.PULL_UP)
previous = button.value()
while True:
    current = button.value()
    sleep_ms(20)
    if current == button.value() and current != previous:
        previous = current
        print("Pulsado" if current == 0 else "Libre")
`, arduinoCode: `void setup() { Serial.begin(115200); pinMode(4, INPUT_PULLUP); }
void loop() { Serial.println(digitalRead(4) == LOW ? "Pulsado" : "Libre"); delay(50); }
`, expected: 'Pulsado al apretar y Libre al soltar.', challenge: 'Usa el estado del pulsador para controlar el LED de GP2 / D2.', ...common },
  { id: 'buzzer', title: 'Un sonido programado', kicker: 'Kit · buzzer pasivo', duration: 4, sensor: 'buzzer', description: 'Genera un tono con PWM en un piezo pasivo del kit.', objective: 'Relacionar frecuencia y altura del sonido.', materials: ['Buzzer pasivo piezo de baja corriente', 'Resistencia 220 Ω', 'Jumpers'], steps: [step('Limita la corriente', 'Usa solo el piezo pasivo apto para GPIO. GP3 (pin 5) / Arduino D3 → 220 Ω → positivo del piezo; negativo a GND. Si es un transductor magnético o buzzer activo de consumo desconocido, no lo conectes a GPIO.', 'GP3 · pin 5 / D3 → 220 Ω', 'Piezo pasivo (+)'), step('Escucha una vez', 'Ejecuta el tono corto. Volumen bajo, sin acercar a los oídos. Un buzzer activo produce su propio tono y necesita un driver si excede la corriente GPIO.', 'PWM de 880 Hz', 'Tono corto')], why: 'PWM alterna alto y bajo a una frecuencia controlada. El buzzer pasivo necesita esa oscilación; el activo incluye su oscilador.', code: `from machine import Pin, PWM
from time import sleep
sound = PWM(Pin(3))
try:
    sound.freq(880)
    sound.duty_u16(12000)
    sleep(0.3)
finally:
    sound.duty_u16(0)
    sound.deinit()
print("Prueba terminada")
`, arduinoCode: `void setup() { tone(3, 880, 300); }
void loop() {}
`, expected: 'Un tono de 0.3 segundos, solo con un piezo pasivo de corriente segura.', challenge: 'Prueba 440 Hz y compara la altura del sonido.', ...common },
  { id: 'potentiometer', title: 'Una perilla, miles de valores', kicker: 'Kit · potenciómetro', duration: 4, sensor: 'potentiometer', description: 'Un divisor ajustable te deja explorar todo el rango ADC.', objective: 'Ver cómo una posición mecánica produce voltaje.', materials: ['Potenciómetro 10 kΩ', 'Jumpers'], steps: [step('Extremos del divisor', 'Conecta los dos extremos a 3V3 y GND; nunca 5 V con Pico.', '3V3 y GND', 'Potenciómetro · extremos'), step('El cursor', 'Desconecta primero la sonda de suelo. La pata central va a GP26 / pin 31; Arduino A0.', 'Potenciómetro · centro', 'GP26 · pin 31 / A0')], why: 'Mover el cursor cambia la proporción del divisor; la entrada ADC no necesita que pase una corriente grande.', code: `from machine import ADC, Pin
from time import sleep
adc = ADC(Pin(26))
while True:
    print("Posición:", adc.read_u16(), "/ 65535")
    sleep(0.2)
`, arduinoCode: `void setup() { Serial.begin(115200); }
void loop() { Serial.println(analogRead(A0)); delay(200); }
`, expected: 'De casi cero a casi el máximo al girar. No se suma a los tres ADC de la estación final.', challenge: 'Controla el intervalo del parpadeo con el potenciómetro.', ...common },
  { id: 'tilt', title: 'Detectar una inclinación', kicker: 'Kit · SW520D', duration: 3, sensor: 'button', description: 'Un interruptor mecánico abre o cierra según su orientación.', objective: 'Distinguir un contacto de un sensor de ángulo.', materials: ['SW520D', 'Jumpers'], steps: [step('Contacto con pull-up', 'Una pata a GP4 / pin 6, Arduino D4; la otra a GND. Retira antes el pulsador de ese pin.', 'SW520D · contacto 1', 'GP4 · pin 6 / D4'), step('Masa común', 'Conecta el segundo contacto a GND. Inclina despacio; el valor puede rebotar y depende del montaje.', 'SW520D · contacto 2', 'GND', '#53645b')], why: 'Este interruptor no mide grados ni aceleración. Sus contactos pueden oscilar al moverse.', code: `from machine import Pin
from time import sleep
tilt = Pin(4, Pin.IN, Pin.PULL_UP)
while True:
    print("Contacto:", tilt.value())
    sleep(0.1)
`, arduinoCode: `void setup() { Serial.begin(115200); pinMode(4, INPUT_PULLUP); }
void loop() { Serial.println(digitalRead(4)); delay(100); }
`, expected: '0 o 1 al cambiar la orientación.', challenge: 'Describe por qué no puedes usarlo para conocer un ángulo exacto.', ...common },
  { id: 'shift_register', title: 'Más salidas con tres hilos', kicker: 'Kit · 74HC595', duration: 8, sensor: 'shift_register', description: 'Enciende el LED desde un registro de desplazamiento del kit.', objective: 'Separar datos, reloj y latch.', materials: ['74HC595', 'LED', 'Resistencia 220 Ω', 'Protoboard y jumpers'], steps: [step('Alimentación y habilitación', '74HC595 muesca arriba: 16 VCC a 3V3, 8 GND a GND, 10 MR a 3V3 y 13 OE a GND. En Arduino Uno/Nano AVR, VCC y MR van a 5V para recibir sus señales GPIO de 5V.', 'VCC 16 / MR 10', '3V3 Pico / 5V Arduino', '#bf6a50'), step('Tres líneas de control', 'DS pin 14 a GP5 / D5; SHCP pin 11 a GP6 / D6; STCP pin 12 a GP7 / D7. La numeración del chip se cuenta alrededor de la muesca.', 'GP5, GP6, GP7', '74HC595 · DS, SHCP, STCP'), step('Salida protegida', 'Q0 pin 15 → resistencia 220 Ω → ánodo LED; cátodo a GND. No conectes motores ni todas las salidas a cargas grandes.', '74HC595 · Q0 pin 15', '220 Ω → LED → GND')], why: 'El reloj mueve un bit por vez. El latch copia ocho bits a las salidas; así tres GPIO controlan ocho señales digitales.', code: `from machine import Pin
from time import sleep
data, clock, latch = Pin(5, Pin.OUT), Pin(6, Pin.OUT), Pin(7, Pin.OUT)
def send(value):
    latch.off()
    for bit in range(7, -1, -1):
        clock.off(); data.value((value >> bit) & 1); clock.on()
    latch.on()
try:
    while True:
        send(1); sleep(0.5)
        send(0); sleep(0.5)
finally:
    send(0)
`, arduinoCode: `void setup() { pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT); }
void sendByte(byte v) { digitalWrite(7, LOW); shiftOut(5, 6, MSBFIRST, v); digitalWrite(7, HIGH); }
void loop() { sendByte(1); delay(500); sendByte(0); delay(500); }
`, expected: 'El LED en Q0 parpadea usando el registro. Verifica cada pin del chip antes de alimentar.', challenge: 'Cambia 1 por 2 y explica por qué Q0 ya no enciende.', ...common },
];

const displayPy = (four: boolean) => `from machine import Pin
from time import sleep_us

# Actividad individual: retira el montaje de estación.
# Confirma A..G y COM/D1..D4 en la ficha de TU display.
COMMON_ANODE = False  # cambia a True solo si tu modelo es ánodo común
segments = [Pin(p, Pin.OUT) for p in (5, 6, 7, 8, 9, 10, 11)]
commons = [Pin(p, Pin.OUT) for p in ${four ? '(12, 13, 14, 15)' : '(12,)'}]
# Cada COM tiene una resistencia de 1 kΩ. Solo UN LED a la vez.
digits = (0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F)
values = ${four ? '[2, 0, 2, 6]' : '[2]'}
on, off = (0, 1) if COMMON_ANODE else (1, 0)
def blank():
    for c in commons: c.value(on)  # COM inactivo
    for s in segments: s.value(off)
blank()
try:
    while True:
        for d, value in enumerate(values):
            for seg in range(7):
                blank()
                if digits[value] & (1 << seg):
                    segments[seg].value(on)
                    commons[d].value(off)
                sleep_us(700)
finally:
    blank()
`;
const displayIno = (four: boolean) => `const bool COMMON_ANODE = false; // verifica el modelo físico
const byte segments[] = {5,6,7,8,9,10,11}; // A B C D E F G
const byte commons[] = ${four ? '{A0,A1,A2,A3}' : '{A0}'};
const byte digitBits[] = {0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
const byte values[] = ${four ? '{2,0,2,6}' : '{2}'};
const byte count = ${four ? 4 : 1};
void blank() { for(byte i=0;i<count;i++) digitalWrite(commons[i],COMMON_ANODE?LOW:HIGH); for(byte i=0;i<7;i++) digitalWrite(segments[i],COMMON_ANODE?HIGH:LOW); }
void setup() { for(byte i=0;i<count;i++) pinMode(commons[i],OUTPUT); for(byte i=0;i<7;i++) pinMode(segments[i],OUTPUT); blank(); }
void loop() {
  for(byte d=0;d<count;d++) for(byte seg=0;seg<7;seg++) {
    blank();
    if(digitBits[values[d]] & (1<<seg)) { digitalWrite(segments[seg],COMMON_ANODE?LOW:HIGH); digitalWrite(commons[d],COMMON_ANODE?HIGH:LOW); }
    delayMicroseconds(700);
  }
}
`;
const advanced: Lesson[] = [
  { id: 'flame', title: 'Luz infrarroja, sin fuego', kicker: 'Kit · sensor de llama', duration: 5, sensor: 'flame', description: 'Explora una salida de comparador con el sensor óptico del kit.', objective: 'Relacionar espectro de luz, trimmer y umbral digital.', materials: ['Módulo sensor de llama del kit', 'Jumpers', 'Control remoto IR del kit'], steps: [...power('módulo de llama'), step('Una salida digital', 'DO a GP12 / pin 16; Arduino D12. Confirma que tu unidad es módulo con comparador DO, no un fotodiodo desnudo. Usa mando IR o luz ambiente como estímulo, sin encender fuego.', 'Módulo · DO', 'GP12 · pin 16 / D12'), step('Prueba un cambio', 'Ajusta el trimmer y observa si cambia al apuntar el mando o variar luz. El espectro del emisor y del detector puede impedir que un mando concreto active el umbral.', 'Trimmer y luz infrarroja', 'Comparador · 0/1')], why: 'La etiqueta llama no significa que el sensor reconozca una combustión: detecta luz en una banda y compara su intensidad. No es un sistema certificado contra incendios.', code: `from machine import Pin
from time import sleep
sensor = Pin(12, Pin.IN, Pin.PULL_UP)
while True:
    print("DO óptico:", sensor.value(), "(polaridad según módulo)")
    sleep(0.1)
`, arduinoCode: `void setup() { Serial.begin(115200); pinMode(12, INPUT_PULLUP); }
void loop() { Serial.print("DO optico: "); Serial.println(digitalRead(12)); delay(100); }
`, expected: 'Nivel digital del comparador. Anota su polaridad y limita la prueba a una fuente luminosa segura.', challenge: '¿Puede una luz no producida por fuego activar este sensor?', ...common },
  { id: 'infrared', title: 'Los mensajes invisibles del control', kicker: 'Kit · receptor IR', duration: 7, sensor: 'infrared', description: 'Decodifica el protocolo NEC frecuente en los controles del kit, sin bibliotecas externas.', objective: 'Comprender pulsos, bits y validación de un comando.', materials: ['Receptor IR', 'Control remoto IR del kit', 'Jumpers'], steps: [...power('receptor IR compatible 3.3 V'), step('Identifica OUT', 'OUT a GP13 / pin 17; Arduino D11. Confirma el modelo y su ficha: el orden de las tres patas cambia entre receptores. No conectes un pull-up a 5 V sobre Pico.', 'Receptor · OUT', 'GP13 · pin 17 / D11'), step('Recibe un comando', 'Apunta el mando y pulsa una tecla breve. Este código reconoce NEC con cabecera 9 ms/4.5 ms y valida el comando invertido; otros protocolos mostrarán ausencia de NEC válido, sin inventar teclas.', 'Pulsos infrarrojos NEC', 'Código hexadecimal')], why: 'Un receptor demodula una portadora infrarroja. La placa mide duraciones y reconstruye bits; un protocolo determina el significado.', code: `from machine import Pin, time_pulse_us
from time import sleep_ms
receiver = Pin(13, Pin.IN, Pin.PULL_UP)
print("Apunta el mando y pulsa una tecla NEC")
while True:
    try:
        mark = time_pulse_us(receiver, 0, 100000)
        if not 8000 <= mark <= 10000: continue
        space = time_pulse_us(receiver, 1, 6000)
        if not 3500 <= space <= 5500: continue
        frame = 0
        for bit in range(32):
            mark = time_pulse_us(receiver, 0, 3000)
            space = time_pulse_us(receiver, 1, 3000)
            if not 300 <= mark <= 900 or space < 300: raise ValueError("Pulso inválido")
            if space > 1100: frame |= 1 << bit
        command, inverse = (frame >> 16) & 255, (frame >> 24) & 255
        if command ^ inverse == 255:
            print("NEC:", hex(frame), "comando:", hex(command))
        else:
            print("NEC inválido: comando no coincide con su inverso")
    except (OSError, ValueError):
        sleep_ms(5)
`, arduinoCode: `const byte IR_PIN = 11;
void setup() { Serial.begin(115200); pinMode(IR_PIN, INPUT_PULLUP); }
void loop() {
  unsigned long mark=pulseIn(IR_PIN,LOW,100000); if(mark<8000 || mark>10000) return;
  unsigned long space=pulseIn(IR_PIN,HIGH,6000); if(space<3500 || space>5500) return;
  uint32_t frame=0;
  for(byte bit=0;bit<32;bit++) { mark=pulseIn(IR_PIN,LOW,3000); space=pulseIn(IR_PIN,HIGH,3000); if(mark<300 || mark>900 || space<300) return; if(space>1100) frame|=((uint32_t)1<<bit); }
  byte command=(frame>>16)&255, inverse=(frame>>24)&255;
  if((command ^ inverse)==255) { Serial.print("NEC: "); Serial.print(frame,HEX); Serial.print(" comando: "); Serial.println(command,HEX); }
}
`, expected: 'Código NEC hexadecimal si tu mando usa NEC. Mantener una tecla puede enviar una repetición, que este ejemplo omite.', challenge: 'Haz una tabla de tres teclas y sus comandos; no presupongas códigos universales.', ...common },
  { id: 'active_buzzer', title: 'Una alerta que tiene voz', kicker: 'Kit · buzzer activo + ULN2003', duration: 6, sensor: 'active_buzzer', description: 'Conmuta un buzzer activo usando el driver de potencia que sí está en el kit.', objective: 'Separar señal GPIO y corriente de una carga.', materials: ['Buzzer activo de tensión confirmada', 'ULN2003 del kit', 'Jumpers'], steps: [step('Usa un driver, no el GPIO como fuente', 'Con USB desconectado: ULN2003 GND/pin 8 a GND; COM/pin 9 al positivo de la carga para diodos de protección. Si es módulo, identifica sus terminales/OUT1 en la ficha del módulo.', 'ULN2003 · GND / COM', 'GND / VBUS 5 V'), step('La carga queda en la salida', 'Buzzer activo de 5 V: positivo a VBUS/5V; negativo a OUT1 (pin 16 del chip). No se alimenta desde GP3. Si tu buzzer es de otra tensión, ajusta según ficha sin superar su máximo.', 'Buzzer (+) a 5 V, (−) a OUT1', 'ULN2003 · canal 1', '#bf6a50'), step('Controla IN1', 'GP3/pin 5 → IN1/pin 1; Arduino D3 → IN1. El código da dos pulsos cortos y deja la carga apagada.', 'GP3 · pin 5 / D3', 'ULN2003 · IN1')], why: 'Un GPIO controla una entrada de baja corriente. El ULN2003 absorbe la corriente de la carga hacia GND; no convierte el buzzer activo en un piezo pasivo.', code: `from machine import Pin
from time import sleep
driver = Pin(3, Pin.OUT, value=0)
try:
    for _ in range(2):
        driver.on(); sleep(0.15)
        driver.off(); sleep(0.2)
finally:
    driver.off()
print("Alerta terminada")
`, arduinoCode: `void setup() { pinMode(3,OUTPUT); digitalWrite(3,LOW); for(byte i=0;i<2;i++) { digitalWrite(3,HIGH); delay(150); digitalWrite(3,LOW); delay(200); } }
void loop() {}
`, expected: 'Dos sonidos cortos en el buzzer activo si alimentación, driver y tensión de carga están validados.', challenge: 'Explica por qué se usa ULN2003 en lugar de conectar la carga a GPIO.', ...common },
  { id: 'seven_segment', title: 'Dibujar números con luz', kicker: 'Kit · display 7 segmentos', duration: 7, sensor: 'seven_segment', description: 'Recorre un segmento por vez para formar un número con corriente limitada.', objective: 'Traducir una cifra a una máscara de siete bits.', materials: ['Display 7 segmentos', '1 resistencia 1 kΩ', 'Jumpers'], steps: [step('Identifica tu display', 'Usa la ficha del modelo para localizar A–G, COM y si es ánodo o cátodo común. No existe un pinout universal. DP no se conecta. El docente identifica el modelo antes del taller.', 'Etiquetas A B C D E F G / COM', 'Pinout del modelo real'), step('Un limitador común, un LED por vez', 'COM → resistencia 1 kΩ → GP12/pin 16 (Arduino A0). Si hay dos COM, ambos van al mismo nodo antes de esa resistencia. El escaneo activa solo un segmento por vez: no cambies a varios simultáneos.', 'COM → 1 kΩ', 'GP12 · pin 16 / A0'), step('Siete líneas', 'A/B/C/D/E/F/G a GP5/6/7/8/9/10/11 (pines físicos 7/9/10/11/12/14/15). Arduino D5–D11. Ajusta COMMON_ANODE según el componente.', 'Segmentos A–G', 'GPIO del código')], why: 'Con un único segmento encendido, la resistencia compartida limita un único camino de corriente. La persistencia visual reúne los segmentos escaneados en una cifra.', code: displayPy(false), arduinoCode: displayIno(false), expected: 'Cifra 2, algo tenue por el escaneo. Cambia values entre 0 y 9.', challenge: 'Explica por qué encender varios segmentos a la vez invalidaría este presupuesto de corriente.', ...common },
  { id: 'four_digit', title: 'Cuatro cifras, una secuencia', kicker: 'Kit · display 4 dígitos', duration: 9, sensor: 'four_digit', description: 'Multiplexa un solo LED a la vez entre cuatro dígitos para mostrar 2026.', objective: 'Entender selección de dígito y refresco.', materials: ['Display 4 dígitos', '4 resistencias 1 kΩ', 'Jumpers'], steps: [step('Identifica las doce patas', 'Confirma modelo, polaridad común, A–G y D1–D4 en la ficha. Las posiciones varían. DP permanece desconectado.', 'Display real · A–G y D1–D4', 'Ficha del fabricante'), step('Limita cada común', 'Cada D1/D2/D3/D4 lleva su propia resistencia 1 kΩ hacia GP12/13/14/15 (pines 16/17/19/20). Arduino A0/A1/A2/A3. Nunca unes cuatro comunes a un mismo GPIO.', 'D1–D4 → 4×1 kΩ', 'GP12–GP15 / A0–A3'), step('Segmentos y escaneo', 'A–G a GP5/6/7/8/9/10/11; Arduino D5–D11. El software apaga todo antes de activar una pareja dígito/segmento. Solo un LED conduce en cada instante.', 'A B C D E F G', 'GPIO del código')], why: 'Multiplexar comparte pines entre dígitos. Un único LED activo por instante mantiene la corriente dentro del límite usando el kit y sin inventar transistores adicionales.', code: displayPy(true), arduinoCode: displayIno(true), expected: '2026 tenue pero estable; si el refresco no es visible en tu módulo, empieza probando un solo segmento y revisa polaridad/pinout.', challenge: 'Modifica values para mostrar el número de tu grupo en cuatro posiciones.', ...common },
  { id: 'matrix', title: 'Una semilla de 64 píxeles', kicker: 'Kit · matriz 8×8', duration: 10, sensor: 'matrix', description: 'Dibuja una hoja con la matriz desnuda del kit, sin asumir un módulo MAX7219.', objective: 'Usar filas, columnas y mapas de bits.', materials: ['Matriz 8×8 desnuda', '5 resistencias 1 kΩ y 3 resistencias 10 kΩ', 'Jumpers'], steps: [step('Identifica filas y columnas', 'Consulta el modelo real para R1–R8/C1–C8 y polaridad. En este código ROW_ANODE=True significa filas ánodo; cambia solo si tu ficha confirma lo contrario. No se presupone MAX7219.', 'Matriz · R1–R8 y C1–C8', 'Pinout verificado'), step('Una resistencia por fila', 'R1–R5 por 1 kΩ y R6–R8 por 10 kΩ; salidas GPIO0–7 (pines físicos 1/2/4/5/6/7/9/10). Las últimas tres filas serán más tenues. Arduino filas D2–D9.', '8 filas con 8 limitadores', 'GP0–GP7 / D2–D9'), step('Conecta columnas', 'Columnas C1–C8 a GP8–GP15 (pines 11/12/14/15/16/17/19/20). Arduino D10/D11/D12/D13/A0/A1/A2/A3. El código enciende un solo píxel por vez y apaga la matriz al interrumpir.', 'C1–C8', 'GPIO de columnas')], why: 'La matriz tiene 64 LED pero comparte ocho filas y ocho columnas. Activar una intersección identifica un píxel. El refresco rápido crea una imagen persistente.', code: `from machine import Pin
from time import sleep_us
ROW_ANODE = True  # confirmar polaridad del modelo
rows = [Pin(p, Pin.OUT) for p in range(8)]
cols = [Pin(p, Pin.OUT) for p in range(8, 16)]
bitmap = [0x18, 0x3C, 0x7E, 0xDB, 0x7E, 0x3C, 0x18, 0x18]
def blank():
    for r in rows: r.value(0 if ROW_ANODE else 1)
    for c in cols: c.value(1 if ROW_ANODE else 0)
blank()
try:
    while True:
        for y in range(8):
            for x in range(8):
                blank()
                if bitmap[y] & (1 << (7-x)):
                    rows[y].value(1 if ROW_ANODE else 0)
                    cols[x].value(0 if ROW_ANODE else 1)
                sleep_us(150)
finally:
    blank()
`, arduinoCode: `const bool ROW_ANODE=true;
const byte rows[]={2,3,4,5,6,7,8,9};
const byte cols[]={10,11,12,13,A0,A1,A2,A3};
const byte bitmap[]={0x18,0x3C,0x7E,0xDB,0x7E,0x3C,0x18,0x18};
void blank() { for(byte i=0;i<8;i++) { digitalWrite(rows[i],ROW_ANODE?LOW:HIGH); digitalWrite(cols[i],ROW_ANODE?HIGH:LOW); } }
void setup() { for(byte i=0;i<8;i++) { pinMode(rows[i],OUTPUT); pinMode(cols[i],OUTPUT); } blank(); }
void loop() { for(byte y=0;y<8;y++) for(byte x=0;x<8;x++) { blank(); if(bitmap[y]&(1<<(7-x))) { digitalWrite(rows[y],ROW_ANODE?HIGH:LOW); digitalWrite(cols[x],ROW_ANODE?LOW:HIGH); } delayMicroseconds(150); } }
`, expected: 'Una figura de hoja. Diferente brillo en filas por las resistencias disponibles, sin pedir ocho resistencias adicionales.', challenge: 'Crea otra figura editando los ocho bytes; cada bit es un píxel.', ...common },
  { id: 'lcd', title: 'Un mensaje que sale del computador', kicker: 'Kit · LCD 16×2 paralelo', duration: 10, sensor: 'lcd', description: 'Escribe dos líneas con el LCD disponible, sin un adaptador I2C inexistente.', objective: 'Comprender bus de cuatro bits y una señal enable.', materials: ['LCD 16×2 compatible HD44780', 'Potenciómetro 10 kΩ', 'Resistencia 220 Ω para backlight', 'Jumpers'], steps: [step('Alimentación, contraste y solo escritura', 'LCD VSS/pin1 a GND, VDD/pin2 a VBUS/5V. Potenciómetro extremos a 5V/GND y cursor a V0/pin3. RW/pin5 SIEMPRE a GND: la LCD no debe devolver 5V al GPIO. Confirma que el controlador acepta alto de 3.3V antes de usar Pico.', 'LCD 1 GND, 2 5V, 3 contraste, 5 GND', 'Alimentación y modo escritura'), step('Bus de cuatro bits', 'RS/pin4 a GP5, E/pin6 a GP6, D4/pin11 a GP7, D5/pin12 a GP8, D6/pin13 a GP9 y D7/pin14 a GP10. Arduino RS=D5, E=D6, D4–D7=D7–D10. LCD D0–D3 sin conexión.', 'RS, E, D4, D5, D6, D7', 'GP5–GP10 / D5–D10'), step('Backlight con resistencia', 'Si tu LCD tiene A/pin15 y K/pin16, A a 5V mediante 220 Ω, K a GND. Confirma límites del módulo; la resistencia se conserva aunque lleve una interna. Ajusta contraste hasta ver las letras.', '5V → 220 Ω → A / K → GND', 'Backlight LCD')], why: 'Cada byte viaja como dos grupos de cuatro bits. Enable permite capturarlos. Escribir solamente y mantener RW a GND evita que la pantalla conduzca señales de 5 V hacia Pico.', code: `from machine import Pin
from time import sleep_ms, sleep_us
rs, enable = Pin(5, Pin.OUT, value=0), Pin(6, Pin.OUT, value=0)
data = [Pin(p, Pin.OUT, value=0) for p in (7, 8, 9, 10)]
def nibble(value):
    for bit, pin in enumerate(data): pin.value((value >> bit) & 1)
    enable.on(); sleep_us(2); enable.off(); sleep_us(60)
def send(value, is_data=False):
    rs.value(is_data); nibble(value >> 4); nibble(value & 15)
    if value in (1, 2) and not is_data: sleep_ms(2)
sleep_ms(50)
nibble(3); sleep_ms(5); nibble(3); sleep_ms(1); nibble(3); nibble(2)
for command in (0x28, 0x0C, 0x06, 0x01): send(command)
for row, text in enumerate(("Raices Digitales", "Hola, planta!")):
    send(0x80 + (0x40 if row else 0))
    for char in text[:16]: send(ord(char), True)
print("Mensaje escrito. Ajusta el contraste si no aparece.")
`, arduinoCode: `const byte RS=5, EN=6, DATA[]={7,8,9,10};
void nibble(byte v) { for(byte i=0;i<4;i++) digitalWrite(DATA[i],(v>>i)&1); digitalWrite(EN,HIGH); delayMicroseconds(2); digitalWrite(EN,LOW); delayMicroseconds(60); }
void sendByte(byte v,bool isData=false) { digitalWrite(RS,isData); nibble(v>>4); nibble(v&15); if(!isData && (v==1 || v==2)) delay(2); }
void text(const char* s) { while(*s) sendByte(*s++,true); }
void setup() {
  pinMode(RS,OUTPUT); pinMode(EN,OUTPUT); digitalWrite(RS,LOW); digitalWrite(EN,LOW); for(byte i=0;i<4;i++) pinMode(DATA[i],OUTPUT);
  delay(50); nibble(3); delay(5); nibble(3); delay(1); nibble(3); nibble(2);
  sendByte(0x28); sendByte(0x0C); sendByte(0x06); sendByte(0x01);
  sendByte(0x80); text("Raices Digitales"); sendByte(0xC0); text("Hola, planta!");
}
void loop() {}
`, expected: 'Dos líneas de texto. Si solo hay bloques, revisa contraste y enable. Tu módulo necesita alto lógico compatible con Pico para este cableado.', challenge: 'Sustituye la segunda línea por el nombre de tu grupo, máximo 16 caracteres ASCII.', ...common },
  { id: 'stepper', title: 'Mover con una secuencia', kicker: 'Kit · motor 5 V + ULN2003', duration: 8, sensor: 'stepper', description: 'Activa una sola bobina cada vez a través del driver incluido.', objective: 'Entender por qué los motores necesitan electrónica de potencia.', materials: ['Motor paso a paso 5 V del kit', 'ULN2003', 'Jumpers'], steps: [step('Valida el consumo del motor real', 'Actividad individual, con los demás sensores y Wi-Fi desconectados. El docente verifica motor unipolar 5V, corriente de UNA bobina y presupuesto USB antes de conectar VBUS. No usar el soporte 9V directamente.', 'Motor 5V / corriente de una bobina', 'Presupuesto de alimentación validado'), step('Driver y protección', 'Motor al conector del módulo ULN2003. VCC del módulo/común del motor y COM/pin9 a VBUS/5V, GND/pin8 a GND. IN1/2/3/4 a GP20/21/22/0 (pines26/27/29/1); Arduino D4/5/6/7. Con ULN2003 desnudo, verifica salidas 16/15/14/13 hacia las bobinas.', 'GPIO → IN1–IN4 · ULN2003', 'Bobinas del motor · nunca directo GPIO'), step('Gira y libera', 'Se ejecutan 128 pasos en un sentido y 128 al volver, solo una bobina activa. El ángulo depende del motor y caja reductora; no se fija un valor universal. Al terminar todas las bobinas quedan apagadas.', 'Secuencia 1000 → 0100 → 0010 → 0001', '128 pasos + regreso')], why: 'Un GPIO entrega una señal; el ULN2003 conmuta la corriente del motor y sus diodos limitan transitorios. Una bobina activa reduce consumo y torque frente a dos bobinas.', code: `from machine import Pin
from time import sleep_ms
import network
network.WLAN(network.STA_IF).active(False)
pins = [Pin(p, Pin.OUT, value=0) for p in (20, 21, 22, 0)]
def off():
    for pin in pins: pin.off()
try:
    for direction in (1, -1):
        for step in range(128):
            off()
            pins[(step * direction) % 4].on()
            sleep_ms(8)
        off(); sleep_ms(300)
finally:
    off()
print("Motor liberado")
`, arduinoCode: `const byte PINS[]={4,5,6,7};
void off() { for(byte i=0;i<4;i++) digitalWrite(PINS[i],LOW); }
void setup() { for(byte i=0;i<4;i++) pinMode(PINS[i],OUTPUT); off(); for(int direction=1;direction>=-1;direction-=2) { for(int step=0;step<128;step++) { off(); digitalWrite(PINS[(step*direction+512)%4],HIGH); delay(8); } off(); delay(300); } }
void loop() {}
`, expected: 'Movimiento suave y regreso si el orden de bobinas, torque y presupuesto eléctrico están verificados. Sin torque de retención al terminar.', challenge: 'Invierte la secuencia y compara dirección, sin aumentar corriente ni activar varias bobinas.', ...common },
  { id: 'servo', title: 'Una posición escrita en un pulso', kicker: 'Kit · SG90 y presupuesto de potencia', duration: 7, sensor: 'servo', description: 'Genera la señal de un servo y aprende a separar control de alimentación.', objective: 'Relacionar duración del pulso y posición sin exceder la fuente disponible.', materials: ['SG90', 'LED + 1 kΩ para explorar la señal con el kit actual', 'Jumpers'], steps: [step('Con el inventario actual, explora la señal', 'GP20/pin26 (Arduino D10) → 1 kΩ → LED → GND permite comprobar que hay pulsos. VCC del SG90 queda desconectado: el fabricante pide fuente externa y no se garantiza corriente suficiente en USB/Pico. No usar 9V directo ni 3V3.', 'PWM GP20 · pin26 / D10', '1 kΩ → LED → GND'), step('Movimiento solo con fuente validada', 'Para mover realmente SG90, el docente debe contar con alimentación regulada 4.8–6V que cubra sus picos y verificar el modelo. Esa fuente no está en el inventario y no se presupone. GND común, señal al GPIO y potencia independiente.', 'SG90 · señal / GND / VCC', 'Fuente de potencia validada fuera del kit'), step('Pulso, no voltaje analógico', 'El código genera 50Hz y tres anchos próximos al centro (1.3/1.5/1.7ms) durante un tiempo acotado. Con el LED se ve una señal tenue; sin fuente validada no se afirma que el eje se mueve.', 'Periodo 20ms · ancho 1.3–1.7ms', 'Información de posición')], why: 'PWM de servo codifica una orden, pero la potencia para mover el motor viene de otra conexión. El SG90 no se conduce mediante ULN2003 y no se alimenta a 9V.', code: `from machine import Pin, PWM
from time import sleep
signal = PWM(Pin(20))
signal.freq(50)
try:
    for micros in (1300, 1500, 1700, 1500):
        signal.duty_u16(int(micros * 65535 / 20000))
        print("Pulso:", micros, "µs; periodo 20000 µs")
        sleep(0.5)
finally:
    signal.duty_u16(0)
    signal.deinit()
print("Señal apagada. La alimentación del motor debe estar validada aparte.")
`, arduinoCode: `const byte SIGNAL=10;
void setup() { Serial.begin(115200); pinMode(SIGNAL,OUTPUT); const int widths[]={1300,1500,1700,1500}; for(byte w=0;w<4;w++) { Serial.print("Pulso us: "); Serial.println(widths[w]); for(byte i=0;i<25;i++) { digitalWrite(SIGNAL,HIGH); delayMicroseconds(widths[w]); digitalWrite(SIGNAL,LOW); delayMicroseconds(20000-widths[w]); } } digitalWrite(SIGNAL,LOW); }
void loop() {}
`, expected: 'Pulsos reales en GPIO y LED tenue con el material actual. Movimiento SG90 queda fuera del taller base hasta disponer de fuente regulada validada.', challenge: 'Explica por qué una señal correcta no garantiza que exista potencia suficiente para mover un motor.', ...common },
];

export const lessons: Lesson[] = [...core, soil, dht, ds, ldr, rain, water, distance, motion, ...extras, ...advanced];
