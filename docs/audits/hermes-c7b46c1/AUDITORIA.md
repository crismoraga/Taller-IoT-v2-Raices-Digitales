# Auditoría Raíces Digitales: placas, práctica guiada y publicación

## Estado auditado

- Repo: G:/RaicesDigitales. Origin: https://github.com/crismoraga/Taller-IoT-v2---Ra-ces-Digitales.git
- HEAD: c7b46c1da421945e5a9f46dc5e4fc58428b9d9a4; rama v2-mejora-total.
- Snapshot tomada 2026-10-09T03:20:22.970967+00:00 de **226 archivos** del árbol de trabajo, incluidos cambios tracked/untracked en curso. No equivale a auditar solo HEAD. No se hizo stash, reset ni clean. Se excluyeron secretos, .env real, .claude/worktrees, .vercel y dependencias/tools/build.
- Sesión existente Claude: 012014df-1f03-47d6-b459-ab9f5ff16273, nombre raicesdigitales-1b, PID10812 al descubrir. VS Code estaba abierto en este proyecto y el selector mostraba Opus5.5 Max. Esas IDs de ventana/proceso son efímeras.
- 22 observaciones: {'P1': 7, 'P2': 15}. Hay duplicados semánticos CIR-07/CH-03 (energía física), BD-03/CH-09 (offline y errores HTTP), CIR-01/CH-08 (placa y contenido). No son22 bugs independientes ni todos están reproducidos runtime. Evidencia por área debajo y confianza original conservada.

## Comprobaciones reales del coordinador

Ejecutadas en snapshot aislada usando las dependencias actuales vía junction read-only al node_modules del original; esto **NO es instalación limpia reproducible**.

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`: exit0.
- `npm test`:315 tests aprobados en5 archivos.
- `npm run test:firmware`:14 tests aprobados. Usa peers/mocks, no certifica placas físicas.
- `npm run build`: exit0, build Vite y caché offline45 assets. Advertencia de chunk editor~2.386MB sin gzip; 3D~909KB y app~575KB. Mejorar lazy loading/budget sin cambiar un warning por éxito de rendimiento.
- E2E:17/17 aprobados en1,9min, Chrome headless, API/SQLite temporal independiente en3107. Datos/credenciales de prueba sintéticos en memoria/environment, sin acceder aUSB real, Telegram, DB productiva ni cambiar grupos del servidor original. Peer USB prueba protocolo simulado, NO hardware real.
- **Regresión del síntoma del usuario: FALLA esperada (exit1).** Abrir /taller/welcome → Conecta → seleccionar Arduino Uno. selector.value='uno', heading='La protoboard y la Pico W, por dentro', SVG sigue con 'Raspberry Pi Pico W' y GP0…GP28. No es que selector no cambie: los renderizadores/modelos no resuelven board.
- Evidencia parent: `C:/Users/Cris/AppData/Local/hermes/cache/scratch/raices-audit/board-regression.json`, `board-uno-shows-pico.png`, `source/parent-board-repro.mjs`. Browser CDP dio el mismo resultado por separado. La regresión no modifica fuente ni hace llamadas mutadoras aAPI del original.
- Las E2E existentes prueban tabla Arduino y casillas/siguiente, **NO** cambio de geometría welcome ni cableado manual. Por eso315+14+17 pasan y el defecto persiste.

## Publicación: límites y hallazgo adicional del coordinador

El proyecto está vinculado localmente a un proyecto Vercel llamado raices-digitales. Eso no demuestra un deployment funcional ni autoriza adivinar su dominio. La CLI `vercel` no está enPATH. El candidato `https://raices-digitales.vercel.app` dio200 pero el título/contenido recuperados son **Raíces Digitales — Patrimonio Cultural**, NO este taller; `/api/health` devolvióNOT_FOUND. No atribuir ese sitio al proyecto ni sobrescribirlo: resolver projectId/team/deployments reales de la vinculación y verificar identidad.

Fastify SÍ está soportado actualmente por Vercel, pero esto no vuelve persistentes SQLite/colas/timers/proceso compilador. La ruta server/index.ts tampoco es por sí sola el punto de entrada reconocido de cualquier deployment Vercel. Evitar el falso argumento de que Vercel no soportaNode/Fastify. Elegir arquitectura adecuada:
- backend persistente conSQLite/volumen y compilador aislado; mismo origen víaCaddy, o frontendVercel con rewriteAPI verificado y protocolo de cookies/SSE/CSRF.
- Alternativa serverless requiere adaptación real de BD compartida, trabajos/cola y actualización de datos, y capacidad explícita de compilación remota/local. No declarar completo un frontend estático que crea404 enAPI.

Fuentes oficiales consultadas:
- https://vercel.com/docs/frameworks/backend/fastify
- https://vercel.com/kb/guide/is-sqlite-supported-in-vercel

## Prioridades del producto

1. Corregir board rendering y coherencia de modelo/pines/código/contenido; crear práctica cable por cable donde el alumno realiza ambas inserciones virtuales antes de replicarlas físicamente.
2. Seguridad física nominal3,3/5V y ausencia de falsas confirmaciones de energía/validación; carreras USB y compilaciones obsoletas.
3. Publicación públicaHTTPS de plataforma con API persistente y capacidades honestas; no solo documentación o captura local.
4. Aislamiento grupos/borradores/calibración, preservación offline y merges; endurecer backend/compilador y rendimiento/accesibilidad.

No se implementaron fixes, no hubo commit/push/deploy durante esta auditoría. Este documento es evidencia y encargo, no certificación eléctrica ni publicación.

# Observaciones con evidencia

# circuit

## CIR-01 [P1] Cambiar Pico W → Arduino no cambia el explorador de bienvenida ni el modelo de portada; los circuitos solo soportan Pico

Confianza original: high; verificación original: confirmed_static

Adicional: el coordinador reprodujo el defecto en navegador y Playwright con prueba red específica, sin mocks del renderizador.
- `web/pages/Lesson.tsx:251`: welcome se evalúa antes de la rama arduino; renderiza EXPLORER/BreadboardView sin app.board (264–269).
- `web/pages/Lesson.tsx:272`: En otras lecciones Arduino sí reemplaza el circuito por PinGuide; no hay plano Arduino (280–287).
- `web/circuit/BreadboardView.tsx:1123`: PicoLayer se renderiza incondicionalmente.
- `web/experience/CircuitExperience.tsx:733`: CircuitWorld siempre monta Pico; Props 787–792 no incluyen board.
- `web/experience/LivingStation.tsx:542`: LivingWorld siempre monta HeroPico; Props 554–557 no incluyen board.
- `web/App.tsx:506`: setBoard sí cambia estado y localStorage cuando no hay conexión; no es un fallo general del selector.

### scenario
Sin conexión serial, abrir /taller/welcome → Conecta → cambiar Tu placa a uno/nano. El selector cambia, pero sigue el explorador Pico. La portada conserva HeroPico. En /taller/led el comportamiento distinto esperado por el código es reemplazar el plano por tabla Arduino, no dejar el mismo plano. Browser repro corresponde al padre.

### fix
Introducir BoardDefinition por pico/uno/nano (nano-old comparte geometría Nano, no necesariamente carga), con pines físicos, capacidades, tensión, terminales, montaje y geometría. Resolver LessonAssembly(board,lesson) y pasarlo a ambos renderizadores/ERC. En Uno representar placa externa con headers, no intentar insertar el cuerpo de Uno en la protoboard. Hasta disponer del plano, ocultar el explorador Pico para Arduino y explicar explícitamente la falta de soporte. Adaptar o etiquetar como Pico específica la portada.

### acceptance

- En /taller/welcome cambiar pico→uno→nano modifica nombre, silueta y pinout en el mismo render; no quedan etiquetas GP/3V3 propias de Pico bajo un selector Arduino.
- La lección LED de cada placa muestra terminales que coinciden con su guía y código; Uno D2/5V y Pico GP2/3V3 no se intercambian.
- Cambiar placa invalida o separa intentos/confirmaciones y conserva solo estado compatible; conectado sigue rechazando el cambio.
- E2E cubre welcome, una lección con circuito y portada para las tres geometrías, además de texto/código.

## CIR-02 [P1] “3D interactivo” es inspección de un montaje prearmado: el estudiante no conecta ningún cable virtual

Confianza original: high; verificación original: confirmed_static
- `web/lesson/WiringGuide.tsx:159`: Pasa circuit/activeStep/mode, ningún intento del alumno ni callbacks de cableado.
- `web/experience/CircuitExperience.tsx:697`: Parts/wires visibles salen del prefijo de steps; entrar al paso ya dibuja su cable (703–710).
- `web/experience/CircuitExperience.tsx:614`: Click de cable solo abre Selection; no cambia endpoints.
- `web/circuit/BreadboardView.tsx:1039`: Click del plano solo inspecciona agujero.
- `web/lesson/WiringGuide.tsx:111`: analyze recibe el circuit de referencia entero, no un circuito construido por el alumno.
- `tests/e2e/workshop.spec.ts:111`: Test incremental avanza y marca casillas; no crea conexiones ni introduce cables incorrectos.

### scenario
Abrir LED, Empezar a cablear: el GND aparece conectado automáticamente. Seleccionar sus extremos solo explica. Se puede terminar sin realizar una sola inserción virtual. Esto no satisface el requisito de practicar cada cable antes del hardware.

### fix
Separar referencia inmutable CircuitSpec de AssemblyAttempt editable. Registrar extremos mediante elegir origen→elegir destino (click/touch y selector teclado), placement/rotación de piezas, undo/remove/reset. Renderizar solo attempt; objetivo actual como ghost/markers inequívocos, no cable ya realizado. Validar estado de intento, no referencia; dar feedback de error y por qué. Conservar vista demo aparte y claramente etiquetada.

### acceptance

- Un intento nuevo comienza sin cables; entrar a un paso no agrega el cable.
- LED requiere insertar ambos extremos de cada cable virtual; origen correcto + destino equivocado no completa paso y señala la fila/pin incorrecto.
- Eliminar un cable previamente válido invalida los pasos/netlist dependientes.
- 2D/3D muestran exactamente el mismo attempt al alternar; teclado y touch permiten completar sin arrastre.
- Resultado final depende de conexiones reales del attempt y ERC; demo nunca concede logro de práctica.

## CIR-03 [P2] El avance “Guiado” y los vistos buenos representan posición, no acciones verificadas; se pueden saltar y reanudar sin validar

Confianza original: high; verificación original: confirmed_static
- `web/lesson/WiringGuide.tsx:118`: Solo advance revisa la casilla del paso actual.
- `web/lesson/WiringGuide.tsx:405`: Lista llama go(index) directamente; no aplica el guard de verify.
- `web/lesson/WiringGuide.tsx:417`: Todos los índices anteriores se pintan éxito aunque nunca se verificaron.
- `web/lesson/WiringGuide.tsx:99`: Solo persiste position; verified inicializa vacío (102,106), por lo que reload conserva avance sin conservar evidencia.
- `web/pages/Lesson.tsx:755`: Fases navegables sin requisito de cableado.
- `web/pages/Lesson.tsx:805`: Siguiente: Programa no depende de cableado listo; completar solo depende de quizDone/confirmed (632).

### scenario
LED en Guiado: hacer click en último paso; anteriores aparecen completados. Recargar en una posición avanzada mantiene el cursor, no las comprobaciones. Pulsar Siguiente: Programa evita WiringGuide y sus advertencias. No se afirma que la navegación libre sea mala: el error es presentarla como progreso verificado.

### fix
Modelar estados visited/attempted/validated distintos. Derivar progreso de steps validados y dependencias del attempt; dejar previsualización/navegación libre sin asignar éxito. Guard único para transición guiada, lista, teclado y navegación entre fases. Persistir versión del esquema, placa, lesson/circuit e intento, no cursor como evidencia.

### acceptance

- Saltar a último paso no añade checks de éxito a pasos nunca realizados.
- En Guiado no se concede cableado listo al saltar por lista/fase/teclado; Libre puede explorar pero no equivale a validación.
- Reload restaura attempt y completitud derivada; una versión o placa incompatible reinicia tras aviso.
- Completar actividad distingue checkpoint teórico de práctica virtual realizada.

## CIR-04 [P2] En “Antes de cablear”, 3D muestra el primer cable ya colocado; 2D correctamente no lo muestra

Confianza original: high; verificación original: confirmed_static_and_model_probe
- `web/lesson/WiringGuide.tsx:98`: Preparación usa position=-1 y pasa ese valor a activeStep (161).
- `web/experience/CircuitExperience.tsx:810`: Math.max(0, ...) convierte -1 en 0; se pasa stepIndex al mundo (919).
- `web/experience/CircuitExperience.tsx:698`: Prefijo slice(0,activeStep+1) incluye el primer cable.
- `web/circuit/BreadboardView.tsx:796`: 2D current=-1 deja objetos del paso cero hidden (800).
- `web/circuit/layouts.ts:47`: El primer paso LED agrega w_gnd_bottom a3→bn:3.

### scenario
LED al abrir Conecta, antes de Empezar a cablear: 3D enseña GND armado y describe primer paso en inspector; la tarjeta dice preparación. Cambiar a 2D lo hace desaparecer. Probe ejecutado confirma clamp(-1)=0 y primer cable; no se ha observado canvas en navegador en este subagente.

### fix
Conservar el sentinel -1 hasta cálculo de visibleSteps/world/inspector. Manejar explícitamente prepare/step/final en vez de clamping ambiguo.

### acceptance

- activeStep=-1,mode=step contiene cero cables y cero piezas agregadas por steps tanto 2D como 3D.
- Empezar a cablear cambia el objetivo a step0, sin autocompletarlo en modalidad práctica.
- El inspector describe preparación, no el paso 0, antes de comenzar.

## CIR-05 [P2] El explorador enseña que todo riel está unido, aunque la revisión eléctrica y los pasos soportan rieles partidos

Confianza original: high; verificación original: confirmed_static_and_model_probe
- `web/circuit/BreadboardView.tsx:998`: Inspector/hover usan stripOf(id) sin splitRails.
- `web/circuit/BreadboardView.tsx:1018`: Asegura: Todos los agujeros de esta línea están unidos entre sí.
- `web/lesson/WiringGuide.tsx:112`: ERC de la guía usa splitRails=true.
- `web/circuit/breadboard.ts:115`: stripOf separa mitades si splitRails=true; corte después de31.
- `web/circuit/layouts.ts:129`: Puentes 31→33 reparan riel partido y pasos explican por qué (135).
- `tests/circuit.test.ts:284`: Regresión ya distingue funcionamiento con/sin puentes y splitRails.

### scenario
Explorar bn:3 en welcome o antes de poner puente. La vista resalta/describiría todo bn incluido bn:60 como unido, aunque el escenario conservador de ERC los considera separados. Probe: inspectorSame=true,splitElectricalSame=false.

### fix
Hacer rail topology parte explícita del BreadboardDefinition y compartirla entre geometría, inspector y ERC. Enseñar variante continua/partida; no asumir que color continuo garantiza conectividad. Diferenciar unión interna y unión efectiva por puente.

### acceptance

- Con riel partido y sin puente, bn:3 no resalta bn:60 ni afirma continuidad.
- Agregar puente31→33 cambia la conectividad efectiva en inspector y ERC juntos.
- Vista continua declara la variante; tutorial manda comprobar el kit real en lugar de afirmar una topología universal.

## CIR-06 [P2] ERC no detecta GPIO de 3,5 V: usa límite absoluto3,6 aunque promete seguridad nominal≤3,3

Confianza original: high; verificación original: confirmed_runtime_model
- `web/circuit/netlist.ts:51`: GPIO_ABS_MAX=3.6.
- `web/circuit/netlist.ts:335`: gpio-overvoltage solo si value>GPIO_ABS_MAX.
- `web/circuit/netlist.ts:11`: Contrato documentado: ningún GP más de3,3V.
- `web/circuit/pico.ts:114`: Guía ADC: 0 a3,3V; nunca más de3,3V.
- `web/lesson/WiringGuide.tsx:529`: UI afirma Sin cortocircuitos y describe máximo de GPIO cuando no hay issues.
- `circuit-probe-output.json:84`: Fixture divisor1k/2k desdeVBUS5,25V aGP26 produce issues=[] y gpioVolts.GP26=3.5 (85–87).

### scenario
Fixture scratch eléctricamente conectada, geometría válida y netlist concordante entrega3,5V al ADC y pasa analyze sin observación. No se encontró esa sobrevoltaje en los16 montajes actuales: este es un fallo del validador ante modificaciones/práctica, no prueba de daño real del kit.

### fix
Separar límite nominal de trabajo y absoluto destructivo; no usar absoluto como criterio verde. Validar entradas con tensión segura específica de placa y referencia ADC y contemplar tolerancias. Un input>3,3 debe al menos perder sello seguro.

### acceptance

- La fixture actual de circuit-probe.ts debe emitir riesgo de overvoltage y no sello seguro al obtenerGP26=3,5V.
- Regresiones frontera3,3/3,35/3,5/3,6/5V distinguen nominal de absoluto.
- Los16 montajes de referencia actuales siguen pasando las condiciones documentadas; el divisor HC se ensaya aUSB máximo+tolerancia.

## CIR-07 [P2] Desconectar serial no corta energía USB, pero el tutorial lo presenta como placa sin energía segura para cablear

Confianza original: high; verificación original: confirmed_static; physical_power_not_tested
- `web/lesson/WiringGuide.tsx:445`: Intro decide advertencia eléctrica usando app.connected; falso muestra Placa sin conectar: así se cablea (454–460).
- `web/lesson/WiringGuide.tsx:450`: Dentro de Desconecta el cable USB se presenta ConnectButton como acción.
- `web/App.tsx:491`: disconnect cierra serial y marca connected=false; no puede extraer USB ni verificar VBUS.
- `web/circuit/pico.ts:79`: El propio modelo identifica VBUS como5V conUSB conectado.

### scenario
Cerrar conexión del navegador manteniendo el cable USB físicamente enchufado, o abrir página con placa alimentada y sin puerto autorizado. app.connected=false no equivale a placa sin energía. El mensaje de seguridad no puede asegurar ese estado.

### fix
Decir Sin conexión de datos, no Sin energía. Paso físico explícito: retirarUSB y fuentes externas, confirmación humana distinta de disconnect serial. Nunca inferir ausencia deVCC desde WebSerial.

### acceptance

- Con serial desconectado y USB aún insertado no aparece mensaje que afirme placa desenergizada.
- La preparación pide retirarUSB/alimentaciones y confirmarlo antes de práctica física; aclarar que botón desconecta datos, no energía.
- Prueba física docente documenta separación de estado datos/energía; UI automatizada verifica texto correcto para connected true/false.

## Limitaciones originales
[
  "Auditoría del snapshot dirty, baseline c7b46c1; fuente read-only, no cambios de código ni git/original, sin .env/cuentas/credenciales/deploy.",
  "Reproducción de navegador delegada al padre; hallazgos de render/estado son evidencia estática, no captura visual propia.",
  "Ejecutado vitest solo tests/circuit.test.ts:71/71 pass. E2E leído, no ejecutado aquí.",
  "Ejecutado probe real de los16 circuitos:sin errores ERC aUSB5,25/rieles partidos y sin clearanceProblems; no se afirma correspondencia universal con variantes del hardware físico.",
  "No se eleva a bug el stale-state genérico de useState de WiringGuide: Lesson monta contenedor key lesson.id:active en guiado (789), lo que evita persistencia accidental entre lecciones en esa ruta. Riesgo futuro de prop swap/free mode debe validarse antes de afirmar.",
  "Geometría clearanceProblems verifica agujeros tapados usando envolventes parciales de piezas; no modela contacto/collision3D/cables ni toda variante comercial. Eso limita seguridad real, pero no se encontró colisión en layouts vigentes.",
  "No se afirma simulación eléctrica en flujo animado: README y nota1050 lo etiquetan correctamente ilustrativo."
]

# backend-deploy

## BD-01 [P1] Un deploy Vercel del frontend no publica la API persistente existente

Confianza original: 0.99; verificación original: ver informe/probe
- `web/lib/api.ts:65`: Todos los fetch apuntan a /api del mismo origen y credentials=same-origin.
- `vite.config.ts:12`: El único proxy /api está en server de desarrollo; no se convierte en proxy productivo.
- `server/database.ts:53`: DatabaseSync abre un archivo local persistente; SSE, auditorías y cola Telegram viven en un proceso residente.
- `README.md:52`: La documentación reconoce correctamente que el backend SQLite no debe desplegarse como funciones efímeras.

### scenario
Publicar únicamente dist en Vercel deja /api/session, /api/firmware, ingestión y compilación sin backend. El snapshot no contiene vercel.json ni adaptación serverless. Es un bloqueo de arquitectura para ese objetivo, no una regresión del Compose documentado.

### fix
Preferir Compose en un VPS Linux con dominio y disco persistente, sirviendo frontend y API bajo Caddy. Si se exige Vercel, alojar únicamente dist allí, configurar rewrite externo /api/:path* hacia el backend residente y fallback SPA después de la API; mantener cookies, Origin y no-store. No trasladar SQLite/toolchain a funciones.

### acceptance
Desde el dominio elegido crear sesión, recuperar cookie tras recarga, compilar/upload real, recibir SSE y lectura real, reiniciar backend y conservar datos; /api nunca debe devolver index.html.

## BD-02 [P2] Compose no configura trustProxy: cinco fallos bloquean acceso docente a todos los clientes

Confianza original: 1.0; verificación original: ver informe/probe
- `server/app.ts:60`: trustProxy es false si TRUST_PROXY no está definido.
- `compose.yaml:5`: No pasa TRUST_PROXY al app aunque todo el tráfico llega desde Caddy.
- `server/app.ts:610`: Login limita 5 solicitudes/15 minutos por req.ip; creación y pairing también usan req.ip.

### scenario
Prueba app.inject: misma IP remota de proxy, X-Forwarded-For distinto para atacante y docente. Cinco contraseñas incorrectas retornaron 401; login válido de otro XFF retornó 429. En Compose la IP vista es Caddy, no la del cliente.

### fix
Confiar exclusivamente en el proxy controlado mediante rango/IP privado estable o función validada, y configurar la propagación de IP en Caddy. No habilitar trustProxy indiscriminado ni aceptar XFF arbitrario del público.

### acceptance
Tras cinco fallos de un cliente, otro cliente puede iniciar sesión; XFF falsificado desde un emisor no confiable no altera la IP autorizada. Probar también límites de creación y pairing tras proxy.

## BD-03 [P2] Un 429/500/503 al reconectar destruye borradores pendientes offline

Confianza original: 0.99; verificación original: ver informe/probe
- `web/App.tsx:199`: refreshSession solicita sesión y luego PATCH de la cola dentro del mismo try.
- `web/App.tsx:225`: Ante cualquier error que no sea de red llama offlineStore.forget(). No discrimina estado HTTP.
- `web/lib/offline.ts:49`: forget elimina cache de sesión y cola pending.
- `web/lib/api.ts:78`: Errores HTTP se convierten en Error genérico, sin status; isNetworkError no los reconoce.

### scenario
Un grupo trabaja sin red; al reconectar la API está en mantenimiento (503), saturada (429) o devuelve 400 al aplicar un borrador. refreshSession borra ambas claves locales y descarta cambios nunca sincronizados. Verificado por trazado estático, no prueba de navegador.

### fix
Conservar estado HTTP en ApiError; no borrar cache/cola por errores transitorios o validación. Para 401/403 conservar un archivo recuperable y explicar cambio/expiración de identidad sin sincronizar hacia otro grupo.

### acceptance
E2E con pending local y GET o PATCH que retorna 429/500/503/400: las claves y borradores persisten, son exportables y sincronizan sólo cuando vuelve la sesión autorizada.

## BD-04 [P2] El filtro del compilador permite directivas C++ con digraph %:

Confianza original: 0.96; verificación original: ver informe/probe
- `server/arduino.ts:205`: Sólo identifica includes que empiezan por #; %: es un token equivalente en el preprocesador.
- `server/arduino.ts:226`: El filtro de include_next/import/pragma/line tampoco contempla %:.
- `server/compiler-service.ts:15`: El servicio incluido ejecuta compilación nativa con arduinoSandbox=false y depende de este filtro.
- `docs/SECURITY.md:13`: Afirma que los includes de estudiante están limitados a bibliotecas conocidas.

### scenario
La reproducción literal de ambos regex devolvió includesDetected=0 y forbiddenDetected=false para %:include <stdio.h>. GCC local -E aceptó el digraph (exit 0) y resolvió stdio.h. Puede sustituirse por una ruta absoluta: se elude la lista blanca. No se probó AVR ni exfiltración; el contenedor mantiene separación respecto de SQLite y secretos docentes.

### fix
No tratar regex como frontera de seguridad del preprocesador. Rechazar digraphs y otras formas alternativas con tests, o analizar/tokenizar con una política fiable. Mantener aislamiento de compilador y archivos mínimos; no afirmar confinamiento a biblioteca por el filtro actual.

### acceptance
AVR real rechaza %:include con ruta externa, %:include_next, variantes de tokenización y directivas ofuscadas; bibliotecas educativas siguen compilando. Ningún diagnóstico devuelve archivos fuera del allowlist.

## BD-05 [P2] Rate limit global se evade rotando cookies inventadas sin autenticar

Confianza original: 1.0; verificación original: ver informe/probe
- `server/app.ts:84`: La clave global usa hash de cookie rd_session o Authorization antes de validar su autenticidad.
- `server/app.ts:210`: /api/health es público y llama compiler.available(), que genera I/O al servicio o proceso.
- `server/arduino.ts:132`: Cada health consulta al compilador privado con fetch y timeout; sin servicio intenta CLI.

### scenario
181 solicitudes /api/health con una cookie inválida diferente por solicitud retornaron todas 200, pese al límite anunciado de 180/minuto. Un emisor puede eludir límite de coste de health y solicitudes fallidas con identidades inventadas. Esto no elude los límites específicos por IP de login ni otorga permisos.

### fix
Aplicar primero un presupuesto por IP confiable para tráfico público/no autenticado y usar ID de sesión/dispositivo validado sólo como presupuesto adicional. Cachear comprobación de disponibilidad del compilador y separar liveness/readiness.

### acceptance
181 solicitudes desde una misma IP con cookies o Authorization aleatorios se limitan; varias sesiones válidas mantienen presupuesto definido y health no dispara una consulta al compilador por cada ataque.

## BD-06 [P2] La retención efectiva por defecto es siete días, no treinta para los datos del grupo

Confianza original: 1.0; verificación original: ver informe/probe
- `server/database.ts:99`: expires_at se fija al crear grupo; PATCH/ingest no renuevan sesión.
- `server/database.ts:273`: cleanup borra sesiones expiradas antes de aplicar RETENTION_DAYS; FK ON DELETE CASCADE borra lecturas y alertas.
- `docs/DEPLOYMENT.md:53`: Describe grupos siete días e historial/alertas treinta días sin explicitar que la cascada vence antes.

### scenario
Prueba en SQLite memory con sessionDays=7 y retentionDays=30: una lectura se eliminó por completo al adelantar ocho días y ejecutar cleanup. Las publicaciones activas no extienden ese plazo. Un usuario que espera exportar treinta días pierde la serie tras siete.

### fix
Documentar que la retención real es el menor de vida de sesión y RETENTION_DAYS, o desacoplar expiración de autenticación y purga física mediante un periodo de conservación recuperable por docente. Para talleres de varias semanas ajustar política explícita, no asumir que RETENTION_DAYS la prolonga.

### acceptance
Tests separan expiración de acceso, retención física y borrado explícito; documentación y despliegue dicen exactamente cuándo desaparece historial y qué permite exportarlo.

## Limitaciones originales
[
  "Auditoría del snapshot de working tree indicado (HEAD c7b46c1 según contexto); no se leyó .env, secretos, cuentas ni repositorio original. No se desplegó ni se inventó URL pública.",
  "No Docker Engine ni Arduino CLI disponible en este host; no se construyeron imágenes ni se ejecutó AVR. El GCC local prueba semántica de digraph, no certifica toda la toolchain AVR.",
  "Pruebas dirigidas locales: app.inject/SQLite memory con configuración de auditoría sintética; Node reportó v26.7.0, mientras Docker usa Node 24. Tests integrales/build/browser y hardware quedan al agente padre.",
  "PWA verificada estáticamente: service worker precachea dist, evita API y usa fallback de navegación; no hay manifest de instalación revisado, ni prueba física USB/TLS. Cache instalada requiere terminar install, no basta una primera visita instantánea.",
  "No se encontró SSRF controlable por usuario en servidor: Telegram destino fijo y URL del compilador sólo configuración de administrador. Origin exacto, teacher separado, IDs derivados de cookie/Bearer, SQL parametrizado y revocación están implementados; no se afirma ausencia total de vulnerabilidades."
]

# content-hardware

## CH-01 [P1] Cambiar de placa durante el selector USB deja el transporte y el modelo desalineados

Confianza original: alta; verificación original: ver informe/probe
- `web/App.tsx:461`: connect captura boardRef.current antes de await serial.connect/ArduinoSerial.connect y después establece connected=true sin comprobar que siga siendo la misma placa.
- `web/App.tsx:508`: setBoard bloquea solo connected; no connecting ni una operación USB pendiente.
- `web/App.tsx:494`: disconnect y las acciones posteriores eligen transporte mediante el modelo actual, no mediante la conexión realmente abierta.

### scenario
Elegir Pico, abrir Conectar y cambiar a Uno antes de resolver requestPort. La conexión Pico termina, la UI dice conectada para Uno y ejecutar/desconectar usa ArduinoSerial, dejando la Pico abierta.

### fix
Bloquear cambios durante connecting/busy; registrar una conexión activa inmutable con modelo, transporte y generationId. Invalidar y cerrar aperturas cuyo resultado llegue después de cambiar de generación.

### acceptance
Con requestPort diferido, cambiar modelo o cancelar conexión no deja un puerto huérfano ni connected=true para otro transporte. Desconectar siempre cierra el puerto realmente abierto.

## CH-02 [P1] Una compilación Arduino antigua puede grabarse en una conexión nueva

Confianza original: alta; verificación original: ver informe/probe
- `web/App.tsx:518`: compileAndUpload espera la respuesta HTTP y luego llama al singleton ArduinoSerial.upload sin identidad de conexión capturada ni cancelación.
- `web/App.tsx:437`: guard únicamente actualiza busy en React; no excluye operaciones mediante un lock/ref y no comprueba generación al terminar.
- `web/lib/serial.ts:537`: upload verifica la conexión existente al llegar el resultado, aunque no sea la conexión original. exclusive protege la grabación, no la fase de compilación HTTP.

### scenario
Compilar un programa, desconectar mientras el servidor tarda y reconectar otra Uno/Nano. El resultado atrasado se graba en la nueva placa. Atajos Ctrl+Enter también pueden iniciar compilaciones concurrentes y un guard terminado libera busy mientras otro sigue pendiente.

### fix
Serializar compile+upload como una sola operación, capturar puerto/modelo/generación al iniciarla, usar AbortController al desconectar y rechazar resultados obsoletos antes de cualquier escritura USB.

### acceptance
Una respuesta de compilación diferida tras desconectar/reconectar produce cero escrituras en el segundo puerto. Dos ejecuciones simultáneas no compilan ni graban a la vez y busy permanece activo hasta finalizar la operación vigente.

## CH-03 [P1] La guía confunde cerrar Web Serial con cortar la alimentación física

Confianza original: alta; verificación original: ver informe/probe
- `web/lesson/WiringGuide.tsx:445`: Intro decide la seguridad con app.connected; cuando es false anuncia «Placa sin conectar: así se cablea» con tono success.
- `web/lib/serial.ts:188`: disconnect libera lector/escritor y cierra el puerto: no retira el cable USB ni apaga VBUS/VSYS.
- `web/lesson/WiringGuide.tsx:543`: La revisión final ofrece conectar USB a partir del estado lógico y no de una comprobación física de alimentación.

### scenario
La placa tiene USB físicamente conectado pero nunca se abrió el puerto, o el estudiante pulsa Desconectar. La guía presenta estado seguro para mover cables aunque la placa y sus sensores siguen energizados.

### fix
Separar conexión de datos y energía: mostrar siempre «No podemos comprobar si tu placa tiene energía», pedir retirar físicamente USB y cualquier alimentación externa y confirmar ese paso. Nunca usar connected=false como evidencia de ausencia de tensión.

### acceptance
Con USB lógico desconectado la guía no afirma que la placa esté sin energía. La preparación explica explícitamente que Desconectar en la web solo cierra datos y exige retirar el cable antes de cablear.

## CH-04 [P1] Los borradores del editor no están aislados al cambiar de sesión en la misma actividad

Confianza original: alta; verificación original: ver informe/probe
- `web/lesson/CodeWorkbench.tsx:114`: key contiene lessonId y lenguaje, pero no session.id.
- `web/lesson/CodeWorkbench.tsx:163`: La recarga de value/cachedDraft y limpieza del debounce dependen solo de key. Cambiar session.id no recarga el código del nuevo grupo.
- `web/lesson/CodeWorkbench.tsx:149`: persist usa app.updateSession sin un id de propietario del borrador; change escribe la value visible en la cola y sesión actuales.
- `web/pages/Lesson.tsx:336`: La key de montaje del Workbench tampoco incluye la sesión.

### scenario
La sesión expira o se sustituye mientras la ruta y placa siguen iguales. El editor mantiene código del grupo A al adoptar B. Una edición posterior guarda ese código como borrador de B; un debounce antiguo también puede persistir bajo el contexto nuevo.

### fix
Identificar el editor por session.id+lessonId+familia de placa, y asociar cada debounce explícitamente a su sessionId. En cambio de propietario, guardar solo bajo el propietario antiguo si sigue autorizado o conservar localmente por id, y cargar el borrador de B.

### acceptance
Prueba de componente con sesión A→B sin cambiar ruta: editor muestra exclusivamente el borrador de B y ningún PATCH/cola de B contiene texto de A, incluso con debounce pendiente.

## CH-05 [P2] La calibración no conserva identidad de placa ni protege resultados de captura obsoletos

Confianza original: alta; verificación original: ver informe/probe
- `web/lib/api.ts:19`: calibrations indexa solo sensor; faltan placa, escala ADC, tensión y montaje.
- `web/lesson/CalibrationTool.tsx:44`: low/high se inicializan una vez con la sesión y no se reinicializan al cambiar sesión o placa.
- `web/lesson/CalibrationTool.tsx:63`: capture espera serial.exec y aplica setLow/setHigh sin verificar target/session/board actuales. El selector de sensor permanece habilitado.
- `web/lib/arduino.ts:34`: La generación AVR comprueba rango 0–1023, pero un valor de Pico dentro de ese rango se acepta como AVR y viceversa.
- `firmware/drivers.py:37`: El driver Pico interpreta cualquier par numérico con separación ≥500 como referencias de su escala, sin procedencia.

### scenario
Guardar calibración Arduino 100/800 y cambiar a Pico: ese par sigue siendo válido numéricamente y se incorpora como si proviniera de ADC16. O iniciar captura Suelo y seleccionar Agua antes de resolverla: el raw de GP26 termina en el campo de Agua.

### fix
Guardar calibraciones por identidad de placa/familia ADC y sensor, con metadatos de sonda y alimentación; pedir recalibrar al cambiar montaje. Bloquear cambios de destino durante capture o validar un token target/session/board antes de aplicar el resultado.

### acceptance
Referencias 100/800 de Uno nunca se instalan silenciosamente en Pico. Captura diferida de suelo no modifica agua ni otra sesión. Cambiar placa carga referencias de esa placa o campos vacíos.

## CH-06 [P2] PATCH de progreso y mapas completos sobrescribe avances concurrentes

Confianza original: alta; verificación original: ver informe/probe
- `web/pages/Lesson.tsx:159`: Completar envía un array completo construido desde app.session.progress del render.
- `web/lib/offline.ts:10`: mergeSessionPatch reemplaza progress con el array más reciente en vez de unir completados.
- `server/database.ts:122`: El servidor relee la sesión, pero ...patch reemplaza progress; solo los mapas se combinan.
- `web/lesson/CodeWorkbench.tsx:153`: persist envía todos los drafts.current, por lo que claves que no se editaron pueden sobrescribir versiones recientes de otra pestaña.
- `web/lesson/CalibrationTool.tsx:105`: Guardar referencia también reenvía el mapa completo de calibraciones.

### scenario
Dos pestañas/grupos de trabajo de la misma sesión parten de welcome. A completa led; B completa blink o sincroniza progreso offline: el PATCH de B puede eliminar led. Guardar un borrador también restaura claves antiguas de otras actividades.

### fix
Enviar operaciones parciales: completedLessonIds aditivos o endpoint de completar con unión atómica; drafts/calibrations únicamente con la clave editada. Usar versión/CAS para reset o modificaciones no monotónicas.

### acceptance
PATCH concurrentes welcome+led y welcome+blink conservan los tres ids. Editar led.python no toca blink.python actualizado por otra pestaña. Sincronización offline no borra progreso adquirido online.

## CH-07 [P2] La captura de calibración detiene programas al margen del estado global de ejecución

Confianza original: alta; verificación original: ver informe/probe
- `web/lesson/CalibrationTool.tsx:63`: La herramienta llama al singleton serial.exec directamente, sin app.guard, setRunning ni un estado USB compartido.
- `web/lib/serial.ts:277`: interrupt descarta this.execution tras Ctrl-C sin notificar onRunEnd cuando todavía no llegó el delimitador de fin.
- `web/lesson/CalibrationTool.tsx:146`: Los botones dependen de app.busy y de capturing solo para su spinner individual; ejecutar otra acción sigue siendo posible mientras esta captura ocupa el transporte.

### scenario
Ejecutar estación/bucle y capturar raw. El programa se interrumpe, pero app.running puede seguir true. El botón de ejecutar permanece activo y otro comando choca con exclusive. El otro botón de captura también puede iniciar un segundo intento rechazado.

### fix
Exponer captura como operación en AppContext con mutex global, running=false al interrumpir y tokens de cancelación. Deshabilitar ambos botones/selector durante captura y reflejar claramente «programa detenido; vuelve a ejecutar».

### acceptance
Capturar durante un bucle cambia running a false y busy a true hasta finalizar; no se pueden lanzar dos capturas ni una ejecución concurrente. Ensayar stdout de fin retrasado en el peer USB.

## CH-08 [P2] Uno/Nano cambia el código y la tabla, pero conserva instrucciones y evaluación de Pico

Confianza original: alta; verificación original: ver informe/probe
- `web/pages/Lesson.tsx:192`: concept.body, facts, safety y materiales se muestran sin resolver la variante elegida.
- `web/pages/Lesson.tsx:559`: experiment usa prosa común, y Quiz recibe lesson.checkpoint sin variante de placa.
- `web/content/lessons/led.ts:32`: Material obligatorio «Pico W en la protoboard», facts GP2/3,3 V y experimento d26/d27 se muestran aunque el modelo sea Uno/Nano y su tabla solo define D2.
- `web/content/lessons/sensors.ts:756`: Checkpoint de agua exige GP28 ADC2 aunque el montaje Arduino conecta A2.
- `web/pages/Lesson.tsx:280`: Arduino carece de secuencia cable-a-cable: se sustituye por una tabla y una advertencia de que el plano es Pico.
- `web/pages/Lesson.tsx:251`: welcome se resuelve antes de la rama arduino y ofrece explorar solo una Pico W incluso para Uno/Nano.

### scenario
Seleccionar Uno/Nano en Tu primera señal o Nivel de agua. El sketch y tabla son AVR, pero la explicación sigue enseñando GPIO de Pico, voltaje 3,3 V y agujeros de un plano no aplicable; para superar el checkpoint debe responder por otra placa.

### fix
Resolver la lección completa desde un BoardProfile (pinout, ADC, niveles, fuente, código, materiales, pasos, explicación y quiz). Crear geometría/tutorial incremental propio de Uno y Nano, no recolorear Pico ni equiparar sus agujeros.

### acceptance
En cada variante LED, suelo, DHT11, agua, HC-SR04 y welcome, todas las instrucciones operativas/quiz coinciden con el código y el montaje. Uno y Nano disponen de pasos independientes con ubicación y nivel eléctrico correctos; referencias comparativas a Pico se etiquetan como comparación, no como instrucción.

## CH-09 [P2] Servicio no disponible y almacenamiento denegado pueden producir pérdida de borrador con feedback engañoso

Confianza original: alta; verificación original: ver informe/probe
- `web/lib/api.ts:77`: HTTP 502/503/504 genera Error genérico, sin status accesible para distinguir indisponibilidad de validación.
- `web/lib/offline.ts:56`: isNetworkError considera solo TypeError/TimeoutError/AbortError; un backend caído que devuelve 503 no activa modo offline.
- `web/lib/offline.ts:24`: write atrapa errores de localStorage sin devolver éxito o fracaso.
- `web/lesson/CodeWorkbench.tsx:154`: updateSession puede resolver en fallback offline y setSaved(true), aunque remember/queue hayan fallado por almacenamiento denegado o lleno.

### scenario
El proxy devuelve 503: refreshSession descarta sesión local/cola aunque existan borradores recuperables. Con red cortada y almacenamiento bloqueado, el editor termina diciendo guardado aunque nada quedó durablemente almacenado.

### fix
Tipar errores HTTP y conservar cache/cola ante 5xx/transitorios; distinguir 401/403. Hacer que persistencia local informe resultado y mantener estado «no guardado; descarga» si no hay ninguna copia durable.

### acceptance
503 conserva sesión y borrador local; 401 invalida autorización de manera explícita. Storage quota/denied junto con red caída nunca muestra «Borrador guardado» y ofrece descarga visible también en móvil.

## Limitaciones originales
[
  "No se ejecutaron Vitest, compilador AVR, navegador, pruebas de integración ni firmware en MCU; el padre ejecuta tests/browser. Escenarios asíncronos se derivan de código y requieren pruebas diferidas de confirmación.",
  "No se accedió a USB real, cuentas, .env, secretos, datos de sesiones ni git. No se modificó el snapshot ni G:/RaicesDigitales.",
  "No se auditó completamente connectivity.py/TLS, todos los ejemplos MicroPython ni foundations/explore/potentiometer/route; los archivos parciales están señalados.",
  "No se consultaron fichas externas del kit: la compatibilidad exacta de DHT11, LCD, buzzer, motor y módulos concretos debe verificarse con modelo/lote real. No se declara seguridad física basándose exclusivamente en netlist de software.",
  "Los tests revisados comprueban estructura/prosa/sintaxis y peers seriales, pero no cubren los cambios de grupo del componente, resultados HTTP obsoletos, selector USB diferido ni captura con cambio de destino."
]
