const byte PINS[]={4,5,6,7};
void off() { for(byte i=0;i<4;i++) digitalWrite(PINS[i],LOW); }
void setup() { for(byte i=0;i<4;i++) pinMode(PINS[i],OUTPUT); off(); for(int direction=1;direction>=-1;direction-=2) { for(int step=0;step<128;step++) { off(); digitalWrite(PINS[(step*direction+512)%4],HIGH); delay(8); } off(); delay(300); } }
void loop() {}
