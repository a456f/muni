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

-- 3. Insertar roles base con los sistemas correctos que esperan las APIs
-- WEB: panel web | APP_SERENO: app movil del sereno | APP_ALMACEN: app del almacenero
INSERT IGNORE INTO rol (nombre, sistema) VALUES
('superadmin', 'WEB'),
('admin', 'WEB'),
('operador', 'WEB'),
('supervisor', 'WEB'),
('sereno', 'APP_SERENO'),
('supervisor_sereno', 'APP_SERENO'),
('almacenero', 'APP_ALMACEN'),
('logistica', 'APP_ALMACEN'),
('medico', 'WEB'),
('enfermero', 'WEB'),
('paramedico', 'WEB'),
('personal_salud', 'WEB');

-- 4. Asignar rol superadmin al usuario admin (busca por nombre, no por id fijo)
INSERT IGNORE INTO usuario_rol (id_usuario, id_rol)
SELECT u.id_usuario, r.id_rol
FROM usuario u, rol r
WHERE u.username = 'admin' AND r.nombre = 'superadmin';
