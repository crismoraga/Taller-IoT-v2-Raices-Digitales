# Instala primero los archivos de estación desde Conectar.
# La configuración Wi-Fi y URL se genera allí, sin publicarla.
import os
if "main.py" in os.listdir():
    print("Firmware de estación instalado. Reinicia para iniciar la telemetría.")
    import machine
    machine.reset()
else:
    print("Abre Conectar e instala el firmware con tus datos Wi-Fi y vinculación.")
