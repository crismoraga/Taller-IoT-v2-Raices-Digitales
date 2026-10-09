# Identidad Raíces Digitales

La identidad del laboratorio vivo combina naturaleza y telemática: bosque nocturno, papel cálido, señal lima, cobre y cian. Adapta los recursos declarativos SoyTEL presentes en `web/brand/graphics/` (Rutix, emblemas, iconos, medallas, patrones e ilustraciones) y el emblema de Telemática disponible en `public/brand/`, con escenas y lenguaje nuevos para la planta. Marca provisional del taller; referencia institucional: https://telematica.usm.cl/.

Tokens activos en `web/brand/tokens.css`, utilidades en `web/index.css`, y estilos operativos en `web/legacy.css`. Display: Montserrat Variable; texto: Nunito Sans Variable; código: JetBrains Mono Variable. Se sirve el subconjunto latino de las tres fuentes desde el bundle local, con licencias OFL en `public/fonts/`. No hay dependencias de Google Fonts o CDN durante el taller.

| Función | Color |
|---|---|
| Bosque | #0c302b |
| Noche | #071d1b |
| Papel | #f4f4ec |
| Superficie | #fffef8 |
| Señal lima | #d0ef83 |
| Cian de red | #6addde |
| Cobre | #dc916e |
| Tinta | #143c32 |

Las superficies, tintas y estados se adaptan juntos al tema oscuro. La elección claro/oscuro/automático persiste; automático responde al sistema. Las animaciones de entrada, redes, hojas, raíces y puntos de señal se reducen según la preferencia de movimiento. Las escenas se pausan al quedar fuera de pantalla o al ocultar la pestaña, con límites de densidad de píxeles.

La portada «Haz que tu planta hable» permite explorar planta, sensor, Pico y red en Three.js. Los flujos tienen etiqueta ilustrativa, y las cifras reales sólo aparecen con USB/API. El modelo procedural incluye raíces visibles, maceta, placa y sensores; todos los recursos se generan localmente. Cada componente se selecciona también con teclado.

La guía divide el montaje en acciones individuales con nombres, voltajes, polaridad, resistencias y coordenadas de agujeros. Three.js y SVG 2D usan el mismo modelo eléctrico de `web/circuit/`. Los colores de cables son apoyo visual: los extremos y funciones siempre tienen texto. La cámara se encuadra según circuito y pantalla; selección, vista superior, zoom, pausa y reset están implementados.

El editor se carga al abrir Programa/Experimenta. Ofrece código real MicroPython/C++, modificaciones guiadas reversibles, borradores por grupo, terminal y requisitos explícitos. Los checkpoints explican los aciertos; las pistas y soluciones respetan la placa elegida. Datos de práctica se identifican como simulación.

La interfaz incluye objetivos claros, avance, cinco fases por actividad, controles táctiles, etiquetas, foco visible, skip link, diálogos nativos y navegación móvil por teclado. El recorrido esencial estima 60 minutos; la biblioteca adicional se explora fuera de esa ruta.
