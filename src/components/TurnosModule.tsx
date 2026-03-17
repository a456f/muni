import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';

import { API_URL } from '../config/api';
interface Turno {
  id_turno: number;
  nombre_turno: string;
  hora_inicio: string;
  hora_fin: string;
}

const TurnosModule = () => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [form, setForm] = useState({ nombre_turno: '', hora_inicio: '', hora_fin: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/turnos`);
      if (res.ok) setTurnos(await res.json());
    } catch (error) { console.error("Error fetching data:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/turnos/${editingId}` : `${API_URL}/turnos`;
    const method = editingId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el turno.');
      }
      setIsModalOpen(false);
      fetchData();
      showNotification(`Turno ${editingId ? 'actualizado' : 'creado'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openModal = (item?: Turno) => {
    if (item) {
      setForm({ nombre_turno: item.nombre_turno, hora_inicio: item.hora_inicio, hora_fin: item.hora_fin });
      setEditingId(item.id_turno);
    } else {
      setForm({ nombre_turno: '', hora_inicio: '', hora_fin: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este turno?')) {
      try {
        const response = await fetch(`${API_URL}/turnos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar el turno.');
        }
        fetchData();
        showNotification('Turno eliminado con éxito.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      <div className="crud-header">
        <h2>Gestión de Turnos</h2>
        <button className="login-button" onClick={() => openModal()}>+ Nuevo Turno</button>
      </div>
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Nuevo'} Turno</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body"><div className="crud-form">
                <input placeholder="Nombre del Turno (ej: Mañana)" value={form.nombre_turno} onChange={e => setForm({ ...form, nombre_turno: e.target.value })} required />
                <input type="time" placeholder="Hora Inicio" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} required />
                <input type="time" placeholder="Hora Fin" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} required />
              </div></div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>ID</th><th>Nombre Turno</th><th>Hora Inicio</th><th>Hora Fin</th><th>Acciones</th></tr></thead>
          <tbody>
            {turnos.map(item => (
              <tr key={item.id_turno}>
                <td>{item.id_turno}</td><td>{item.nombre_turno}</td><td>{item.hora_inicio}</td><td>{item.hora_fin}</td>
                <td>
                  <button className="action-btn edit" onClick={() => openModal(item)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id_turno)} title="Eliminar">
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
export default TurnosModule;