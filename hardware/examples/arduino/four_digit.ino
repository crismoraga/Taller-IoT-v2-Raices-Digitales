const bool COMMON_ANODE = false; // verifica el modelo físico
const byte segments[] = {5,6,7,8,9,10,11}; // A B C D E F G
const byte commons[] = {A0,A1,A2,A3};
const byte digitBits[] = {0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
const byte values[] = {2,0,2,6};
const byte count = 4;
void blank() { for(byte i=0;i<count;i++) digitalWrite(commons[i],COMMON_ANODE?LOW:HIGH); for(byte i=0;i<7;i++) digitalWrite(segments[i],COMMON_ANODE?HIGH:LOW); }
void setup() { for(byte i=0;i<count;i++) pinMode(commons[i],OUTPUT); for(byte i=0;i<7;i++) pinMode(segments[i],OUTPUT); blank(); }
void loop() {
  for(byte d=0;d<count;d++) for(byte seg=0;seg<7;seg++) {
    blank();
    if(digitBits[values[d]] & (1<<seg)) { digitalWrite(segments[seg],COMMON_ANODE?LOW:HIGH); digitalWrite(commons[d],COMMON_ANODE?HIGH:LOW); }
    delayMicroseconds(700);
  }
}
