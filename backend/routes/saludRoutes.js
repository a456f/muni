// c:\Users\ANTHONY\sistema-denuncias\backend\routes\saludRoutes.js
import express from 'express';
import { db } from '../server.js';

const router = express.Router();

// =============================================
// 1. GESTIÓN DE PACIENTES
// =============================================

router.get('/pacientes/buscar/:dni', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM paciente WHERE dni = ?", [req.params.dni]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: "Paciente no encontrado" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 2. GESTIÓN DE PERSONAL DE SALUD
// =============================================

router.get('/personal', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.id_personal AS id,
                p.id_personal,
                CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
                COALESCE(a.nombre, 'Sin area') AS area,
                'Personal de Salud' AS rol
            FROM personal p
            LEFT JOIN areas a ON a.id = p.id_area
            WHERE p.estado = 1
              AND a.nombre IS NOT NULL
              AND LOWER(a.nombre) LIKE '%salud%'
            ORDER BY p.nombres, p.apellidos
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/personal', async (req, res) => {
    const { nombre, dni, rol } = req.body;
    try {
        await db.query("INSERT INTO personal (nombre, dni, rol) VALUES (?, ?, ?)", [nombre, dni, rol]);
        res.status(201).json({ message: "Personal registrado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 3. TIPOS DE ATENCIÓN DE SALUD (CRUD)
// =============================================

router.get('/tipos-atencion', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM tipo_atencion_salud ORDER BY nombre");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/tipos-atencion/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM tipo_atencion_salud WHERE id = ?", [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Tipo de atención no encontrado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tipos-atencion', async (req, res) => {
    const { nombre, descripcion } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO tipo_atencion_salud (nombre, descripcion) VALUES (?, ?)",
            [nombre, descripcion || null]
        );
        res.status(201).json({ message: "Tipo de atención creado", id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/tipos-atencion/:id', async (req, res) => {
    const { nombre, descripcion, estado } = req.body;
    try {
        await db.query(
            "UPDATE tipo_atencion_salud SET nombre = ?, descripcion = ?, estado = ? WHERE id = ?",
            [nombre, descripcion || null, estado ?? 1, req.params.id]
        );
        res.json({ message: "Tipo de atención actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/tipos-atencion/:id', async (req, res) => {
    try {
        await db.query("UPDATE tipo_atencion_salud SET estado = 0 WHERE id = ?", [req.params.id]);
        res.json({ message: "Tipo de atención desactivado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 4. ESTABLECIMIENTOS DE SALUD (CRUD)
// =============================================

router.get('/establecimientos', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM establecimiento_salud ORDER BY nombre");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/establecimientos/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM establecimiento_salud WHERE id = ?", [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Establecimiento no encontrado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/establecimientos', async (req, res) => {
    const { nombre, tipo, direccion, telefono, distrito } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO establecimiento_salud (nombre, tipo, direccion, telefono, distrito) VALUES (?, ?, ?, ?, ?)",
            [nombre, tipo || 'HOSPITAL', direccion || null, telefono || null, distrito || null]
        );
        res.status(201).json({ message: "Establecimiento creado", id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/establecimientos/:id', async (req, res) => {
    const { nombre, tipo, direccion, telefono, distrito, estado } = req.body;
    try {
        await db.query(
            "UPDATE establecimiento_salud SET nombre = ?, tipo = ?, direccion = ?, telefono = ?, distrito = ?, estado = ? WHERE id = ?",
            [nombre, tipo, direccion || null, telefono || null, distrito || null, estado ?? 1, req.params.id]
        );
        res.json({ message: "Establecimiento actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/establecimientos/:id', async (req, res) => {
    try {
        await db.query("UPDATE establecimiento_salud SET estado = 0 WHERE id = ?", [req.params.id]);
        res.json({ message: "Establecimiento desactivado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 5. GESTIÓN DE ATENCIONES (TRANSACCIÓN COMPLETA)
// =============================================

router.get('/atenciones', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM atencion");

        const [rows] = await db.query(`
            SELECT
                a.id, a.numero, a.fecha, a.hora_inicio,
                p.dni, p.nombres, p.apellido_paterno, p.apellido_materno, p.sexo,
                c.tipo as clasificacion,
                ta.nombre as tipo_atencion,
                es.nombre as establecimiento_traslado
            FROM atencion a
            JOIN paciente p ON a.paciente_id = p.id
            LEFT JOIN clasificacion c ON c.atencion_id = a.id
            LEFT JOIN tipo_atencion_salud ta ON ta.id = a.tipo_atencion_id
            LEFT JOIN traslado_salud ts ON ts.atencion_id = a.id
            LEFT JOIN establecimiento_salud es ON es.id = ts.establecimiento_id
            ORDER BY a.fecha DESC, a.hora_inicio DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        res.json({ data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/atenciones/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [mainRows] = await db.query(`
            SELECT
                a.*,
                p.dni, p.nombres, p.apellido_paterno, p.apellido_materno, p.edad, p.sexo,
                o.direccion, o.telefono, o.operador, o.hora_llamada, o.hora_ingreso,
                e.motivo, e.enfermedad_actual, e.examen_fisico,
                c.tipo as clasificacion,
                ta.nombre as tipo_atencion
            FROM atencion a
            JOIN paciente p ON a.paciente_id = p.id
            LEFT JOIN ocurrencia o ON o.atencion_id = a.id
            LEFT JOIN evaluacion_medica e ON e.atencion_id = a.id
            LEFT JOIN clasificacion c ON c.atencion_id = a.id
            LEFT JOIN tipo_atencion_salud ta ON ta.id = a.tipo_atencion_id
            WHERE a.id = ?
        `, [id]);

        if (mainRows.length === 0) {
            return res.status(404).json({ message: "Atención no encontrada" });
        }

        const atencion = mainRows[0];

        const [diagnosticos] = await db.query("SELECT descripcion FROM diagnostico WHERE atencion_id = ?", [id]);
        const [tratamientos] = await db.query("SELECT descripcion FROM tratamiento WHERE atencion_id = ?", [id]);
        const [personal] = await db.query(`
            SELECT
                CONCAT(p.nombres, ' ', p.apellidos) AS nombre,
                COALESCE(a.nombre, 'Salud') AS rol
            FROM atencion_personal ap
            JOIN personal p ON ap.personal_id = p.id_personal
            LEFT JOIN areas a ON a.id = p.id_area
            WHERE ap.atencion_id = ?
        `, [id]);

        // Traslados
        const [traslados] = await db.query(`
            SELECT ts.*, es.nombre as establecimiento_nombre, es.tipo as establecimiento_tipo, es.direccion as establecimiento_direccion
            FROM traslado_salud ts
            JOIN establecimiento_salud es ON es.id = ts.establecimiento_id
            WHERE ts.atencion_id = ?
            ORDER BY ts.fecha_traslado DESC
        `, [id]);

        res.json({ ...atencion, diagnosticos, tratamientos, personal, traslados });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/atenciones', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            paciente,
            atencion,
            ocurrencia,
            evaluacion,
            diagnosticos,
            tratamiento,
            clasificacion,
            personal_ids,
            tipo_atencion_id
        } = req.body;

        let pacienteId = paciente.id;

        if (!pacienteId) {
            const [existing] = await connection.query("SELECT id FROM paciente WHERE dni = ?", [paciente.dni]);
            if (existing.length > 0) {
                pacienteId = existing[0].id;
            } else {
                const [pResult] = await connection.query(
                    "INSERT INTO paciente (dni, nombres, apellido_paterno, apellido_materno, edad, sexo) VALUES (?, ?, ?, ?, ?, ?)",
                    [paciente.dni, paciente.nombres, paciente.apellido_paterno, paciente.apellido_materno, paciente.edad, paciente.sexo]
                );
                pacienteId = pResult.insertId;
            }
        }

        const numeroAtencion = atencion.numero || `AT-${Date.now()}`;
        const [aResult] = await connection.query(
            "INSERT INTO atencion (numero, fecha, hora_inicio, hora_fin, paciente_id, tipo_atencion_id) VALUES (?, ?, ?, ?, ?, ?)",
            [numeroAtencion, atencion.fecha, atencion.hora_inicio, atencion.hora_fin, pacienteId, tipo_atencion_id || null]
        );
        const atencionId = aResult.insertId;

        if (ocurrencia) {
            await connection.query(
                "INSERT INTO ocurrencia (atencion_id, direccion, telefono, operador, hora_llamada, hora_ingreso) VALUES (?, ?, ?, ?, ?, ?)",
                [atencionId, ocurrencia.direccion, ocurrencia.telefono, ocurrencia.operador, ocurrencia.hora_llamada, ocurrencia.hora_ingreso]
            );
        }

        if (evaluacion) {
            await connection.query(
                "INSERT INTO evaluacion_medica (atencion_id, motivo, enfermedad_actual, examen_fisico) VALUES (?, ?, ?, ?)",
                [atencionId, evaluacion.motivo, evaluacion.enfermedad_actual, evaluacion.examen_fisico]
            );
        }

        if (diagnosticos && Array.isArray(diagnosticos)) {
            for (const diag of diagnosticos) {
                if(diag.descripcion) {
                    await connection.query("INSERT INTO diagnostico (atencion_id, descripcion) VALUES (?, ?)", [atencionId, diag.descripcion]);
                }
            }
        }

        if (tratamiento && tratamiento.descripcion) {
             await connection.query("INSERT INTO tratamiento (atencion_id, descripcion) VALUES (?, ?)", [atencionId, tratamiento.descripcion]);
        }

        if (clasificacion && clasificacion.tipo) {
            await connection.query("INSERT INTO clasificacion (atencion_id, tipo) VALUES (?, ?)", [atencionId, clasificacion.tipo]);
        }

        if (personal_ids && Array.isArray(personal_ids)) {
            for (const pid of personal_ids) {
                await connection.query("INSERT INTO atencion_personal (atencion_id, personal_id) VALUES (?, ?)", [atencionId, pid]);
            }
        }

        await connection.commit();
        res.status(201).json({ message: "Atención registrada con éxito", id_atencion: atencionId, numero: numeroAtencion });

    } catch (err) {
        await connection.rollback();
        console.error("Error en transacción de salud:", err);
        res.status(500).json({ error: "Error al registrar la atención: " + err.message });
    } finally {
        connection.release();
    }
});

// =============================================
// 6. TRASLADOS A ESTABLECIMIENTOS (ASIGNACIÓN + HISTORIAL)
// =============================================

router.get('/traslados', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ts.*,
                   es.nombre as establecimiento_nombre, es.tipo as establecimiento_tipo,
                   a.numero as atencion_numero, a.fecha as atencion_fecha,
                   p.nombres as paciente_nombres, p.apellido_paterno, p.dni as paciente_dni
            FROM traslado_salud ts
            JOIN establecimiento_salud es ON es.id = ts.establecimiento_id
            JOIN atencion a ON a.id = ts.atencion_id
            JOIN paciente p ON p.id = a.paciente_id
            ORDER BY ts.fecha_traslado DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/traslados/atencion/:atencionId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ts.*, es.nombre as establecimiento_nombre, es.tipo as establecimiento_tipo, es.direccion as establecimiento_direccion
            FROM traslado_salud ts
            JOIN establecimiento_salud es ON es.id = ts.establecimiento_id
            WHERE ts.atencion_id = ?
            ORDER BY ts.fecha_traslado DESC
        `, [req.params.atencionId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/traslados', async (req, res) => {
    const { atencion_id, establecimiento_id, hora_traslado, observaciones } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO traslado_salud (atencion_id, establecimiento_id, hora_traslado, observaciones) VALUES (?, ?, ?, ?)",
            [atencion_id, establecimiento_id, hora_traslado || null, observaciones || null]
        );
        res.status(201).json({ message: "Traslado registrado", id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/traslados/:id', async (req, res) => {
    const { establecimiento_id, hora_traslado, observaciones, estado } = req.body;
    try {
        await db.query(
            "UPDATE traslado_salud SET establecimiento_id = ?, hora_traslado = ?, observaciones = ?, estado = ? WHERE id = ?",
            [establecimiento_id, hora_traslado, observaciones, estado, req.params.id]
        );
        res.json({ message: "Traslado actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// 7. ESTADÍSTICAS / DASHBOARD DE SALUD
// =============================================

router.get('/estadisticas', async (req, res) => {
    try {
        const mesParam = req.query.mes; // formato: YYYY-MM
        let whereDate = '';
        let params = [];

        if (mesParam) {
            whereDate = 'WHERE DATE_FORMAT(a.fecha, "%Y-%m") = ?';
            params = [mesParam];
        }

        // Total de atenciones
        const [[{ total_atenciones }]] = await db.query(
            `SELECT COUNT(*) as total_atenciones FROM atencion a ${whereDate}`, params
        );

        // Por tipo de atención
        const [porTipoAtencion] = await db.query(`
            SELECT COALESCE(ta.nombre, 'SIN TIPO') as nombre, COUNT(*) as cantidad
            FROM atencion a
            LEFT JOIN tipo_atencion_salud ta ON ta.id = a.tipo_atencion_id
            ${whereDate}
            GROUP BY ta.nombre
            ORDER BY cantidad DESC
        `, params);

        // Por establecimiento de traslado
        const [porEstablecimiento] = await db.query(`
            SELECT es.nombre, COUNT(*) as cantidad
            FROM traslado_salud ts
            JOIN establecimiento_salud es ON es.id = ts.establecimiento_id
            JOIN atencion a ON a.id = ts.atencion_id
            ${whereDate}
            GROUP BY es.nombre
            ORDER BY cantidad DESC
        `, params);

        // Por fecha (últimos 30 días o mes seleccionado)
        const [porFecha] = await db.query(`
            SELECT DATE_FORMAT(a.fecha, '%d %b') as fecha_label, a.fecha, COUNT(*) as cantidad
            FROM atencion a
            ${whereDate || 'WHERE a.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'}
            GROUP BY a.fecha
            ORDER BY a.fecha ASC
        `, params);

        // Por sexo
        const [porSexo] = await db.query(`
            SELECT CASE p.sexo WHEN 'M' THEN 'Masculino' WHEN 'F' THEN 'Femenino' ELSE 'No especificado' END as nombre,
                   COUNT(*) as cantidad
            FROM atencion a
            JOIN paciente p ON p.id = a.paciente_id
            ${whereDate}
            GROUP BY p.sexo
        `, params);

        // Por clasificación
        const [porClasificacion] = await db.query(`
            SELECT COALESCE(c.tipo, 'Sin clasificación') as nombre, COUNT(*) as cantidad
            FROM atencion a
            LEFT JOIN clasificacion c ON c.atencion_id = a.id
            ${whereDate}
            GROUP BY c.tipo
            ORDER BY cantidad DESC
        `, params);

        // Atenciones del mes actual vs anterior
        const [[{ mes_actual }]] = await db.query(`
            SELECT COUNT(*) as mes_actual FROM atencion
            WHERE DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
        `);
        const [[{ mes_anterior }]] = await db.query(`
            SELECT COUNT(*) as mes_anterior FROM atencion
            WHERE DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
        `);

        res.json({
            total_atenciones,
            porTipoAtencion,
            porEstablecimiento,
            porFecha,
            porSexo,
            porClasificacion,
            mes_actual,
            mes_anterior
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
