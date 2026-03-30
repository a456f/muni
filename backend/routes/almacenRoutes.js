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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max por archivo
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, ext);
    }
});
// Subida múltiple: hasta 4 fotos por revisión/inconsistencia
const uploadFotos = uploadRevision.array('fotos', 4);

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
router.post('/revision', uploadFotos, async (req, res) => {
    const { equipo_id, usuario_id, ubicacion, latitud, longitud, comentario } = req.body;

    if (!equipo_id || !usuario_id) {
        return res.status(400).json({ message: 'equipo_id y usuario_id son requeridos.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO revisiones_equipo (equipo_id, usuario_id, ubicacion, latitud, longitud, comentario)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [equipo_id, usuario_id, ubicacion || null, latitud || null, longitud || null, comentario || null]
        );
        const revId = result.insertId;

        // Insertar cada foto en tabla separada
        if (req.files && req.files.length > 0) {
            const fotoValues = req.files.map(f => [revId, 'revision', f.path.replace(/\\/g, '/')]);
            await connection.query(
                `INSERT INTO fotos_almacen (referencia_id, tipo, ruta) VALUES ?`,
                [fotoValues]
            );
        }

        await connection.query("UPDATE equipos SET validacion = 'VALIDADO' WHERE id = ?", [equipo_id]);
        await connection.commit();

        // Obtener nombre del equipo y revisor para la notificación
        const [[equipoInfo]] = await db.query(
            "SELECT e.descripcion, e.identificador, e.numero_serie FROM equipos e WHERE e.id = ?", [equipo_id]
        );
        const [[revisorInfo]] = await db.query(
            `SELECT CONCAT(p.nombres, ' ', p.apellidos) as nombre FROM usuario u
             JOIN personal p ON u.id_personal = p.id_personal WHERE u.id_usuario = ?`, [usuario_id]
        );

        // Emitir notificación en tiempo real
        const io = req.app.get('io');
        if (io) {
            io.emit('nueva_revision', {
                id_revision: revId,
                equipo: equipoInfo?.descripcion || 'Equipo',
                equipo_codigo: equipoInfo?.identificador || '',
                numero_serie: equipoInfo?.numero_serie || '',
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
        await connection.rollback();
        console.error("Error al registrar revisión:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
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
                r.latitud,
                r.longitud,
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

// --- 7. Registrar inconsistencia (equipo físico que no existe en la BD) ---
router.post('/inconsistencia', uploadFotos, async (req, res) => {
    const { usuario_id, codigo_encontrado, descripcion, motivo, ubicacion, latitud, longitud } = req.body;

    if (!usuario_id || !codigo_encontrado) {
        return res.status(400).json({ message: 'usuario_id y codigo_encontrado son requeridos.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO inconsistencias_equipo (usuario_id, codigo_encontrado, descripcion, motivo, ubicacion, latitud, longitud)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [usuario_id, codigo_encontrado, descripcion || null, motivo || null, ubicacion || null, latitud || null, longitud || null]
        );
        const incId = result.insertId;

        // Insertar cada foto en tabla separada
        if (req.files && req.files.length > 0) {
            const fotoValues = req.files.map(f => [incId, 'inconsistencia', f.path.replace(/\\/g, '/')]);
            await connection.query(
                `INSERT INTO fotos_almacen (referencia_id, tipo, ruta) VALUES ?`,
                [fotoValues]
            );
        }

        await connection.commit();

        // Notificación en tiempo real al panel web
        const [[revisorInfo]] = await db.query(
            `SELECT CONCAT(p.nombres, ' ', p.apellidos) as nombre FROM usuario u
             JOIN personal p ON u.id_personal = p.id_personal WHERE u.id_usuario = ?`, [usuario_id]
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('nueva_inconsistencia', {
                id: incId,
                codigo: codigo_encontrado,
                motivo: motivo || '',
                revisor: revisorInfo?.nombre || 'Almacenero',
                message: `Inconsistencia reportada: equipo "${codigo_encontrado}" no encontrado en BD - ${revisorInfo?.nombre || 'Almacenero'}`
            });
        }

        res.status(201).json({
            message: 'Inconsistencia registrada con éxito.',
            id: incId
        });
    } catch (err) {
        await connection.rollback();
        console.error("Error al registrar inconsistencia:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// --- 8. Listar inconsistencias (para el panel web y app) ---
router.get('/inconsistencias', async (req, res) => {
    const { page = 1, limit = 20, estado } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    let params = [];

    if (estado) {
        whereClause = 'WHERE i.estado = ?';
        params.push(estado);
    }

    try {
        const [countResult, dataResult] = await Promise.all([
            db.query(`SELECT COUNT(*) as total FROM inconsistencias_equipo i ${whereClause}`, params),
            db.query(`
                SELECT
                    i.*,
                    CONCAT(p.nombres, ' ', p.apellidos) as nombre_reportante
                FROM inconsistencias_equipo i
                JOIN usuario u ON i.usuario_id = u.id_usuario
                JOIN personal p ON u.id_personal = p.id_personal
                ${whereClause}
                ORDER BY i.fecha_reporte DESC
                LIMIT ? OFFSET ?
            `, [...params, limitNum, offset])
        ]);

        const total = countResult[0][0].total;
        res.json({
            data: dataResult[0],
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (err) {
        console.error("Error al listar inconsistencias:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- 9. Resolver inconsistencia (desde el panel web) ---
router.put('/inconsistencias/:id/resolver', async (req, res) => {
    const { resolucion } = req.body;
    try {
        await db.query(
            `UPDATE inconsistencias_equipo SET estado = 'RESUELTA', resolucion = ?, fecha_resolucion = NOW() WHERE id = ?`,
            [resolucion || 'Resuelta', req.params.id]
        );
        res.json({ message: 'Inconsistencia marcada como resuelta.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 10. Actualizar operatividad de equipo (desde la app) ---
router.put('/equipos/:id/operatividad', async (req, res) => {
    const { operatividad, usuario_id, comentario } = req.body;

    if (!['OPERATIVO', 'INOPERATIVO'].includes(operatividad)) {
        return res.status(400).json({ message: 'operatividad debe ser OPERATIVO o INOPERATIVO.' });
    }

    try {
        await db.query("UPDATE equipos SET operatividad = ? WHERE id = ?", [operatividad, req.params.id]);

        // Registrar en historial
        await db.query(
            "INSERT INTO historial_equipos (equipo_id, movimiento, observaciones) VALUES (?, ?, ?)",
            [req.params.id, `OPERATIVIDAD_${operatividad}`, comentario || `Marcado como ${operatividad}`]
        );

        res.json({ message: `Equipo marcado como ${operatividad}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 11. Listar equipos para la app del almacenero (optimizado para +50k registros) ---
router.get('/equipos', async (req, res) => {
    const { q = '', page = 1, limit = 20, estado } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let params = [];

    // Filtro por búsqueda de texto
    if (q.trim()) {
        const search = `%${q.trim()}%`;
        whereConditions.push(`(e.numero_serie LIKE ? OR e.identificador LIKE ? OR e.sbn LIKE ? OR e.descripcion LIKE ? OR e.marca LIKE ? OR e.modelo LIKE ? OR te.nombre LIKE ?)`);
        params.push(search, search, search, search, search, search, search);
    }

    // Filtro por estado
    if (estado) {
        whereConditions.push(`e.estado = ?`);
        params.push(estado);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const baseQuery = `
        FROM equipos e
        JOIN tipos_equipo te ON e.tipo_id = te.id
        ${whereClause}
    `;

    try {
        // Ejecutar count y data en paralelo
        const [countResult, dataResult] = await Promise.all([
            db.query(`SELECT COUNT(*) as total ${baseQuery}`, params),
            db.query(`
                SELECT
                    e.id, e.descripcion, e.marca, e.modelo, e.numero_serie,
                    e.identificador, e.sbn, e.estado, e.operatividad, e.validacion,
                    e.fecha_registro, te.nombre as tipo_nombre
                ${baseQuery}
                ORDER BY e.id DESC
                LIMIT ? OFFSET ?
            `, [...params, limitNum, offset])
        ]);

        const total = countResult[0][0].total;

        res.json({
            data: dataResult[0],
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error("Error al listar equipos almacén:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- 12. Obtener fotos de una revisión o inconsistencia ---
router.get('/fotos/:tipo/:referencia_id', async (req, res) => {
    const { tipo, referencia_id } = req.params;

    if (!['revision', 'inconsistencia'].includes(tipo)) {
        return res.status(400).json({ message: 'Tipo debe ser "revision" o "inconsistencia".' });
    }

    try {
        const [rows] = await db.query(
            `SELECT id, ruta, fecha_subida FROM fotos_almacen WHERE referencia_id = ? AND tipo = ? ORDER BY id ASC`,
            [referencia_id, tipo]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
