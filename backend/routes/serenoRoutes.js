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

export default router;
