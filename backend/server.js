import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import serenoRoutes from './routes/serenoRoutes.js'; // <-- 1. IMPORTAR RUTAS

const app = express();
const port = 3001; // Puerto diferente a Vite

// Middlewares
app.use(cors());
app.use(express.json());

// Constante para el "salting" de bcrypt
const saltRounds = 10;

// --- Configuración para subida de archivos con Multer ---
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único para evitar colisiones
  }
});
const upload = multer({ storage: storage });

// Configuración de conexión a Laragon (MySQL)
const dbConfig = {
  host: '127.0.0.1',
  user: 'appuser',
  password: '123456',
  database: 'sistema_denuncias'
};
// Crear y exportar el pool de conexiones
export const db = mysql.createPool(dbConfig);

// Servir archivos estáticos desde la carpeta 'uploads'
app.use('/uploads', express.static('uploads'));

// --- Endpoint para subir archivos ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se subió ningún archivo.' });
  }
  // Devolvemos la ruta relativa para que el frontend la use
  res.json({ filePath: `uploads/${req.file.filename}` });
});

// Endpoint de Login
app.post('/api/login', async (req, res) => {

  const { email, password } = req.body;
  try {
    // 1. Buscamos al usuario por su correo
    const [rows] = await db.query("SELECT * FROM usuarios WHERE correo = ? AND estado = 1", [email]);

    if (rows.length > 0) {
      const user = rows[0];

      // 2. Comparamos la contraseña enviada con el hash guardado en la BD
      const match = await bcrypt.compare(password, user.password_hash);

      if (match) {
        console.log("Usuario web encontrado:", user.nombre);
        res.status(200).json({
          message: "Login exitoso desde MySQL",
          token: "token_web_" + user.id_usuario, // Generar un token real (JWT) sería el siguiente paso
          user: {
            id: user.id_usuario,
            email: user.correo,
            role: "admin",
            nombre: user.nombre
          }
        });
      } else {
        // La contraseña no coincide
        res.status(401).json({ message: "Correo o contraseña incorrectos" });
      }
    } else {
      // El usuario no existe o está inactivo
      res.status(401).json({ message: "Correo o contraseña incorrectos" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error en el servidor: " + err.message });
  }

});

// --- CRUD USUARIOS ---
app.get('/api/usuarios', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM usuarios");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, correo, password, telefono } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.query("INSERT INTO usuarios (nombre, correo, password_hash, telefono, estado, fecha_creacion) VALUES (?, ?, ?, ?, 1, NOW())", [nombre, correo, hashedPassword, telefono]);
    res.status(201).json({ message: "Usuario creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { nombre, correo, telefono } = req.body;
  try {
    await db.query("UPDATE usuarios SET nombre = ?, correo = ?, telefono = ? WHERE id_usuario = ?", [nombre, correo, telefono, req.params.id]);
    res.json({ message: "Usuario actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM usuarios WHERE id_usuario = ?", [req.params.id]);
    res.json({ message: "Usuario eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/usuarios/:id/toggle-status', async (req, res) => {
  try {
      const [rows] = await db.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [req.params.id]);
      if (rows.length === 0) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const newStatus = rows[0].estado === 1 ? 0 : 1;
      await db.query("UPDATE usuarios SET estado = ? WHERE id_usuario = ?", [newStatus, req.params.id]);
      res.json({ message: "Estado del usuario actualizado", newStatus });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// --- USAR RUTAS DE SERENOS ---
app.use('/api/serenos', serenoRoutes);


// --- CRUD PATRULLAS ---
app.get('/api/patrullas', async (req, res) => {
  try { 
    const [rows] = await db.query(`
      SELECT 
        p.*,
        ANY_VALUE(ap.id_asignacion) as id_asignacion,
        ANY_VALUE(s.nombres) as nombres,
        ANY_VALUE(s.apellidos) as apellidos,
        ANY_VALUE(t.nombre_turno) as nombre_turno
      FROM patrullas p
      LEFT JOIN asignacion_patrullas ap ON p.id_patrulla = ap.id_patrulla
      LEFT JOIN serenos s ON ap.id_sereno = s.id_sereno
      LEFT JOIN turnos t ON ap.id_turno = t.id_turno
      GROUP BY p.id_patrulla
    `); 
    res.json(rows); 
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/patrullas', async (req, res) => {
  const { codigo, tipo } = req.body;
  try { await db.query("INSERT INTO patrullas (codigo, tipo) VALUES (?, ?)", [codigo, tipo]); res.json({ message: "Patrulla creada" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/patrullas/:id', async (req, res) => {
  const { codigo, tipo } = req.body;
  try { await db.query("UPDATE patrullas SET codigo = ?, tipo = ? WHERE id_patrulla = ?", [codigo, tipo, req.params.id]); res.json({ message: "Patrulla actualizada" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/patrullas/:id', async (req, res) => {
  try { await db.query("DELETE FROM patrullas WHERE id_patrulla = ?", [req.params.id]); res.json({ message: "Patrulla eliminada" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD TURNOS ---
app.get('/api/turnos', async (req, res) => {
  try { const [rows] = await db.query("SELECT * FROM turnos"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/turnos', async (req, res) => {
  const { nombre_turno, hora_inicio, hora_fin } = req.body;
  try { await db.query("INSERT INTO turnos (nombre_turno, hora_inicio, hora_fin) VALUES (?, ?, ?)", [nombre_turno, hora_inicio, hora_fin]); res.json({ message: "Turno creado" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/turnos/:id', async (req, res) => {
  const { nombre_turno, hora_inicio, hora_fin } = req.body;
  try { await db.query("UPDATE turnos SET nombre_turno = ?, hora_inicio = ?, hora_fin = ? WHERE id_turno = ?", [nombre_turno, hora_inicio, hora_fin, req.params.id]); res.json({ message: "Turno actualizado" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/turnos/:id', async (req, res) => {
  try { await db.query("DELETE FROM turnos WHERE id_turno = ?", [req.params.id]); res.json({ message: "Turno eliminado" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD ASIGNACION_PATRULLAS ---
app.get('/api/asignaciones', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ap.id_asignacion,
        ap.fecha,
        s.id_sereno,
        s.nombres,
        s.apellidos,
        p.id_patrulla,
        p.codigo as codigo_patrulla,
        t.id_turno,
        t.nombre_turno,
        t.hora_inicio,
        t.hora_fin
      FROM asignacion_patrullas ap
      JOIN serenos s ON ap.id_sereno = s.id_sereno
      JOIN patrullas p ON ap.id_patrulla = p.id_patrulla
      JOIN turnos t ON ap.id_turno = t.id_turno
      ORDER BY ap.fecha DESC, t.hora_inicio
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/asignaciones', async (req, res) => {
  const { id_sereno, id_patrulla, id_turno, fecha } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Lógica simplificada: Un sereno o patrulla solo puede tener una asignación a la vez, sin importar fecha o turno.
    const [existingSereno] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_sereno = ?", [id_sereno]);
    if (existingSereno.length > 0) {
      throw new Error('Este sereno ya tiene una asignación. Elimine la anterior para continuar.');
    }
    
    const [existingPatrulla] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_patrulla = ?", [id_patrulla]);
    if (existingPatrulla.length > 0) {
      throw new Error('Esta patrulla ya tiene una asignación. Elimine la anterior para continuar.');
    }
    await connection.query("INSERT INTO asignacion_patrullas (id_sereno, id_patrulla, id_turno, fecha) VALUES (?, ?, ?, ?)", [id_sereno, id_patrulla, id_turno, fecha]);

    // Registrar en historial
    const [[sereno]] = await connection.query("SELECT CONCAT(nombres, ' ', apellidos) as nombre_completo FROM serenos WHERE id_sereno = ?", [id_sereno]);
    const [[patrulla]] = await connection.query("SELECT codigo FROM patrullas WHERE id_patrulla = ?", [id_patrulla]);
    const [[turno]] = await connection.query("SELECT nombre_turno FROM turnos WHERE id_turno = ?", [id_turno]);
    const detalles = `Sereno '${sereno.nombre_completo}' asignado a patrulla '${patrulla.codigo}' en turno '${turno.nombre_turno}' para el ${new Date(fecha).toLocaleDateString()}.`;
    await connection.query("INSERT INTO historial_asignaciones (detalles, tipo_operacion) VALUES (?, 'ASIGNACION')", [detalles]);

    await connection.commit();
    res.status(201).json({ message: "Asignación creada" });
  } catch (err) { 
    await connection.rollback();
    res.status(err.message.includes('ya tiene una asignación') ? 409 : 500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

app.put('/api/asignaciones/:id', async (req, res) => {
  const { id_sereno, id_patrulla, id_turno, fecha } = req.body;
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener datos ANTES de la actualización para el historial
    const [[oldAssignment]] = await connection.query("SELECT s.nombres as sereno_nombre, s.apellidos as sereno_apellido, p.codigo as patrulla_codigo FROM asignacion_patrullas ap JOIN serenos s ON ap.id_sereno = s.id_sereno JOIN patrullas p ON ap.id_patrulla = p.id_patrulla WHERE ap.id_asignacion = ?", [id]);

    // 2. Verificar conflictos (que el nuevo sereno o patrulla no estén ya asignados en OTRA asignación)
    const [existingSereno] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_sereno = ? AND id_asignacion != ?", [id_sereno, id]);
    if (existingSereno.length > 0) {
      throw new Error('El sereno de destino ya tiene otra asignación.');
    }
    const [existingPatrulla] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_patrulla = ? AND id_asignacion != ?", [id_patrulla, id]);
    if (existingPatrulla.length > 0) {
      throw new Error('La patrulla de destino ya tiene otra asignación.');
    }

    // 3. Actualizar la asignación
    await connection.query("UPDATE asignacion_patrullas SET id_sereno = ?, id_patrulla = ?, id_turno = ?, fecha = ? WHERE id_asignacion = ?", [id_sereno, id_patrulla, id_turno, fecha, id]);

    // 4. Registrar en historial
    const [[newSereno]] = await connection.query("SELECT CONCAT(nombres, ' ', apellidos) as nombre_completo FROM serenos WHERE id_sereno = ?", [id_sereno]);
    const [[newPatrulla]] = await connection.query("SELECT codigo FROM patrullas WHERE id_patrulla = ?", [id_patrulla]);
    const detalles = `Transferencia de patrulla '${newPatrulla.codigo}' de '${oldAssignment.sereno_nombre} ${oldAssignment.sereno_apellido}' a '${newSereno.nombre_completo}'.`;
    await connection.query("INSERT INTO historial_asignaciones (detalles, tipo_operacion) VALUES (?, 'TRANSFERENCIA')", [detalles]);

    await connection.commit();
    res.json({ message: "Asignación transferida/actualizada con éxito" });
  } catch (err) {
    await connection.rollback();
    res.status(err.message.includes('ya tiene otra asignación') ? 409 : 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/asignaciones/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener datos para el historial
    const [[assignment]] = await connection.query(`
      SELECT s.nombres, s.apellidos, p.codigo as patrulla_codigo, t.nombre_turno, ap.fecha
      FROM asignacion_patrullas ap
      JOIN serenos s ON ap.id_sereno = s.id_sereno
      JOIN patrullas p ON ap.id_patrulla = p.id_patrulla
      JOIN turnos t ON ap.id_turno = t.id_turno
      WHERE ap.id_asignacion = ?
    `, [req.params.id]);

    if (assignment) {
      const detalles = `Se eliminó la asignación del sereno '${assignment.nombres} ${assignment.apellidos}' con la patrulla '${assignment.patrulla_codigo}' del turno '${assignment.nombre_turno}' (${new Date(assignment.fecha).toLocaleDateString()}).`;
      await connection.query("INSERT INTO historial_asignaciones (detalles, tipo_operacion) VALUES (?, 'ELIMINACION')", [detalles]);
    }

    // 2. Eliminar la asignación
    await connection.query("DELETE FROM asignacion_patrullas WHERE id_asignacion = ?", [req.params.id]);

    await connection.commit();
    res.json({ message: "Asignación eliminada" });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

// --- HISTORIAL DE ASIGNACIONES ---
app.get('/api/historial-asignaciones', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM historial_asignaciones ORDER BY fecha_operacion DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CRUD SECTORES ---
app.get('/api/sectores', async (req, res) => {
  try {
    // Hacemos un LEFT JOIN para traer el nombre de la zona
    const [rows] = await db.query(`
      SELECT s.*, z.nombre as nombre_zona 
      FROM sectores s 
      LEFT JOIN zonas z ON s.id_zona = z.id_zona
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sectores', async (req, res) => {
  const { nombre, id_zona } = req.body;
  try {
    await db.query("INSERT INTO sectores (nombre, id_zona) VALUES (?, ?)", [nombre, id_zona]);
    res.json({ message: "Sector creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/sectores/:id', async (req, res) => {
  const { nombre, id_zona } = req.body;
  try {
    await db.query("UPDATE sectores SET nombre = ?, id_zona = ? WHERE id_sector = ?", [nombre, id_zona, req.params.id]);
    res.json({ message: "Sector actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/sectores/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM sectores WHERE id_sector = ?", [req.params.id]);
    res.json({ message: "Sector eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD PUNTOS GEOGRÁFICOS ---
app.get('/api/puntos', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM puntos_geograficos");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/puntos', async (req, res) => {
  const { latitud, longitud } = req.body;
  try {
    await db.query("INSERT INTO puntos_geograficos (latitud, longitud) VALUES (?, ?)", [latitud, longitud]);
    res.json({ message: "Punto creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/puntos/:id', async (req, res) => {
  const { latitud, longitud } = req.body;
  try {
    await db.query("UPDATE puntos_geograficos SET latitud = ?, longitud = ? WHERE id_punto = ?", [latitud, longitud, req.params.id]);
    res.json({ message: "Punto actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/puntos/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM puntos_geograficos WHERE id_punto = ?", [req.params.id]);
    res.json({ message: "Punto eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD DISTRITOS (Necesario para el selector de Zonas) ---
app.get('/api/distritos', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM distritos");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/distritos', async (req, res) => {
  const { nombre } = req.body;
  try {
    await db.query("INSERT INTO distritos (nombre) VALUES (?)", [nombre]);
    res.json({ message: "Distrito creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/distritos/:id', async (req, res) => {
  const { nombre } = req.body;
  try {
    await db.query("UPDATE distritos SET nombre = ? WHERE id_distrito = ?", [nombre, req.params.id]);
    res.json({ message: "Distrito actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/distritos/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM distritos WHERE id_distrito = ?", [req.params.id]);
    res.json({ message: "Distrito eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CATALOGOS PARA INCIDENCIAS ---
app.get('/api/tipos-incidencia', async (req, res) => {
  try { const [rows] = await db.query("SELECT * FROM tipos_incidencia"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/tipos-incidencia', async (req, res) => {
  const { nombre, codigo, descripcion } = req.body;
  try {
    await db.query("INSERT INTO tipos_incidencia (nombre, codigo, descripcion) VALUES (?, ?, ?)", [nombre, codigo, descripcion]);
    res.json({ message: "Tipo de incidencia creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/tipos-incidencia/:id', async (req, res) => {
  const { nombre, codigo, descripcion } = req.body;
  try {
    await db.query("UPDATE tipos_incidencia SET nombre = ?, codigo = ?, descripcion = ? WHERE id_tipo = ?", [nombre, codigo, descripcion, req.params.id]);
    res.json({ message: "Tipo de incidencia actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/tipos-incidencia/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM tipos_incidencia WHERE id_tipo = ?", [req.params.id]);
    res.json({ message: "Tipo de incidencia eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/estados-incidencia', async (req, res) => {
  try { const [rows] = await db.query("SELECT * FROM estados_incidencia"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/estados-incidencia', async (req, res) => {
  const { nombre } = req.body;
  try {
    await db.query("INSERT INTO estados_incidencia (nombre) VALUES (?)", [nombre]);
    res.json({ message: "Estado de incidencia creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/estados-incidencia/:id', async (req, res) => {
  const { nombre } = req.body;
  try {
    await db.query("UPDATE estados_incidencia SET nombre = ? WHERE id_estado = ?", [nombre, req.params.id]);
    res.json({ message: "Estado de incidencia actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/estados-incidencia/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM estados_incidencia WHERE id_estado = ?", [req.params.id]);
    res.json({ message: "Estado de incidencia eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/prioridad-incidencia', async (req, res) => {
  try { const [rows] = await db.query("SELECT * FROM prioridad_incidencia"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/prioridad-incidencia', async (req, res) => {
  const { nivel } = req.body;
  try {
    await db.query("INSERT INTO prioridad_incidencia (nivel) VALUES (?)", [nivel]);
    res.json({ message: "Prioridad de incidencia creada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/prioridad-incidencia/:id', async (req, res) => {
  const { nivel } = req.body;
  try {
    await db.query("UPDATE prioridad_incidencia SET nivel = ? WHERE id_prioridad = ?", [nivel, req.params.id]);
    res.json({ message: "Prioridad de incidencia actualizada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/prioridad-incidencia/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM prioridad_incidencia WHERE id_prioridad = ?", [req.params.id]);
    res.json({ message: "Prioridad de incidencia eliminada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD INCIDENCIAS ---
app.get('/api/incidencias', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*,
             CONCAT(s.nombres, ' ', s.apellidos) as nombre_sereno
      FROM incidencias i
      LEFT JOIN serenos s ON i.id_sereno = s.id_sereno
      ORDER BY i.fecha_registro DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/incidencias', async (req, res) => {
  // --- LÓGICA ADAPTADA PARA EL PARTE DE INTERVENCIÓN DE LA APP ---
  // El endpoint original estaba desactualizado con respecto a la nueva estructura de la tabla 'incidencias'.
  // Este código ahora coincide con la estructura que usa la app del sereno.
  const {
    numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
    modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
    monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
    firma_base64, // La app envía la firma en base64
    id_sereno // La app envía el id del sereno
  } = req.body;

  const connection = await db.getConnection();
  let firmaRuta = null;

  try {
    await connection.beginTransaction();

    // 1. Procesar y guardar la firma si se envió
    if (firma_base64) {
        const firmasDir = 'uploads/firmas/';
        if (!fs.existsSync(firmasDir)) { fs.mkdirSync(firmasDir, { recursive: true }); }

        const base64Data = firma_base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `firma_${id_sereno}_${Date.now()}.png`;
        firmaRuta = path.join(firmasDir, filename).replace(/\\/g, "/");
        fs.writeFileSync(firmaRuta, buffer);
    }

    // 2. Insertar el parte de intervención en la tabla 'incidencias'
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
        firmaRuta, id_sereno
      ]
    );
    const id_incidencia = result.insertId;

    await connection.commit();
    res.status(201).json({ message: "Parte de intervención registrado con éxito.", id_incidencia: id_incidencia });
  } catch (err) {
    await connection.rollback();
    // Si hay un error, eliminar el archivo de firma que se subió para no dejar basura
    if (firmaRuta) { try { fs.unlinkSync(firmaRuta); } catch (e) { console.error("Error al limpiar firma:", e); } }
    console.error("Error al registrar parte de intervención:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.put('/api/incidencias/:id', async (req, res) => {
  const { 
    numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
    modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
    monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
    firma_ruta, id_sereno
  } = req.body;
  try {
    await db.query(
      `UPDATE incidencias SET 
        numero_parte=?, servicio=?, zona=?, dia=?, fecha=?, hora_hecho=?, hora_denuncia=?, hora_intervencion=?,
        modalidad_intervencion=?, unidad_serenazgo=?, lugar_hecho=?, tipo_hecho=?, arma_usada=?,
        monto_afectado=?, nombres_agraviado=?, senas_autor=?, supervisor_nombre=?, descripcion_relato=?,
        firma_ruta=?, id_sereno=?
      WHERE id_incidencia=?`,
      [
        numero_parte, servicio, zona, dia, fecha, hora_hecho, hora_denuncia, hora_intervencion,
        modalidad_intervencion, unidad_serenazgo, lugar_hecho, tipo_hecho, arma_usada,
        monto_afectado, nombres_agraviado, senas_autor, supervisor_nombre, descripcion_relato,
        firma_ruta, id_sereno,
        req.params.id
      ]
    );
    res.json({ message: "Incidencia actualizada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/incidencias/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM incidencias WHERE id_incidencia = ?", [req.params.id]);
    res.json({ message: "Incidencia eliminada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD EVIDENCIAS ---
app.get('/api/incidencias/:id/evidencias', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ev.*, a.ruta_archivo, a.fecha_subida
      FROM evidencias ev
      JOIN archivos a ON ev.id_archivo = a.id_archivo
      WHERE ev.id_incidencia = ?
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/evidencias', async (req, res) => {
  const { id_incidencia, ruta_archivo, descripcion } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Determinar el tipo de archivo por su extensión
    let id_tipo_archivo = 3; // 3 = Documento (por defecto para PDF, Word, etc.)
    const extension = path.extname(ruta_archivo).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
      id_tipo_archivo = 1; // Imagen
    } else if (['.mp4', '.mov', '.avi'].includes(extension)) {
      id_tipo_archivo = 2; // Video
    }

    // 2. Insertar Archivo con el tipo detectado
    const [fileResult] = await connection.query("INSERT INTO archivos (id_tipo_archivo, ruta_archivo, fecha_subida) VALUES (?, ?, NOW())", [id_tipo_archivo, ruta_archivo]);
    const id_archivo = fileResult.insertId;
    // 3. Insertar Evidencia
    await connection.query("INSERT INTO evidencias (id_incidencia, id_archivo, descripcion) VALUES (?, ?, ?)", [id_incidencia, id_archivo, descripcion]);
    await connection.commit();
    res.json({ message: "Evidencia agregada" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally { connection.release(); }
});


// --- CRUD ALMACEN ---

// --- CRUD Tipos de Equipo ---
app.get('/api/tipos-equipo', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM tipos_equipo ORDER BY nombre");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tipos-equipo', async (req, res) => {
    const { nombre } = req.body;
    try {
        await db.query("INSERT INTO tipos_equipo (nombre) VALUES (?)", [nombre]);
        res.status(201).json({ message: "Tipo de equipo creado con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tipos-equipo/:id', async (req, res) => {
    const { nombre } = req.body;
    try {
        await db.query("UPDATE tipos_equipo SET nombre = ? WHERE id = ?", [nombre, req.params.id]);
        res.json({ message: "Tipo de equipo actualizado con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tipos-equipo/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM tipos_equipo WHERE id = ?", [req.params.id]);
        res.json({ message: "Tipo de equipo eliminado con éxito" });
    } catch (err) {
        // Handle foreign key constraint error
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'No se puede eliminar porque hay equipos de este tipo.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- CRUD Equipos ---
app.get('/api/equipos', async (req, res) => {
    const { searchTerm, page = 1, limit = 15, forExport } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let params = [];
    let whereClause = '';

    if (searchTerm) {
        const searchTermWithWildcards = `%${searchTerm}%`;
        whereClause = `
            WHERE tipo_nombre LIKE ?
            OR descripcion LIKE ?
            OR marca LIKE ?
            OR modelo LIKE ?
            OR numero_serie LIKE ?
            OR identificador LIKE ?
            OR estado LIKE ?
            OR persona_asignada LIKE ?
            OR area_asignada LIKE ?
        `;
        params = Array(9).fill(searchTermWithWildcards);
    }

    const subquery = `
        SELECT 
          e.*, 
          te.nombre as tipo_nombre,
          ANY_VALUE(p.nombre) as persona_asignada,
          ANY_VALUE(ar.nombre) as area_asignada
        FROM equipos e
        JOIN tipos_equipo te ON e.tipo_id = te.id
        LEFT JOIN asignaciones asg ON e.id = asg.equipo_id AND asg.estado = 'ACTIVO'
        LEFT JOIN personas p ON asg.persona_id = p.id
        LEFT JOIN areas ar ON asg.area_id = ar.id
        GROUP BY e.id
    `;

    const countQuery = `SELECT COUNT(*) as total FROM (${subquery}) as equipos_completos ${whereClause}`;
    let dataQuery = `SELECT * FROM (${subquery}) as equipos_completos ${whereClause} ORDER BY fecha_registro DESC`;
    let dataParams = [...params];

    if (!forExport) {
        dataQuery += ` LIMIT ? OFFSET ?`;
        dataParams.push(parseInt(limit, 10), offset);
    }

     try {
        if (forExport) {
            const [dataRows] = await db.query(dataQuery, dataParams);
            // For export, we just return the data array, not the pagination object
            return res.json({ data: dataRows });
        }

        const [countRows] = await db.query(countQuery, params);
        const totalItems = countRows[0].total;
        const totalPages = Math.ceil(totalItems / parseInt(limit, 10));

        const [dataRows] = await db.query(dataQuery, dataParams);

        res.json({
            data: dataRows,
            pagination: { totalItems, totalPages, currentPage: parseInt(page, 10), limit: parseInt(limit, 10) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/equipos', async (req, res) => {
  const { tipo_id, descripcion, marca, modelo, numero_serie, identificador } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO equipos (tipo_id, descripcion, marca, modelo, numero_serie, identificador, estado) VALUES (?, ?, ?, ?, ?, ?, 'ALMACEN')",
      [tipo_id, descripcion, marca, modelo, numero_serie, identificador]
    );
    const newEquipoId = result.insertId;
    await connection.query(
      "INSERT INTO historial_equipos (equipo_id, movimiento, observaciones) VALUES (?, 'REGISTRO', 'Equipo nuevo registrado en el sistema')",
      [newEquipoId]
    );
    await connection.commit();
    res.status(201).json({ message: "Equipo registrado con éxito" });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El número de serie ya existe.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.put('/api/equipos/:id', async (req, res) => {
  const { tipo_id, descripcion, marca, modelo, numero_serie, identificador, estado } = req.body;
  try {
    await db.query(
      "UPDATE equipos SET tipo_id = ?, descripcion = ?, marca = ?, modelo = ?, numero_serie = ?, identificador = ?, estado = ? WHERE id = ?",
      [tipo_id, descripcion, marca, modelo, numero_serie, identificador, estado, req.params.id]
    );
    res.json({ message: "Equipo actualizado" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El número de serie ya existe.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/equipos/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM equipos WHERE id = ?", [req.params.id]);
    res.json({ message: "Equipo eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD Areas ---
app.get('/api/areas', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM areas ORDER BY nombre");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/areas', async (req, res) => {
    const { nombre } = req.body;
    try {
        await db.query("INSERT INTO areas (nombre) VALUES (?)", [nombre]);
        res.status(201).json({ message: "Área creada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/areas/:id', async (req, res) => {
    const { nombre } = req.body;
    try {
        await db.query("UPDATE areas SET nombre = ? WHERE id = ?", [nombre, req.params.id]);
        res.json({ message: "Área actualizada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/areas/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM areas WHERE id = ?", [req.params.id]);
        res.json({ message: "Área eliminada con éxito" });
    } catch (err) {
        // Handle foreign key constraint error (e.g., ER_ROW_IS_REFERENCED_2)
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'No se puede eliminar el área porque tiene personal asignado.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- CRUD Personas ---
app.get('/api/personas', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, a.nombre as area_nombre 
      FROM personas p 
      LEFT JOIN areas a ON p.area_id = a.id
      ORDER BY p.nombre
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/personas', async (req, res) => {
    const { nombre, area_id } = req.body;
    try {
        await db.query("INSERT INTO personas (nombre, area_id) VALUES (?, ?)", [nombre, area_id || null]);
        res.status(201).json({ message: "Persona creada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/personas/:id', async (req, res) => {
    const { nombre, area_id } = req.body;
    try {
        await db.query("UPDATE personas SET nombre = ?, area_id = ? WHERE id = ?", [nombre, area_id || null, req.params.id]);
        res.json({ message: "Persona actualizada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/personas/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM personas WHERE id = ?", [req.params.id]);
        res.json({ message: "Persona eliminada con éxito" });
    } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'No se puede eliminar a la persona porque tiene equipos asignados.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- CRUD Asignaciones de Equipo ---
app.get('/api/asignaciones-equipos', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        asg.id, asg.fecha_asignacion, asg.fecha_devolucion, asg.estado,
        e.id as equipo_id, e.descripcion as equipo_descripcion, e.numero_serie,
        p.id as persona_id, p.nombre as persona_nombre,
        ar.id as area_id, ar.nombre as area_nombre
      FROM asignaciones asg
      JOIN equipos e ON asg.equipo_id = e.id
      LEFT JOIN personas p ON asg.persona_id = p.id
      LEFT JOIN areas ar ON asg.area_id = ar.id
      ORDER BY asg.fecha_asignacion DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/asignaciones-equipos', async (req, res) => {
    const { equipo_id, persona_id, area_id, fecha_asignacion } = req.body;
    const finalPersonaId = persona_id || null; // Aceptar persona opcional
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if equipment is available
        const [[equipo]] = await connection.query("SELECT estado FROM equipos WHERE id = ?", [equipo_id]);
        if (!equipo || equipo.estado !== 'ALMACEN') {
            throw new Error('El equipo seleccionado no está disponible en almacén.');
        }

        // 2. Create the assignment
        const [result] = await connection.query(
            "INSERT INTO asignaciones (equipo_id, persona_id, area_id, fecha_asignacion, estado) VALUES (?, ?, ?, ?, 'ACTIVO')",
            [equipo_id, finalPersonaId, area_id, fecha_asignacion]
        );
        const newAsignacionId = result.insertId;

        // 3. Update equipment status
        await connection.query("UPDATE equipos SET estado = 'ASIGNADO' WHERE id = ?", [equipo_id]);

        // 4. Log in history
        await connection.query(
            "INSERT INTO historial_equipos (equipo_id, persona_id, area_id, movimiento, observaciones) VALUES (?, ?, ?, 'ASIGNACION', ?)",
            [equipo_id, finalPersonaId, area_id, `Asignado mediante registro #${newAsignacionId}`]
        );

        await connection.commit();
        res.status(201).json({ message: "Equipo asignado con éxito" });
    } catch (err) {
        await connection.rollback();
        res.status(err.message.includes('disponible') ? 409 : 500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Endpoint to mark an assignment as returned
app.put('/api/asignaciones-equipos/:id/devolucion', async (req, res) => {
    const { id } = req.params;
    const { fecha_devolucion, observaciones } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[asignacion]] = await connection.query("SELECT * FROM asignaciones WHERE id = ?", [id]);
        if (!asignacion || asignacion.estado !== 'ACTIVO') {
            throw new Error('La asignación no es válida o ya fue devuelta.');
        }

        await connection.query("UPDATE asignaciones SET estado = 'DEVUELTO', fecha_devolucion = ? WHERE id = ?", [fecha_devolucion, id]);
        await connection.query("UPDATE equipos SET estado = 'ALMACEN' WHERE id = ?", [asignacion.equipo_id]);
        await connection.query(
            "INSERT INTO historial_equipos (equipo_id, persona_id, area_id, movimiento, observaciones) VALUES (?, ?, ?, 'DEVOLUCION', ?)",
            [asignacion.equipo_id, asignacion.persona_id, asignacion.area_id, observaciones || `Devolución de equipo.`]
        );

        await connection.commit();
        res.json({ message: "Equipo devuelto a almacén con éxito." });
    } catch (err) {
        await connection.rollback();
        res.status(err.message.includes('válida') ? 409 : 500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// --- Historial de Equipos ---
app.get('/api/historial-equipos/:equipo_id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        h.*,
        p.nombre as persona_nombre,
        a.nombre as area_nombre
      FROM historial_equipos h
      LEFT JOIN personas p ON h.persona_id = p.id
      LEFT JOIN areas a ON h.area_id = a.id
      WHERE h.equipo_id = ?
      ORDER BY h.fecha DESC
    `, [req.params.equipo_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- CRUD ZONAS ---
app.get('/api/zonas', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT z.*, d.nombre as nombre_distrito
      FROM zonas z
      LEFT JOIN distritos d ON z.id_distrito = d.id_distrito
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zonas', async (req, res) => {
  const { nombre, id_distrito } = req.body;
  try {
    await db.query(
      "INSERT INTO zonas (nombre, id_distrito) VALUES (?, ?)",
      [nombre, id_distrito]
    );
    res.json({ message: "Zona creada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/zonas/:id', async (req, res) => {
  const { nombre, id_distrito } = req.body;
  try {
    await db.query(
      "UPDATE zonas SET nombre = ?, id_distrito = ? WHERE id_zona = ?",
      [nombre, id_distrito, req.params.id]
    );
    res.json({ message: "Zona actualizada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/zonas/:id', async (req, res) => {
  try {
    await db.query(
      "DELETE FROM zonas WHERE id_zona = ?",
      [req.params.id]
    );
    res.json({ message: "Zona eliminada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Endpoint para probar la conexión a la base de datos (Ping)
app.get('/api/test-db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ message: "✅ Conexión exitosa a la Base de Datos" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error: No se pudo conectar a la BD" });
  }
});

// --- ENDPOINT DE KPIs (Estadísticas) ---
app.get('/api/kpis', async (req, res) => {
  try {
    const [totalRows] = await db.query("SELECT COUNT(*) as total FROM incidencias");
    // NOTA: La nueva tabla 'incidencias' no tiene campo 'id_estado', por lo que
    // simplificamos los KPIs para mostrar solo el total por ahora.
    // const [resueltasRows] = await db.query("SELECT COUNT(*) as total FROM incidencias WHERE id_estado = 3"); 
    // const [pendientesRows] = await db.query("SELECT COUNT(*) as total FROM incidencias WHERE id_estado IN (1, 2)");

    res.json({
      total: totalRows[0].total,
      resueltas: 0, // Placeholder
      pendientes: totalRows[0].total,
      efectividad: 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${port}`);
});