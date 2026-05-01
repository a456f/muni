import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../server.js';

const router = express.Router();
const saltRounds = 10;

const normalizeRoleIds = (roleIds = []) =>
  [...new Set((Array.isArray(roleIds) ? roleIds : []).map(Number).filter(Boolean))];

const assignRoles = async (connection, idUsuario, roleIds) => {
  await connection.query('DELETE FROM usuario_rol WHERE id_usuario = ?', [idUsuario]);

  const normalized = normalizeRoleIds(roleIds);
  if (normalized.length === 0) {
    return;
  }

  const values = normalized.map((idRol) => [idUsuario, idRol]);
  await connection.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ?', [values]);
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contrasena son obligatorios.' });
  }

  try {
    const [rows] = await db.query(
      `
        SELECT 
          u.id_usuario,
          u.username,
          u.password_hash,
          p.id_personal,
          p.nombres,
          p.apellidos,
          p.correo,
          GROUP_CONCAT(DISTINCT CASE WHEN r.sistema = 'WEB' THEN r.nombre END ORDER BY r.nombre SEPARATOR ',') AS web_roles
        FROM usuario u
        INNER JOIN personal p ON p.id_personal = u.id_personal
        LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        LEFT JOIN rol r ON r.id_rol = ur.id_rol
        WHERE u.username = ?
          AND u.estado = 1
          AND p.estado = 1
        GROUP BY u.id_usuario, p.id_personal
      `,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contrasena incorrectos.' });
    }

    const user = rows[0];
    if (!user.web_roles) {
      return res.status(403).json({ message: 'La cuenta no tiene acceso al sistema web.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Usuario o contrasena incorrectos.' });
    }

    await db.query('UPDATE usuario SET ultimo_login = NOW() WHERE id_usuario = ?', [user.id_usuario]);

    const roles = user.web_roles.split(',');
    res.status(200).json({
      message: 'Login exitoso',
      token: `token_web_${user.id_usuario}`,
      user: {
        id: user.id_usuario,
        id_personal: user.id_personal,
        username: user.username,
        email: user.correo,
        role: roles[0],
        roles,
        nombre: `${user.nombres} ${user.apellidos}`.trim()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor: ' + err.message });
  }
});

router.get('/roles', async (req, res) => {
  const { sistema } = req.query;

  try {
    const params = [];
    let sql = 'SELECT id_rol, nombre, sistema FROM rol';

    if (sistema) {
      sql += ' WHERE sistema = ?';
      params.push(sistema);
    }

    sql += ' ORDER BY sistema, nombre';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personal', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT
          p.id_personal,
          p.codigo_personal,
          p.nombres,
          p.apellidos,
          p.dni,
          p.correo,
          p.telefono,
          p.direccion,
          p.estado AS estado_personal,
          p.fecha_creacion,
          u.id_usuario,
          u.username,
          u.estado AS estado_usuario,
          GROUP_CONCAT(DISTINCT r.id_rol ORDER BY r.sistema, r.nombre SEPARATOR ',') AS role_ids,
          GROUP_CONCAT(DISTINCT r.nombre ORDER BY r.sistema, r.nombre SEPARATOR ',') AS roles,
          GROUP_CONCAT(DISTINCT r.sistema ORDER BY r.sistema SEPARATOR ',') AS sistemas
        FROM personal p
        LEFT JOIN usuario u ON u.id_personal = p.id_personal
        LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        LEFT JOIN rol r ON r.id_rol = ur.id_rol
        GROUP BY
          p.id_personal, p.codigo_personal, p.nombres, p.apellidos, p.dni, p.correo,
          p.telefono, p.direccion, p.estado, p.fecha_creacion, u.id_usuario, u.username, u.estado
        ORDER BY p.apellidos, p.nombres
      `
    );

    res.json(
      rows.map((row) => ({
        ...row,
        roleIds: row.role_ids ? row.role_ids.split(',').map(Number) : [],
        roles: row.roles ? row.roles.split(',') : [],
        sistemas: row.sistemas ? row.sistemas.split(',') : []
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/personal', async (req, res) => {
  const {
    codigo_personal,
    nombres,
    apellidos,
    dni,
    correo,
    telefono,
    direccion,
    username,
    password,
    roleIds = []
  } = req.body;

  if (!codigo_personal || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Codigo de personal, nombres y apellidos son obligatorios.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [personalResult] = await connection.query(
      `
        INSERT INTO personal (
          codigo_personal, nombres, apellidos, dni, correo, telefono, direccion, estado, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
      `,
      [codigo_personal, nombres, apellidos, dni || null, correo || null, telefono || null, direccion || null]
    );

    if (username || password || normalizeRoleIds(roleIds).length > 0) {
      if (!username || !password) {
        throw new Error('Si va a crear acceso al sistema, usuario y contrasena son obligatorios.');
      }

      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const [userResult] = await connection.query(
        `
          INSERT INTO usuario (
            id_personal, username, password_hash, estado, fecha_creacion
          ) VALUES (?, ?, ?, 1, NOW())
        `,
        [personalResult.insertId, username, hashedPassword]
      );

      await assignRoles(connection, userResult.insertId, roleIds);
    }

    await connection.commit();
    res.status(201).json({ message: 'Personal creado correctamente.' });
  } catch (err) {
    await connection.rollback();
    res.status(getErrorStatus(err)).json({ error: traducirError(err) });
  } finally {
    connection.release();
  }
});

// Helper para traducir errores técnicos a mensajes amigables
function traducirError(err) {
  const msg = err.message || '';
  if (err.code === 'ER_DUP_ENTRY') {
    if (msg.includes('codigo_personal')) return 'El código de personal ya existe. Use uno diferente.';
    if (msg.includes('username')) return 'El nombre de usuario ya está registrado.';
    if (msg.includes('dni')) return 'El DNI ya está registrado en el sistema.';
    if (msg.includes('numero_serie')) return 'El número de serie ya existe.';
    if (msg.includes('correo')) return 'El correo electrónico ya está registrado.';
    return 'Ya existe un registro con esos datos.';
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return 'Hay datos relacionados que no existen. Verifique los registros vinculados.';
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return 'No se puede eliminar: existen registros relacionados.';
  }
  if (err.code === 'ER_DATA_TOO_LONG') {
    return 'Uno de los campos excede el largo permitido.';
  }
  if (err.code === 'ER_BAD_NULL_ERROR') {
    return 'Falta un campo obligatorio.';
  }
  // Si es un Error custom (lanzado con throw new Error), usar su mensaje
  if (err.message && !err.code) return err.message;
  return 'Error en el servidor. Intenta de nuevo más tarde.';
}

function getErrorStatus(err) {
  if (err.code === 'ER_DUP_ENTRY') return 409;
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') return 400;
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') return 409;
  if (err.code === 'ER_DATA_TOO_LONG' || err.code === 'ER_BAD_NULL_ERROR') return 400;
  return 500;
}

router.put('/personal/:id', async (req, res) => {
  const {
    codigo_personal,
    nombres,
    apellidos,
    dni,
    correo,
    telefono,
    direccion,
    username,
    password,
    roleIds = []
  } = req.body;

  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE personal
        SET codigo_personal = ?, nombres = ?, apellidos = ?, dni = ?, correo = ?, telefono = ?, direccion = ?
        WHERE id_personal = ?
      `,
      [codigo_personal, nombres, apellidos, dni || null, correo || null, telefono || null, direccion || null, id]
    );

    const [[existingUser]] = await connection.query('SELECT id_usuario FROM usuario WHERE id_personal = ?', [id]);
    const normalizedRoleIds = normalizeRoleIds(roleIds);
    const shouldHaveUser = Boolean(username) || Boolean(password) || normalizedRoleIds.length > 0 || existingUser;

    if (shouldHaveUser) {
      if (!username) {
        throw new Error('El usuario es obligatorio cuando existe acceso al sistema.');
      }

      if (existingUser) {
        if (password) {
          const hashedPassword = await bcrypt.hash(password, saltRounds);
          await connection.query(
            'UPDATE usuario SET username = ?, password_hash = ? WHERE id_usuario = ?',
            [username, hashedPassword, existingUser.id_usuario]
          );
        } else {
          await connection.query(
            'UPDATE usuario SET username = ? WHERE id_usuario = ?',
            [username, existingUser.id_usuario]
          );
        }

        await assignRoles(connection, existingUser.id_usuario, normalizedRoleIds);
      } else {
        if (!password) {
          throw new Error('La contrasena es obligatoria para crear la cuenta.');
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [userResult] = await connection.query(
          `
            INSERT INTO usuario (
              id_personal, username, password_hash, estado, fecha_creacion
            ) VALUES (?, ?, ?, 1, NOW())
          `,
          [id, username, hashedPassword]
        );
        await assignRoles(connection, userResult.insertId, normalizedRoleIds);
      }
    }

    await connection.commit();
    res.json({ message: 'Personal actualizado correctamente.' });
  } catch (err) {
    await connection.rollback();
    res.status(getErrorStatus(err)).json({ error: traducirError(err) });
  } finally {
    connection.release();
  }
});

router.delete('/personal/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[existingUser]] = await connection.query('SELECT id_usuario FROM usuario WHERE id_personal = ?', [id]);
    if (existingUser) {
      await connection.query('DELETE FROM usuario_rol WHERE id_usuario = ?', [existingUser.id_usuario]);
      await connection.query('DELETE FROM usuario WHERE id_usuario = ?', [existingUser.id_usuario]);
    }

    await connection.query('DELETE FROM personal WHERE id_personal = ?', [id]);
    await connection.commit();
    res.json({ message: 'Personal eliminado correctamente.' });
  } catch (err) {
    await connection.rollback();
    res.status(getErrorStatus(err)).json({ error: traducirError(err) });
  } finally {
    connection.release();
  }
});

router.put('/personal/:id/toggle-status', async (req, res) => {
  const { id } = req.params;

  try {
    const [[existingUser]] = await db.query(
      `
        SELECT u.id_usuario, u.estado
        FROM usuario u
        WHERE u.id_personal = ?
      `,
      [id]
    );

    if (!existingUser) {
      return res.status(404).json({ error: 'La persona no tiene una cuenta creada.' });
    }

    const newStatus = existingUser.estado === 1 ? 0 : 1;
    await db.query('UPDATE usuario SET estado = ? WHERE id_usuario = ?', [newStatus, existingUser.id_usuario]);
    res.json({ message: 'Estado de la cuenta actualizado.', newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/personal/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'La nueva contrasena es obligatoria.' });
  }

  try {
    const [[existingUser]] = await db.query('SELECT id_usuario FROM usuario WHERE id_personal = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'La persona no tiene una cuenta creada.' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [hashedPassword, existingUser.id_usuario]);
    res.json({ message: 'Contrasena actualizada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
