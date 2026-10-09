# Experiencias 3D

Los dos componentes utilizan React Three Fiber y geometría procedural local. No solicitan modelos, fuentes ni texturas a un CDN.

```tsx
import { LivingStation, CircuitExperience } from "../experience";
import { circuits } from "../circuit/layouts";

<LivingStation mode="hero" />
<CircuitExperience circuit={circuits.led} activeStep={2} mode="step" />
```

`LivingStation` presenta la relación planta → sensor → microcontrolador → red → dashboard. La planta, la maceta y los circuitos de esta composición son ilustrativos. Las partículas representan información conceptual; no son telemetría. La selección de cada parte explica su función. El botón **Raíces** hace transparente la maceta para mostrar el sistema radicular.

`CircuitExperience` muestra el montaje concreto de una actividad. Usa `pointXY`, `endpointXY`, `moduleBox` y `PICO_PINS` del mismo modelo que genera la vista 2D y alimenta las pruebas eléctricas. El escalado de dibujo a coordenadas 3D se aplica una sola vez y conserva cada agujero y terminal. `activeStep` es un índice desde cero. En modo `step`, el futuro se oculta, lo anterior se atenúa y el paso actual destaca sus terminales. En modo `all`, se muestra el montaje terminado. Las formas de los encapsulados son representaciones aproximadas; las marcas impresas de cada módulo físico se deben comprobar antes de cablear.

El recorrido animado del circuito está desactivado inicialmente y siempre se identifica como ilustrativo. Su brillo no afirma que una placa esté energizada. Para comprobar el circuito real se usa el programa de la actividad y su salida serial.

Ambas vistas tienen controles de cámara, selección equivalente con teclado, pausa y soporte para `prefers-reduced-motion`. Los renders continuos se detienen fuera de la ventana visible o en una pestaña en segundo plano. Cuando no se dispone de WebGL o se pierde el contexto, aparece una explicación y permanece disponible la guía textual; el montaje 2D de la actividad es la alternativa funcional.

La cámara del circuito encuadra la caja completa de la protoboard y sus módulos externos según la proporción real del canvas. Comprueba sus ocho esquinas contra los campos de visión horizontal y vertical, reservando margen. El encuadre se recalcula al cambiar tamaño de pantalla; **Restablecer** y **Vista superior** conservan esa regla. No usa la ventana parcial del plano 2D para recortar la protoboard 3D.

La revisión de TypeScript y los 71 casos de `tests/circuit.test.ts` verifican integración y modelo eléctrico. La apariencia de los renders se revisa mediante la prueba visual del taller. Una prueba de navegador no reemplaza la validación con la placa y los módulos del kit físico.
