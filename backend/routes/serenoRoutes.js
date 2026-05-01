import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../server.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    cb(null, ext || mime);
  }
});

const SERENO_SYSTEM = 'APP_SERENO';

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ message: 'El usuario y la contrasena son obligatorios.' });
  }

  try {
    const [rows] = await db.query(
      `
        SELECT 
          u.id_usuario,
          u.username,
          u.password_hash,
          p.id_personal,
          p.codigo_personal,
          p.nombres,
          p.apellidos,
          GROUP_CONCAT(DISTINCT r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
        FROM usuario u
        INNER JOIN personal p ON p.id_personal = u.id_personal
        INNER JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        INNER JOIN rol r ON r.id_rol = ur.id_rol
        WHERE u.username = ?
          AND u.estado = 1
          AND p.estado = 1
          AND r.sistema = ?
        GROUP BY u.id_usuario, p.id_personal
      `,
      [usuario, SERENO_SYSTEM]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contrasena incorrectos, o la cuenta no tiene acceso a la app de serenazgo.' });
    }

    const personal = rows[0];
    const match = await bcrypt.compare(password, personal.password_hash);

    if (!match) {
      return res.status(401).json({ message: 'Usuario o contrasena incorrectos.' });
    }

    await db.query('UPDATE usuario SET ultimo_login = NOW() WHERE id_usuario = ?', [personal.id_usuario]);

    res.status(200).json({
      message: 'Login exitoso',
      token: `token_sereno_${personal.id_usuario}`,
      sereno: {
        id_sereno: personal.id_personal,
        id_personal: personal.id_personal,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        usuario: personal.username,
        codigo_sereno: personal.codigo_personal,
        codigo_personal: personal.codigo_personal,
        roles: personal.roles ? personal.roles.split(',') : []
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error en el servidor: ' + err.message });
  }
});

router.get('/tipos-incidencia', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT id_tipo, nombre, codigo FROM tipos_incidencia ORDER BY nombre ASC');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor: ' + err.message });
  }
});

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT 
          p.id_personal AS id_sereno,
          p.id_personal,
          p.codigo_personal AS codigo_sereno,
          p.codigo_personal,
          p.nombres,
          p.apellidos,
          p.dni AS numero_documento,
          'DNI' AS tipo_documento,
          u.id_usuario AS id_credencial,
          u.username AS usuario,
          u.estado
        FROM personal p
        INNER JOIN usuario u ON u.id_personal = p.id_personal
        INNER JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        INNER JOIN rol r ON r.id_rol = ur.id_rol
        WHERE p.estado = 1
          AND r.sistema = ?
          AND r.nombre IN ('sereno', 'supervisor_sereno')
        GROUP BY
          p.id_personal, p.codigo_personal, p.nombres, p.apellidos, p.dni,
          u.id_usuario, u.username, u.estado
        ORDER BY p.apellidos, p.nombres
      `,
      [SERENO_SYSTEM]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/evidencias', upload.single('file'), async (req, res) => {
  const { id_incidencia, descripcion } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningun archivo.' });
  }

  if (!id_incidencia) {
    return res.status(400).json({ error: 'El ID de la incidencia es obligatorio.' });
  }

  const ruta_archivo = req.file.path.replace(/\\/g, '/');
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let id_tipo_archivo = 3;
    const extension = path.extname(ruta_archivo).toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
      id_tipo_archivo = 1;
    } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(extension)) {
      id_tipo_archivo = 2;
    }

    const [fileResult] = await connection.query(
      'INSERT INTO archivos (id_tipo_archivo, ruta_archivo, fecha_subida) VALUES (?, ?, NOW())',
      [id_tipo_archivo, ruta_archivo]
    );

    await connection.query(
      'INSERT INTO evidencias (id_incidencia, id_archivo, descripcion) VALUES (?, ?, ?)',
      [id_incidencia, fileResult.insertId, descripcion || null]
    );

    await connection.commit();
    res.status(201).json({ message: 'Evidencia reportada con exito.', filePath: ruta_archivo });
  } catch (err) {
    await connection.rollback();
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error en el servidor: ' + err.message });
  } finally {
    connection.release();
  }
});

router.post('/incidencias', async (req, res) => {
  const {
    numero_parte,
    servicio,
    zona,
    dia,
    fecha,
    hora_hecho,
    hora_denuncia,
    hora_intervencion,
    modalidad_intervencion,
    unidad_serenazgo,
    lugar_hecho,
    tipo_hecho,
    arma_usada,
    monto_afectado,
    nombres_agraviado,
    senas_autor,
    supervisor_nombre,
    descripcion_relato,
    firma_base64,
    id_sereno
  } = req.body;

  if (!id_sereno || !descripcion_relato || !lugar_hecho || !tipo_hecho) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: id_sereno, descripcion_relato, lugar_hecho, tipo_hecho.' });
  }

  let firmaRuta = null;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (firma_base64) {
      const firmasDir = 'uploads/firmas/';
      if (!fs.existsSync(firmasDir)) {
        fs.mkdirSync(firmasDir, { recursive: true });
      }

      const base64Data = firma_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `firma_${id_sereno}_${Date.now()}.png`;
      firmaRuta = path.join(firmasDir, filename).replace(/\\/g, '/');
      fs.writeFileSync(firmaRuta, buffer);
    }

    const [result] = await connection.query(
      `
        INSERT INTO incidencias (
          numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
          modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
          monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
          firma_ruta, id_sereno, fecha_registro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
        modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
        monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
        firmaRuta, id_sereno
      ]
    );

    await connection.commit();
    res.status(201).json({ message: 'Parte de intervencion registrado con exito.', id_incidencia: result.insertId });

    const io = req.app.get('io');
    if (io) {
      io.emit('nueva_incidencia', {
        message: `Nueva incidencia reportada. Parte N ${numero_parte}`,
        id_incidencia: result.insertId,
        tipo: tipo_hecho
      });
    }
  } catch (err) {
    await connection.rollback();
    if (firmaRuta) {
      try {
        fs.unlinkSync(firmaRuta);
      } catch (cleanupErr) {
        console.error('Error al limpiar firma:', cleanupErr);
      }
    }
    res.status(500).json({ error: 'Error en el servidor: ' + err.message });
  } finally {
    connection.release();
  }
});

// ============================================================
// PÁNICO DEL SERENO - Alerta de emergencia
// ============================================================
router.post('/panico', async (req, res) => {
    const { sereno_id, latitud, longitud, mensaje } = req.body;

    if (!sereno_id) {
        return res.status(400).json({ message: 'sereno_id es requerido.' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO alertas_panico_sereno (sereno_id, latitud, longitud, mensaje)
             VALUES (?, ?, ?, ?)`,
            [sereno_id, latitud || 0, longitud || 0, mensaje || null]
        );

        // Obtener datos del sereno
        const [[sereno]] = await db.query(
            "SELECT CONCAT(p.nombres, ' ', p.apellidos) as nombre, p.id_personal FROM personal p WHERE p.id_personal = ?",
            [sereno_id]
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('alerta_panico_sereno', {
                id: result.insertId,
                sereno_id,
                sereno: sereno?.nombre || `Sereno #${sereno_id}`,
                latitud, longitud,
                mensaje: mensaje || '',
                fecha: new Date().toISOString(),
                message: `ALERTA DE PÁNICO - Sereno ${sereno?.nombre || sereno_id} solicita apoyo urgente`
            });
        }

        res.status(201).json({ message: 'Alerta enviada.', id: result.insertId });
    } catch (err) {
        console.error("Error en pánico sereno:", err);
        res.status(500).json({ error: err.message });
    }
});

// Alertas de ciudadanos asignadas a un sereno
router.get('/mis-alertas/:sereno_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ap.*,
                   CONCAT(c.nombres, ' ', c.apellidos) as nombre_ciudadano,
                   c.telefono
            FROM alertas_panico ap
            LEFT JOIN ciudadanos c ON ap.ciudadano_id = c.id
            WHERE ap.sereno_id = ? AND ap.estado IN ('ASIGNADO', 'ACTIVO')
            ORDER BY ap.fecha DESC
        `, [req.params.sereno_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// RECORRIDOS GPS DEL SERENO
// ============================================================

// Iniciar patrullaje
router.post('/recorrido/iniciar', async (req, res) => {
    const { sereno_id } = req.body;
    if (!sereno_id) return res.status(400).json({ message: 'sereno_id requerido.' });

    try {
        // Si tiene uno activo, lo cerramos
        await db.query(
            `UPDATE recorridos_serenos SET estado='FINALIZADO', fecha_fin=NOW()
             WHERE sereno_id=? AND estado='ACTIVO'`, [sereno_id]
        );

        const [r] = await db.query(
            `INSERT INTO recorridos_serenos (sereno_id, estado) VALUES (?, 'ACTIVO')`,
            [sereno_id]
        );

        const [[sereno]] = await db.query(
            `SELECT CONCAT(p.nombres,' ',p.apellidos) as nombre FROM personal p WHERE id_personal=?`,
            [sereno_id]
        );

        const io = req.app.get('io');
        if (io) io.emit('recorrido_iniciado', { recorrido_id: r.insertId, sereno_id, nombre: sereno?.nombre });

        res.json({ message: 'Patrullaje iniciado.', recorrido_id: r.insertId });
    } catch (err) {
        console.error("Error iniciar recorrido:", err);
        res.status(500).json({ error: err.message });
    }
});

// Agregar punto GPS al recorrido activo
router.post('/recorrido/punto', async (req, res) => {
    const { sereno_id, latitud, longitud, velocidad } = req.body;
    if (!sereno_id || !latitud || !longitud) return res.status(400).json({ message: 'Datos incompletos.' });

    try {
        const [[recorrido]] = await db.query(
            `SELECT id FROM recorridos_serenos WHERE sereno_id=? AND estado='ACTIVO' ORDER BY id DESC LIMIT 1`,
            [sereno_id]
        );
        if (!recorrido) return res.status(404).json({ message: 'No hay patrullaje activo. Inicie primero.' });

        await db.query(
            `INSERT INTO puntos_recorrido (recorrido_id, latitud, longitud, velocidad)
             VALUES (?, ?, ?, ?)`,
            [recorrido.id, latitud, longitud, velocidad || 0]
        );

        const io = req.app.get('io');
        if (io) io.emit('gps_sereno', {
            recorrido_id: recorrido.id, sereno_id, latitud, longitud,
            velocidad: velocidad || 0, fecha: new Date().toISOString()
        });

        res.json({ message: 'OK', recorrido_id: recorrido.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Finalizar patrullaje
router.post('/recorrido/finalizar', async (req, res) => {
    const { sereno_id } = req.body;
    if (!sereno_id) return res.status(400).json({ message: 'sereno_id requerido.' });

    try {
        const [[recorrido]] = await db.query(
            `SELECT id FROM recorridos_serenos WHERE sereno_id=? AND estado='ACTIVO' ORDER BY id DESC LIMIT 1`,
            [sereno_id]
        );
        if (!recorrido) return res.status(404).json({ message: 'Sin patrullaje activo.' });

        // Calcular distancia aproximada
        const [puntos] = await db.query(
            `SELECT latitud, longitud FROM puntos_recorrido WHERE recorrido_id=? ORDER BY id ASC`,
            [recorrido.id]
        );
        let km = 0;
        for (let i = 1; i < puntos.length; i++) {
            const a = puntos[i-1], b = puntos[i];
            const R = 6371;
            const dLat = (b.latitud - a.latitud) * Math.PI / 180;
            const dLon = (b.longitud - a.longitud) * Math.PI / 180;
            const aa = Math.sin(dLat/2)**2 + Math.cos(a.latitud*Math.PI/180) * Math.cos(b.latitud*Math.PI/180) * Math.sin(dLon/2)**2;
            km += 2 * R * Math.asin(Math.sqrt(aa));
        }

        await db.query(
            `UPDATE recorridos_serenos SET estado='FINALIZADO', fecha_fin=NOW(), distancia_km=? WHERE id=?`,
            [km.toFixed(2), recorrido.id]
        );

        const io = req.app.get('io');
        if (io) io.emit('recorrido_finalizado', { recorrido_id: recorrido.id, sereno_id, distancia_km: km.toFixed(2) });

        res.json({ message: 'Patrullaje finalizado.', distancia_km: km.toFixed(2), puntos: puntos.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar recorridos activos (para el panel web)
router.get('/recorridos/activos', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.id, r.sereno_id, r.fecha_inicio,
                   CONCAT(p.nombres, ' ', p.apellidos) as nombre_sereno,
                   p.codigo_personal,
                   (SELECT COUNT(*) FROM puntos_recorrido WHERE recorrido_id = r.id) as total_puntos,
                   (SELECT latitud FROM puntos_recorrido WHERE recorrido_id = r.id ORDER BY id DESC LIMIT 1) as ultima_lat,
                   (SELECT longitud FROM puntos_recorrido WHERE recorrido_id = r.id ORDER BY id DESC LIMIT 1) as ultima_lng
            FROM recorridos_serenos r
            JOIN personal p ON r.sereno_id = p.id_personal
            WHERE r.estado = 'ACTIVO'
            ORDER BY r.fecha_inicio DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Recorrido activo de un sereno (con sus puntos)
router.get('/recorrido-activo/:sereno_id', async (req, res) => {
    try {
        const [[recorrido]] = await db.query(
            `SELECT id, sereno_id, fecha_inicio FROM recorridos_serenos
             WHERE sereno_id=? AND estado='ACTIVO' ORDER BY id DESC LIMIT 1`,
            [req.params.sereno_id]
        );
        if (!recorrido) return res.json({ activo: false });

        const [puntos] = await db.query(
            `SELECT latitud, longitud, fecha FROM puntos_recorrido
             WHERE recorrido_id=? ORDER BY id ASC`,
            [recorrido.id]
        );
        res.json({ activo: true, recorrido, puntos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener puntos de un recorrido
router.get('/recorridos/:id/puntos', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, latitud, longitud, velocidad, fecha FROM puntos_recorrido WHERE recorrido_id=? ORDER BY id ASC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Historial de recorridos por sereno
router.get('/recorridos/historial/:sereno_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, CONCAT(p.nombres,' ',p.apellidos) as nombre_sereno,
                   (SELECT COUNT(*) FROM puntos_recorrido WHERE recorrido_id = r.id) as total_puntos
            FROM recorridos_serenos r
            JOIN personal p ON r.sereno_id = p.id_personal
            WHERE r.sereno_id = ?
            ORDER BY r.fecha_inicio DESC
            LIMIT 50
        `, [req.params.sereno_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
