# Contribuir a Raíces Digitales

Gracias por mejorar el taller. Para que el cambio sea fácil de revisar, describe qué necesita hacer una persona y qué cambia en su experiencia.

## Antes de proponer un cambio

1. Busca issues y documentación para evitar trabajo duplicado.
2. Lee [Desarrollo](docs/DEVELOPMENT.md), [arquitectura](docs/ARCHITECTURE.md) y la [matriz de placas](docs/SUPPORTED_BOARDS.md) si afecta hardware.
3. Crea una rama con un nombre corto que indique el área.
4. Mantén el cambio enfocado y actualiza la documentación cercana.
5. Ejecuta comprobaciones adecuadas y anota exactamente cuáles; distingue simulación, compilación y hardware físico.

## Pull requests

Incluye:

- problema y resultado observable;
- módulos/placas/versiones afectadas;
- pruebas ejecutadas y fallos conocidos;
- capturas solo cuando ayudan y están libres de datos privados.

Evita incluir `node_modules/`, `dist/`, `data/`, `tools/`, binarios temporales, configuraciones de placas y credenciales. No subas `.env`, Wi-Fi, tokens, cookies, identificadores de grupos, base de datos, `config.json` ni capturas que los expongan.

## Código y experiencia

- Conserva accesibilidad de teclado, foco visible, contraste, tema oscuro, movimiento reducido y alternativa sin WebGL.
- Mantén las lecturas reales separadas de datos de simulación y animaciones explicativas.
- Para conexiones, actualiza el modelo común para ambas vistas 2D y 3D.
- Para sensores, conserva estados, unidad, rango, validación y fallos independientes.
- Para hardware nuevo, documenta MCU, pinout, protocolo/bootloader, firma, velocidades y limitaciones. No marques compatibilidad sin evidencia.
- Revisa licencias y atribución de código, imágenes, iconos, fuentes y firmware externos. Este repositorio aún no declara una licencia general.

Si descubres una vulnerabilidad, no publiques credenciales ni un exploit funcional en un issue público. Usa el canal privado de seguridad habilitado por GitHub en la página del repositorio; si no está disponible, contacta al mantenedor mediante la información pública de su perfil.
