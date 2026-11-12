# Base de datos saloney

**Para la presentación:** abre `SALONEY_modelo_es.sql` en MySQL Workbench. Define las doce tablas del proyecto con nombres en español en una base independiente (`saloney_modelo_es`). Es un modelo de estructura, no un respaldo de los registros del salón. La consulta final permite recorrer el historial por fecha, producto, responsable y destinataria.

**Ejemplo del historial:** si entran 10 frascos por compra y se entrega uno a una manicurista, quedan dos movimientos: `Entrada: +10, de 0 a 10` y `Entrega a manicurista: −1, de 10 a 9`. Si se agota el frasco, cambia el estado de la entrega; no se vuelve a restar. Una reposición sí produce otra salida. Crear la ficha de un producto tampoco es una entrada de mercancía. Las citas y los pagos se registran en sus propias tablas.

`saloney.sql` contiene la estructura real del proyecto, ordenada por dependencias y comentada en español, siguiendo el formato del ejemplo enviado. Incluye creación de la base, claves primarias, relaciones, índices y la fila de control de transacciones. Se puede abrir en MySQL Workbench y ejecutar sobre una base nueva.

Se conserva el nombre de las tablas usadas por la aplicación para mantener su funcionamiento. No se ejecuta `DROP DATABASE` ni se borran registros. `CREATE TABLE IF NOT EXISTS` no modifica una tabla que ya existe con otra estructura: no lo uses para mezclar esquemas diferentes en una base que tenga datos.

| Concepto | Tabla del proyecto |
| --- | --- |
| Usuarios, clientes y manicuristas | `users`, diferenciados por `role` |
| Servicios | `services` |
| Citas | `appointments` |
| Pagos | `payments` |
| Productos | `products` |
| Entradas y salidas | `stock_movements` |
| Bloqueos de disponibilidad | `availability` |
| Configuración | `settings` |
| Sesiones | `sessions` |
| Control de concurrencia | `app_lock` |

El ejemplo recibido permitía asignar la profesional después de reservar. Aquí `professional_id` es obligatorio, respetando tu indicación de que **la cliente elige la manicurista**. Las invitadas pueden reservar sin una cuenta y los pagos conservan un registro único por cita.

Las tablas de ventas de productos y notificaciones del ejemplo no se agregan como estructuras desconectadas del sistema actual. Si se implementan esos módulos, requieren su correspondiente migración y operaciones de aplicación.

Para instalar con datos iniciales ejecuta el servidor siguiendo el README principal. Las contraseñas se generan con scrypt desde la aplicación; el archivo SQL no incluye credenciales.

Para regenerar el archivo y crear los índices faltantes sin borrar datos: `node scripts/organize-database.js`.
