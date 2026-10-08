const bool ROW_ANODE=true;
const byte rows[]={2,3,4,5,6,7,8,9};
const byte cols[]={10,11,12,13,A0,A1,A2,A3};
const byte bitmap[]={0x18,0x3C,0x7E,0xDB,0x7E,0x3C,0x18,0x18};
void blank() { for(byte i=0;i<8;i++) { digitalWrite(rows[i],ROW_ANODE?LOW:HIGH); digitalWrite(cols[i],ROW_ANODE?HIGH:LOW); } }
void setup() { for(byte i=0;i<8;i++) { pinMode(rows[i],OUTPUT); pinMode(cols[i],OUTPUT); } blank(); }
void loop() { for(byte y=0;y<8;y++) for(byte x=0;x<8;x++) { blank(); if(bitmap[y]&(1<<(7-x))) { digitalWrite(rows[y],ROW_ANODE?HIGH:LOW); digitalWrite(cols[x],ROW_ANODE?LOW:HIGH); } delayMicroseconds(150); } }
