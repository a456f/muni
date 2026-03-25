-- ============================================
-- MIGRACIÓN: Módulo de Salud Ampliado
-- Tablas: tipo_atencion_salud, establecimiento_salud, traslado_salud
-- ============================================

-- 1. Tipos de Atención de Salud
CREATE TABLE IF NOT EXISTS `tipo_atencion_salud` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text,
  `estado` tinyint DEFAULT 1,
  `fecha_registro` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Datos iniciales de tipos de atención (basados en la imagen)
INSERT INTO tipo_atencion_salud (nombre) VALUES
('ATENCION GENERAL'),
('INYECTABLES Y TOMA DE PRESION'),
('ACCIDENTE DE TRANSITO'),
('DESMAYO Y PARO CARDIACO'),
('OTROS'),
('ACCIDENTE DOMESTICO'),
('PACIENTE PSIQUIATRICO'),
('AGRESION A PERSONAS EN ESTADO...'),
('INTENTO DE SUICIDIO'),
('INCIDENTES EN PLAYA');

-- 2. Establecimientos de Salud (Hospitales, Clínicas, Boticas)
CREATE TABLE IF NOT EXISTS `establecimiento_salud` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `tipo` enum('HOSPITAL','CLINICA','BOTICA','CENTRO DE SALUD','OTRO') NOT NULL DEFAULT 'HOSPITAL',
  `direccion` varchar(255),
  `telefono` varchar(20),
  `distrito` varchar(100),
  `estado` tinyint DEFAULT 1,
  `fecha_registro` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Datos iniciales de establecimientos (basados en la imagen)
INSERT INTO establecimiento_salud (nombre, tipo) VALUES
('Hospital Angamos', 'HOSPITAL'),
('Hospital Casimiro Ulloa', 'HOSPITAL'),
('Clinica Good Hope', 'CLINICA'),
('Clinica Delgado', 'CLINICA'),
('No Especificado', 'OTRO'),
('Hospital Lazaro Hemoglobin Martinez', 'HOSPITAL'),
('Clinica el Golf', 'CLINICA'),
('Clinica Ricardo Palma', 'CLINICA'),
('Hospital Maria Auxiliadora Noldes Carrin', 'HOSPITAL'),
('Hospital Central FAP', 'HOSPITAL'),
('Hospital Naval', 'HOSPITAL'),
('Hospital PNP', 'HOSPITAL');

-- 3. Agregar columna tipo_atencion_id a la tabla atencion
ALTER TABLE `atencion` ADD COLUMN `tipo_atencion_id` int DEFAULT NULL AFTER `paciente_id`;
ALTER TABLE `atencion` ADD CONSTRAINT `fk_atencion_tipo` FOREIGN KEY (`tipo_atencion_id`) REFERENCES `tipo_atencion_salud` (`id`);

-- 4. Traslados a establecimientos de salud (historial de asignaciones)
CREATE TABLE IF NOT EXISTS `traslado_salud` (
  `id` int NOT NULL AUTO_INCREMENT,
  `atencion_id` int NOT NULL,
  `establecimiento_id` int NOT NULL,
  `fecha_traslado` datetime DEFAULT CURRENT_TIMESTAMP,
  `hora_traslado` time DEFAULT NULL,
  `observaciones` text,
  `estado` enum('PENDIENTE','EN_TRASLADO','RECIBIDO','CANCELADO') DEFAULT 'PENDIENTE',
  `registrado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_traslado_atencion` (`atencion_id`),
  KEY `idx_traslado_establecimiento` (`establecimiento_id`),
  CONSTRAINT `traslado_salud_ibfk_1` FOREIGN KEY (`atencion_id`) REFERENCES `atencion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `traslado_salud_ibfk_2` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimiento_salud` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
