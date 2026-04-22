import express from 'express';
import { db } from '../server.js';

const router = express.Router();

// Listar todas las cámaras instaladas (para el mapa)
router.get('/', async (req, res) => {
    const { estado } = req.query;
    let where = '';
    const params = [];
    if (estado) {
        where = 'WHERE c.estado = ?';
        params.push(estado);
    }
    try {
        const [rows] = await db.query(`
            SELECT
                c.id, c.equipo_id, c.latitud, c.longitud, c.direccion, c.referencia,
                c.estado, c.fecha_instalacion, c.fecha_actualizacion, c.observacion,
                e.descripcion, e.marca, e.modelo, e.numero_serie, e.identificador, e.sbn,
                te.nombre as tipo_equipo
            FROM camaras_instaladas c
            JOIN equipos e ON c.equipo_id = e.id
            JOIN tipos_equipo te ON e.tipo_id = te.id
            ${where}
            ORDER BY c.fecha_instalacion DESC
        `, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar cámaras disponibles en el almacén (no instaladas aún)
router.get('/disponibles', async (req, res) => {
    const { q = '' } = req.query;
    try {
        let whereClause = `WHERE te.nombre LIKE '%CAMARA%' OR te.nombre LIKE '%BODYCAM%'`;
        const params = [];

        if (q.trim()) {
            const search = `%${q.trim()}%`;
            whereClause += ` AND (e.descripcion LIKE ? OR e.numero_serie LIKE ? OR e.identificador LIKE ? OR e.sbn LIKE ? OR e.marca LIKE ?)`;
            params.push(search, search, search, search, search);
        }

        // Excluir las ya instaladas
        whereClause += ` AND e.id NOT IN (SELECT equipo_id FROM camaras_instaladas)`;

        const [rows] = await db.query(`
            SELECT
                e.id, e.descripcion, e.marca, e.modelo, e.numero_serie,
                e.identificador, e.sbn, e.estado as estado_equipo,
                te.nombre as tipo_equipo
            FROM equipos e
            JOIN tipos_equipo te ON e.tipo_id = te.id
            ${whereClause}
            ORDER BY e.descripcion
            LIMIT 50
        `, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Instalar cámara en una ubicación
router.post('/', async (req, res) => {
    const { equipo_id, latitud, longitud, direccion, referencia, estado } = req.body;

    if (!equipo_id || !latitud || !longitud) {
        return res.status(400).json({ message: 'equipo_id, latitud y longitud son requeridos.' });
    }

    try {
        // Verificar que el equipo exista
        const [[equipo]] = await db.query("SELECT id, descripcion FROM equipos WHERE id = ?", [equipo_id]);
        if (!equipo) return res.status(404).json({ message: 'Equipo no encontrado.' });

        // Verificar que no esté instalada ya
        const [[existe]] = await db.query("SELECT id FROM camaras_instaladas WHERE equipo_id = ?", [equipo_id]);
        if (existe) return res.status(409).json({ message: 'Esta cámara ya está instalada en el mapa.' });

        const [result] = await db.query(
            `INSERT INTO camaras_instaladas (equipo_id, latitud, longitud, direccion, referencia, estado)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [equipo_id, latitud, longitud, direccion || null, referencia || null, estado || 'ACTIVA']
        );

        res.status(201).json({
            message: `Cámara "${equipo.descripcion}" instalada correctamente.`,
            id: result.insertId
        });
    } catch (err) {
        console.error("Error al instalar cámara:", err);
        res.status(500).json({ error: err.message });
    }
});

// Actualizar estado, ubicación o datos de una cámara
router.put('/:id', async (req, res) => {
    const { latitud, longitud, direccion, referencia, estado, observacion } = req.body;
    try {
        const fields = [];
        const values = [];
        if (latitud !== undefined) { fields.push('latitud = ?'); values.push(latitud); }
        if (longitud !== undefined) { fields.push('longitud = ?'); values.push(longitud); }
        if (direccion !== undefined) { fields.push('direccion = ?'); values.push(direccion); }
        if (referencia !== undefined) { fields.push('referencia = ?'); values.push(referencia); }
        if (estado !== undefined) { fields.push('estado = ?'); values.push(estado); }
        if (observacion !== undefined) { fields.push('observacion = ?'); values.push(observacion); }

        if (fields.length === 0) return res.status(400).json({ message: 'No hay campos a actualizar.' });

        fields.push('fecha_actualizacion = NOW()');
        values.push(req.params.id);

        await db.query(`UPDATE camaras_instaladas SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Cámara actualizada.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar cámara del mapa (vuelve a estar disponible)
router.delete('/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM camaras_instaladas WHERE id = ?", [req.params.id]);
        res.json({ message: 'Cámara removida del mapa.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
