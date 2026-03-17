import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface TipoIncidencia {
  id_tipo: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
}

const TiposIncidenciaModule = () => {
  const [items, setItems] = useState<TipoIncidencia[]>([]);
  const [form, setForm] = useState({ nombre: '', codigo: '', descripcion: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`${API_URL}/tipos-incidencia`);
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/tipos-incidencia/${editingId}` : `${API_URL}/tipos-incidencia`;
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (response.ok) {
      alert(`Tipo de incidencia ${editingId ? 'actualizado' : 'creado'} con éxito.`);
    }
    setIsModalOpen(false);
    fetchData();
  };

  const openModal = (item?: TipoIncidencia) => {
    if (item) {
      setForm({ nombre: item.nombre, codigo: item.codigo || '', descripcion: item.descripcion || '' });
      setEditingId(item.id_tipo);
    } else {
      setForm({ nombre: '', codigo: '', descripcion: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este tipo?')) {
      await fetch(`${API_URL}/tipos-incidencia/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  return (
    <div className="crud-module">
      <div className="crud-header">
        <h2>Tipos de Incidencia</h2>
        <button className="login-button" onClick={() => openModal()}>+ Nuevo Tipo</button>
      </div>
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Nuevo'} Tipo</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body"><div className="crud-form">
                <input placeholder="Nombre del Tipo" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                <input placeholder="Código (ej. SEG-01)" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} />
                <input placeholder="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
              </div></div>
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
          <thead><tr><th>ID</th><th>Nombre</th><th>Código</th><th>Descripción</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id_tipo}>
                <td>{item.id_tipo}</td><td>{item.nombre}</td><td>{item.codigo}</td><td>{item.descripcion}</td>
                <td>
                  <button className="action-btn edit" onClick={() => openModal(item)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id_tipo)} title="Eliminar">
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
export default TiposIncidenciaModule;