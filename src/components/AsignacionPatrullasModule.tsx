import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';

const AsignacionPatrullasModule = () => {
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [serenos, setSerenos] = useState<any[]>([]);
  const [patrullas, setPatrullas] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  
  const initialFormState = { id_sereno: '', id_patrulla: '', id_turno: '', fecha: new Date().toISOString().split('T')[0] };
  const [form, setForm] = useState(initialFormState);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [serenoSearch, setSerenoSearch] = useState('');
  const [patrullaSearch, setPatrullaSearch] = useState('');

  const { notification, showNotification, hideNotification } = useNotification();
  const [takenSerenos, setTakenSerenos] = useState<number[]>([]);
  const [takenPatrols, setTakenPatrols] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      const [resAsig, resSer, resPat, resTur] = await Promise.all([
        fetch('http://localhost:3001/api/asignaciones'),
        fetch('http://localhost:3001/api/serenos'),
        fetch('http://localhost:3001/api/patrullas'),
        fetch('http://localhost:3001/api/turnos')
      ]);
      if (resAsig.ok) setAsignaciones(await resAsig.json());
      if (resSer.ok) setSerenos(await resSer.json());
      if (resPat.ok) setPatrullas(await resPat.json());
      if (resTur.ok) setTurnos(await resTur.json());
    } catch (error) { console.error("Error fetching data:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  // Efecto para actualizar las patrullas y serenos ocupados.
  // Si un sereno o patrulla tiene CUALQUIER asignación, se considera ocupado.
  useEffect(() => {
    const allTakenPatrols = asignaciones.map(a => a.id_patrulla);
    const allTakenSerenos = asignaciones.map(a => a.id_sereno);
    setTakenPatrols(allTakenPatrols);
    setTakenSerenos(allTakenSerenos);
  }, [asignaciones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const url = editingId ? `http://localhost:3001/api/asignaciones/${editingId}` : 'http://localhost:3001/api/asignaciones';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar la asignación');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setEditingItem(null);
      fetchData();
      showNotification(`Asignación ${editingId ? 'transferida' : 'creada'} con éxito.`, 'success');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingItem(null);
  };

  const openModal = (item?: any) => {
    setSerenoSearch('');
    setPatrullaSearch('');
    setError(null);
    if (item) {
      setEditingId(item.id_asignacion);
      setEditingItem(item);
      setForm({
        // Para transferir, el sereno a seleccionar será el nuevo.
        // Los demás datos se mantienen para la petición PUT.
        id_sereno: '', 
        id_patrulla: item.id_patrulla.toString(),
        id_turno: item.id_turno.toString(),
        fecha: new Date(item.fecha).toISOString().split('T')[0]
      });
    } else {
      setEditingId(null);
      setEditingItem(null);
      const defaultTurnoId = turnos.length > 0 ? turnos[0].id_turno.toString() : '';
      setForm({ ...initialFormState, id_turno: defaultTurnoId });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar esta asignación?')) {
      try {
        const response = await fetch(`http://localhost:3001/api/asignaciones/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Error al eliminar la asignación');
        }
        fetchData();
        showNotification('Asignación eliminada con éxito.', 'success');
      } catch (err: any) {
        showNotification(err.message, 'error');
      }
    }
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      <div className="crud-header">
        <h2>Asignación de Patrullas y Transferencias</h2>
        <button className="login-button" onClick={() => openModal()}>+ Nueva Asignación</button>
      </div>
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Transferir Asignación' : 'Nueva Asignación'}</h3><button className="modal-close" onClick={closeModal}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="error-message">{error}</div>}
                {editingId && editingItem ? (
                  <div className="transfer-view">
                    <div className="transfer-info">
                      <p><strong>Patrulla:</strong> <span>{editingItem.codigo_patrulla}</span></p>
                      <p><strong>Sereno Actual:</strong> <span>{`${editingItem.apellidos}, ${editingItem.nombres}`}</span></p>
                      <p><strong>Turno:</strong> <span>{`${editingItem.nombre_turno} (${editingItem.hora_inicio} - ${editingItem.hora_fin})`}</span></p>
                    </div>
                    <div className="crud-form" style={{marginTop: '1.5rem'}}>
                      <label>Transferir a nuevo sereno:</label>
                      <input type="text" placeholder="Buscar sereno disponible..." value={serenoSearch} onChange={e => setSerenoSearch(e.target.value)} />
                      <select value={form.id_sereno} onChange={e => setForm({ ...form, id_sereno: e.target.value })} required>
                        <option value="">Seleccione un Sereno</option>
                        {serenos
                          .filter(s => 
                            !takenSerenos.includes(s.id_sereno) &&
                            (`${s.apellidos} ${s.nombres}`.toLowerCase().includes(serenoSearch.toLowerCase()))
                          )
                          .map(s => (
                          <option key={s.id_sereno} value={s.id_sereno}>
                            {s.apellidos}, {s.nombres}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="crud-form">
                    <input type="text" placeholder="Buscar sereno..." value={serenoSearch} onChange={e => setSerenoSearch(e.target.value)} />
                    <select value={form.id_sereno} onChange={e => setForm({ ...form, id_sereno: e.target.value })} required>
                      <option value="">Seleccione un Sereno</option>
                      {serenos.filter(s => !takenSerenos.includes(s.id_sereno) && (`${s.apellidos} ${s.nombres}`.toLowerCase().includes(serenoSearch.toLowerCase()))).map(s => (<option key={s.id_sereno} value={s.id_sereno}>{s.apellidos}, {s.nombres}</option>))}
                    </select>

                    <input type="text" placeholder="Buscar patrulla..." value={patrullaSearch} onChange={e => setPatrullaSearch(e.target.value)} />
                    <select value={form.id_patrulla} onChange={e => setForm({ ...form, id_patrulla: e.target.value })} required>
                      <option value="">Seleccione una Patrulla</option>
                      {patrullas.filter(p => !takenPatrols.includes(p.id_patrulla) && (`${p.codigo} ${p.tipo}`.toLowerCase().includes(patrullaSearch.toLowerCase()))).map(p => (<option key={p.id_patrulla} value={p.id_patrulla}>{p.codigo} - {p.tipo}</option>))}
                    </select>

                    <select value={form.id_turno} onChange={e => setForm({ ...form, id_turno: e.target.value })} required>
                      <option value="">Seleccione un Turno</option>
                      {turnos.map(t => <option key={t.id_turno} value={t.id_turno}>{t.nombre_turno} ({t.hora_inicio} - {t.hora_fin})</option>)}
                    </select>
                    <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Confirmar' : 'Asignar'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Fecha</th><th>Sereno</th><th>Patrulla</th><th>Turno</th><th>Acciones</th></tr></thead>
          <tbody>
            {asignaciones.map(item => (
              <tr key={item.id_asignacion}>
                <td>{new Date(item.fecha).toLocaleDateString()}</td>
                <td>{item.apellidos}, {item.nombres}</td>
                <td>{item.codigo_patrulla}</td>
                <td>{item.nombre_turno} ({item.hora_inicio} - {item.hora_fin})</td>
                <td>
                  <button className="action-btn transfer" onClick={() => openModal(item)} title="Transferir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id_asignacion)} title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AsignacionPatrullasModule;