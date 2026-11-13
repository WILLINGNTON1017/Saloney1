# SALONEY

Aplicación web para un salón de uñas, construida con los tres documentos de requisitos y las referencias de interfaz proporcionadas. Incluye sitio público, reservas y paneles de cliente, manicurista y administrador, con identidad rosada y blanca y adaptación a móvil.

**Regla confirmada por el usuario:** la cliente elige la manicurista durante la reserva. El administrador no reasigna a otra profesional. La manicurista elegida confirma o rechaza la solicitud.

## Código principal y Visual Studio Code

Abre `SALONEY.code-workspace` y consulta [la guía del código](docs/GUIA_DEL_CODIGO.md). El iniciador principal es `scripts/start.js`; las pantallas están en `public/app.js` y la API en `server/index.js`. Con F5 puedes iniciar y depurar el servidor. El lanzador abre Google Chrome si está instalado.

## Abrir el proyecto en este equipo

1. Abre `iniciar.cmd` desde la carpeta del proyecto y mantén abierta su ventana mientras usas SALONEY. Puedes minimizarla.
2. Visita **http://127.0.0.1:3000**.
3. Usa una cuenta de demostración de la tabla siguiente, o registra una cliente.

La configuración local de `.env` utiliza **MySQL 8.0 en el puerto 3307**, con una instancia dedicada a este proyecto y datos en `data/mysql`. Las credenciales del usuario de base de datos se generan aleatoriamente. No se usan las credenciales de otra instalación de MySQL. El iniciador vuelve a levantar esta instancia si está apagada. La configuración de `.env` tiene prioridad sobre variables de otras sesiones del equipo.

Si SALONEY ya está abierto, utiliza el enlace; no necesitas iniciar otra copia del servidor. El servidor web se detiene al cerrar su terminal o con Ctrl+C. MySQL continúa como proceso local. Para detenerlo ordenadamente, utiliza `node --env-file=.env scripts/stop-mysql.js`.

### Cuentas de demostración

| Rol           | Usuario     | Correo                  | Contraseña     |
| ------------- | ----------- | ----------------------- | -------------- |
| Administrador | `admin`     | `admin@saloney.com`     | `Saloney2026!` |
| Cliente       | `maria`     | `maria@saloney.com`     | `Saloney2026!` |
| Manicurista   | `ana`       | `ana@saloney.com`       | `Saloney2026!` |
| Manicurista   | `valentina` | `valentina@saloney.com` | `Saloney2026!` |
| Manicurista   | `carolina`  | `carolina@saloney.com`  | `Saloney2026!` |
| Cliente       | `laura`     | `laura@saloney.com`     | `Saloney2026!` |

El formulario identifica el rol por la cuenta; no permite seleccionarlo. Los datos iniciales son ejemplos. Las citas de ejemplo se crean alrededor de la fecha de la primera ejecución.

## Funciones

- **Público:** inicio, información del salón, catálogo con precios y duración, registro, inicio de sesión y reserva sin cuenta con nombre y teléfono.
- **Cliente:** elección de servicio y manicurista, calendario, horarios disponibles, preferencias de diseño y color, confirmación, próximas citas, historial, modificación y cancelación dentro del plazo, total pagado y edición del perfil.
- **Manicurista:** panel propio, citas asignadas, agenda semanal, detalle de atención, confirmación/rechazo con motivo, inicio y finalización de atención, historial de sus clientes, bloqueos de disponibilidad, estadísticas y perfil.
- **Administrador:** panel general, búsqueda y gestión de clientes/usuarios/manicuristas, roles y activación, catálogo, gestión de citas, pagos, productos, movimientos de inventario, ajustes y reportes por período con exportación CSV.
- **Reportes:** estados, servicios más y menos solicitados, citas por profesional, horarios con más reservas, clientes frecuentes, clientes nuevos, ingresos por fecha/servicio, métodos de pago, clientes que más gastan, citas sin pago y stock bajo. El período se puede configurar para consultar días, semanas o meses.

Las cifras se calculan a partir de la base de datos. Las imágenes del catálogo son ilustrativas; una fotografía generada de manicure sirve como recurso visual común.

## Instalación en otro equipo

Requiere Node.js **24 o superior**. El frontend usa módulos JavaScript nativos y no necesita compilación. Para MySQL se instala el controlador `mysql2`:

```sh
corepack pnpm install
```

Si no dispones de Corepack, puedes usar `npm install`. El proyecto incluye `pnpm-lock.yaml` para instalaciones reproducibles con pnpm.

### MySQL

1. Crea una base `saloney` con `utf8mb4` y un usuario limitado a esa base.
2. Copia `.env.example` como `.env` y configura `DB_DRIVER=mysql`, host, puerto, usuario, contraseña y base.
3. Ejecuta `node --env-file=.env server/index.js`.

El servidor crea las tablas de `database/schema.sql` si no existen. Para una instalación nueva sin ejemplos establece `DEMO_SEED=false`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres); se creará la cuenta `admin`. No cambies la configuración de ejemplos esperando que se borren usuarios ya existentes: nunca se borran automáticamente.

También se incluye `docker-compose.yml` para MySQL 8.4 si tienes Docker. Define `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD` en `.env`, ejecuta `docker compose up -d` y usa el puerto 3306. No necesitas Docker para la instancia local ya configurada.

### Demostración sin MySQL

Configura `DB_DRIVER=sqlite` y `DEMO_SEED=true`, o ejecuta `node server/index.js` sin cargar `.env`. La base queda en `data/saloney.db`. Esta alternativa usa la misma API y los mismos controles de acceso, pero no reemplaza la configuración MySQL del proyecto.

## Pruebas

```sh
node --test tests/integration.test.js
node --env-file=.env scripts/test-mysql.js
```

La primera orden crea una base SQLite aislada. La segunda crea una base MySQL `saloney_test_<fecha>` y requiere la credencial administrativa de la instancia local en `.env`. Las pruebas no alteran las citas reales del proyecto.

Se comprueban roles, registro y duplicados, protección de origen, reservas simultáneas y duración, propiedad de las citas, transiciones de estado, pagos, inventario, reservas de visitante, bloqueos, reprogramación/cancelación, conservación del historial y cierre de sesión.

## Copias de seguridad

```sh
node --env-file=.env scripts/backup.js
node --env-file=.env scripts/restore.js backups/archivo.json
```

La copia consistente se guarda en `backups/` e incluye datos e identificadores; excluye sesiones. **La restauración solo acepta una base vacía** y no reemplaza datos existentes. Configura la base de destino en `.env` antes de restaurar. Los respaldos contienen información privada y hashes de contraseña: mantenlos en una ubicación protegida. Para copias operativas completas de MySQL también puedes usar `mysqldump` con la cuenta administradora de la instancia.

## Estructura

```text
public/                 Interfaz, estilos e imágenes
server/index.js         Servidor HTTP, API y permisos
server/db.js            Adaptadores MySQL / SQLite
server/security.js      Validación, contraseñas y utilidades
server/seed.js          Catálogo y datos de demostración
database/schema.sql     Modelo relacional
scripts/                Inicio, respaldo y pruebas de MySQL
tests/                  Pruebas de integración
docs/                   Arquitectura y cobertura de requisitos
```

## Seguridad y alcance

- Contraseñas con scrypt y sal individual; nunca se devuelven hashes a la interfaz.
- Sesiones con tokens aleatorios, almacenados como hash, vencimiento y cookies HttpOnly / SameSite. En producción se activa Secure.
- Permisos y propiedad de citas validados en el servidor; no dependen de los menús.
- Consultas parametrizadas, transacciones y bloqueo compartido entre procesos para evitar reservas simultáneas y stock inconsistente.
- Validación de entradas, límite de tamaño, limitación de intentos, comprobación de origen y política de contenido.
- El precio se obtiene del servicio y queda guardado en la cita. Un pago por cita evita ingresos duplicados. Los servicios con historial se desactivan en lugar de borrarse.

La entrega funciona **localmente**. Para uso público se requiere alojamiento compatible con Node.js/MySQL, HTTPS, cuentas reales y datos de contacto definitivos. La configuración de producción se realiza sobre una base nueva, sin usuarios de demostración. No se configuraron envíos de correo/SMS, pasarela de cobro, calificaciones ni recordatorios externos. La recuperación de contraseña se hace mediante la administración, que verifica la identidad y asigna una clave temporal. Los pagos son registros administrativos, no cargos bancarios.

Los textos de privacidad son una base informativa del proyecto; adapta los datos del responsable y las condiciones definitivas antes de operar con clientes reales. No publiques `.env`, `data/` ni `backups/`.
