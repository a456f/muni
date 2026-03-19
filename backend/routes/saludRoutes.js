// c:\Users\ANTHONY\sistema-denuncias\backend\routes\saludRoutes.js
import express from 'express';
import { db } from '../server.js';

const router = express.Router();

// --- 1. GESTIÓN DE PACIENTES ---

// Buscar paciente por DNI
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

// --- 2. GESTIÓN DE PERSONAL DE SALUD ---

router.get('/personal', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM personal ORDER BY nombre");
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

// --- 3. GESTIÓN DE ATENCIONES (TRANSACCIÓN COMPLETA) ---

router.get('/atenciones', async (req, res) => {
    try {
        // Obtenemos un resumen de las atenciones
        const [rows] = await db.query(`
            SELECT 
                a.id, a.numero, a.fecha, a.hora_inicio, 
                p.dni, p.nombres, p.apellido_paterno, p.apellido_materno,
                c.tipo as clasificacion
            FROM atencion a
            JOIN paciente p ON a.paciente_id = p.id
            LEFT JOIN clasificacion c ON c.atencion_id = a.id
            ORDER BY a.fecha DESC, a.hora_inicio DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener detalle completo de una atención
router.get('/atenciones/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Datos principales
        const [mainRows] = await db.query(`
            SELECT 
                a.*,
                p.dni, p.nombres, p.apellido_paterno, p.apellido_materno, p.edad, p.sexo,
                o.direccion, o.telefono, o.operador, o.hora_llamada, o.hora_ingreso,
                e.motivo, e.enfermedad_actual, e.examen_fisico,
                c.tipo as clasificacion
            FROM atencion a
            JOIN paciente p ON a.paciente_id = p.id
            LEFT JOIN ocurrencia o ON o.atencion_id = a.id
            LEFT JOIN evaluacion_medica e ON e.atencion_id = a.id
            LEFT JOIN clasificacion c ON c.atencion_id = a.id
            WHERE a.id = ?
        `, [id]);

        if (mainRows.length === 0) {
            return res.status(404).json({ message: "Atención no encontrada" });
        }

        const atencion = mainRows[0];

        // 2. Diagnósticos
        const [diagnosticos] = await db.query("SELECT descripcion FROM diagnostico WHERE atencion_id = ?", [id]);

        // 3. Tratamientos
        const [tratamientos] = await db.query("SELECT descripcion FROM tratamiento WHERE atencion_id = ?", [id]);

        // 4. Personal
        const [personal] = await db.query(`
            SELECT p.nombre, p.rol 
            FROM atencion_personal ap
            JOIN personal p ON ap.personal_id = p.id
            WHERE ap.atencion_id = ?
        `, [id]);

        res.json({ ...atencion, diagnosticos, tratamientos, personal });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REGISTRAR NUEVA ATENCIÓN
// Este endpoint maneja la creación de registros en múltiples tablas usando una transacción
router.post('/atenciones', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            paciente,       // Objeto con datos del paciente
            atencion,       // Objeto con datos de la atención (fecha, horas)
            ocurrencia,     // Objeto con detalles de ocurrencia
            evaluacion,     // Objeto con evaluación médica
            diagnosticos,   // Array de strings o objetos
            tratamiento,    // Objeto o string
            clasificacion,  // Objeto con tipo
            personal_ids    // Array de IDs de personal
        } = req.body;

        // 1. Gestionar Paciente (Crear si no existe ID, o Actualizar si se desea)
        let pacienteId = paciente.id;
        
        // Si no viene ID, verificar si existe por DNI para evitar duplicados
        if (!pacienteId) {
            const [existing] = await connection.query("SELECT id FROM paciente WHERE dni = ?", [paciente.dni]);
            if (existing.length > 0) {
                pacienteId = existing[0].id;
                // Opcional: Actualizar datos del paciente si cambiaron
            } else {
                const [pResult] = await connection.query(
                    "INSERT INTO paciente (dni, nombres, apellido_paterno, apellido_materno, edad, sexo) VALUES (?, ?, ?, ?, ?, ?)",
                    [paciente.dni, paciente.nombres, paciente.apellido_paterno, paciente.apellido_materno, paciente.edad, paciente.sexo]
                );
                pacienteId = pResult.insertId;
            }
        }

        // 2. Crear Atención
        // Generar número de atención si no viene (usamos timestamp como ejemplo simple)
        const numeroAtencion = atencion.numero || `AT-${Date.now()}`;
        const [aResult] = await connection.query(
            "INSERT INTO atencion (numero, fecha, hora_inicio, hora_fin, paciente_id) VALUES (?, ?, ?, ?, ?)",
            [numeroAtencion, atencion.fecha, atencion.hora_inicio, atencion.hora_fin, pacienteId]
        );
        const atencionId = aResult.insertId;

        // 3. Registrar Ocurrencia
        if (ocurrencia) {
            await connection.query(
                "INSERT INTO ocurrencia (atencion_id, direccion, telefono, operador, hora_llamada, hora_ingreso) VALUES (?, ?, ?, ?, ?, ?)",
                [atencionId, ocurrencia.direccion, ocurrencia.telefono, ocurrencia.operador, ocurrencia.hora_llamada, ocurrencia.hora_ingreso]
            );
        }

        // 4. Registrar Evaluación Médica
        if (evaluacion) {
            await connection.query(
                "INSERT INTO evaluacion_medica (atencion_id, motivo, enfermedad_actual, examen_fisico) VALUES (?, ?, ?, ?)",
                [atencionId, evaluacion.motivo, evaluacion.enfermedad_actual, evaluacion.examen_fisico]
            );
        }

        // 5. Registrar Diagnósticos (Puede ser uno o varios)
        if (diagnosticos && Array.isArray(diagnosticos)) {
            for (const diag of diagnosticos) {
                if(diag.descripcion) {
                    await connection.query("INSERT INTO diagnostico (atencion_id, descripcion) VALUES (?, ?)", [atencionId, diag.descripcion]);
                }
            }
        }

        // 6. Registrar Tratamiento
        if (tratamiento && tratamiento.descripcion) {
             await connection.query("INSERT INTO tratamiento (atencion_id, descripcion) VALUES (?, ?)", [atencionId, tratamiento.descripcion]);
        }

        // 7. Registrar Clasificación
        if (clasificacion && clasificacion.tipo) {
            await connection.query("INSERT INTO clasificacion (atencion_id, tipo) VALUES (?, ?)", [atencionId, clasificacion.tipo]);
        }

        // 8. Asignar Personal (Relación Muchos a Muchos)
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

export default router;
