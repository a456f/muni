import React, { useState, useEffect } from 'react';
import './IncidenciasModule.css';
import EvidenciasModule from './EvidenciasModule';
import Notification from '../hooks/Notification';
import type { User } from '../services/authService';
import { useNotification } from './useNotification';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';

// Interfaz actualizada según la nueva tabla 'incidencias'
interface Incidencia {
  id_incidencia: number;
  numero_parte: string | null;
  servicio: string | null;
  zona: string | null;
  dia: string | null;
  fecha: string | null;
  hora_hecho: string | null;
  hora_denuncia: string | null;
  hora_intervencion: string | null;
  modalidad_intervencion: string | null;
  unidad_serenazgo: string | null;
  lugar_hecho: string | null;
  tipo_hecho: string | null;
  arma_usada: string | null;
  monto_afectado: number | null;
  nombres_agraviado: string | null;
  senas_autor: string | null;
  supervisor_nombre: string | null;
  descripcion_relato: string | null;
  firma_ruta: string | null;
  id_sereno: number | null;
  fecha_registro: string;
  nombre_sereno?: string; // Campo extra del JOIN
}

interface Props {
  user?: User;
}

const IncidenciasModule = ({ user }: Props) => {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  // Catálogos para facilitar la entrada de datos (aunque la tabla ahora usa texto)
  const [tiposCat, setTiposCat] = useState<any[]>([]);
  const [zonasCat, setZonasCat] = useState<any[]>([]);
  const [serenos, setSerenos] = useState<any[]>([]);
  
  const initialFormState = {
    numero_parte: '',
    servicio: '',
    zona: '',
    dia: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_hecho: '',
    hora_denuncia: '',
    hora_intervencion: '',
    modalidad_intervencion: '',
    unidad_serenazgo: '',
    lugar_hecho: '',
    tipo_hecho: '',
    arma_usada: '',
    monto_afectado: '',
    nombres_agraviado: '',
    senas_autor: '',
    supervisor_nombre: '',
    descripcion_relato: '',
    firma_ruta: '',
    id_sereno: ''
  };

  const [form, setForm] = useState(initialFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evidenceModalId, setEvidenceModalId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { notification, showNotification, hideNotification } = useNotification();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [resInc, resTip, resZon, resSer] = await Promise.all([
        fetch(`${API_URL}/incidencias`),
        fetch(`${API_URL}/tipos-incidencia`),
        fetch(`${API_URL}/zonas`),
        fetch(`${API_URL}/serenos`)
      ]);
      
      if(resInc.ok) setIncidencias(await resInc.json());
      if(resTip.ok) setTiposCat(await resTip.json());
      if(resZon.ok) setZonasCat(await resZon.json());
      if(resSer.ok) setSerenos(await resSer.json());
    } catch (error) { console.error(error); }
  };

  useEffect(() => { 
    fetchData();

    // Comprobar si hay una incidencia para resaltar desde la notificación
    const idToHighlight = sessionStorage.getItem('highlightIncidencia');
    if (idToHighlight) {
      setHighlightedId(parseInt(idToHighlight, 10));
      sessionStorage.removeItem('highlightIncidencia');

      // Quitar el resaltado después de unos segundos
      setTimeout(() => {
        setHighlightedId(null);
      }, 3000);
    }
  }, []);

  // Filtrado
  const filtered = incidencias.filter(i => 
    (i.descripcion_relato && i.descripcion_relato.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.tipo_hecho && i.tipo_hecho.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.numero_parte && i.numero_parte.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/incidencias/${editingId}` : `${API_URL}/incidencias`;
    const method = editingId ? 'PUT' : 'POST';
    
    // Preparar el cuerpo, manejando campos numéricos/nulos
    const body = { 
      ...form,
      monto_afectado: form.monto_afectado === '' ? null : parseFloat(form.monto_afectado),
      id_sereno: form.id_sereno === '' ? null : parseInt(form.id_sereno)
    }; 

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocurrió un error al guardar.');
      }
      
      setForm(initialFormState);
      setEditingId(null);
      setIsModalOpen(false);
      fetchData();
      showNotification(`Incidencia ${editingId ? 'actualizada' : 'creada'} correctamente.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openModal = (i?: Incidencia) => {
    if (i) {
      setForm({
        numero_parte: i.numero_parte || '',
        servicio: i.servicio || '',
        zona: i.zona || '',
        dia: i.dia || '',
        fecha: i.fecha ? i.fecha.split('T')[0] : '',
        hora_hecho: i.hora_hecho || '',
        hora_denuncia: i.hora_denuncia || '',
        hora_intervencion: i.hora_intervencion || '',
        modalidad_intervencion: i.modalidad_intervencion || '',
        unidad_serenazgo: i.unidad_serenazgo || '',
        lugar_hecho: i.lugar_hecho || '',
        tipo_hecho: i.tipo_hecho || '',
        arma_usada: i.arma_usada || '',
        monto_afectado: i.monto_afectado?.toString() || '',
        nombres_agraviado: i.nombres_agraviado || '',
        senas_autor: i.senas_autor || '',
        supervisor_nombre: i.supervisor_nombre || '',
        descripcion_relato: i.descripcion_relato || '',
        firma_ruta: i.firma_ruta || '',
        id_sereno: i.id_sereno?.toString() || ''
      });
      setEditingId(i.id_incidencia);
    } else {
      setForm(initialFormState);
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar incidencia?')) {
      try {
        const response = await fetch(`${API_URL}/incidencias/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar.');
        }
        fetchData();
        showNotification('Incidencia eliminada correctamente.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="crud-module incidencias-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>Gestión de Incidencias</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar por parte, tipo, descripción..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nueva Incidencia</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Parte N°</th><th>Tipo Hecho</th><th>Zona</th><th>Lugar</th><th>Sereno</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id_incidencia} className={i.id_incidencia === highlightedId ? 'highlight' : ''}>
                <td>{i.numero_parte || '-'}</td>
                <td>{i.tipo_hecho}</td>
                <td>{i.zona}</td>
                <td>{i.lugar_hecho}</td>
                <td>{i.nombre_sereno || 'N/A'}</td>
                <td>{i.fecha_registro ? new Date(i.fecha_registro).toLocaleDateString() : '-'}</td>
                <td>
                  <button className="action-btn" onClick={() => setEvidenceModalId(i.id_incidencia)} title="Ver Evidencias">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </button>
                  <button className="action-btn edit" onClick={() => openModal(i)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(i.id_incidencia)} title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" style={{maxWidth: "900px"}} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Registrar'} Parte de Intervención</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form grid-form-3-cols">
                  {/* Datos Generales */}
                  <input placeholder="Número de Parte (ej: 1356040 -B)" value={form.numero_parte} onChange={e => setForm({...form, numero_parte: e.target.value})} />
                  <select value={form.servicio} onChange={e => setForm({...form, servicio: e.target.value})}><option value="">Servicio</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                  <select value={form.id_sereno} onChange={e => setForm({...form, id_sereno: e.target.value})} required className="full-width-mobile">
                    <option value="">Seleccione Sereno (Reportero)</option>
                    {serenos.map(s => <option key={s.id_sereno} value={s.id_sereno}>{s.apellidos}, {s.nombres}</option>)}
                  </select>

                  {/* Ubicación y Tiempo */}
                  <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                  <select value={form.dia} onChange={e => setForm({...form, dia: e.target.value})}><option value="">Día</option><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option></select>
                  <select value={form.zona} onChange={e => setForm({...form, zona: e.target.value})}>
                    <option value="">Seleccione Zona</option>
                    {zonasCat.map(z => <option key={z.id_zona} value={z.nombre}>{z.nombre}</option>)}
                  </select>

                  <div className="time-group">
                    <label>Hora Hecho:</label>
                    <input type="time" value={form.hora_hecho} onChange={e => setForm({...form, hora_hecho: e.target.value})} />
                  </div>
                  <div className="time-group">
                    <label>Hora Denuncia:</label>
                    <input type="time" value={form.hora_denuncia} onChange={e => setForm({...form, hora_denuncia: e.target.value})} />
                  </div>
                  <div className="time-group">
                    <label>Hora Intervención:</label>
                    <input type="time" value={form.hora_intervencion} onChange={e => setForm({...form, hora_intervencion: e.target.value})} />
                  </div>

                  {/* Detalles del Hecho */}
                  <select value={form.modalidad_intervencion} onChange={e => setForm({...form, modalidad_intervencion: e.target.value})}><option value="">Modalidad</option><option>Llamada de Base</option><option>Directa</option><option>Cámara</option></select>
                  <select value={form.tipo_hecho} onChange={e => setForm({...form, tipo_hecho: e.target.value})} required className="full-width-mobile">
                    <option value="">Tipo de Hecho</option>
                    {tiposCat.map(t => <option key={t.id_tipo} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <input placeholder="Lugar del Hecho" value={form.lugar_hecho} onChange={e => setForm({...form, lugar_hecho: e.target.value})} className="full-width-mobile" required />

                  <input placeholder="Unidad (Placa)" value={form.unidad_serenazgo} onChange={e => setForm({...form, unidad_serenazgo: e.target.value})} />
                  <input placeholder="Supervisor" value={form.supervisor_nombre} onChange={e => setForm({...form, supervisor_nombre: e.target.value})} />
                  <input placeholder="Arma usada" value={form.arma_usada} onChange={e => setForm({...form, arma_usada: e.target.value})} />

                  {/* Involucrados */}
                  <input placeholder="Nombres Agraviado" value={form.nombres_agraviado} onChange={e => setForm({...form, nombres_agraviado: e.target.value})} />
                  <input placeholder="Monto Afectado (S/.)" type="number" step="0.01" value={form.monto_afectado} onChange={e => setForm({...form, monto_afectado: e.target.value})} />
                  <input placeholder="Señas del Autor" value={form.senas_autor} onChange={e => setForm({...form, senas_autor: e.target.value})} />

                  {/* Relato */}
                  <textarea placeholder="Descripción / Relato de los hechos" value={form.descripcion_relato} onChange={e => setForm({...form, descripcion_relato: e.target.value})} required className="full-width" style={{minHeight: "100px"}} />
                  
                  {/* Firma (Ruta manual si es necesario, aunque idealmente viene de la app) */}
                  <input placeholder="Ruta de Firma (opcional)" value={form.firma_ruta} onChange={e => setForm({...form, firma_ruta: e.target.value})} className="full-width" disabled />

                  {form.firma_ruta && (
                    <div className="full-width" style={{ marginTop: '10px', gridColumn: '1 / -1', width: '100%' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Firma Registrada:</label>
                      <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px', textAlign: 'center', backgroundColor: '#f8f9fa', overflow: 'hidden' }}>
                        {/* Se remueve '/api' de la URL base para apuntar a la raiz donde se sirven los estáticos (uploads) */}
                        <img src={`${API_URL.replace(/\/api\/?$/, '')}/${form.firma_ruta}`} alt="Firma del involucrado" style={{ maxWidth: '100%', height: 'auto', maxHeight: '200px', objectFit: 'contain' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {evidenceModalId && createPortal(
        <EvidenciasModule idIncidencia={evidenceModalId} onClose={() => setEvidenceModalId(null)} />
      , document.body)}
    </div>
  );
};

export default IncidenciasModule;
