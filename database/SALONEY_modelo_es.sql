-- Modelo completo para revisar en MySQL 8.0.16 o posterior.
-- Se instala en una base separada: no reemplaza ni copia los datos de saloney.
CREATE DATABASE IF NOT EXISTS saloney_modelo_es
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE saloney_modelo_es;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    nombre_usuario VARCHAR(80) NOT NULL,
    correo VARCHAR(160) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL,
    activo INT NOT NULL DEFAULT 1,
    especialidad VARCHAR(200) NOT NULL DEFAULT '',
    fecha_creacion VARCHAR(30) NOT NULL,
    eliminado INT NOT NULL DEFAULT 0,
    tema VARCHAR(10) NOT NULL DEFAULT 'claro',
    foto_perfil TEXT,

    PRIMARY KEY (id),

    UNIQUE KEY unico_nombre_usuario (nombre_usuario),
    UNIQUE KEY unico_correo (correo),

    KEY indice_usuarios_rol_estado (rol, activo)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS servicios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    precio INT NOT NULL,
    duracion INT NOT NULL,
    activo INT NOT NULL DEFAULT 1,
    imagen INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_cliente BIGINT DEFAULT NULL,
    nombre_invitado VARCHAR(100) NOT NULL DEFAULT '',
    telefono_invitado VARCHAR(30) NOT NULL DEFAULT '',
    id_manicurista BIGINT NOT NULL,
    id_servicio BIGINT NOT NULL,
    fecha VARCHAR(10) NOT NULL,
    hora VARCHAR(5) NOT NULL,
    duracion INT NOT NULL,
    precio INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    diseno VARCHAR(80) NOT NULL DEFAULT '',
    color VARCHAR(40) NOT NULL DEFAULT '',
    notas VARCHAR(1000) NOT NULL DEFAULT '',
    motivo VARCHAR(500) NOT NULL DEFAULT '',
    fecha_creacion VARCHAR(30) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL DEFAULT '',
    destino_pago VARCHAR(30) NOT NULL DEFAULT '',
    telefono_whatsapp VARCHAR(20) NOT NULL DEFAULT '',
    whatsapp_desde VARCHAR(30) NOT NULL DEFAULT '',
    aviso_whatsapp_2h INT NOT NULL DEFAULT 0,
    aviso_whatsapp_30min INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id),

    KEY indice_citas_servicio (id_servicio),
    KEY indice_citas_manicurista_fecha (
        id_manicurista,
        fecha,
        estado
    ),
    KEY indice_citas_cliente_fecha (id_cliente, fecha),

    CONSTRAINT fk_citas_cliente
        FOREIGN KEY (id_cliente)
        REFERENCES usuarios (id),

    CONSTRAINT fk_citas_manicurista
        FOREIGN KEY (id_manicurista)
        REFERENCES usuarios (id),

    CONSTRAINT fk_citas_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicios (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    id_cita BIGINT NOT NULL,
    mensaje VARCHAR(500) NOT NULL,
    fecha_creacion VARCHAR(30) NOT NULL,
    fecha_lectura VARCHAR(30) DEFAULT NULL,

    PRIMARY KEY (id),

    KEY indice_notificaciones_usuario (id_usuario),
    KEY indice_notificaciones_cita (id_cita),

    CONSTRAINT fk_notificaciones_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id),

    CONSTRAINT fk_notificaciones_cita
        FOREIGN KEY (id_cita)
        REFERENCES citas (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_cita BIGINT NOT NULL,
    monto INT NOT NULL,
    metodo VARCHAR(30) NOT NULL,
    estado VARCHAR(20) NOT NULL,
    fecha VARCHAR(10) NOT NULL,
    id_usuario_confirmacion BIGINT DEFAULT NULL,
    fecha_confirmacion VARCHAR(30) NOT NULL DEFAULT '',

    PRIMARY KEY (id),

    UNIQUE KEY unico_pago_cita (id_cita),

    KEY indice_pagos_fecha_estado (fecha, estado),
    KEY indice_pagos_usuario_confirmacion (
        id_usuario_confirmacion
    ),

    CONSTRAINT fk_pagos_cita
        FOREIGN KEY (id_cita)
        REFERENCES citas (id),

    CONSTRAINT fk_pagos_usuario_confirmacion
        FOREIGN KEY (id_usuario_confirmacion)
        REFERENCES usuarios (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    existencias INT NOT NULL DEFAULT 0,
    existencias_minimas INT NOT NULL DEFAULT 5,
    activo INT NOT NULL DEFAULT 1,
    costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    unidad VARCHAR(30) NOT NULL DEFAULT 'unidad',
    fecha_creacion VARCHAR(30) DEFAULT NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insumos_manicuristas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_producto BIGINT NOT NULL,
    id_manicurista BIGINT NOT NULL,
    cantidad INT NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fecha_inicio VARCHAR(30) NOT NULL,
    fecha_agotamiento VARCHAR(30) NOT NULL DEFAULT '',

    PRIMARY KEY (id),

    UNIQUE KEY unico_entrega_producto (id, id_producto),
    KEY indice_insumos_producto (id_producto),
    KEY indice_insumos_manicurista (
        id_manicurista,
        fecha_agotamiento
    ),

    CONSTRAINT fk_insumos_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos (id),

    CONSTRAINT fk_insumos_manicurista
        FOREIGN KEY (id_manicurista)
        REFERENCES usuarios (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- Historial del almacén. Una fila representa un producto en una operación.
-- El signo indica entrada (+) o salida (-). Los importes se expresan en COP.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_producto BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL COMMENT 'Responsable que registró el movimiento',
    id_entrega BIGINT NULL COMMENT 'Entrega vinculada si recibió el producto una manicurista',
    tipo_movimiento VARCHAR(30) NOT NULL,
    cantidad INT NOT NULL,
    existencias_antes INT NOT NULL,
    existencias_despues INT NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL,
    valor_movimiento DECIMAL(24,2) GENERATED ALWAYS AS (ABS(cantidad) * costo_unitario) STORED,
    motivo VARCHAR(200) NOT NULL,
    fecha_creacion DATETIME(3) NOT NULL COMMENT 'Fecha y hora UTC registrada por el servidor',
    PRIMARY KEY (id),
    UNIQUE KEY unico_movimiento_entrega (id_entrega),
    KEY indice_movimientos_producto_fecha (id_producto, fecha_creacion, id),
    KEY indice_movimientos_fecha (fecha_creacion, id),
    KEY indice_movimientos_responsable (id_usuario, fecha_creacion),
    CONSTRAINT fk_movimiento_producto FOREIGN KEY (id_producto) REFERENCES productos(id),
    CONSTRAINT fk_movimiento_responsable FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
    CONSTRAINT fk_movimiento_entrega FOREIGN KEY (id_entrega, id_producto)
        REFERENCES insumos_manicuristas(id, id_producto),
    CONSTRAINT verificar_saldo CHECK (existencias_antes >= 0 AND existencias_despues >= 0
        AND existencias_despues = existencias_antes + cantidad),
    CONSTRAINT verificar_costo CHECK (costo_unitario >= 0),
    CONSTRAINT verificar_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) > 0),
    CONSTRAINT verificar_tipo CHECK (
        (tipo_movimiento = 'Entrada' AND cantidad > 0 AND id_entrega IS NULL) OR
        (tipo_movimiento = 'Salida' AND cantidad < 0 AND id_entrega IS NULL) OR
        (tipo_movimiento = 'Entrega a manicurista' AND cantidad < 0 AND id_entrega IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS disponibilidad (
    id BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario BIGINT NOT NULL,
    fecha VARCHAR(10) NOT NULL,
    hora_inicio VARCHAR(5) NOT NULL,
    hora_fin VARCHAR(5) NOT NULL,
    motivo VARCHAR(200) NOT NULL,

    PRIMARY KEY (id),

    KEY indice_disponibilidad_usuario_fecha (
        id_usuario,
        fecha
    ),

    CONSTRAINT fk_disponibilidad_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS configuracion (
    id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    correo VARCHAR(160) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    horas_cancelacion INT NOT NULL,
    horas_anticipacion INT NOT NULL,
    minutos_anticipacion INT DEFAULT NULL,
    hora_apertura VARCHAR(5) NOT NULL,
    hora_cierre VARCHAR(5) NOT NULL,
    enlace_instagram VARCHAR(500) NOT NULL DEFAULT '',
    enlace_facebook VARCHAR(500) NOT NULL DEFAULT '',

    PRIMARY KEY (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones (
    clave_sesion VARCHAR(64) NOT NULL,
    id_usuario BIGINT NOT NULL,
    fecha_vencimiento VARCHAR(30) NOT NULL,
    ultima_actividad VARCHAR(30) NOT NULL DEFAULT '',

    PRIMARY KEY (clave_sesion),

    KEY indice_sesiones_usuario (id_usuario),
    KEY indice_sesiones_vencimiento (fecha_vencimiento),

    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS bloqueo_aplicacion (
    id INT NOT NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


INSERT INTO bloqueo_aplicacion (id)
SELECT 1
WHERE NOT EXISTS (
    SELECT 1
    FROM bloqueo_aplicacion
    WHERE id = 1
);

-- Consulta para el administrador o para la presentación en clase.
SELECT m.id, CONVERT_TZ(m.fecha_creacion, '+00:00', '-05:00') AS fecha_hora_colombia,
       p.nombre AS producto, m.tipo_movimiento, m.cantidad,
       m.existencias_antes, m.existencias_despues, m.costo_unitario, m.valor_movimiento,
       responsable.nombre AS registrado_por, manicurista.nombre AS recibido_por, m.motivo
FROM movimientos_inventario m
JOIN productos p ON p.id = m.id_producto
JOIN usuarios responsable ON responsable.id = m.id_usuario
LEFT JOIN insumos_manicuristas e ON e.id = m.id_entrega
LEFT JOIN usuarios manicurista ON manicurista.id = e.id_manicurista
ORDER BY m.fecha_creacion DESC, m.id DESC;
