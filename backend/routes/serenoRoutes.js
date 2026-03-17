// backend/routes/serenoRoutes.js
import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../server.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const saltRounds = 10;

// --- Configuración para subida de archivos (copiada de server.js) ---
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
const upload = multer({ storage: storage });

// --- LOGIN DE SERENOS (APP ANDROID) ---
// Nota: La ruta ahora es solo '/login' porque el prefijo '/api/serenos' se definirá en server.js
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ message: 'El usuario y la contraseña son obligatorios.' });
  }

  try {
    // 1. Buscamos la credencial por el nombre de usuario y que esté activa
    const [rows] = await db.query(`
      SELECT sc.*, s.nombres, s.apellidos, s.codigo_sereno 
      FROM sereno_credenciales sc
      JOIN serenos s ON sc.id_sereno = s.id_sereno
      WHERE sc.usuario = ? AND sc.estado = 1
    `, [usuario]);

    if (rows.length > 0) {
      const sereno = rows[0];
      const match = await bcrypt.compare(password, sereno.password_hash);

      if (match) {
        console.log("Login de Sereno exitoso:", sereno.nombres, sereno.apellidos);
        res.status(200).json({
          message: "Login exitoso",
          token: "token_sereno_" + sereno.id_credencial, // Idealmente, usar JWT aquí
          sereno: {
            id_sereno: sereno.id_sereno,
            nombres: sereno.nombres,
            apellidos: sereno.apellidos,
            usuario: sereno.usuario,
            codigo_sereno: sereno.codigo_sereno
          }
        });
      } else {
        res.status(401).json({ message: "Usuario o contraseña incorrectos." });
      }
    } else {
      res.status(401).json({ message: "Usuario o contraseña incorrectos, o la cuenta está inactiva." });
    }
  } catch (err) {
    res.status(500).json({ message: "Error en el servidor: " + err.message });
  }
});

// --- OBTENER TIPOS DE INCIDENCIA (PARA LA APP) ---
// Ruta final: GET /api/serenos/tipos-incidencia
router.get('/tipos-incidencia', async (req, res) => {
  try {
    // Se seleccionan solo los campos necesarios para la app y se ordenan alfabéticamente.
    const [rows] = await db.query("SELECT id_tipo, nombre, codigo FROM tipos_incidencia ORDER BY nombre ASC");
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor: " + err.message });
  }
});

// --- NUEVO ENDPOINT PARA REPORTAR EVIDENCIA (APP ANDROID) ---
// Ruta final: POST /api/serenos/evidencias
router.post('/evidencias', upload.single('file'), async (req, res) => {
    // El middleware 'upload.single('file')' ya procesó el archivo.
    // req.file contiene la información del archivo.
    // req.body contiene los campos de texto.

    const { id_incidencia, descripcion } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    if (!id_incidencia) {
        return res.status(400).json({ error: 'El ID de la incidencia es obligatorio.' });
    }

    const ruta_archivo = req.file.path.replace(/\\/g, "/"); // Normalizar slashes para consistencia
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        
        // 1. Determinar el tipo de archivo por su extensión
        let id_tipo_archivo = 3; // 3 = Documento (por defecto)
        const extension = path.extname(ruta_archivo).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
            id_tipo_archivo = 1; // Imagen
        } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(extension)) {
            id_tipo_archivo = 2; // Video
        }

        // 2. Insertar en la tabla 'archivos'
        const [fileResult] = await connection.query("INSERT INTO archivos (id_tipo_archivo, ruta_archivo, fecha_subida) VALUES (?, ?, NOW())", [id_tipo_archivo, ruta_archivo]);
        const id_archivo = fileResult.insertId;

        // 3. Insertar en la tabla 'evidencias'
        await connection.query("INSERT INTO evidencias (id_incidencia, id_archivo, descripcion) VALUES (?, ?, ?)", [id_incidencia, id_archivo, descripcion || null]);

        await connection.commit();
        res.status(201).json({ message: "Evidencia reportada con éxito.", filePath: ruta_archivo });

    } catch (err) {
        await connection.rollback();
        // Si hay un error, eliminar el archivo que se subió para no dejar basura
        if (req.file) { fs.unlinkSync(req.file.path); }
        res.status(500).json({ error: "Error en el servidor: " + err.message });
    } finally {
        connection.release();
    }
});

// --- NUEVO ENDPOINT PARA REGISTRAR PARTE DE INTERVENCIÓN (APP) ---
// Este endpoint está diseñado para recibir los datos según el esquema de tabla 'incidencias' que proporcionaste.
// NOTA: Este esquema es diferente al que usa la aplicación web. Para que este endpoint funcione,
// la tabla 'incidencias' en la base de datos debe ser modificada para coincidir con los campos
// que especificaste (ej: id_sereno, zona, tipo_hecho, descripcion_relato, etc.).
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
        firma_base64, // Se espera una cadena base64 de la imagen. Ej: "data:image/png;base64,iVBORw0KGgo..."
        id_sereno,
    } = req.body;

    // Validación de campos obligatorios
    if (!id_sereno || !descripcion_relato || !lugar_hecho || !tipo_hecho) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: id_sereno, descripcion_relato, lugar_hecho, tipo_hecho.' });
    }

    let firmaRuta = null;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Es más eficiente guardar la firma como un archivo y almacenar la ruta.
        // Se asume que la tabla tendrá una columna 'firma_ruta' en lugar de 'firma_base64'.
        if (firma_base64) {
            const firmasDir = 'uploads/firmas/';
            if (!fs.existsSync(firmasDir)) { fs.mkdirSync(firmasDir, { recursive: true }); }

            const base64Data = firma_base64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `firma_${id_sereno}_${Date.now()}.png`;
            firmaRuta = path.join(firmasDir, filename).replace(/\\/g, "/");
            fs.writeFileSync(firmaRuta, buffer);
        }

        const [result] = await connection.query(
            `INSERT INTO incidencias (
                numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
                modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
                monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
                firma_ruta, id_sereno, fecha_registro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
                modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
                monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
                firmaRuta, // Se guarda la RUTA del archivo, no el base64
                id_sereno
            ]
        );
        
        await connection.commit();
        res.status(201).json({ message: "Parte de intervención registrado con éxito.", id_incidencia: result.insertId });

        // --- NOTIFICACIÓN EN TIEMPO REAL ---
        const io = req.app.get('io');
        if (io) {
            io.emit('nueva_incidencia', { 
                message: `¡Nueva incidencia reportada! Parte N° ${numero_parte}`,
                id_incidencia: result.insertId,
                tipo: tipo_hecho
            });
        }

    } catch (err) {
        await connection.rollback();
        if (firmaRuta) { try { fs.unlinkSync(firmaRuta); } catch (e) { console.error("Error al limpiar firma:", e); } }
        console.error("Error al registrar parte de intervención:", err.message);
        res.status(500).json({ error: "Error en el servidor: " + err.message });
    } finally {
        connection.release();
    }
});

// --- CRUD DE SERENOS (PARA EL FRONTEND WEB) ---

// Ruta final: GET /api/serenos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.id_sereno, s.nombres, s.apellidos, s.tipo_documento, 
        s.numero_documento, s.codigo_sereno, sc.usuario,
        sc.id_credencial, sc.estado
      FROM serenos s
      LEFT JOIN sereno_credenciales sc ON s.id_sereno = sc.id_sereno
      ORDER BY s.apellidos, s.nombres
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta final: POST /api/serenos
router.post('/', async (req, res) => {
  const { nombres, apellidos, tipo_documento, numero_documento, codigo_sereno, password } = req.body;
  if (!nombres || !apellidos || !tipo_documento || !numero_documento || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [serenoResult] = await connection.query(
      "INSERT INTO serenos (nombres, apellidos, tipo_documento, numero_documento, codigo_sereno) VALUES (?, ?, ?, ?, ?)",
      [nombres, apellidos, tipo_documento, numero_documento, codigo_sereno || null]
    );
    const newSerenoId = serenoResult.insertId;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await connection.query(
      "INSERT INTO sereno_credenciales (id_sereno, usuario, password_hash, estado) VALUES (?, ?, ?, 1)",
      [newSerenoId, numero_documento, hashedPassword]
    );
    await connection.commit();
    res.status(201).json({ message: "Sereno y credenciales creados exitosamente" });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Ya existe un sereno con ese número de documento o código.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    connection.release();
  }
});

// Ruta final: PUT /api/serenos/:id
router.put('/:id', async (req, res) => {
  const { nombres, apellidos, tipo_documento, codigo_sereno } = req.body;
  try {
    await db.query(
      "UPDATE serenos SET nombres = ?, apellidos = ?, tipo_documento = ?, codigo_sereno = ? WHERE id_sereno = ?",
      [nombres, apellidos, tipo_documento, codigo_sereno || null, req.params.id]
    );
    res.json({ message: "Sereno actualizado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta final: DELETE /api/serenos/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM serenos WHERE id_sereno = ?", [req.params.id]);
    res.json({ message: "Sereno y sus credenciales han sido eliminados" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GESTIÓN DE CREDENCIALES ---

// Ruta final: PUT /api/serenos/credenciales/:id/toggle-status
router.put('/credenciales/:id/toggle-status', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT estado FROM sereno_credenciales WHERE id_credencial = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Credencial de sereno no encontrada' });
    }
    const newStatus = rows[0].estado === 1 ? 0 : 1;
    await db.query("UPDATE sereno_credenciales SET estado = ? WHERE id_credencial = ?", [newStatus, req.params.id]);
    res.json({ message: "Estado de la credencial actualizado", newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta final: PUT /api/serenos/credenciales/:id/password
router.put('/credenciales/:id/password', async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;
  if (!password) {
    return res.status(400).json({ error: 'La nueva contraseña es obligatoria.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const [result] = await db.query(
      "UPDATE sereno_credenciales SET password_hash = ? WHERE id_credencial = ?",
      [hashedPassword, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Credencial no encontrada.' });
    }
    res.json({ message: "Contraseña actualizada exitosamente." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
