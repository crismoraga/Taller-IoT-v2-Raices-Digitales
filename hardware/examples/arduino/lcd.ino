const byte RS=5, EN=6, DATA[]={7,8,9,10};
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
