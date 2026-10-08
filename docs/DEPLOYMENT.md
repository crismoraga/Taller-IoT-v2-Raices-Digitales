# Despliegue HTTPS con persistencia

La composición incluye tres procesos: aplicación Node 24 con SQLite, compilador Arduino aislado y Caddy para certificados HTTPS. Se usa una única réplica de la aplicación y un volumen persistente. SQLite no se comparte por NFS ni entre múltiples contenedores de aplicación.

Requisitos del servidor: Docker Engine con Compose v2, DNS propio apuntando al servidor, puertos TCP 80/443 abiertos, conexión saliente para ACME y Telegram, al menos 2 GB de RAM y almacenamiento para imágenes/toolchain. La construcción del compilador descarga dependencias oficiales. El contenedor compilador en ejecución sólo tiene red privada interna; no tiene salida a Internet.

1. Copia `.env.example` a `.env` y configura:

```dotenv
DOMAIN=tu-dominio-publico
ACME_EMAIL=tu-correo-real
TEACHER_PASSWORD=una-contraseña-propia-de-al-menos-12-caracteres
SECRETS_KEY=clave-base64-generada-de-32-bytes
ARDUINO_SERVICE_TOKEN=otra-clave-aleatoria-de-al-menos-32-caracteres
SESSION_DAYS=7
RETENTION_DAYS=30
```

Genera cada clave por separado con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Conserva `.env` fuera del repositorio y protege permisos del archivo. `DOMAIN` no incluye `https://`; Compose genera `APP_ORIGIN=https://...`. No hay valores de contraseña predefinidos.

2. Construye y arranca:

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 app compiler caddy
```

3. Abre `https://tu-dominio-publico`, crea un grupo y revisa `/api/health`. Debe indicar `ok:true` y `arduinoAvailable:true` al completarse la instalación de AVR. Comprueba profesor, prueba Telegram con credenciales válidas, pairing y una lectura real. El firewall debe exponer únicamente Caddy; la aplicación y el compilador no publican puertos en el host. Caddy mantiene streaming SSE con `flush_interval -1`.

La Pico contiene `firmware/ca.pem`, la CA pública **ISRG Root X1**, con vigencia hasta junio de 2035. Caddy usa exclusivamente ACME de Let's Encrypt y solicita la cadena cuya raíz es X1. Esto mantiene la cadena del servidor compatible con el almacén reducido de la placa. Si cambias de emisor/cadena, actualiza la CA de la Pico y vuelve a validar TLS; no desactives la comprobación. La configuración se apoya en [issuer y preferred_chains de Caddy](https://caddyserver.com/docs/caddyfile/directives/tls#issuers) y las [cadenas oficiales de Let's Encrypt](https://letsencrypt.org/certificates/).

El volumen `raices_data` contiene sesiones, telemetría, alertas y secretos cifrados. `caddy_data` contiene certificados. Reiniciar con `docker compose restart` conserva datos. No uses `docker compose down -v` si quieres conservarlos.

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
