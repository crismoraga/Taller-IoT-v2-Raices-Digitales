const unsigned long intervalo = 500; // milisegundos
void setup() { Serial.begin(115200); pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); Serial.println("LED: 1"); delay(intervalo); digitalWrite(2, LOW); Serial.println("LED: 0"); delay(intervalo); }
