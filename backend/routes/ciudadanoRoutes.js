import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../server.js';

const router = express.Router();

// Configurar multer para fotos de denuncias ciudadanas
const denunciaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/denuncias_ciudadano/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `den_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${path.extname(file.originalname)}`);
    }
});
const uploadFotos = multer({
    storage: denunciaStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por archivo
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|mp4|mov/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, ext);
    }
}).any(); // Acepta cualquier nombre de campo

// ============================================================
// 1. REGISTRO DE CIUDADANO
// ============================================================
router.post('/registro', async (req, res) => {
    const { nombres, apellidos, dni, telefono, email, direccion, password } = req.body;

    if (!nombres || !apellidos || !dni || !telefono || !password) {
        return res.status(400).json({ message: 'Nombres, apellidos, DNI, teléfono y contraseña son requeridos.' });
    }

    try {
        // Verificar si ya existe un ciudadano con ese DNI
        const [existing] = await db.query('SELECT id FROM ciudadanos WHERE dni = ?', [dni]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Ya existe un ciudadano registrado con ese DNI.' });
        }

        const bcrypt = (await import('bcrypt')).default;
        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO ciudadanos (nombres, apellidos, dni, telefono, email, direccion, password_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nombres, apellidos, dni, telefono, email || null, direccion || null, password_hash]
        );

        res.status(201).json({
            message: 'Registro exitoso.',
            ciudadano: {
                id: result.insertId,
                nombres,
                apellidos,
                dni,
                telefono
            }
        });
    } catch (err) {
        console.error('Error en registro ciudadano:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 2. LOGIN CIUDADANO
// ============================================================
router.post('/login', async (req, res) => {
    const { dni, password } = req.body;

    if (!dni || !password) {
        return res.status(400).json({ message: 'DNI y contraseña son requeridos.' });
    }

    try {
        const [rows] = await db.query(
            'SELECT * FROM ciudadanos WHERE dni = ? AND estado = 1',
            [dni]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'DNI incorrecto o cuenta inactiva.' });
        }

        const ciudadano = rows[0];
        const bcrypt = (await import('bcrypt')).default;
        const match = await bcrypt.compare(password, ciudadano.password_hash);

        if (!match) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        res.json({
            message: 'Login exitoso',
            token: `token_ciudadano_${ciudadano.id}`,
            ciudadano: {
                id: ciudadano.id,
                nombres: ciudadano.nombres,
                apellidos: ciudadano.apellidos,
                nombre_completo: `${ciudadano.nombres} ${ciudadano.apellidos}`,
                dni: ciudadano.dni,
                telefono: ciudadano.telefono,
                email: ciudadano.email,
                direccion: ciudadano.direccion
            }
        });
    } catch (err) {
        console.error('Error en login ciudadano:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 3. REGISTRAR DENUNCIA / INCIDENCIA
// ============================================================
router.post('/denuncia', uploadFotos, async (req, res) => {
    const {
        ciudadano_id, tipo_incidencia, descripcion, lugar_hecho,
        referencia, latitud, longitud, es_anonimo
    } = req.body;

    if (!tipo_incidencia || !descripcion || !lugar_hecho) {
        return res.status(400).json({ message: 'tipo_incidencia, descripcion y lugar_hecho son requeridos.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Generar número de denuncia
        const [countResult] = await connection.query(
            "SELECT COUNT(*) as total FROM denuncias_ciudadano WHERE YEAR(fecha_registro) = YEAR(NOW())"
        );
        const numero = `DEN-${new Date().getFullYear()}-${String(countResult[0].total + 1).padStart(5, '0')}`;

        const [result] = await connection.query(
            `INSERT INTO denuncias_ciudadano
             (numero_denuncia, ciudadano_id, tipo_incidencia, descripcion, lugar_hecho, referencia, latitud, longitud, es_anonimo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                numero,
                es_anonimo === 'true' || es_anonimo === true ? null : (ciudadano_id || null),
                tipo_incidencia,
                descripcion,
                lugar_hecho,
                referencia || null,
                latitud || null,
                longitud || null,
                es_anonimo === 'true' || es_anonimo === true ? 1 : 0
            ]
        );
        const denunciaId = result.insertId;

        // Guardar fotos/evidencias
        const archivos = req.files || [];
        if (archivos.length > 0) {
            const fotoValues = archivos.map(f => [denunciaId, f.path.replace(/\\/g, '/'), f.mimetype]);
            await connection.query(
                `INSERT INTO fotos_denuncia (denuncia_id, ruta, tipo_archivo) VALUES ?`,
                [fotoValues]
            );
        }

        await connection.commit();

        // Notificación en tiempo real al panel web
        const io = req.app.get('io');
        if (io) {
            io.emit('nueva_denuncia_ciudadano', {
                id: denunciaId,
                numero: numero,
                tipo: tipo_incidencia,
                lugar: lugar_hecho,
                es_anonimo: es_anonimo === 'true' || es_anonimo === true,
                fotos: archivos.length,
                message: `Nueva denuncia ciudadana #${numero}: ${tipo_incidencia} en ${lugar_hecho}`
            });
        }

        res.status(201).json({
            message: 'Denuncia registrada con éxito.',
            denuncia: {
                id: denunciaId,
                numero_denuncia: numero
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('Error al registrar denuncia:', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// ============================================================
// 4. MIS DENUNCIAS (historial del ciudadano)
// ============================================================
router.get('/mis-denuncias/:ciudadano_id', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        const [countResult, dataResult] = await Promise.all([
            db.query(
                'SELECT COUNT(*) as total FROM denuncias_ciudadano WHERE ciudadano_id = ?',
                [req.params.ciudadano_id]
            ),
            db.query(`
                SELECT d.*,
                    (SELECT COUNT(*) FROM fotos_denuncia WHERE denuncia_id = d.id) as total_fotos,
                    (SELECT COUNT(*) FROM seguimiento_denuncia WHERE denuncia_id = d.id) as total_seguimientos
                FROM denuncias_ciudadano d
                WHERE d.ciudadano_id = ?
                ORDER BY d.fecha_registro DESC
                LIMIT ? OFFSET ?
            `, [req.params.ciudadano_id, limitNum, offset])
        ]);

        const total = countResult[0][0].total;
        res.json({
            data: dataResult[0],
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 5. DETALLE DE UNA DENUNCIA (con fotos y seguimiento)
// ============================================================
router.get('/denuncia/:id', async (req, res) => {
    try {
        const [[denuncia]] = await db.query(
            'SELECT * FROM denuncias_ciudadano WHERE id = ?',
            [req.params.id]
        );

        if (!denuncia) {
            return res.status(404).json({ message: 'Denuncia no encontrada.' });
        }

        // Fotos
        const [fotos] = await db.query(
            'SELECT id, ruta, tipo_archivo, fecha_subida FROM fotos_denuncia WHERE denuncia_id = ? ORDER BY id',
            [req.params.id]
        );

        // Seguimiento / respuestas
        const [seguimientos] = await db.query(`
            SELECT s.*,
                CONCAT(p.nombres, ' ', p.apellidos) as respondido_por
            FROM seguimiento_denuncia s
            LEFT JOIN usuario u ON s.usuario_id = u.id_usuario
            LEFT JOIN personal p ON u.id_personal = p.id_personal
            WHERE s.denuncia_id = ?
            ORDER BY s.fecha ASC
        `, [req.params.id]);

        res.json({
            denuncia,
            fotos,
            seguimientos
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 6. CONSULTAR DENUNCIA POR NÚMERO (sin login, seguimiento público)
// ============================================================
router.get('/consultar/:numero_denuncia', async (req, res) => {
    try {
        const [[denuncia]] = await db.query(
            `SELECT id, numero_denuncia, tipo_incidencia, lugar_hecho, estado, fecha_registro, fecha_actualizacion
             FROM denuncias_ciudadano WHERE numero_denuncia = ?`,
            [req.params.numero_denuncia]
        );

        if (!denuncia) {
            return res.status(404).json({ message: 'No se encontró denuncia con ese número.' });
        }

        const [seguimientos] = await db.query(`
            SELECT s.mensaje, s.estado_nuevo, s.fecha,
                CONCAT(p.nombres, ' ', p.apellidos) as respondido_por
            FROM seguimiento_denuncia s
            LEFT JOIN usuario u ON s.usuario_id = u.id_usuario
            LEFT JOIN personal p ON u.id_personal = p.id_personal
            WHERE s.denuncia_id = ?
            ORDER BY s.fecha ASC
        `, [denuncia.id]);

        res.json({
            denuncia,
            seguimientos
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 7. TIPOS DE INCIDENCIA (para el select de la app)
// ============================================================
router.get('/tipos-incidencia', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id_tipo, nombre, codigo FROM tipos_incidencia ORDER BY nombre');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 8. FOTOS DE UNA DENUNCIA
// ============================================================
router.get('/fotos/:denuncia_id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, ruta, tipo_archivo, fecha_subida FROM fotos_denuncia WHERE denuncia_id = ? ORDER BY id',
            [req.params.denuncia_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 9. AGREGAR COMENTARIO A SU DENUNCIA (ciudadano responde)
// ============================================================
router.post('/denuncia/:id/comentario', async (req, res) => {
    const { ciudadano_id, mensaje } = req.body;

    if (!mensaje) {
        return res.status(400).json({ message: 'El mensaje es requerido.' });
    }

    try {
        // Verificar que la denuncia pertenece al ciudadano
        const [[denuncia]] = await db.query(
            'SELECT id FROM denuncias_ciudadano WHERE id = ? AND ciudadano_id = ?',
            [req.params.id, ciudadano_id]
        );

        if (!denuncia) {
            return res.status(403).json({ message: 'No tiene permiso para comentar en esta denuncia.' });
        }

        await db.query(
            `INSERT INTO seguimiento_denuncia (denuncia_id, mensaje, tipo_autor, ciudadano_id)
             VALUES (?, ?, 'CIUDADANO', ?)`,
            [req.params.id, mensaje, ciudadano_id]
        );

        res.status(201).json({ message: 'Comentario agregado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 10. ACTUALIZAR PERFIL CIUDADANO
// ============================================================
router.put('/perfil/:id', async (req, res) => {
    const { nombres, apellidos, telefono, email, direccion } = req.body;

    try {
        await db.query(
            `UPDATE ciudadanos SET nombres = ?, apellidos = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?`,
            [nombres, apellidos, telefono, email || null, direccion || null, req.params.id]
        );
        res.json({ message: 'Perfil actualizado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 11. RESPONDER DENUNCIA (desde panel web - admin/operador)
// ============================================================
router.post('/denuncia/:id/responder', async (req, res) => {
    const { usuario_id, mensaje, estado_nuevo } = req.body;

    if (!mensaje) {
        return res.status(400).json({ message: 'El mensaje es requerido.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            `INSERT INTO seguimiento_denuncia (denuncia_id, usuario_id, mensaje, estado_nuevo, tipo_autor)
             VALUES (?, ?, ?, ?, 'OPERADOR')`,
            [req.params.id, usuario_id || null, mensaje, estado_nuevo || null]
        );

        // Si se envía nuevo estado, actualizar la denuncia
        if (estado_nuevo) {
            await connection.query(
                `UPDATE denuncias_ciudadano SET estado = ?, fecha_actualizacion = NOW() WHERE id = ?`,
                [estado_nuevo, req.params.id]
            );
        }

        await connection.commit();

        // Notificar al ciudadano (si tiene socket conectado)
        const io = req.app.get('io');
        if (io) {
            const [[den]] = await db.query('SELECT numero_denuncia, ciudadano_id FROM denuncias_ciudadano WHERE id = ?', [req.params.id]);
            io.emit('respuesta_denuncia', {
                denuncia_id: parseInt(req.params.id),
                numero: den?.numero_denuncia,
                ciudadano_id: den?.ciudadano_id,
                mensaje,
                estado_nuevo,
            });
        }

        res.json({ message: 'Respuesta registrada.' });
    } catch (err) {
        await connection.rollback();
        console.error("Error en responder denuncia:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// ============================================================
// BOTÓN DE PÁNICO - Alerta de emergencia del ciudadano
// ============================================================
router.post('/panico', async (req, res) => {
    const { ciudadano_id, latitud, longitud, direccion } = req.body;

    if (!latitud || !longitud) {
        return res.status(400).json({ message: 'Se requiere ubicación GPS para enviar alerta.' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO alertas_panico (ciudadano_id, latitud, longitud, direccion)
             VALUES (?, ?, ?, ?)`,
            [ciudadano_id || null, latitud, longitud, direccion || null]
        );

        const alertaId = result.insertId;

        // Obtener datos del ciudadano para la notificación
        let nombreCiudadano = 'Ciudadano anónimo';
        let telefonoCiudadano = '';
        if (ciudadano_id) {
            const [[c]] = await db.query(
                "SELECT nombres, apellidos, telefono, dni FROM ciudadanos WHERE id = ?",
                [ciudadano_id]
            );
            if (c) {
                nombreCiudadano = `${c.nombres} ${c.apellidos}`;
                telefonoCiudadano = c.telefono || '';
            }
        }

        // Notificar al panel web y serenos en tiempo real
        const io = req.app.get('io');
        if (io) {
            io.emit('alerta_panico', {
                id: alertaId,
                ciudadano: nombreCiudadano,
                telefono: telefonoCiudadano,
                latitud, longitud,
                direccion: direccion || '',
                fecha: new Date().toISOString(),
                message: `ALERTA DE PÁNICO de ${nombreCiudadano} - Ubicación: ${latitud}, ${longitud}`
            });
        }

        res.status(201).json({
            message: 'Alerta de pánico enviada. Ayuda en camino.',
            id: alertaId
        });
    } catch (err) {
        console.error("Error en alerta de pánico:", err);
        res.status(500).json({ error: err.message });
    }
});

// Obtener alertas de pánico activas (para el panel web)
router.get('/alertas-panico', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ap.*,
                   CONCAT(c.nombres, ' ', c.apellidos) as nombre_ciudadano,
                   c.telefono, c.dni
            FROM alertas_panico ap
            LEFT JOIN ciudadanos c ON ap.ciudadano_id = c.id
            ORDER BY ap.fecha DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Asignar sereno a alerta de pánico
router.put('/alertas-panico/:id/asignar', async (req, res) => {
    const { sereno_id, operador } = req.body;

    if (!sereno_id) {
        return res.status(400).json({ message: 'Se requiere sereno_id.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Actualizar la alerta con el sereno asignado
        await connection.query(
            `UPDATE alertas_panico SET estado = 'ASIGNADO', sereno_id = ?, atendido_por = ?, fecha_atencion = NOW() WHERE id = ?`,
            [sereno_id, operador || 'Operador', req.params.id]
        );

        // Obtener datos de la alerta y el ciudadano
        const [[alerta]] = await connection.query(`
            SELECT ap.*, CONCAT(c.nombres, ' ', c.apellidos) as nombre_ciudadano, c.telefono
            FROM alertas_panico ap
            LEFT JOIN ciudadanos c ON ap.ciudadano_id = c.id
            WHERE ap.id = ?
        `, [req.params.id]);

        // Obtener datos del sereno
        const [[sereno]] = await connection.query(`
            SELECT p.id_personal, CONCAT(p.nombres, ' ', p.apellidos) as nombre_sereno
            FROM personal p WHERE p.id_personal = ?
        `, [sereno_id]);

        await connection.commit();

        // Notificar al sereno via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('panico_asignado_sereno', {
                alerta_id: parseInt(req.params.id),
                sereno_id,
                sereno_nombre: sereno?.nombre_sereno || '',
                ciudadano: alerta?.nombre_ciudadano || 'Ciudadano',
                telefono: alerta?.telefono || '',
                latitud: alerta?.latitud,
                longitud: alerta?.longitud,
                direccion: alerta?.direccion || '',
                message: `Alerta de pánico asignada a ${sereno?.nombre_sereno || 'sereno'}`
            });

            // Notificar al ciudadano que un sereno va en camino
            io.emit('panico_sereno_asignado', {
                alerta_id: parseInt(req.params.id),
                ciudadano_id: alerta?.ciudadano_id,
                sereno_nombre: sereno?.nombre_sereno || 'Un sereno',
                message: `${sereno?.nombre_sereno || 'Un sereno'} fue asignado a tu alerta y va en camino.`
            });
        }

        res.json({
            message: `Sereno ${sereno?.nombre_sereno || ''} asignado a la alerta.`,
            sereno: sereno?.nombre_sereno
        });
    } catch (err) {
        await connection.rollback();
        console.error("Error al asignar sereno a alerta:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Cerrar alerta de pánico (resuelta)
router.put('/alertas-panico/:id/cerrar', async (req, res) => {
    const { observacion } = req.body;
    try {
        await db.query(
            "UPDATE alertas_panico SET estado = 'CERRADO', observacion = ? WHERE id = ?",
            [observacion || 'Atendida', req.params.id]
        );
        res.json({ message: 'Alerta cerrada.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 12. LISTAR TODAS LAS DENUNCIAS (panel web con paginación)
// ============================================================
router.get('/denuncias', async (req, res) => {
    const { page = 1, limit = 20, estado, tipo, q } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let conditions = [];
    let params = [];

    if (estado) { conditions.push('d.estado = ?'); params.push(estado); }
    if (tipo) { conditions.push('d.tipo_incidencia = ?'); params.push(tipo); }
    if (q) {
        conditions.push('(d.numero_denuncia LIKE ? OR d.descripcion LIKE ? OR d.lugar_hecho LIKE ? OR c.nombres LIKE ? OR c.apellidos LIKE ? OR c.dni LIKE ?)');
        const search = `%${q}%`;
        params.push(search, search, search, search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const [countResult, dataResult] = await Promise.all([
            db.query(`SELECT COUNT(*) as total FROM denuncias_ciudadano d LEFT JOIN ciudadanos c ON d.ciudadano_id = c.id ${where}`, params),
            db.query(`
                SELECT d.*,
                    CASE WHEN d.es_anonimo = 1 THEN 'ANÓNIMO' ELSE CONCAT(c.nombres, ' ', c.apellidos) END as nombre_ciudadano,
                    CASE WHEN d.es_anonimo = 1 THEN NULL ELSE c.dni END as dni_ciudadano,
                    CASE WHEN d.es_anonimo = 1 THEN NULL ELSE c.telefono END as telefono_ciudadano,
                    (SELECT COUNT(*) FROM fotos_denuncia WHERE denuncia_id = d.id) as total_fotos
                FROM denuncias_ciudadano d
                LEFT JOIN ciudadanos c ON d.ciudadano_id = c.id
                ${where}
                ORDER BY d.fecha_registro DESC
                LIMIT ? OFFSET ?
            `, [...params, limitNum, offset])
        ]);

        const total = countResult[0][0].total;
        res.json({
            data: dataResult[0],
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
