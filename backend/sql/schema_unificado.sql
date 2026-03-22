CREATE TABLE personal (
  id_personal INT AUTO_INCREMENT PRIMARY KEY,
  codigo_personal VARCHAR(20) NOT NULL UNIQUE,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  dni VARCHAR(15) UNIQUE,
  correo VARCHAR(100),
  telefono VARCHAR(20),
  direccion VARCHAR(150),
  estado TINYINT DEFAULT 1,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  id_personal INT NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  estado TINYINT DEFAULT 1,
  ultimo_login DATETIME NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_personal
    FOREIGN KEY (id_personal) REFERENCES personal(id_personal)
    ON DELETE CASCADE
);

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  sistema VARCHAR(30) NOT NULL,
  UNIQUE KEY uq_rol_sistema_nombre (sistema, nombre)
);

CREATE TABLE usuario_rol (
  id_usuario INT NOT NULL,
  id_rol INT NOT NULL,
  PRIMARY KEY (id_usuario, id_rol),
  CONSTRAINT fk_usuario_rol_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
    ON DELETE CASCADE,
  CONSTRAINT fk_usuario_rol_rol
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
    ON DELETE CASCADE
);

INSERT INTO rol (nombre, sistema) VALUES
('superadmin', 'WEB'),
('admin', 'WEB'),
('usuario_prueba', 'WEB'),
('usuario_simple', 'WEB'),
('sereno', 'APP_SERENO'),
('supervisor_sereno', 'APP_SERENO'),
('almacenero', 'APP_ALMACEN'),
('supervisor_almacen', 'APP_ALMACEN');

-- Ajustes para tablas operativas existentes:
-- asignacion_patrullas: usar id_personal en lugar de id_sereno
-- incidencias: usar id_personal en lugar de id_sereno
