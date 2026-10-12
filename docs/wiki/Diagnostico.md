# Diagnóstico

Empieza con el mensaje exacto, la placa/variante seleccionada, navegador, actividad y última acción que funcionó. Cambia una condición a la vez. Nunca envíes claves Wi-Fi, `.env`, `config.json`, tokens, cookies, datos de grupos o archivos SQLite.

| Síntoma | Revisar |
| --- | --- |
| No aparece selector USB | Chrome/Edge escritorio, HTTPS, cable con datos y permiso del sitio. |
| Puerto ocupado | Cierra Thonny, IDE/monitor serial y otras pestañas; reconecta y autoriza de nuevo. |
| Error STK500 o bootloader | Confirma Uno/Nano, selección Nano antiguo cuando aplique, driver del puente USB, puerto libre y reset. Verifica que MCU y bootloader reales correspondan al perfil. |
| Firma AVR incorrecta | Detén la carga; no fuerces otra placa. Confirma ATmega y selección. El cargador debe rechazarla antes de escribir. |
| Compilación Arduino no disponible | Comprueba `/api/health`, servicio Arduino CLI y core AVR. La compilación del servidor y la carga USB son etapas distintas. |
| Pico no ejecuta REPL | Usa MicroPython oficial del modelo exacto, no CircuitPython/Arduino; cierra otro cliente serial. |
| Pico Wi-Fi no conecta | Solo modelos W; SSID de 2.4 GHz, endpoint HTTPS público y certificado/CA confiables. USB puede seguir sirviendo como puente desde una computadora en línea. |
| WebGL no carga | Usa la vista 2D y los pasos textuales; revisa navegador/controlador GPU. |
| Sensor no responde | Verifica pinout del módulo comprado, alimentación/señal y la guía de [hardware](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/HARDWARE.md). Un ADC numérico no prueba que haya un sensor conectado. |

Lista completa y más síntomas: [TROUBLESHOOTING.md](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/TROUBLESHOOTING.md). Comparte solo el error sanitizado y los pasos de reproducción.
