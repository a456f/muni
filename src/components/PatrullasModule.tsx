import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import PatrullaHistorialModal from './PatrullaHistorialModal';

interface Patrulla {
  id_patrulla: number;
  codigo: string;
  tipo: string;
  // Campos que vienen del JOIN para saber el estado
  id_asignacion: number | null;
  nombres: string | null;
  apellidos: string | null;
  nombre_turno: string | null;
}

const PatrullasModule = () => {
  const [patrullas, setPatrullas] = useState<Patrulla[]>([]);
  const [form, setForm] = useState({ codigo: '', tipo: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyModalPatrol, setHistoryModalPatrol] = useState<string | null>(null);
  const { notification, showNotification, hideNotification } = useNotification();

  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/patrullas');
      if (res.ok) setPatrullas(await res.json());
    } catch (error) { console.error("Error fetching data:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `http://localhost:3001/api/patrullas/${editingId}` : 'http://localhost:3001/api/patrullas';
    const method = editingId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar la patrulla.');
      }
      setIsModalOpen(false);
      fetchData();
      showNotification(`Patrulla ${editingId ? 'actualizada' : 'creada'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openModal = (item?: Patrulla) => {
    if (item) {
      setForm({ codigo: item.codigo, tipo: item.tipo });
      setEditingId(item.id_patrulla);
    } else {
      setForm({ codigo: '', tipo: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar esta patrulla?')) {
      try {
        const response = await fetch(`http://localhost:3001/api/patrullas/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar la patrulla.');
        }
        fetchData();
        showNotification('Patrulla eliminada con éxito.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      <div className="crud-header">
        <h2>Gestión de Patrullas</h2>
        <button className="login-button" onClick={() => openModal()}>+ Nueva Patrulla</button>
      </div>
      {historyModalPatrol && (
        <PatrullaHistorialModal 
          patrolCode={historyModalPatrol} 
          onClose={() => setHistoryModalPatrol(null)} 
        />
      )}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Nueva'} Patrulla</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body"><div className="crud-form">
                <input placeholder="Código (ej: P-101)" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} required />
                <input placeholder="Tipo (ej: Camioneta, Moto)" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} required />
              </div></div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
      <p className="module-description">
        Esta tabla muestra el estado <strong>en tiempo real</strong> de las patrullas para el turno actual.
      </p>
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>ID</th><th>Código</th><th>Tipo</th><th>Estado Actual</th><th>Asignado a</th><th>Acciones</th></tr></thead>
          <tbody>
            {patrullas.map(item => (
              <tr key={item.id_patrulla}>
                <td>{item.id_patrulla}</td><td>{item.codigo}</td><td>{item.tipo}</td>
                <td>
                  {item.id_asignacion ? (
                    <span className="badge status-inactive">Ocupado</span>
                  ) : (
                    <span className="badge status-active">Libre</span>
                  )}
                </td>
                <td>
                  {item.id_asignacion ? `${item.nombres} ${item.apellidos}` : 'N/A'}
                </td>
                <td>
                  <button className="action-btn" onClick={() => setHistoryModalPatrol(item.codigo)} title="Ver Historial">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                  </button>
                  <button className="action-btn edit" onClick={() => openModal(item)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id_patrulla)} title="Eliminar">
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
export default PatrullasModule;