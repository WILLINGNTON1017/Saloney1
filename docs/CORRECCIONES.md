# Correcciones de conexión y navegación

- Se reemplazó la conexión MySQL única por un pool que descarta conexiones cerradas. Las transacciones siguen usando la misma conexión hasta confirmar o revertir, manteniendo el bloqueo de reservas.
- Se corrigió el inicio de MySQL para conservarlo como proceso supervisado, con salida de diagnóstico. La configuración del proyecto prevalece sobre variables ajenas.
- El menú se actualiza al navegar. Si falla una consulta, se muestra un error dentro de la sección solicitada con la opción Reintentar, manteniendo la navegación disponible.
- Reintentar vuelve a consultar la sesión, además de los datos. Los errores de red se explican en español e indican cómo abrir el servidor local.
- Cerrar sesión aparece también en la barra superior. El menú tiene desplazamiento propio y reserva espacio para el botón inferior, incluso en pantallas bajas o con zoom.
- Se verificaron las nueve consultas administrativas, el acceso y el cierre de sesión. La suite MySQL pasó sus 15 resultados.

El servidor y MySQL deben seguir ejecutándose para usar la aplicación. Inicia SALONEY mediante `iniciar.cmd` y minimiza su ventana; al cerrarla se puede perder la conexión local.

La estructura ordenada de la base que actualmente usa el proyecto se encuentra en `database/saloney.sql`. Los datos existentes se conservan.
