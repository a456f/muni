// c:\Users\ANTHONY\sistema-denuncias\src\components\SaludModule.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';
import './SaludModule.css'; // Importar los estilos

// Interfaces para el tipado de datos
interface Paciente {
  id?: number;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  edad: number | '';
  sexo: string;
}

interface Personal {
  id: number;
  id_personal?: number; // Añadimos esto por si la BD usa este nombre
  nombre: string;
  rol: string;
}

interface AtencionResumen {
  id: number;
  numero: string;
  fecha: string;
  hora_inicio: string;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  clasificacion: string;
}

// Interfaz para el detalle completo
interface AtencionDetalle extends AtencionResumen {
  hora_fin: string;
  apellido_materno: string;
  edad: number;
  sexo: string;
  direccion: string;
  telefono: string;
  operador: string;
  hora_llamada: string;
  hora_ingreso: string;
  motivo: string;
  enfermedad_actual: string;
  examen_fisico: string;
  diagnosticos: { descripcion: string }[];
  tratamientos: { descripcion: string }[];
  personal: { nombre: string; rol: string }[];
}

const SaludModule = () => {
  const [atenciones, setAtenciones] = useState<AtencionResumen[]>([]);
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewDetails, setViewDetails] = useState<AtencionDetalle | null>(null);
  const { notification, showNotification, hideNotification } = useNotification();
  
  // Estado inicial del formulario complejo
  const initialFormState = {
    paciente: { dni: '', nombres: '', apellido_paterno: '', apellido_materno: '', edad: '' as number | '', sexo: 'M' },
    atencion: { 
        fecha: new Date().toISOString().split('T')[0], 
        hora_inicio: '', 
        hora_fin: '' 
    },
    ocurrencia: { direccion: '', telefono: '', operador: '', hora_llamada: '', hora_ingreso: '' },
    evaluacion: { motivo: '', enfermedad_actual: '', examen_fisico: '' },
    diagnostico: '', // Manejo simple de un diagnóstico principal para la UI
    tratamiento: '',
    clasificacion: 'Consulta',
    personal_ids: [] as number[] // IDs seleccionados
  };

  const [form, setForm] = useState(initialFormState);

  const fetchData = async () => {
    try {
        const [resAtenciones, resPersonal] = await Promise.all([
            fetch(`${API_URL}/salud/atenciones`),
            fetch(`${API_URL}/salud/personal`)
        ]);
        if (resAtenciones.ok) setAtenciones(await resAtenciones.json());
        if (resPersonal.ok) setPersonalList(await resPersonal.json());
    } catch (error) {
        console.error("Error cargando datos de salud:", error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const buscarPaciente = async () => {
    if (form.paciente.dni.length < 8) {
        showNotification('El DNI debe tener 8 dígitos.', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/salud/pacientes/buscar/${form.paciente.dni}`);
        if (res.ok) {
            const data = await res.json();
            setForm(prev => ({
                ...prev,
                paciente: { ...prev.paciente, ...data, id: data.id } // Guardamos ID si existe
            }));
            showNotification('Paciente encontrado.', 'success');
        } else {
            // Limpiar datos excepto DNI para ingreso manual
            setForm(prev => ({
                ...prev,
                paciente: { ...initialFormState.paciente, dni: prev.paciente.dni }
            }));
            showNotification('Paciente no encontrado. Ingrese los datos manualmente.', 'error');
        }
    } catch (err) { console.error(err); }
  };

  const handlePersonalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value));
      setForm(prev => ({ ...prev, personal_ids: selectedIds }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        buscarPaciente();
    }
  };

  // Función auxiliar para obtener el ID del personal sin importar cómo venga de la BD
  const getPersonalId = (p: Personal) => p.id || p.id_personal || 0;

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Estructurar los datos para el backend
      const payload = {
          paciente: form.paciente,
          atencion: form.atencion,
          ocurrencia: form.ocurrencia,
          evaluacion: form.evaluacion,
          diagnosticos: [{ descripcion: form.diagnostico }],
          tratamiento: { descripcion: form.tratamiento },
          clasificacion: { tipo: form.clasificacion },
          personal_ids: form.personal_ids
      };

      try {
          const res = await fetch(`${API_URL}/salud/atenciones`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');

          showNotification('Atención registrada correctamente.', 'success');
          setIsModalOpen(false);
          setForm(initialFormState);
          fetchData();
      } catch (err: any) {
          showNotification(err.message, 'error');
      }
  };

  const handleView = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/salud/atenciones/${id}`);
      if (!res.ok) throw new Error('Error al cargar detalles');
      const data = await res.json();
      setViewDetails(data);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      
      <div className="crud-header">
        <h2>Área de Salud: Registro de Atenciones</h2>
        <button className="login-button" onClick={() => setIsModalOpen(true)}>+ Nueva Atención</button>
      </div>

      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>DNI</th><th>Clasificación</th><th>Acciones</th></tr></thead>
          <tbody>
            {atenciones.map(a => (
              <tr key={a.id}>
                <td>{new Date(a.fecha).toLocaleDateString()}</td>
                <td>{a.hora_inicio}</td>
                <td>{a.nombres} {a.apellido_paterno}</td>
                <td>{a.dni}</td>
                <td><span className="badge status-active">{a.clasificacion || 'N/A'}</span></td>
                <td>
                  <button className="action-btn" onClick={() => handleView(a.id)} title="Ver Detalle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header">
              <h3>Registro de Atención Médica</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {/* SECCIÓN PACIENTE */}
                <h4>1. Datos del Paciente</h4>
                <div className="crud-form salud-grid-3">
                    <div className="salud-search-box">
                        <div className="input-wrapper">
                            <label>DNI</label>
                            <input 
                                value={form.paciente.dni} 
                                onChange={e => setForm({...form, paciente: {...form.paciente, dni: e.target.value}})} 
                                onBlur={buscarPaciente} // Busca al salir del campo
                                onKeyDown={handleKeyDown} // Busca al presionar Enter
                                placeholder="Ingrese DNI" required maxLength={8}
                            />
                        </div>
                        <button type="button" className="action-btn search-btn" onClick={buscarPaciente} title="Buscar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </button>
                    </div>
                    <div><label>Nombres</label><input value={form.paciente.nombres} onChange={e => setForm({...form, paciente: {...form.paciente, nombres: e.target.value}})} required placeholder="Nombres del paciente" /></div>
                    <div><label>Ap. Paterno</label><input value={form.paciente.apellido_paterno} onChange={e => setForm({...form, paciente: {...form.paciente, apellido_paterno: e.target.value}})} required /></div>
                    <div><label>Ap. Materno</label><input value={form.paciente.apellido_materno} onChange={e => setForm({...form, paciente: {...form.paciente, apellido_materno: e.target.value}})} /></div>
                    <div><label>Edad</label><input type="number" value={form.paciente.edad} onChange={e => setForm({...form, paciente: {...form.paciente, edad: parseInt(e.target.value) || ''}})} required /></div>
                    <div>
                        <label>Sexo</label>
                        <select value={form.paciente.sexo} onChange={e => setForm({...form, paciente: {...form.paciente, sexo: e.target.value}})}>
                            <option value="M">Masculino</option><option value="F">Femenino</option>
                        </select>
                    </div>
                </div>

                {/* SECCIÓN ATENCIÓN Y OCURRENCIA */}
                <h4>2. Datos de la Atención</h4>
                <div className="crud-form salud-grid-3">
                    <div><label>Fecha</label><input type="date" value={form.atencion.fecha} onChange={e => setForm({...form, atencion: {...form.atencion, fecha: e.target.value}})} required /></div>
                    <div><label>Hora Inicio</label><input type="time" value={form.atencion.hora_inicio} onChange={e => setForm({...form, atencion: {...form.atencion, hora_inicio: e.target.value}})} required /></div>
                    <div><label>Hora Fin</label><input type="time" value={form.atencion.hora_fin} onChange={e => setForm({...form, atencion: {...form.atencion, hora_fin: e.target.value}})} /></div>
                    
                    <div className="full-width"><label>Dirección Ocurrencia</label><input value={form.ocurrencia.direccion} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, direccion: e.target.value}})} placeholder="Lugar donde ocurrió el incidente" /></div>
                    <div><label>Teléfono</label><input value={form.ocurrencia.telefono} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, telefono: e.target.value}})} /></div>
                    <div><label>Hora Llamada</label><input type="time" value={form.ocurrencia.hora_llamada} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, hora_llamada: e.target.value}})} /></div>
                    <div><label>Operador</label><input value={form.ocurrencia.operador} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, operador: e.target.value}})} /></div>
                </div>

                {/* SECCIÓN EVALUACIÓN */}
                <h4>3. Evaluación Médica</h4>
                <div className="crud-form">
                    <label>Motivo de Consulta</label>
                    <input value={form.evaluacion.motivo} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, motivo: e.target.value}})} required placeholder="Ej: Dolor abdominal, accidente de tránsito..." />
                    
                    <label>Enfermedad Actual / Relato</label>
                    <textarea value={form.evaluacion.enfermedad_actual} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, enfermedad_actual: e.target.value}})} rows={2}></textarea>
                    
                    <label>Examen Físico</label>
                    <textarea value={form.evaluacion.examen_fisico} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, examen_fisico: e.target.value}})} rows={2} placeholder="PA, FC, FR, SatO2, T°, etc."></textarea>
                </div>

                {/* SECCIÓN DIAGNÓSTICO Y TRATAMIENTO */}
                <div className="crud-form salud-grid-2">
                    <div>
                        <label>Diagnóstico (CIE-10 o descriptivo)</label>
                        <textarea value={form.diagnostico} onChange={e => setForm({...form, diagnostico: e.target.value})} rows={3} required></textarea>
                    </div>
                    <div>
                        <label>Tratamiento / Indicaciones</label>
                        <textarea value={form.tratamiento} onChange={e => setForm({...form, tratamiento: e.target.value})} rows={3}></textarea>
                    </div>
                </div>

                <div className="crud-form salud-grid-2">
                    <div>
                        <label>Clasificación</label>
                        <select value={form.clasificacion} onChange={e => setForm({...form, clasificacion: e.target.value})}>
                            <option value="Consulta">Consulta</option>
                            <option value="Emergencia">Emergencia</option>
                            <option value="Urgencia">Urgencia</option>
                            <option value="Traslado">Traslado</option>
                            <option value="Fallecido">Fallecido</option>
                        </select>
                    </div>
                    <div>
                        <label>Personal Asignado (Ctrl+Click para varios)</label>
                        <select multiple value={form.personal_ids.map(String)} onChange={handlePersonalChange} style={{height: '80px'}}>
                            {personalList.map(p => (
                                <option key={getPersonalId(p)} value={getPersonalId(p)}>{p.nombre} ({p.rol})</option>
                            ))}
                        </select>
                    </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">Registrar Atención</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* MODAL DE DETALLE */}
      {viewDetails && createPortal(
        <div className="modal-overlay" onClick={() => setViewDetails(null)}>
          <div className="modal-content" style={{maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de Atención: {viewDetails.numero}</h3>
              <button className="modal-close" onClick={() => setViewDetails(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="salud-grid-2">
                <div>
                  <h4>Paciente</h4>
                  <p><strong>Nombre:</strong> {viewDetails.nombres} {viewDetails.apellido_paterno} {viewDetails.apellido_materno}</p>
                  <p><strong>DNI:</strong> {viewDetails.dni}</p>
                  <p><strong>Edad:</strong> {viewDetails.edad} años</p>
                  <p><strong>Sexo:</strong> {viewDetails.sexo}</p>
                </div>
                <div>
                  <h4>Ocurrencia</h4>
                  <p><strong>Fecha:</strong> {new Date(viewDetails.fecha).toLocaleDateString()}</p>
                  <p><strong>Hora:</strong> {viewDetails.hora_inicio} - {viewDetails.hora_fin || 'En curso'}</p>
                  <p><strong>Lugar:</strong> {viewDetails.direccion || '-'}</p>
                  <p><strong>Teléfono:</strong> {viewDetails.telefono || '-'}</p>
                </div>
              </div>

              <h4>Evaluación Médica</h4>
              <div style={{background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', marginBottom: '10px'}}>
                <p><strong>Motivo:</strong> {viewDetails.motivo}</p>
                <p><strong>Enfermedad Actual:</strong> {viewDetails.enfermedad_actual || '-'}</p>
                <p><strong>Examen Físico:</strong> {viewDetails.examen_fisico || '-'}</p>
              </div>

              <div className="salud-grid-2">
                <div>
                  <h4>Diagnósticos</h4>
                  <ul style={{paddingLeft: '20px', margin: 0}}>
                    {viewDetails.diagnosticos.map((d, i) => <li key={i}>{d.descripcion}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Clasificación</h4>
                  <span className="badge status-active">{viewDetails.clasificacion}</span>
                </div>
              </div>

              <h4>Tratamiento</h4>
              <div style={{background: '#f0f9ff', padding: '10px', borderRadius: '6px', border: '1px solid #bae6fd'}}>
                {viewDetails.tratamientos.map((t, i) => <div key={i}>{t.descripcion}</div>)}
              </div>

              <h4>Personal Asignado</h4>
              <ul style={{display: 'flex', gap: '10px', padding: 0, listStyle: 'none', flexWrap: 'wrap'}}>
                {viewDetails.personal.map((p, i) => (
                  <li key={i} className="badge status-inactive">{p.nombre} ({p.rol})</li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="login-button" onClick={() => setViewDetails(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SaludModule;
