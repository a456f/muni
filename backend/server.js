import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import accessRoutes from './routes/accessRoutes.js';
import serenoRoutes from './routes/serenoRoutes.js'; // <-- 1. IMPORTAR RUTAS
import saludRoutes from './routes/saludRoutes.js'; // <-- Rutas de Salud
import almacenRoutes from './routes/almacenRoutes.js'; // <-- Rutas de Almacén

const app = express();
const port = 3001; // Puerto diferente a Vite

// Orígenes permitidos
const allowedOrigins = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
  'http://195.35.40.161:3000', 'http://195.35.40.161',
  'https://195.35.40.161:3000', 'https://195.35.40.161'
];

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins }
});
app.set('io', io);

// Middlewares
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Rate limiting simple para login endpoints
const loginAttempts = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  const maxAttempts = 10;

  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < windowMs);

  if (recent.length >= maxAttempts) {
    return res.status(429).json({ message: 'Demasiados intentos. Espere un minuto.' });
  }

  recent.push(now);
  loginAttempts.set(ip, recent);

  // Limpiar IPs viejas cada 5 min
  if (Math.random() < 0.01) {
    for (const [key, val] of loginAttempts) {
      if (val.every(t => now - t > windowMs * 5)) loginAttempts.delete(key);
    }
  }
  next();
};

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
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

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

app.post('/api/login', rateLimiter);
app.post('/api/serenos/login', rateLimiter);
app.post('/api/almacen/login', rateLimiter);
app.use('/api', accessRoutes);

// Endpoint de Login
app.post('/api/legacy-login', rateLimiter, async (req, res) => {

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
app.get('/api/legacy-usuarios', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM usuarios");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/legacy-usuarios', async (req, res) => {
  const { nombre, correo, password, telefono } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.query("INSERT INTO usuarios (nombre, correo, password_hash, telefono, estado, fecha_creacion) VALUES (?, ?, ?, ?, 1, NOW())", [nombre, correo, hashedPassword, telefono]);
    res.status(201).json({ message: "Usuario creado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/legacy-usuarios/:id', async (req, res) => {
  const { nombre, correo, telefono } = req.body;
  try {
    await db.query("UPDATE usuarios SET nombre = ?, correo = ?, telefono = ? WHERE id_usuario = ?", [nombre, correo, telefono, req.params.id]);
    res.json({ message: "Usuario actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/legacy-usuarios/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM usuarios WHERE id_usuario = ?", [req.params.id]);
    res.json({ message: "Usuario eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/legacy-usuarios/:id/toggle-status', async (req, res) => {
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
app.use('/api/salud', saludRoutes);
app.use('/api/almacen', almacenRoutes);


// --- CRUD PATRULLAS ---
app.get('/api/patrullas', async (req, res) => {
  try { 
    const [rows] = await db.query(`
      SELECT 
        p.id_patrulla,
        p.codigo,
        p.tipo,
        ap.id_asignacion,
        ap.fecha as fecha_asignacion,
        ap.id_personal,
        ap.id_turno,
        per.codigo_personal,
        per.nombres,
        per.apellidos,
        CONCAT(per.apellidos, ', ', per.nombres) as sereno_nombre,
        t.nombre_turno,
        t.hora_inicio,
        t.hora_fin,
        CASE
          WHEN ap.id_asignacion IS NULL THEN 'LIBRE'
          ELSE 'ASIGNADA'
        END as estado_operativo
      FROM patrullas p
      LEFT JOIN asignacion_patrullas ap ON p.id_patrulla = ap.id_patrulla
      LEFT JOIN personal per ON ap.id_personal = per.id_personal
      LEFT JOIN turnos t ON ap.id_turno = t.id_turno
      ORDER BY p.codigo ASC
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
        per.id_personal as id_sereno,
        per.id_personal as id_personal,
        per.nombres,
        per.apellidos,
        p.id_patrulla,
        p.codigo as codigo_patrulla,
        t.id_turno,
        t.nombre_turno,
        t.hora_inicio,
        t.hora_fin
      FROM asignacion_patrullas ap
      JOIN personal per ON ap.id_personal = per.id_personal
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
    const [existingSereno] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_personal = ?", [id_sereno]);
    if (existingSereno.length > 0) {
      throw new Error('Este sereno ya tiene una asignación. Elimine la anterior para continuar.');
    }
    
    const [existingPatrulla] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_patrulla = ?", [id_patrulla]);
    if (existingPatrulla.length > 0) {
      throw new Error('Esta patrulla ya tiene una asignación. Elimine la anterior para continuar.');
    }
    await connection.query("INSERT INTO asignacion_patrullas (id_personal, id_patrulla, id_turno, fecha) VALUES (?, ?, ?, ?)", [id_sereno, id_patrulla, id_turno, fecha]);

    // Registrar en historial
    const [[sereno]] = await connection.query("SELECT CONCAT(nombres, ' ', apellidos) as nombre_completo FROM personal WHERE id_personal = ?", [id_sereno]);
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
    const [[oldAssignment]] = await connection.query("SELECT per.nombres as sereno_nombre, per.apellidos as sereno_apellido, p.codigo as patrulla_codigo FROM asignacion_patrullas ap JOIN personal per ON ap.id_personal = per.id_personal JOIN patrullas p ON ap.id_patrulla = p.id_patrulla WHERE ap.id_asignacion = ?", [id]);

    // 2. Verificar conflictos (que el nuevo sereno o patrulla no estén ya asignados en OTRA asignación)
    const [existingSereno] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_personal = ? AND id_asignacion != ?", [id_sereno, id]);
    if (existingSereno.length > 0) {
      throw new Error('El sereno de destino ya tiene otra asignación.');
    }
    const [existingPatrulla] = await connection.query("SELECT id_asignacion FROM asignacion_patrullas WHERE id_patrulla = ? AND id_asignacion != ?", [id_patrulla, id]);
    if (existingPatrulla.length > 0) {
      throw new Error('La patrulla de destino ya tiene otra asignación.');
    }

    // 3. Actualizar la asignación
    await connection.query("UPDATE asignacion_patrullas SET id_personal = ?, id_patrulla = ?, id_turno = ?, fecha = ? WHERE id_asignacion = ?", [id_sereno, id_patrulla, id_turno, fecha, id]);

    // 4. Registrar en historial
    const [[newSereno]] = await connection.query("SELECT CONCAT(nombres, ' ', apellidos) as nombre_completo FROM personal WHERE id_personal = ?", [id_sereno]);
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

app.put('/api/asignaciones/:id/devolver', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[assignment]] = await connection.query(`
      SELECT 
        ap.id_asignacion,
        ap.fecha,
        per.nombres,
        per.apellidos,
        p.codigo as patrulla_codigo,
        t.nombre_turno
      FROM asignacion_patrullas ap
      JOIN personal per ON ap.id_personal = per.id_personal
      JOIN patrullas p ON ap.id_patrulla = p.id_patrulla
      JOIN turnos t ON ap.id_turno = t.id_turno
      WHERE ap.id_asignacion = ?
    `, [id]);

    if (!assignment) {
      throw new Error('La asignacion no existe.');
    }

    const detalles = `Patrulla '${assignment.patrulla_codigo}' devuelta al almacen desde '${assignment.nombres} ${assignment.apellidos}' en turno '${assignment.nombre_turno}' (${new Date(assignment.fecha).toLocaleDateString()}).`;
    await connection.query("INSERT INTO historial_asignaciones (detalles, tipo_operacion) VALUES (?, 'DEVOLUCION')", [detalles]);
    await connection.query("DELETE FROM asignacion_patrullas WHERE id_asignacion = ?", [id]);

    await connection.commit();
    res.json({ message: 'Patrulla devuelta al almacen correctamente.' });
  } catch (err) {
    await connection.rollback();
    res.status(err.message.includes('no existe') ? 404 : 500).json({ error: err.message });
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
      SELECT per.nombres, per.apellidos, p.codigo as patrulla_codigo, t.nombre_turno, ap.fecha
      FROM asignacion_patrullas ap
      JOIN personal per ON ap.id_personal = per.id_personal
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let where = '';
    const params = [];
    if (search) {
      where = `WHERE i.numero_parte LIKE ? OR i.tipo_hecho LIKE ? OR i.descripcion_relato LIKE ? OR i.zona LIKE ?`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM incidencias i ${where}`, params);

    const [rows] = await db.query(`
      SELECT i.*,
             CONCAT(per.nombres, ' ', per.apellidos) as nombre_sereno
      FROM incidencias i
      LEFT JOIN personal per ON i.id_sereno = per.id_personal
      ${where}
      ORDER BY i.fecha_registro DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({ data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
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

// --- Resumen Equipos por Tipo ---
app.get('/api/equipos/resumen', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT te.nombre AS tipo, COUNT(*) AS cantidad
            FROM equipos e
            JOIN tipos_equipo te ON e.tipo_id = te.id
            GROUP BY te.id, te.nombre
            ORDER BY cantidad DESC
        `);
        const total = rows.reduce((sum, r) => sum + r.cantidad, 0);
        res.json({ resumen: rows, total });
    } catch (error) {
        console.error('Error fetching resumen:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
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
            OR sbn LIKE ?
            OR estado LIKE ?
            OR persona_asignada LIKE ?
            OR area_asignada LIKE ?
        `;
        params = Array(10).fill(searchTermWithWildcards);
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
  const { tipo_id, descripcion, marca, modelo, numero_serie, identificador, sbn } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO equipos (tipo_id, descripcion, marca, modelo, numero_serie, identificador, sbn, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'ALMACEN')",
      [tipo_id, descripcion, marca, modelo, numero_serie, identificador, sbn || null]
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
  const { tipo_id, descripcion, marca, modelo, numero_serie, identificador, sbn, estado } = req.body;
  try {
    await db.query(
      "UPDATE equipos SET tipo_id = ?, descripcion = ?, marca = ?, modelo = ?, numero_serie = ?, identificador = ?, sbn = ?, estado = ? WHERE id = ?",
      [tipo_id, descripcion, marca, modelo, numero_serie, identificador, sbn || null, estado, req.params.id]
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
      SELECT
        p.id_personal as id,
        p.id_personal,
        p.codigo_personal,
        p.nombres,
        p.apellidos,
        CONCAT(p.nombres, ' ', p.apellidos) as nombre,
        p.id_area as area_id,
        a.nombre as area_nombre,
        p.id_sector as sector_id,
        s.nombre as sector_nombre,
        z.nombre as zona_nombre
      FROM personal p
      LEFT JOIN areas a ON p.id_area = a.id
      LEFT JOIN sectores s ON p.id_sector = s.id_sector
      LEFT JOIN zonas z ON s.id_zona = z.id_zona
      ORDER BY p.nombres, p.apellidos
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/personas', async (req, res) => {
    const { nombre, area_id, sector_id } = req.body;
    try {
        const trimmed = (nombre || '').trim();
        if (!trimmed) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const parts = trimmed.split(/\s+/);
        const nombres = parts.shift();
        const apellidos = parts.join(' ') || '.';
        const codigoPersonal = `P-${Date.now()}`;
        await db.query("INSERT INTO personal (codigo_personal, nombres, apellidos, id_area, id_sector, estado, fecha_creacion) VALUES (?, ?, ?, ?, ?, 1, NOW())", [codigoPersonal, nombres, apellidos, area_id || null, sector_id || null]);
        res.status(201).json({ message: "Persona creada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/personas/:id', async (req, res) => {
    const { nombre, area_id, sector_id } = req.body;
    try {
        const trimmed = (nombre || '').trim();
        if (!trimmed) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const parts = trimmed.split(/\s+/);
        const nombres = parts.shift();
        const apellidos = parts.join(' ') || '.';
        await db.query("UPDATE personal SET nombres = ?, apellidos = ?, id_area = ?, id_sector = ? WHERE id_personal = ?", [nombres, apellidos, area_id || null, sector_id || null, req.params.id]);
        res.json({ message: "Persona actualizada con éxito" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/personas/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM personal WHERE id_personal = ?", [req.params.id]);
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
// --- CRUD SECTORES ---
app.get('/api/sectores', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, z.nombre as nombre_zona, d.nombre as nombre_distrito
      FROM sectores s
      JOIN zonas z ON s.id_zona = z.id_zona
      LEFT JOIN distritos d ON z.id_distrito = d.id_distrito
      WHERE s.estado = 1
      ORDER BY d.nombre, z.nombre, s.nombre
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sectores/:id', async (req, res) => {
  try {
    const [[sector]] = await db.query(`
      SELECT s.*, z.nombre as nombre_zona, d.nombre as nombre_distrito
      FROM sectores s
      JOIN zonas z ON s.id_zona = z.id_zona
      LEFT JOIN distritos d ON z.id_distrito = d.id_distrito
      WHERE s.id_sector = ?
    `, [req.params.id]);
    if (!sector) return res.status(404).json({ error: 'Sector no encontrado' });

    const [puntos] = await db.query(
      "SELECT latitud, longitud, orden FROM sector_puntos WHERE id_sector = ? ORDER BY orden", [req.params.id]
    );
    res.json({ ...sector, puntos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sectores', async (req, res) => {
  const { nombre, id_zona, descripcion, puntos } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO sectores (nombre, id_zona, descripcion) VALUES (?, ?, ?)",
      [nombre, id_zona, descripcion || null]
    );
    const sectorId = result.insertId;

    if (puntos && Array.isArray(puntos) && puntos.length > 0) {
      for (let i = 0; i < puntos.length; i++) {
        await connection.query(
          "INSERT INTO sector_puntos (id_sector, latitud, longitud, orden) VALUES (?, ?, ?, ?)",
          [sectorId, puntos[i].latitud, puntos[i].longitud, i]
        );
      }
    }
    await connection.commit();
    res.status(201).json({ message: "Sector creado", id_sector: sectorId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally { connection.release(); }
});

app.put('/api/sectores/:id', async (req, res) => {
  const { nombre, id_zona, descripcion, puntos } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE sectores SET nombre = ?, id_zona = ?, descripcion = ? WHERE id_sector = ?",
      [nombre, id_zona, descripcion || null, req.params.id]
    );

    if (puntos && Array.isArray(puntos)) {
      await connection.query("DELETE FROM sector_puntos WHERE id_sector = ?", [req.params.id]);
      for (let i = 0; i < puntos.length; i++) {
        await connection.query(
          "INSERT INTO sector_puntos (id_sector, latitud, longitud, orden) VALUES (?, ?, ?, ?)",
          [req.params.id, puntos[i].latitud, puntos[i].longitud, i]
        );
      }
    }
    await connection.commit();
    res.json({ message: "Sector actualizado" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally { connection.release(); }
});

app.delete('/api/sectores/:id', async (req, res) => {
  try {
    await db.query("UPDATE sectores SET estado = 0 WHERE id_sector = ?", [req.params.id]);
    res.json({ message: "Sector eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    res.json({
      total: totalRows[0].total,
      resueltas: 0,
      pendientes: totalRows[0].total,
      efectividad: 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ESTADÍSTICAS COMPLETAS PARA DASHBOARD ---
app.get('/api/estadisticas', async (req, res) => {
  try {
    const [[totales]] = await db.query(`
      SELECT
        COUNT(*) as total_incidencias,
        COUNT(DISTINCT id_sereno) as serenos_activos,
        COUNT(DISTINCT zona) as zonas_cubiertas,
        COUNT(DISTINCT DATE(fecha_registro)) as dias_con_actividad
      FROM incidencias
    `);

    const [porTipo] = await db.query(`
      SELECT tipo_hecho as nombre, COUNT(*) as cantidad
      FROM incidencias WHERE tipo_hecho IS NOT NULL AND tipo_hecho != ''
      GROUP BY tipo_hecho ORDER BY cantidad DESC LIMIT 10
    `);

    const [porZona] = await db.query(`
      SELECT zona as nombre, COUNT(*) as cantidad
      FROM incidencias WHERE zona IS NOT NULL AND zona != ''
      GROUP BY zona ORDER BY cantidad DESC LIMIT 10
    `);

    const [porModalidad] = await db.query(`
      SELECT COALESCE(modalidad_intervencion, 'No especificada') as nombre, COUNT(*) as cantidad
      FROM incidencias GROUP BY modalidad_intervencion ORDER BY cantidad DESC
    `);

    const [porServicio] = await db.query(`
      SELECT COALESCE(servicio, 'N/A') as nombre, COUNT(*) as cantidad
      FROM incidencias GROUP BY servicio ORDER BY cantidad DESC
    `);

    const [porDia] = await db.query(`
      SELECT DATE(fecha_registro) as fecha, COUNT(*) as cantidad
      FROM incidencias WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(fecha_registro) ORDER BY fecha ASC
    `);

    const [porHora] = await db.query(`
      SELECT HOUR(hora_hecho) as hora, COUNT(*) as cantidad
      FROM incidencias WHERE hora_hecho IS NOT NULL
      GROUP BY HOUR(hora_hecho) ORDER BY hora ASC
    `);

    const [topSerenos] = await db.query(`
      SELECT CONCAT(p.nombres, ' ', p.apellidos) as nombre, COUNT(*) as cantidad
      FROM incidencias i JOIN personal p ON i.id_sereno = p.id_personal
      GROUP BY i.id_sereno ORDER BY cantidad DESC LIMIT 10
    `);

    const [[mesActual]] = await db.query(`
      SELECT COUNT(*) as total FROM incidencias
      WHERE MONTH(fecha_registro) = MONTH(NOW()) AND YEAR(fecha_registro) = YEAR(NOW())
    `);
    const [[mesAnterior]] = await db.query(`
      SELECT COUNT(*) as total FROM incidencias
      WHERE MONTH(fecha_registro) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
        AND YEAR(fecha_registro) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
    `);

    const [ultimas] = await db.query(`
      SELECT i.id_incidencia, i.numero_parte, i.tipo_hecho, i.zona, i.lugar_hecho,
        i.fecha_registro, i.modalidad_intervencion,
        CONCAT(p.nombres, ' ', p.apellidos) as nombre_sereno
      FROM incidencias i LEFT JOIN personal p ON i.id_sereno = p.id_personal
      ORDER BY i.fecha_registro DESC LIMIT 5
    `);

    const [porDiaSemana] = await db.query(`
      SELECT DAYNAME(fecha_registro) as nombre, COUNT(*) as cantidad
      FROM incidencias GROUP BY DAYNAME(fecha_registro), DAYOFWEEK(fecha_registro)
      ORDER BY DAYOFWEEK(fecha_registro) ASC
    `);

    res.json({
      totales, mesActual: mesActual.total, mesAnterior: mesAnterior.total,
      porTipo, porZona, porModalidad, porServicio, porDia, porHora, porDiaSemana, topSerenos, ultimas
    });
  } catch (err) {
    console.error("Error en estadísticas:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para probar la notificación por socket
app.get('/api/test-notificacion', (req, res) => {
  const io = req.app.get('io');
  if (io) {
    const testData = {
      message: `¡NOTIFICACIÓN DE PRUEBA! - ${new Date().toLocaleTimeString()}`,
      id_incidencia: Math.floor(Math.random() * 1000),
      tipo: 'PRUEBA'
    };
    io.emit('nueva_incidencia', testData);
    console.log('Evento de notificación de prueba emitido:', testData);
    res.status(200).send('Evento de notificación de prueba emitido. Revisa el dashboard.');
  } else {
    res.status(500).send('Socket.io no está inicializado en el servidor.');
  }
});

// =============================================
// --- CRUD SUPERVISORES Y ASIGNACIONES ---
// =============================================

// Listar supervisores (personal con rol supervisor_sereno)
app.get('/api/supervisores', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_personal, p.codigo_personal, p.nombres, p.apellidos,
        CONCAT(p.nombres, ' ', p.apellidos) as nombre_completo,
        COUNT(asig.id) as serenos_asignados
      FROM personal p
      INNER JOIN usuario u ON u.id_personal = p.id_personal
      INNER JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
      INNER JOIN rol r ON r.id_rol = ur.id_rol
      LEFT JOIN asignacion_supervisores asig ON asig.supervisor_id = p.id_personal AND asig.estado = 'ACTIVO'
      WHERE r.nombre = 'supervisor_sereno' AND p.estado = 1
      GROUP BY p.id_personal
      ORDER BY p.apellidos, p.nombres
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar serenos disponibles (no asignados a ningún supervisor activo)
app.get('/api/supervisores/serenos-disponibles', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_personal, p.codigo_personal, p.nombres, p.apellidos,
        CONCAT(p.nombres, ' ', p.apellidos) as nombre_completo
      FROM personal p
      INNER JOIN usuario u ON u.id_personal = p.id_personal
      INNER JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
      INNER JOIN rol r ON r.id_rol = ur.id_rol
      WHERE r.nombre = 'sereno' AND p.estado = 1
        AND p.id_personal NOT IN (
          SELECT sereno_id FROM asignacion_supervisores WHERE estado = 'ACTIVO'
        )
      GROUP BY p.id_personal
      ORDER BY p.apellidos, p.nombres
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Obtener serenos asignados a un supervisor
app.get('/api/supervisores/:id/serenos', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        asig.id as id_asignacion,
        asig.fecha_asignacion,
        asig.observaciones,
        p.id_personal, p.codigo_personal, p.nombres, p.apellidos,
        CONCAT(p.nombres, ' ', p.apellidos) as nombre_completo
      FROM asignacion_supervisores asig
      INNER JOIN personal p ON p.id_personal = asig.sereno_id
      WHERE asig.supervisor_id = ? AND asig.estado = 'ACTIVO'
      ORDER BY asig.fecha_asignacion DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Asignar sereno a supervisor
app.post('/api/supervisores/asignar', async (req, res) => {
  const { supervisor_id, sereno_id, observaciones } = req.body;
  if (!supervisor_id || !sereno_id) {
    return res.status(400).json({ error: 'supervisor_id y sereno_id son requeridos.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar que el sereno no esté ya asignado
    const [existing] = await connection.query(
      "SELECT id FROM asignacion_supervisores WHERE sereno_id = ? AND estado = 'ACTIVO'", [sereno_id]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'Este sereno ya está asignado a un supervisor.' });
    }

    // Crear asignación
    const [result] = await connection.query(
      "INSERT INTO asignacion_supervisores (supervisor_id, sereno_id, observaciones) VALUES (?, ?, ?)",
      [supervisor_id, sereno_id, observaciones || null]
    );

    // Registrar en historial
    const [[sup]] = await connection.query("SELECT CONCAT(nombres,' ',apellidos) as nombre FROM personal WHERE id_personal = ?", [supervisor_id]);
    const [[ser]] = await connection.query("SELECT CONCAT(nombres,' ',apellidos) as nombre FROM personal WHERE id_personal = ?", [sereno_id]);

    await connection.query(
      "INSERT INTO historial_supervisores (asignacion_id, supervisor_id, sereno_id, accion, detalle) VALUES (?, ?, ?, 'ASIGNADO', ?)",
      [result.insertId, supervisor_id, sereno_id, `Sereno '${ser.nombre}' asignado al supervisor '${sup.nombre}'.`]
    );

    await connection.commit();
    res.status(201).json({ message: 'Sereno asignado correctamente.', id: result.insertId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Desasignar sereno de supervisor
app.put('/api/supervisores/desasignar/:id_asignacion', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[asig]] = await connection.query("SELECT * FROM asignacion_supervisores WHERE id = ? AND estado = 'ACTIVO'", [req.params.id_asignacion]);
    if (!asig) {
      await connection.rollback();
      return res.status(404).json({ error: 'Asignación no encontrada o ya inactiva.' });
    }

    await connection.query(
      "UPDATE asignacion_supervisores SET estado = 'INACTIVO', fecha_desasignacion = NOW() WHERE id = ?",
      [req.params.id_asignacion]
    );

    const [[sup]] = await connection.query("SELECT CONCAT(nombres,' ',apellidos) as nombre FROM personal WHERE id_personal = ?", [asig.supervisor_id]);
    const [[ser]] = await connection.query("SELECT CONCAT(nombres,' ',apellidos) as nombre FROM personal WHERE id_personal = ?", [asig.sereno_id]);

    await connection.query(
      "INSERT INTO historial_supervisores (asignacion_id, supervisor_id, sereno_id, accion, detalle) VALUES (?, ?, ?, 'DESASIGNADO', ?)",
      [asig.id, asig.supervisor_id, asig.sereno_id, `Sereno '${ser.nombre}' desasignado del supervisor '${sup.nombre}'.`]
    );

    await connection.commit();
    res.json({ message: 'Sereno desasignado correctamente.' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Historial de asignaciones de supervisores
app.get('/api/supervisores/historial', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        h.*,
        CONCAT(sup.nombres, ' ', sup.apellidos) as nombre_supervisor,
        CONCAT(ser.nombres, ' ', ser.apellidos) as nombre_sereno
      FROM historial_supervisores h
      JOIN personal sup ON h.supervisor_id = sup.id_personal
      JOIN personal ser ON h.sereno_id = ser.id_personal
      ORDER BY h.fecha DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

httpServer.listen(port, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${port}`);
});
