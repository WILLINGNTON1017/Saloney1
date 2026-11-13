# Cobertura de requisitos

Los identificadores siguientes corresponden al documento “Requisitos funcionales de SALONEY”. Las diferencias entre documentos se resolvieron con la indicación del usuario de que la cliente elige a la manicurista.

| Requisito                 | Implementación                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- |
| RF01 Registro             | Cuenta pública de cliente con validación y duplicados                              |
| RF02 Inicio de sesión     | Usuario o correo y contraseña                                                      |
| RF03 Roles                | Rol obtenido del servidor; panel y permisos correspondientes                       |
| RF04 Reserva sin cuenta   | Nombre, teléfono, profesional, servicio, fecha y hora                              |
| RF05 Reserva con cuenta   | Reserva asociada al usuario autenticado                                            |
| RF06 Disponibilidad       | Calendario y horas libres con validación por duración                              |
| RF07 Confirmación         | Número de reserva, resumen y estado pendiente                                      |
| RF08 Gestión de citas     | Consulta, detalle, filtros, reprogramación y estados                               |
| RF09 Manicuristas         | Creación administrativa de cuentas profesionales                                   |
| RF10 Servicios            | Crear, editar, consultar, activar/desactivar y eliminar cuando no tienen historial |
| RF11 Panel cliente        | Próximas citas, historial, datos y profesional elegida                             |
| RF12 Historial            | Persistencia y consulta de citas anteriores                                        |
| RF13 Acumulación de citas | Contadores derivados de citas de la cliente                                        |
| RF14 Dinero gastado       | Suma de pagos recibidos, no de reservas pendientes                                 |
| RF15 Panel manicurista    | Resumen y citas de la profesional autenticada                                      |
| RF16 Agenda               | Agenda semanal y consulta de citas                                                 |
| RF17 Estados              | Transiciones controladas y rechazo con motivo                                      |
| RF18 Clientes             | Búsqueda, edición e historial administrativo                                       |
| RF19 Usuarios             | Creación, consulta, roles y activación/desactivación                               |
| RF20 Pagos                | Registro por cita, método, fecha y estado                                          |
| RF21 Reportes             | Filtro de fechas, indicadores y exportación CSV                                    |
| RF22 Cierre de sesión     | Invalida la sesión en la base y elimina la cookie                                  |

## Casos adicionales

Los casos de uso también incluyen preferencias de diseños/colores, elección de profesionales, modificación de cita, rechazo y registro de atención, perfil y disponibilidad. Estas funciones están implementadas. La recuperación de contraseña utiliza intervención administrativa; no se configuró un proveedor de correo.

## Validación realizada

- Suite de integración: **15 resultados aprobados en SQLite y 15 en MySQL 8.0.46** (14 comprobaciones funcionales y su grupo de ejecución).
- Escenarios: registro y roles, acceso privado, solicitudes de origen externo, reservas simultáneas, duración, aislamiento de clientes, transiciones, pagos idempotentes, stock negativo, invitadas, bloqueos, reprogramación/cancelación, catálogo e invalidación de sesión.
- Revisión de navegador: inicio, acceso, panel administrativo, panel de cliente, panel de manicurista y reserva completa guardada en MySQL.
- Revisión responsive del flujo de reserva a 390 px y del panel a 1440 px. No se detectó desbordamiento horizontal en la página móvil de reserva.
- Creación de copias de seguridad comprobada con SQLite y MySQL. Restauración de una copia MySQL en una base SQLite vacía comprobada.

No se realizaron pruebas de carga, auditoría de penetración ni compatibilidad visual exhaustiva en todos los navegadores. Las instrucciones de restauración y operación están en el README.
