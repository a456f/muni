-- =====================================================================
-- Tablas adicionales agregadas después del schema_completo.sql
-- Ejecutar después de schema_completo.sql
-- =====================================================================

USE sistema_denuncias;

-- Ciudadanos (app móvil)
CREATE TABLE IF NOT EXISTS ciudadanos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    direccion VARCHAR(255) NULL,
    estado TINYINT DEFAULT 1,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Denuncias del ciudadano
CREATE TABLE IF NOT EXISTS denuncias_ciudadano (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_denuncia VARCHAR(30) NULL,
    ciudadano_id INT NULL,
    tipo_incidencia VARCHAR(255) NULL,
    descripcion TEXT NOT NULL,
    lugar_hecho VARCHAR(255) NOT NULL,
    referencia VARCHAR(255) NULL,
    latitud DECIMAL(10,7) NULL,
    longitud DECIMAL(10,7) NULL,
    es_anonimo TINYINT DEFAULT 0,
    estado VARCHAR(30) DEFAULT 'RECIBIDO',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    FOREIGN KEY (ciudadano_id) REFERENCES ciudadanos(id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fotos de denuncias del ciudadano
CREATE TABLE IF NOT EXISTS fotos_denuncia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (denuncia_id) REFERENCES denuncias_ciudadano(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historial de cambios de estado en denuncia ciudadano
CREATE TABLE IF NOT EXISTS historial_denuncia_ciudadano (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    estado VARCHAR(30) NOT NULL,
    comentario TEXT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (denuncia_id) REFERENCES denuncias_ciudadano(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seguimiento (chat) de denuncias
CREATE TABLE IF NOT EXISTS seguimiento_denuncia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    usuario_id INT NULL,
    ciudadano_id INT NULL,
    mensaje TEXT NOT NULL,
    estado_nuevo VARCHAR(30) NULL,
    tipo_autor ENUM('OPERADOR', 'CIUDADANO') DEFAULT 'OPERADOR',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (denuncia_id) REFERENCES denuncias_ciudadano(id) ON DELETE CASCADE,
    INDEX idx_denuncia (denuncia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inconsistencias de equipos
CREATE TABLE IF NOT EXISTS inconsistencias_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    codigo_encontrado VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    motivo TEXT NULL,
    ubicacion VARCHAR(255) NULL,
    latitud DECIMAL(10,7) NULL,
    longitud DECIMAL(10,7) NULL,
    foto_ruta VARCHAR(255) NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    resolucion TEXT NULL,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion DATETIME NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fotos de almacén (revisiones e inconsistencias)
CREATE TABLE IF NOT EXISTS fotos_almacen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referencia_id INT NOT NULL,
    tipo ENUM('revision', 'inconsistencia') NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ref (referencia_id, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alertas de pánico de ciudadanos
CREATE TABLE IF NOT EXISTS alertas_panico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ciudadano_id INT NULL,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL,
    direccion VARCHAR(255) NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    sereno_id INT NULL,
    atendido_por VARCHAR(100) NULL,
    observacion TEXT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_atencion DATETIME NULL,
    FOREIGN KEY (ciudadano_id) REFERENCES ciudadanos(id),
    FOREIGN KEY (sereno_id) REFERENCES personal(id_personal),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alertas de pánico de serenos
CREATE TABLE IF NOT EXISTS alertas_panico_sereno (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sereno_id INT NOT NULL,
    latitud DECIMAL(10,7) DEFAULT 0,
    longitud DECIMAL(10,7) DEFAULT 0,
    mensaje TEXT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    atendido_por VARCHAR(100) NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_atencion DATETIME NULL,
    FOREIGN KEY (sereno_id) REFERENCES personal(id_personal),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cámaras instaladas en el mapa
CREATE TABLE IF NOT EXISTS camaras_instaladas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL,
    direccion VARCHAR(255) NULL,
    referencia VARCHAR(255) NULL,
    estado ENUM('ACTIVA', 'INACTIVA', 'MANTENIMIENTO', 'DAÑADA') DEFAULT 'ACTIVA',
    fecha_instalacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    observacion TEXT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id),
    INDEX idx_estado (estado),
    UNIQUE KEY unique_equipo (equipo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Asegurar columnas en equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS sbn VARCHAR(50) NULL AFTER identificador;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS operatividad VARCHAR(15) DEFAULT 'OPERATIVO';
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS validacion VARCHAR(15) DEFAULT 'PENDIENTE';
