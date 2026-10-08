const byte IR_PIN = 11;
void setup() { Serial.begin(115200); pinMode(IR_PIN, INPUT_PULLUP); }
void loop() {
  unsigned long mark=pulseIn(IR_PIN,LOW,100000); if(mark<8000 || mark>10000) return;
  unsigned long space=pulseIn(IR_PIN,HIGH,6000); if(space<3500 || space>5500) return;
  uint32_t frame=0;
  for(byte bit=0;bit<32;bit++) { mark=pulseIn(IR_PIN,LOW,3000); space=pulseIn(IR_PIN,HIGH,3000); if(mark<300 || mark>900 || space<300) return; if(space>1100) frame|=((uint32_t)1<<bit); }
  byte command=(frame>>16)&255, inverse=(frame>>24)&255;
  if((command ^ inverse)==255) { Serial.print("NEC: "); Serial.print(frame,HEX); Serial.print(" comando: "); Serial.println(command,HEX); }
}
