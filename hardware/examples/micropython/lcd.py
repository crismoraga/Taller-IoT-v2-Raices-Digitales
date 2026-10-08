from machine import Pin
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
