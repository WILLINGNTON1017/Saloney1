# Guía del código de SALONEY

## PDF y acceso desde el teléfono

En Reportes usa **Descargar PDF** para el período seleccionado. En Pagos, cada registro pagado incluye **Factura PDF**; también aparece en el detalle de la cita para su cliente, la manicurista asignada y el administrador. Son comprobantes internos, no facturas electrónicas validadas. El servidor genera estos documentos con `server/pdf.js`.

Para abrir desde el teléfono, conecta ambos dispositivos a la misma Wi-Fi y utiliza la IPv4 del computador con `:3000`, no `127.0.0.1`. La configuración actual escucha en la red local (`HOST=0.0.0.0`). Si Windows bloquea la conexión, haz clic derecho en `activar-telefono.cmd` y selecciona **Ejecutar como administrador**; autoriza el puerto 3000 únicamente para la subred local y muestra la dirección que debes abrir. Mantén el servidor y el computador encendidos. La IP puede cambiar cuando cambies de red; algunas redes de invitados impiden comunicación entre dispositivos.

## Cambios de cuentas y preferencias

### Pagos y comprobantes

Al confirmar una reserva se elige directamente **Efectivo, Nequi o Bancolombia**. La cliente ve solo el número de la cuenta seleccionada para copiarlo. En el detalle de la cita puede cambiar su elección mientras el pago no esté confirmado. El administrador o la manicurista asignada pueden corregir el medio de pago.

Para transferencias aparece **Enviar comprobante por WhatsApp**, dirigido al **3132887785**, con el número de cita, cliente, servicio, fecha, valor y destino. La cliente debe adjuntar la imagen y enviar el mensaje dentro de WhatsApp. La aplicación no envía mensajes automáticamente, no guarda el archivo del comprobante y no verifica el banco. El personal coteja la referencia, valor y fecha con el abono real.

En el detalle de la cita, el personal usa **Confirmar pago recibido**, selecciona el medio real y marca que recibió el dinero. Se registra quién confirmó y cuándo. Solo los pagos confirmados se suman a los ingresos del mes; cada cita admite un único pago, incluso ante clics simultáneos. Las cifras son ingresos recibidos, no ganancias netas después de gastos. La manicurista ve los ingresos de sus citas y el administrador los del salón.

- Cada pestaña nueva abre el inicio sin sesión, incluso si se copia una dirección de un panel. Puede entrar con la misma cuenta u otra y navegar por separado. F5 conserva su sesión; cerrar sesión en una pestaña no cierra las demás. Las citas y los datos siguen perteneciendo a la cuenta, no a la pestaña. El identificador de pestaña está en `public/tab-session.js` y las cookies HttpOnly independientes se gestionan en `server/session-cookie.js`.
- El inicio sin sesión siempre es blanco con rosado. Al entrar se recupera el tema de esa cuenta guardado en MySQL; al salir vuelve al claro. Cada cuenta conserva su elección hasta cambiarla.

- El administrador tiene **Eliminar** en Clientes, Manicuristas y Usuarios. La eliminación retira la cuenta e invalida sus sesiones, conservando el historial. Primero deben gestionarse sus citas pendientes. No se permite eliminar la propia cuenta.
- En **Mis citas → Ver detalles → Elegir método de pago**, la cliente elige Efectivo o Transferencia. Las transferencias permiten elegir Nequi **3132887785** o Bancolombia, ahorros **64579908309**, y copiar los números. Elegir un método no confirma un pago recibido.
- **Activo/Inactivo** indica si la cuenta está habilitada; **En línea/Desconectada** indica presencia reciente. Se actualiza cada 30 segundos y caduca tras 90 segundos sin actividad de la pestaña. La reserva ofrece las profesionales conectadas; las citas anteriores conservan el nombre de quien las atiende.
- El botón **Claro / oscuro** guarda el tema en la cuenta cuando hay una sesión iniciada. Su código está en `public/preferences.js` y `public/theme.css`.
- El registro comienza vacío. La aplicación sugiere únicamente el último usuario que inició sesión en este navegador, después de tres letras coincidentes. El autocompletado adicional de Chrome depende de su configuración y puede ignorar `autocomplete="off"`.
- El administrador puede editar el usuario y restablecer la contraseña. Puede mostrar la nueva contraseña mientras la escribe; las anteriores se guardan como hashes y no se pueden visualizar.
- Las redes aparecen también dentro de la sesión. Los enlaces definitivos se configuran en Ajustes; no hay inicio de sesión social con Google/Facebook.
- `iniciar.cmd`, `npm start` y F5 abren **Google Chrome** si está instalado. `scripts/open-chrome.js` espera a que SALONEY responda antes de abrirlo.

## ¿Cuál es el código principal?

**Para iniciar todo el proyecto, el archivo principal es `scripts/start.js`.** Lee la configuración de `.env`, comprueba el servidor, inicia la instancia local de MySQL cuando corresponde y carga `server/index.js`.

Si quieres cambiar **lo que aparece en pantalla**, empieza por **`public/app.js`**. Si quieres cambiar **cómo se guardan y validan los datos**, empieza por **`server/index.js`**.

| Archivo                     | Para qué sirve                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| `iniciar.cmd`               | Abre SALONEY con doble clic en Windows.                                |
| `scripts/start.js`          | Punto de entrada para ejecutar la aplicación.                          |
| `server/index.js`           | Servidor, rutas de la API, operaciones y permisos de cada rol.         |
| `public/index.html`         | Página base que carga los estilos y el JavaScript.                     |
| `public/app.js`             | Pantallas, menús, formularios, reservas y eventos de los botones.      |
| `public/styles.css`         | Colores, tamaños y diseño visual.                                      |
| `public/layout-fixes.css`   | Ajustes de distribución, menú y acceso al cierre de sesión.            |
| `public/icons.js`           | Iconos de la interfaz.                                                 |
| `public/social.js`          | Presentación de Instagram y Facebook.                                  |
| `server/social.js`          | Validación de enlaces de redes sociales.                               |
| `server/db.js`              | Conexión a MySQL o SQLite y creación/actualización de tablas.          |
| `server/security.js`        | Contraseñas, validaciones y utilidades de seguridad.                   |
| `server/seed.js`            | Usuarios, servicios y datos iniciales de demostración.                 |
| `database/schema.sql`       | Estructura utilizada por el servidor para crear las tablas.            |
| `database/saloney.sql`      | Exportación ordenada de la estructura MySQL para consultar o importar. |
| `.env`                      | Configuración privada: conexión, credenciales y puerto.                |
| `.env.example`              | Ejemplo de configuración para otra instalación.                        |
| `package.json`              | Dependencias y comandos del proyecto.                                  |
| `tests/integration.test.js` | Pruebas de reservas, roles, pagos, inventario y sesiones.              |

## Cómo se conecta todo

```text
iniciar.cmd / F5 / npm start
            ↓
     scripts/start.js
            ↓
     server/index.js ── server/db.js ── MySQL: saloney
            ↑
       solicitudes /api
            ↑
 public/app.js + public/index.html + estilos CSS
            ↑
         Navegador
```

## Abrir en Visual Studio Code

1. En Visual Studio Code, selecciona **Archivo → Abrir área de trabajo desde archivo** y elige `SALONEY.code-workspace`. También puedes usar **Abrir carpeta** y seleccionar `Saloney1`.
2. Abre `docs/GUIA_DEL_CODIGO.md` para orientarte. Con **Ctrl+Shift+V** puedes ver esta guía con formato.
3. En **Terminal → Nueva terminal**, ejecuta `node --version`. Necesitas Node.js 24 o superior. Si no se reconoce el comando, instala Node.js y vuelve a abrir VS Code. El lanzador `iniciar.cmd` también puede usar el Node incluido en este equipo.
4. Si faltan las dependencias, ejecuta `npm install`. Si utilizas pnpm, ejecuta `pnpm install --frozen-lockfile`.
5. Pulsa **F5** y selecciona **SALONEY: iniciar y depurar**, o ejecuta `npm start` en la terminal.
6. Abre `http://127.0.0.1:3000`. Mantén abierta la terminal durante el uso.

Si ya hay un servidor en el puerto 3000, el iniciador te avisa y no inicia otra copia. Para depurar con F5, detén primero la ejecución anterior con **Ctrl+C** en su terminal. Puedes colocar puntos de interrupción en `server/index.js`; el código de `public/app.js` se ejecuta en el navegador.

La base existente está configurada en `.env` como `saloney`, en el puerto **3307**. No copies `.env.example` encima de tu `.env` actual. No necesitas volver a importar SQL para abrir el proyecto.

**No abras `public/index.html` con doble clic ni con Live Server:** SALONEY necesita su servidor Node para iniciar sesión y consultar MySQL.

## Comandos útiles

| Comando                | Acción                                             |
| ---------------------- | -------------------------------------------------- |
| `npm start`            | Iniciar la aplicación.                             |
| `npm run dev`          | Iniciar con vigilancia de cambios del servidor.    |
| `npm run check`        | Comprobar sintaxis sin tocar los datos.            |
| `npm test`             | Ejecutar las pruebas en SQLite aislado.            |
| `npm run test:mysql`   | Ejecutar las pruebas en una base MySQL de pruebas. |
| `npm run format`       | Ordenar el formato del código.                     |
| `npm run format:check` | Comprobar el formato.                              |
| `npm run backup`       | Crear una copia de los datos.                      |

VS Code también incluye estas tareas en **Terminal → Ejecutar tarea**. **Ctrl+Shift+B** comprueba la sintaxis. Puedes instalar la extensión recomendada **Prettier** para aplicar el formato al guardar.

## Dónde hacer cada cambio

- **Textos, botones y formularios:** `public/app.js`. Busca con Ctrl+F el texto que aparece en pantalla.
- **Diseño y colores:** `public/styles.css` y `public/layout-fixes.css`.
- **Teléfono y redes del salón:** panel de administrador → Ajustes; se guardan en MySQL.
- **Reservas, pagos y permisos:** `server/index.js`. Las reglas deben validarse en el servidor además de la interfaz.
- **Nuevas columnas o tablas:** `database/schema.sql` y la migración correspondiente en `server/db.js`. Editar un SQL por sí solo no actualiza una base ya creada.

`node_modules` contiene bibliotecas instaladas; no es código que debas editar. `data` contiene las bases locales y `backups` contiene respaldos. Conserva esas carpetas y mantén privadas las credenciales de `.env`.
