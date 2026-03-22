import express from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../server.js';

const router = express.Router();

// Configurar multer para fotos de revisión
const revisionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/revisiones/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `rev_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const uploadRevision = multer({
    storage: revisionStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, ext);
    }
});

// --- 1. Endpoint de Login para la App de Almacén ---
router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }

    try {
        // Buscamos el usuario y sus roles
        const [rows] = await db.query(`
            SELECT
                u.id_usuario, u.username, u.password_hash,
                p.id_personal, p.nombres, p.apellidos, p.dni, p.codigo_personal,
                GROUP_CONCAT(r.nombre) as roles
            FROM usuario u
            JOIN personal p ON u.id_personal = p.id_personal
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN rol r ON ur.id_rol = r.id_rol
            WHERE u.username = ? AND u.estado = 1
            GROUP BY u.id_usuario
        `, [usuario]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Usuario incorrecto o inactivo.' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        // --- VALIDACIÓN DE ROL ---
        // Verificamos si entre sus roles tiene permisos de almacén
        // Puedes ajustar estos nombres ('almacenero', 'logistica') según los tengas en tu tabla 'rol'
        const rolesUser = user.roles ? user.roles.toLowerCase().split(',') : [];
        const tieneAcceso = rolesUser.some(r => ['almacenero'].includes(r.trim()));

        if (!tieneAcceso) {
            return res.status(403).json({ message: 'Acceso denegado: Su usuario no tiene el rol de Almacén.' });
        }

        res.json({
            message: 'Login exitoso',
            token: `token_almacen_${user.id_usuario}`,
            usuario: {
                id: user.id_usuario,
                id_personal: user.id_personal,
                username: user.username,
                nombre_completo: `${user.nombres} ${user.apellidos}`,
                dni: user.dni || '',
                codigo_personal: user.codigo_personal || '',
                roles: user.roles ? user.roles.split(',') : []
            }
        });

    } catch (err) {
        console.error("Error en login almacen:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// --- 2. Endpoint para Escanear/Consultar Equipo ---
router.post('/escanear', async (req, res) => {
    const { codigo } = req.body; // El código escaneado (QR/Barras)

    if (!codigo) {
        return res.status(400).json({ message: 'Se requiere un código para buscar.' });
    }

    try {
        // Busca el equipo por identificador o número de serie
        const [equipos] = await db.query(`
            SELECT 
                e.*,
                te.nombre as tipo_nombre,
                p.nombre as persona_asignada,
                ar.nombre as area_asignada
            FROM equipos e
            LEFT JOIN tipos_equipo te ON e.tipo_id = te.id
            LEFT JOIN asignaciones asg ON e.id = asg.equipo_id AND asg.estado = 'ACTIVO'
            LEFT JOIN personas p ON asg.persona_id = p.id
            LEFT JOIN areas ar ON asg.area_id = ar.id
            WHERE e.identificador = ? OR e.numero_serie = ?
            LIMIT 1
        `, [codigo, codigo]);

        if (equipos.length > 0) {
            const equipo = equipos[0];
            res.json({
                encontrado: true,
                mensaje: 'Equipo encontrado.',
                data: equipo
            });
        } else {
            res.status(404).json({
                encontrado: false,
                mensaje: 'No se encontró ningún equipo con ese código.'
            });
        }

    } catch (err) {
        console.error("Error al escanear equipo:", err);
        res.status(500).json({ error: "Error al procesar el escaneo: " + err.message });
    }
});

// --- 3. Registrar Revisión de Equipo (desde la app del almacenero) ---
router.post('/revision', uploadRevision.single('foto'), async (req, res) => {
    const { equipo_id, usuario_id, ubicacion, latitud, longitud, comentario } = req.body;

    if (!equipo_id || !usuario_id) {
        return res.status(400).json({ message: 'equipo_id y usuario_id son requeridos.' });
    }

    try {
        const fotoRuta = req.file ? req.file.path.replace(/\\/g, '/') : null;

        const [result] = await db.query(
            `INSERT INTO revisiones_equipo (equipo_id, usuario_id, ubicacion, latitud, longitud, comentario, foto_ruta)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [equipo_id, usuario_id, ubicacion || null, latitud || null, longitud || null, comentario || null, fotoRuta]
        );

        // Obtener nombre del equipo y revisor para la notificación
        const [[equipoInfo]] = await db.query(
            "SELECT e.descripcion, e.identificador FROM equipos e WHERE e.id = ?", [equipo_id]
        );
        const [[revisorInfo]] = await db.query(
            `SELECT CONCAT(p.nombres, ' ', p.apellidos) as nombre FROM usuario u
             JOIN personal p ON u.id_personal = p.id_personal WHERE u.id_usuario = ?`, [usuario_id]
        );

        const revId = result.insertId;

        // Emitir notificación en tiempo real
        const io = req.app.get('io');
        if (io) {
            io.emit('nueva_revision', {
                id_revision: revId,
                equipo: equipoInfo?.descripcion || 'Equipo',
                equipo_codigo: equipoInfo?.identificador || '',
                revisor: revisorInfo?.nombre || 'Almacenero',
                ubicacion: ubicacion || '',
                comentario: comentario || '',
                message: `Nueva revisión de equipo "${equipoInfo?.descripcion || ''}" por ${revisorInfo?.nombre || 'Almacenero'}`
            });
        }

        res.status(201).json({
            message: 'Revisión registrada con éxito.',
            id_revision: revId
        });
    } catch (err) {
        console.error("Error al registrar revisión:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. Obtener revisiones de un equipo (para el sistema web) ---
router.get('/revisiones/:equipo_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.*,
                CONCAT(p.nombres, ' ', p.apellidos) as nombre_revisor
            FROM revisiones_equipo r
            JOIN usuario u ON r.usuario_id = u.id_usuario
            JOIN personal p ON u.id_personal = p.id_personal
            WHERE r.equipo_id = ?
            ORDER BY r.fecha_revision DESC
        `, [req.params.equipo_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 5. Historial de revisiones del almacenero (para la app) ---
router.get('/mis-revisiones/:usuario_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.id,
                r.equipo_id,
                r.ubicacion,
                r.comentario,
                r.foto_ruta,
                r.fecha_revision,
                e.descripcion as equipo_nombre,
                e.identificador as equipo_codigo,
                e.marca,
                e.modelo,
                e.numero_serie,
                te.nombre as tipo_equipo
            FROM revisiones_equipo r
            JOIN equipos e ON r.equipo_id = e.id
            LEFT JOIN tipos_equipo te ON e.tipo_id = te.id
            WHERE r.usuario_id = ?
            ORDER BY r.fecha_revision DESC
        `, [req.params.usuario_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 6. Obtener todas las revisiones recientes (para dashboard) ---
router.get('/revisiones', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.*,
                e.descripcion as equipo_nombre,
                e.identificador as equipo_codigo,
                te.nombre as tipo_equipo,
                CONCAT(p.nombres, ' ', p.apellidos) as nombre_revisor
            FROM revisiones_equipo r
            JOIN equipos e ON r.equipo_id = e.id
            LEFT JOIN tipos_equipo te ON e.tipo_id = te.id
            JOIN usuario u ON r.usuario_id = u.id_usuario
            JOIN personal p ON u.id_personal = p.id_personal
            ORDER BY r.fecha_revision DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
