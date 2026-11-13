# SALONEY · Empieza aquí

Este proyecto es una aplicación web para gestionar un salón de uñas. Tiene tres roles: clienta, manicurista y administrador. Esta guía te permite localizar el código, entender cómo se conecta y explicar cada parte.

## Abrir y ejecutar

1. Abre `SALONEY.code-workspace` en Visual Studio Code.
2. Abre el Explorador con **Ctrl + Mayús + E** para ver las carpetas.
3. Pulsa **F5** para iniciar SALONEY. Si el servidor ya está encendido, abre `http://127.0.0.1:3000`.
4. Puedes iniciar también con doble clic en `iniciar.cmd`.

No se ejecuta con Live Server: la aplicación necesita su servidor y MySQL.

## Orden para leer el proyecto

| Orden | Archivo                     | Qué explica                                                              |
| ----- | --------------------------- | ------------------------------------------------------------------------ |
| 1     | `scripts/start.js`          | Cómo se pone en marcha el proyecto y se carga la configuración.          |
| 2     | `public/index.html`         | La página base, los estilos y la carga del código de pantalla.           |
| 3     | `public/app.js`             | Pantallas, formularios, navegación y acciones de los botones.            |
| 4     | `server/index.js`           | Cómo el servidor recibe las peticiones, revisa permisos y procesa datos. |
| 5     | `server/db.js`              | Conexión a la base de datos y actualización de las tablas.               |
| 6     | `database/saloney.sql`      | Tablas y relaciones del esquema MySQL exportado.                         |
| 7     | `tests/integration.test.js` | Ejemplos que comprueban los flujos y los permisos.                       |

## Carpetas

```text
Saloney1/
├── public/       Pantallas, estilos, imágenes y código del navegador
├── server/       Lógica del salón, seguridad y acceso a los datos
├── database/     Estructura SQL de la base de datos
├── scripts/      Arranque, comprobaciones, respaldo y mantenimiento
├── tests/        Pruebas automáticas con datos separados de los reales
├── docs/         Explicaciones técnicas y guías
├── .vscode/      Configuración del editor, tareas y depuración
├── data/         Datos locales y archivos de comprobación generados
└── backups/      Copias de seguridad
```

Las carpetas `node_modules` y `.pnpm-store` contienen dependencias descargadas. Están ocultas en el Explorador para facilitar la lectura, pero permanecen en el disco. El código de SALONEY sigue visible. Puedes volver a mostrarlas desde `.vscode/settings.json`, en `files.exclude`.

## Dónde cambiar cada función

| Función                                            | Archivos                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Pantallas, reserva y calendario                    | `public/app.js`                                                       |
| Diseño general y adaptación de tamaños             | `public/styles.css`, `public/layout-fixes.css`                        |
| Modo claro y oscuro                                | `public/theme.css`, `public/preferences.js`                           |
| Imágenes de servicios                              | `public/photos.js`, `public/assets/`                                  |
| Correo, Instagram, Facebook y enlace a WhatsApp    | `public/app.js`, `public/social.js`, configuración del salón en MySQL |
| Sesión independiente en cada pestaña               | `public/tab-session.js`, `server/session-cookie.js`                   |
| Contraseñas y validación de datos                  | `server/security.js`                                                  |
| Estado de conexión, eliminación de cuentas y pagos | `server/account-features.js`                                          |
| Recordatorios dentro de la aplicación              | `server/reminders.js`, `server/index.js`, `public/app.js`             |
| Facturas y reportes PDF                            | `server/pdf.js`                                                       |
| Cálculo de servicios finalizados                   | `public/service-totals.js`                                            |
| Datos iniciales de una instalación nueva           | `server/seed.js`                                                      |

## Ejemplo: recorrido de una reserva

La clienta selecciona servicio, profesional, fecha y hora en `public/app.js`. La pantalla envía una petición al servidor. `server/index.js` valida los datos y comprueba que el horario esté libre. `server/db.js` ejecuta las consultas en MySQL. La reserva y el aviso a la manicurista se guardan; la pantalla muestra el resultado.

Cerrar la sesión de una manicurista no impide reservar con ella. Su tarjeta muestra Activa o Desconectada; la disponibilidad depende de sus citas y bloqueos.

## Herramientas para estudiar el código

- **Ctrl + P**: buscar un archivo por nombre.
- **Ctrl + Mayús + O**: ver las funciones del archivo abierto.
- **Ctrl + Mayús + F**: buscar un texto en todo el proyecto.
- **Ctrl + clic** en una función: ir a su definición cuando el editor la reconoce.
- **Ctrl + Mayús + B**: comprobar la sintaxis con la tarea configurada.
- La extensión recomendada Prettier mantiene el formato al guardar, si está instalada.

Los comentarios explican las responsabilidades de cada parte. Para comprender un botón, busca su `data-action` en `public/app.js` y después la ruta `/api` correspondiente en `server/index.js`.

## Lo que está preparado y lo que falta conectar

SALONEY funciona localmente con MySQL. El enlace de recuperación abre un correo para solicitar ayuda; el enlace de WhatsApp abre el chat. Los envíos automáticos externos y la recuperación mediante enlace seguro todavía requieren implementación y conexión a los proveedores. El alojamiento público también está pendiente. No confundir estas funciones con los avisos que ya aparecen en la campana dentro de SALONEY.

Más información en `docs/GUIA_DEL_CODIGO.md` y `docs/PUBLICAR_EN_INTERNET.md`.
