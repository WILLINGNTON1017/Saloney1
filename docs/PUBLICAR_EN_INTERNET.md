# Publicar SALONEY en Internet

El servidor local depende del computador encendido y sin suspensión. Una dirección 127.0.0.1 no sirve desde otro dispositivo. Para acceso desde cualquier lugar se necesita alojamiento público con HTTPS y MySQL persistente.

Se añadió un Dockerfile para ejecutar únicamente el servidor web, sin abrir Chrome ni iniciar el MySQL de Windows. El contenedor no incluye .env, copias de seguridad, sesiones ni los datos locales. La construcción Docker queda pendiente de comprobar en el proveedor.

## Configuración del alojamiento

- Crear un servicio MySQL con almacenamiento persistente y la base saloney.
- Crear un servicio para esta aplicación usando el Dockerfile.
- Configurar MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE con los datos del MySQL del alojamiento. No usar las direcciones locales del computador.
- Mantener NODE_ENV=production, DEMO_SEED=false, DB_DRIVER=mysql, HOST=0.0.0.0. El proveedor puede asignar PORT.
- Para una base nueva, configurar ADMIN_EMAIL y ADMIN_PASSWORD (al menos 12 caracteres); se crea el administrador al primer inicio. No publicar cuentas de demostración con contraseñas conocidas.
- Activar una dirección pública HTTPS. Mantener una sola instancia de aplicación durante esta etapa.
- Para trasladar las citas actuales, preparar una copia y una migración controlada antes del primer arranque con datos. No reemplazar ni vaciar la base local.

Opción de alojamiento: https://railway.com/ con MySQL https://docs.railway.com/databases/mysql. Precios sujetos al proveedor: https://docs.railway.com/pricing. Hace falta una cuenta del propietario y seleccionar el plan antes de publicar. No hay una publicación activa todavía.

## Notificaciones y disponibilidad

La campana consulta los avisos cada 15 segundos mientras SALONEY está visible y al volver a la pestaña. Las nuevas reservas, reprogramaciones y cancelaciones notifican a la profesional asignada. La lectura queda guardada.

La clienta recibe un recordatorio al consultar la aplicación dentro de las 24 horas anteriores y otro dentro de las 3 horas anteriores. No se envían mensajes WhatsApp, correos ni notificaciones push con la aplicación cerrada. Los recordatorios permiten confirmar asistencia o cancelar antes de comenzar; esta cancelación desde el recordatorio se permite incluso dentro del límite habitual de cancelación. Libera el horario y avisa a la manicurista. No registra ni devuelve pagos automáticamente.

Mi disponibilidad muestra mes, día y tramos de 30 minutos. Un horario libre permite crear un bloqueo; uno ocupado abre la cita. Al habilitar un bloqueo se libera todo su intervalo original, después de confirmar.

## Recordatorios por WhatsApp

El servidor revisa las reservas cada 30 segundos y programa avisos 2 horas y 30 minutos antes, en hora de Colombia. La clienta acepta el envío en la reserva y se usa el teléfono indicado en ese momento. Las citas anteriores siguen sin suscripción. Un aviso cuyo plazo ya llegó al reservar o reprogramar se omite. Tras una interrupción se admite un retraso de hasta cinco minutos.

Para una demostración, activa el Sandbox de WhatsApp de Twilio y vincula el teléfono de prueba enviando el código de unión que aparece en la consola. Configura en el servidor las cuatro variables TWILIO de .env.example. Usa el número remitente internacional del Sandbox y el Content SID de su plantilla Appointment Reminders. La primera variable de la plantilla es la fecha y la segunda es la hora de Colombia. Reinicia el servidor y reserva una cita de prueba con el consentimiento marcado. Comprueba la entrega en el celular y en el registro de mensajes de Twilio.

Para atender clientas reales, configura el remitente del salón y una plantilla de WhatsApp aprobada con esas mismas dos variables. El servidor debe permanecer encendido. El proceso registra errores del proveedor en el log del servidor. Los estados de entrega se consultan en Twilio.
