# Cableado y modelos 2D/3D

El paso activo resalta una sola conexión y nombra cada extremo. El plano SVG y la vista Three.js consumen el mismo modelo de `web/circuit/`, por lo que una conexión puede contrastarse en ambos modos. Las guías identifican terminales con fila/columna y pin lógico/físico.

Para modificar una actividad:

1. Define el circuito y sus nodos/piezas en el módulo de la actividad.
2. Usa coordenadas y endpoints existentes del modelo eléctrico; no dibujes una conexión paralela a mano en la escena.
3. Ajusta la instrucción para nombrar origen, destino y cantidad de cables en una sola acción.
4. Comprueba cambio de placa, paso pendiente, siguiente/anterior, recarga y selección de vista 2D/3D.
5. Añade o adapta una prueba de geometría/netlist y de interacción.

El render es una ayuda de montaje: encapsulados pueden ser aproximados y las placas/módulos del mercado varían. Sigue la identificación real de pines impresos en el componente y [el mapa de hardware](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/HARDWARE.md). Si WebGL no está disponible, conserva el plano 2D e instrucciones accesibles.
