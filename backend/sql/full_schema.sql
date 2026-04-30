-- =====================================================================
-- SCHEMA COMPLETO DEL SISTEMA OISGO
-- Todas las tablas necesarias para el funcionamiento del sistema
-- =====================================================================

USE sistema_denuncias;

SET FOREIGN_KEY_CHECKS = 0;

-- ===== CATALOGOS BASE =====

CREATE TABLE IF NOT EXISTS distritos (
    id_distrito INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zonas (
    id_zona INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_distrito INT NULL,
    INDEX idx_distrito (id_distrito)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sectores (
    id_sector INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_zona INT NULL,
    descripcion TEXT,
    estado TINYINT DEFAULT 1,
    INDEX idx_zona (id_zona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sector_puntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_sector INT NOT NULL,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL,
    orden INT DEFAULT 0,
    INDEX idx_sector (id_sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS puntos_geograficos (
    id_punto INT AUTO_INCREMENT PRIMARY KEY,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== PERSONAL Y USUARIOS =====

CREATE TABLE IF NOT EXISTS personal (
    id_personal INT AUTO_INCREMENT PRIMARY KEY,
    codigo_personal VARCHAR(20) UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dni VARCHAR(8) NOT NULL,
    correo VARCHAR(100),
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    id_area INT NULL,
    id_sector INT NULL,
    estado TINYINT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dni (dni),
    INDEX idx_area (id_area),
    INDEX idx_sector (id_sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_personal INT NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    estado TINYINT DEFAULT 1,
    ultimo_login DATETIME NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_personal (id_personal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rol (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    sistema VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuario_rol (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    UNIQUE KEY unique_user_role (id_usuario, id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla legacy
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    correo VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    telefono VARCHAR(20),
    estado TINYINT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== INCIDENCIAS Y SERENOS =====

CREATE TABLE IF NOT EXISTS tipos_incidencia (
    id_tipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20),
    descripcion TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS estados_incidencia (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prioridad_incidencia (
    id_prioridad INT AUTO_INCREMENT PRIMARY KEY,
    nivel VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS incidencias (
    id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
    numero_parte VARCHAR(50) UNIQUE,
    servicio VARCHAR(50),
    zona VARCHAR(100),
    dia VARCHAR(20),
    fecha DATE,
    hora_hecho TIME,
    hora_denuncia TIME,
    hora_intervencion TIME,
    modalidad_intervencion VARCHAR(100),
    unidad_serenazgo VARCHAR(100),
    lugar_hecho VARCHAR(255),
    tipo_hecho VARCHAR(100),
    arma_usada VARCHAR(100),
    monto_afectado DECIMAL(10,2),
    nombres_agraviado VARCHAR(255),
    senas_autor TEXT,
    supervisor_nombre VARCHAR(255),
    descripcion_relato TEXT,
    firma_ruta VARCHAR(255),
    id_sereno INT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sereno (id_sereno),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS archivos (
    id_archivo INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo_archivo INT,
    ruta_archivo VARCHAR(255) NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evidencias (
    id_evidencia INT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia INT NOT NULL,
    id_archivo INT NOT NULL,
    descripcion TEXT,
    INDEX idx_incidencia (id_incidencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== EQUIPOS Y ALMACÉN =====

CREATE TABLE IF NOT EXISTS tipos_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_id INT NOT NULL,
    descripcion VARCHAR(255),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    numero_serie VARCHAR(100) UNIQUE,
    identificador VARCHAR(100),
    sbn VARCHAR(50),
    estado VARCHAR(30) DEFAULT 'ALMACEN',
    operatividad VARCHAR(15) DEFAULT 'OPERATIVO',
    validacion VARCHAR(15) DEFAULT 'PENDIENTE',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo_id),
    INDEX idx_serie (numero_serie),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    persona_id INT NULL,
    area_id INT NULL,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion DATETIME NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    INDEX idx_equipo (equipo_id),
    INDEX idx_persona (persona_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_equipos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    persona_id INT NULL,
    area_id INT NULL,
    movimiento VARCHAR(50),
    observaciones TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_equipo (equipo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS revisiones_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    usuario_id INT NULL,
    ubicacion VARCHAR(255),
    latitud DECIMAL(10,7),
    longitud DECIMAL(10,7),
    comentario TEXT,
    fecha_revision DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_equipo (equipo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fotos_almacen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referencia_id INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ref (referencia_id, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inconsistencias_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    codigo_encontrado VARCHAR(100),
    descripcion TEXT,
    motivo VARCHAR(255),
    ubicacion VARCHAR(255),
    latitud DECIMAL(10,7),
    longitud DECIMAL(10,7),
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    resolucion TEXT,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camaras_instaladas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL,
    direccion VARCHAR(255),
    referencia VARCHAR(255),
    estado ENUM('ACTIVA','INACTIVA','MANTENIMIENTO','DAÑADA') DEFAULT 'ACTIVA',
    fecha_instalacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    observacion TEXT,
    UNIQUE KEY unique_equipo (equipo_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== PATRULLAJE =====

CREATE TABLE IF NOT EXISTS patrullas (
    id_patrulla INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    tipo VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS turnos (
    id_turno INT AUTO_INCREMENT PRIMARY KEY,
    nombre_turno VARCHAR(50) NOT NULL,
    hora_inicio TIME,
    hora_fin TIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asignacion_patrullas (
    id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
    id_personal INT NOT NULL,
    id_patrulla INT NOT NULL,
    id_turno INT NOT NULL,
    fecha DATE NOT NULL,
    INDEX idx_personal (id_personal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    detalles TEXT,
    tipo_operacion VARCHAR(30),
    fecha_operacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== SUPERVISORES =====

CREATE TABLE IF NOT EXISTS asignacion_supervisores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supervisor_id INT NOT NULL,
    sereno_id INT NOT NULL,
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion DATETIME NULL,
    INDEX idx_supervisor (supervisor_id),
    INDEX idx_sereno (sereno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_supervisores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NULL,
    supervisor_id INT NULL,
    sereno_id INT NULL,
    accion VARCHAR(30),
    detalle TEXT,
    fecha_operacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== SALUD =====

CREATE TABLE IF NOT EXISTS paciente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(8) UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    edad INT,
    sexo CHAR(1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tipo_atencion_salud (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado TINYINT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS establecimiento_salud (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(50),
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    distrito VARCHAR(100),
    estado TINYINT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS atencion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(50) UNIQUE,
    fecha DATE,
    hora_inicio TIME,
    hora_fin TIME,
    paciente_id INT NULL,
    tipo_atencion_id INT NULL,
    INDEX idx_paciente (paciente_id),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ocurrencia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    operador VARCHAR(100),
    hora_llamada TIME,
    hora_ingreso TIME,
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evaluacion_medica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    motivo TEXT,
    enfermedad_actual TEXT,
    examen_fisico TEXT,
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diagnostico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    descripcion TEXT,
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tratamiento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    descripcion TEXT,
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clasificacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    tipo VARCHAR(100),
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS atencion_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    personal_id INT NOT NULL,
    INDEX idx_atencion (atencion_id),
    INDEX idx_personal (personal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS traslado_salud (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atencion_id INT NOT NULL,
    establecimiento_id INT NULL,
    hora_traslado TIME,
    fecha_traslado DATETIME,
    observaciones TEXT,
    estado VARCHAR(30),
    INDEX idx_atencion (atencion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== CIUDADANOS Y DENUNCIAS =====

CREATE TABLE IF NOT EXISTS ciudadanos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    direccion VARCHAR(255),
    estado TINYINT DEFAULT 1,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS denuncias_ciudadano (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_denuncia VARCHAR(30) UNIQUE,
    ciudadano_id INT NULL,
    tipo_incidencia VARCHAR(255),
    descripcion TEXT NOT NULL,
    lugar_hecho VARCHAR(255) NOT NULL,
    referencia VARCHAR(255),
    latitud DECIMAL(10,7),
    longitud DECIMAL(10,7),
    es_anonimo TINYINT DEFAULT 0,
    estado VARCHAR(30) DEFAULT 'RECIBIDO',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    INDEX idx_ciudadano (ciudadano_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fotos_denuncia_ciudadano (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50),
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_denuncia (denuncia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_denuncia_ciudadano (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    estado VARCHAR(30),
    comentario TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_denuncia (denuncia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seguimiento_denuncia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denuncia_id INT NOT NULL,
    usuario_id INT NULL,
    ciudadano_id INT NULL,
    mensaje TEXT NOT NULL,
    estado_nuevo VARCHAR(30),
    tipo_autor ENUM('OPERADOR','CIUDADANO') DEFAULT 'OPERADOR',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_denuncia (denuncia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== ALERTAS DE PÁNICO =====

CREATE TABLE IF NOT EXISTS alertas_panico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ciudadano_id INT NULL,
    latitud DECIMAL(10,7) NOT NULL,
    longitud DECIMAL(10,7) NOT NULL,
    direccion VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    sereno_id INT NULL,
    atendido_por VARCHAR(100),
    observacion TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_atencion DATETIME NULL,
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alertas_panico_sereno (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sereno_id INT NOT NULL,
    latitud DECIMAL(10,7) DEFAULT 0,
    longitud DECIMAL(10,7) DEFAULT 0,
    mensaje TEXT,
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    atendido_por VARCHAR(100),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_atencion DATETIME NULL,
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ===== DATOS BASE =====

-- Roles
INSERT IGNORE INTO rol (nombre, sistema) VALUES
('superadmin', 'WEB'),
('admin', 'WEB'),
('operador', 'WEB'),
('supervisor', 'WEB'),
('sereno', 'APP_SERENO'),
('supervisor_sereno', 'APP_SERENO'),
('almacenero', 'APP_ALMACEN'),
('logistica', 'APP_ALMACEN');

-- Estados de incidencia
INSERT IGNORE INTO estados_incidencia (nombre) VALUES
('REGISTRADO'),('EN PROCESO'),('ATENDIDO'),('RESUELTO'),('ARCHIVADO');

-- Prioridades
INSERT IGNORE INTO prioridad_incidencia (nivel) VALUES
('BAJA'),('MEDIA'),('ALTA'),('CRITICA');

-- Tipos de archivo
INSERT IGNORE INTO archivos (id_archivo) VALUES (0);
DELETE FROM archivos WHERE id_archivo = 0;

-- Admin user (DNI 00000001 / username admin / password admin123)
INSERT IGNORE INTO personal (id_personal, dni, nombres, apellidos, correo, estado)
VALUES (1, '00000001', 'Administrador', 'Sistema', 'admin@oisgo.local', 1);

INSERT IGNORE INTO usuario (id_personal, username, password_hash, estado)
VALUES (1, 'admin', '$2b$10$alTXMPuWdoJivmXR6LBcLeB/H7itm0d8UH5h3aBMFfGLSj.XPuUmK', 1);

INSERT IGNORE INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol
FROM usuario u, rol r
WHERE u.username = 'admin' AND r.nombre = 'superadmin';
