import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface TipoAtencion {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: number;
}

const TipoAtencionSaludModule = () => {
  const [items, setItems] = useState<TipoAtencion[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/salud/tipos-atencion`);
      if (res.ok) setItems(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/salud/tipos-atencion/${editingId}` : `${API_URL}/salud/tipos-atencion`;
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId ? { ...form, estado: 1 } : form;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) alert(`Tipo de atención ${editingId ? 'actualizado' : 'creado'} con éxito.`);
    setIsModalOpen(false);
    setForm({ nombre: '', descripcion: '' });
    setEditingId(null);
    fetchData();
  };

  const openModal = (item?: TipoAtencion) => {
    if (item) {
      setForm({ nombre: item.nombre, descripcion: item.descripcion || '' });
      setEditingId(item.id);
    } else {
      setForm({ nombre: '', descripcion: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Desactivar este tipo de atención?')) {
      await fetch(`${API_URL}/salud/tipos-atencion/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  return (
    <div className="crud-module">
      <div className="crud-header">
        <h2>Tipos de Atención de Salud</h2>
        <button className="login-button" onClick={() => openModal()}>+ Nuevo Tipo</button>
      </div>
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingId ? 'Editar' : 'Nuevo'} Tipo de Atención</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <div><label>Nombre</label><input placeholder="Ej: Accidente de Tránsito" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required /></div>
                  <div><label>Descripción</label><input placeholder="Descripción opcional" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>ID</th><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.nombre}</td>
                <td>{item.descripcion || '-'}</td>
                <td><span className={`badge ${item.estado ? 'status-active' : 'status-inactive'}`}>{item.estado ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <button className="action-btn edit" onClick={() => openModal(item)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id)} title="Desactivar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

export default TipoAtencionSaludModule;
