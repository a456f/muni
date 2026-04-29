-- =====================================================================
-- Seed: Crear usuario admin por defecto
-- Usuario: admin
-- Password: admin123
-- =====================================================================

USE sistema_denuncias;

-- 1. Insertar persona admin (si no existe)
INSERT IGNORE INTO personal (id_personal, dni, nombres, apellidos, correo, estado)
VALUES (1, '00000001', 'Administrador', 'Sistema', 'admin@oisgo.local', 1);

-- 2. Insertar usuario admin (si no existe)
INSERT IGNORE INTO usuario (id_usuario, id_personal, username, password_hash, estado, fecha_creacion)
VALUES (1, 1, 'admin', '$2b$10$sAAAHY7XjZGLAEFa/FBAfen1dFmked8oZzx31iU0XL/F1U4U124S6', 1, NOW());

-- 3. Insertar roles base si no existen
INSERT IGNORE INTO rol (id_rol, nombre, sistema, descripcion) VALUES
(1, 'superadmin', 'WEB', 'Acceso total al sistema web'),
(2, 'admin', 'WEB', 'Administrador del panel'),
(3, 'operador', 'WEB', 'Operador del panel'),
(4, 'sereno', 'MOVIL', 'Sereno con app movil'),
(5, 'almacenero', 'MOVIL', 'Almacenero con app movil'),
(6, 'supervisor', 'WEB', 'Supervisor de operaciones');

-- 4. Asignar rol superadmin al usuario admin
INSERT IGNORE INTO usuario_rol (id_usuario, id_rol) VALUES (1, 1);
