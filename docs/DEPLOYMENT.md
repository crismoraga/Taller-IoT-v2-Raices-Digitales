# Despliegue HTTPS con persistencia

La composición incluye tres procesos: aplicación Node 24 con SQLite, compilador Arduino aislado y Caddy para certificados HTTPS. Se usa una única réplica de la aplicación y un volumen persistente. SQLite no se comparte por NFS ni entre múltiples contenedores de aplicación.

Para publicar el taller completo hoy, la ruta más directa es **un servidor Linux con Docker y un dominio propio**, sirviendo web y API juntas. Un sitio estático sólo permite ver el contenido: sesiones, panel docente, compilación y telemetría requieren el proceso residente. Si usas Vercel, sigue la sección específica más abajo después de preparar ese backend.

## Sin servidor propio: Blueprint para Render

El archivo [`render.yaml`](../render.yaml) prepara una aplicación web Docker con disco SQLite y un servicio privado de compilación. **Los dos planes `starter` y el disco son de pago**; revisa el importe que muestre Render antes de crear los recursos. Esta configuración no abre una cuenta, no contrata servicios ni publica por sí sola.

1. Guarda los cambios del proyecto en GitHub. Conecta tu repositorio en [Render Blueprints](https://dashboard.render.com/blueprints) y selecciona `render.yaml` de la rama que contiene estas mejoras.
2. Revisa cuenta, región, planes y disco en la pantalla de creación. Ambos servicios deben estar en la misma región. Mantén una única instancia web con el disco en `/app/data`; un plan sin almacenamiento persistente pierde los grupos al reiniciar.
3. Introduce en el formulario seguro `TEACHER_PASSWORD` propio de al menos 12 caracteres y `SECRETS_KEY` de 32 bytes aleatorios codificados en base64. Conserva una copia privada de la clave: será necesaria para restaurar Telegram. El Blueprint genera un token independiente para el compilador y lo comparte con la web mediante la referencia entre servicios; no copies claves al repositorio.
4. Espera que terminen ambos builds. Render proporciona una URL HTTPS real para la web. El arranque obtiene `APP_ORIGIN` de `RENDER_EXTERNAL_URL` si no lo has definido y construye la URL del compilador a partir de su hostname privado. `APP_ORIGIN` y `ARDUINO_SERVICE_URL` explícitos tienen prioridad. Un dominio propio o un frontend Vercel requieren ajustar `APP_ORIGIN` con sus orígenes exactos.
5. Ejecuta `node scripts/smoke-deployment.mjs https://URL-REAL-DE-RENDER --exercise-session --require-arduino`, abre el sitio en otra red y sigue la comprobación previa a la sala. Si la API arranca antes que el compilador, espera que éste esté disponible y vuelve a ejecutar el comprobador.

Render administra HTTPS para su dominio; antes de instalar Pico por Wi-Fi, comprueba que la cadena del certificado es compatible con `firmware/ca.pem`. La conexión USB y el puente Arduino pueden probarse mientras se verifica esa cadena. Las restricciones de salida de red del compilador descritas en Compose pertenecen a Compose: este Blueprint separa procesos y credenciales, pero no configura una política de salida de red del proveedor.

No se habilita `TRUST_PROXY=true` en Render. Durante la validación del despliegue, identifica el proxy de entrada y configura únicamente los rangos o pares que el proveedor garantice, después de comprobar que dos clientes distintos no comparten el límite de login y que una cabecera `X-Forwarded-For` pública no permite eludirlo. Si el proveedor no ofrece una frontera verificable, mantén la configuración conservadora y evita reintentos de contraseñas incorrectas durante la sala; el límite docente podría agrupar clientes de ese proxy. La variante Compose ofrece una frontera de proxy explícita.

Referencia de campos: [especificación de Blueprints](https://render.com/docs/blueprint-spec), [discos persistentes](https://render.com/docs/disks), [red privada](https://render.com/docs/private-network), [variables automáticas](https://render.com/docs/environment-variables#automatically-provided-environment-variables). El acceso a esa documentación y al registro Docker fue rechazado por la política de red durante la preparación en este entorno; no se ha validado este Blueprint mediante la API de Render ni publicado un servicio. Revisa su validación en la pantalla de creación antes de aceptar costes.

## Servidor Linux con dominio y Compose

Requisitos del servidor: Docker Engine con Compose v2, DNS propio apuntando al servidor, puertos TCP 80/443 abiertos, conexión saliente para ACME y Telegram, al menos 2 GB de RAM y almacenamiento para imágenes/toolchain. La construcción del compilador descarga dependencias oficiales. El contenedor compilador en ejecución sólo tiene red privada interna; no tiene salida a Internet.

1. Copia `.env.example` a `.env` y configura:

```dotenv
DOMAIN=tu-dominio-publico
ACME_EMAIL=tu-correo-real
APP_ORIGIN=https://tu-dominio-publico
TEACHER_PASSWORD=una-contraseña-propia-de-al-menos-12-caracteres
SECRETS_KEY=clave-base64-generada-de-32-bytes
ARDUINO_SERVICE_TOKEN=otra-clave-aleatoria-de-al-menos-32-caracteres
SESSION_DAYS=7
RETENTION_DAYS=30
```

Genera cada clave por separado con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Conserva `.env` fuera del repositorio y protege permisos del archivo. `DOMAIN` no incluye `https://`; reemplaza los orígenes locales de `.env.example` por el origen HTTPS público. Si `APP_ORIGIN` no está definido, Compose usa `https://DOMAIN`. No hay valores de contraseña predefinidos.

2. Construye y arranca:

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 app compiler caddy
```

Compose espera la salud del compilador antes de arrancar la aplicación y la de ésta antes de arrancar Caddy. Un contenedor que reinicia o permanece `unhealthy` requiere revisar sus registros; no implica un taller publicado.

3. Abre `https://tu-dominio-publico`, crea un grupo y revisa `/api/health`. Debe indicar `ok:true` y `arduinoAvailable:true` al completarse la instalación de AVR. Comprueba profesor, prueba Telegram con credenciales válidas, pairing y una lectura real. El firewall debe exponer únicamente Caddy; la aplicación y el compilador no publican puertos en el host. Caddy mantiene streaming SSE con `flush_interval -1`.

Verifica también el dominio con el comprobador incluido:

```sh
node scripts/smoke-deployment.mjs https://tu-dominio-publico --exercise-session --require-arduino
```

Por defecto el comprobador sólo lee portada, enlace directo a una lección y salud de API. `--exercise-session` crea una sesión temporal propia, comprueba cookie, aislamiento, CSRF, dashboard, primer evento SSE y exportación, y la elimina. No envía lecturas ni afirma que haya sensores físicos conectados. Verifica la identidad del taller para evitar publicar sobre un sitio distinto con un nombre similar.

Caddy y la aplicación comparten una red exclusiva de proxy. La aplicación confía en la IP de **ese Caddy** para distinguir clientes en los límites de acceso; no confía en cabeceras de otros pares. La red del compilador está separada. Si `172.30.44.0/29` se solapa con una red existente del servidor, cambia juntos `PROXY_SUBNET`, `CADDY_PROXY_IP` y `APP_PROXY_IP` en `.env`, con dos IP distintas dentro de la nueva subred. No expongas el puerto de la aplicación ni establezcas `TRUST_PROXY=true`.

La Pico contiene `firmware/ca.pem`, la CA pública **ISRG Root X1**, con vigencia hasta junio de 2035. Caddy usa exclusivamente ACME de Let's Encrypt y solicita la cadena cuya raíz es X1. Esto mantiene la cadena del servidor compatible con el almacén reducido de la placa. Si cambias de emisor/cadena, actualiza la CA de la Pico y vuelve a validar TLS; no desactives la comprobación. La configuración se apoya en [issuer y preferred_chains de Caddy](https://caddyserver.com/docs/caddyfile/directives/tls#issuers) y las [cadenas oficiales de Let's Encrypt](https://letsencrypt.org/certificates/).

El volumen `raices_data` contiene sesiones, telemetría, alertas y secretos cifrados. `caddy_data` contiene certificados. Reiniciar con `docker compose restart` conserva datos. No uses `docker compose down -v` si quieres conservarlos.

## Frontend en Vercel y API persistente

Vercel puede alojar `dist/` y reenviar `/api/*` a la aplicación residente. SQLite, el compilador, los timers de alertas y las conexiones de telemetría se quedan en el servidor anterior. Esta ruta requiere acceso a una cuenta/proyecto Vercel real y un backend ya publicado con HTTPS; un nombre de proyecto vinculado no demuestra que el sitio esté publicado.

1. Prepara y verifica el backend con Compose. Conserva su dominio también para la conexión Wi-Fi de Pico, cuya CA debe coincidir con la cadena TLS publicada.
2. Elige el dominio estable del frontend en tu proyecto Vercel. En el `.env` del backend, añade ese origen exacto, por ejemplo `APP_ORIGIN=https://dominio-backend,https://dominio-frontend`. Reinicia `docker compose up -d app`. No uses comodines ni aceptes todos los previews como origen.
3. Genera una configuración local con **el dominio real del backend**:

```sh
node scripts/prepare-vercel.mjs https://dominio-backend
vercel --local-config .vercel/workshop.json --prod
```

El generador no incluye credenciales: configura instalación con lockfile, build Vite, rewrite de API antes del fallback SPA, API sin caché, Web Serial y una política de contenido de recursos locales. El fichero generado está dentro de `.vercel/`, ignorado por Git. Revisa la cuenta y proyecto que muestra la CLI antes de publicar. Para despliegues automáticos desde Git, copia esta configuración ya revisada a `vercel.json` y versiona ese fichero sólo después de definir el backend concreto.

4. Desde el frontend publicado ejecuta el comprobador con `--exercise-session --require-arduino`. Verifica en navegador Chrome/Edge el panel docente, edición Monaco, conexión USB, generación de firmware y cambios en vivo. Las cookies deben sobrevivir a la recarga; `/api/*` debe devolver JSON o SSE, nunca `index.html`. El mismo origen visible evita CORS abierto y cookies entre sitios.
5. Para la Pico W, configura en Ajustes el endpoint HTTPS **del backend Caddy** terminado en `/api/device/ingest`. El valor inicial del formulario usa el dominio visible; si es Vercel, comprueba y ajusta ese endpoint antes de instalar. No asumas que la CA de la placa valida el certificado de un dominio Vercel: confirma emisor/cadena antes de usarlo directamente.

Vercel puede imponer plazos a los rewrites externos y cortar una conexión SSE larga. El navegador vuelve a conectarse; comprueba una sesión real durante el taller. Si se interrumpe continuamente, usa el dominio del despliegue completo en Caddy. Una URL de preview no reemplaza la verificación del dominio productivo ni una copia persistente de la base de datos.

## Comprobación previa a abrir la sala

- Abre el sitio desde una segunda red, por ejemplo datos móviles, y verifica portada y una lección directa en HTTPS.
- Crea dos grupos en dos perfiles de navegador; cada uno debe conservar su nombre y su historial tras recargar, sin ver los datos del otro.
- Accede como docente, revisa estaciones y configura Telegram desde ese panel; confirma que llega un mensaje al chat real.
- Conecta una placa por USB en Chrome/Edge de escritorio; carga LED, observa el cambio físico y publica una lectura identificada como hardware.
- Reinicia sólo la aplicación, vuelve a abrir el grupo y comprueba que sus lecturas siguen presentes. Prueba CSV y descarga del código como respaldo.
- Mantén el recorrido guiado y el contenido local disponibles si se pierde Internet; consulta la alternativa de la guía docente para cada actividad.

Las pruebas automáticas no sustituyen estas comprobaciones con hardware, red y credenciales reales. El build de una imagen tampoco demuestra que DNS, certificados y el servicio público estén operativos.

## Copias y restauración

Para una copia consistente, detén la aplicación durante la copia del volumen SQLite. El nombre real del volumen se obtiene con `docker volume ls` (Compose suele añadir un prefijo de proyecto). Sustituye `<volumen-raices-data>` y `<directorio-backup-absoluto>` por los valores reales:

```sh
docker compose stop app
docker run --rm -v <volumen-raices-data>:/data:ro -v <directorio-backup-absoluto>:/backup alpine:3.22 tar czf /backup/raices-data.tgz -C /data .
docker compose start app
```

Copia también `.env` de forma privada: sin `SECRETS_KEY` no se pueden descifrar las credenciales Telegram. Para restaurar, detén la aplicación, recupera los archivos del backup en el mismo volumen con propietario UID/GID 1000, restaura esa clave y reinicia. Prueba una restauración antes de depender de ella para un taller.

Si cambias el token Telegram, guárdalo en la pantalla Profesor y verifica su envío. Cambiar `TEACHER_PASSWORD` y reiniciar no revoca cookies docentes existentes durante sus ocho horas de vigencia; puedes revocarlas borrando `teacher_sessions` en una ventana de mantenimiento o esperar su vencimiento. Cambiar `SECRETS_KEY` requiere volver a configurar Telegram con el token original.

## Límites operativos

Los grupos duran siete días por defecto; historial y alertas, treinta días. Borrar la sesión elimina su token, dispositivos, configuración, códigos, lecturas y alertas con claves foráneas. La limpieza se ejecuta al iniciar y cada hora. El dashboard limita su respuesta a las últimas 5.000 lecturas y marca `historyTruncated`; CSV exporta todas las lecturas retenidas. La exportación JSON contiene sesión, dispositivos, últimas lecturas, umbrales y hasta 10.000 alertas; la serie temporal completa se obtiene en CSV.

Una instancia admite hasta tres conexiones SSE por sesión, cinco dispositivos activos por sesión y un umbral por sensor. El compilador admite una compilación simultánea, código de hasta 60 KB y plazo de sesenta segundos. El cliente recibe 429 si está ocupado. Telegram entrega una notificación por vez, con tres intentos y pausa entre mensajes; los registros pendientes sobreviven al reinicio. Una solicitud aceptada por Telegram se registra como entregada; eso no demuestra que una persona la haya leído.

La auditoría de estaciones se ejecuta cada veinte segundos; después de 120 segundos sin telemetría de un dispositivo de hardware que ya transmitió, registra una alerta de conexión perdida. Al volver a recibir datos registra recuperación. Estas alertas no requieren un umbral de sensor y no demuestran un cable desconectado: pueden indicar falta de alimentación, USB, Wi-Fi o servidor remoto. Se configuran con `DEVICE_OFFLINE_SECONDS` y `DEVICE_AUDIT_SECONDS`; un dispositivo revocado o una simulación no genera estos avisos.

Node, Caddy, Docker, librerías y firmware necesitan actualizaciones regulares. Las imágenes base emplean versiones mayores explícitas; para una liberación repetible fija sus digests después de construir y verificar en tu infraestructura. Este repositorio entrega la composición y documentación; no crea por sí solo un dominio ni publica un servicio externo.

El flujo `.github/workflows/validate.yml` comprueba build, tests de software y firmware, navegador y construcción de las dos imágenes en GitHub Actions. Incluye una compilación real de la estación dentro del servicio aislado. Su presencia en Git no implica una ejecución exitosa: revisa los resultados del flujo de la rama publicada. En un entorno con red restringida, los builds requieren acceso a npm, al registro Docker y a los dominios oficiales Arduino; conserva siempre la verificación TLS y los checksums.
