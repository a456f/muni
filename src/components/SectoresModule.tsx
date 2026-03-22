import React, { useState, useEffect } from 'react';
import './SectoresModule.css';
import { API_URL } from '../config/api';
import { createPortal } from 'react-dom';

interface Sector {
  id_sector: number;
  nombre: string;
  id_zona: number;
  descripcion: string | null;
  nombre_zona?: string;
  nombre_distrito?: string;
}

interface Zona {
  id_zona: number;
  nombre: string;
  nombre_distrito?: string;
}

const SectoresModule = () => {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [form, setForm] = useState({ nombre: '', id_zona: '', descripcion: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado
  const filteredSectores = sectores.filter(s => 
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.nombre_zona && s.nombre_zona.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSectores.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSectores.length / itemsPerPage);

  const fetchData = async () => {
    try {
      const resSectores = await fetch(`${API_URL}/sectores`);
      if (resSectores.ok) setSectores(await resSectores.json());

      const resZonas = await fetch(`${API_URL}/zonas`);
      if (resZonas.ok) setZonas(await resZonas.json());
    } catch (error) { console.error("Error cargando datos:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId 
      ? `${API_URL}/sectores/${editingId}` 
      : `${API_URL}/sectores`;
    const method = editingId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    
    setForm({ nombre: '', id_zona: '', descripcion: '' });
    setEditingId(null);
    setIsModalOpen(false);
    fetchData();
  };

  const openModal = (s?: Sector) => {
    if (s) {
      setForm({ nombre: s.nombre, id_zona: s.id_zona.toString(), descripcion: s.descripcion || '' });
      setEditingId(s.id_sector);
    } else {
      setForm({ nombre: '', id_zona: '', descripcion: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar sector?')) {
      await fetch(`${API_URL}/sectores/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="crud-module sectores-module">
      <div className="crud-header">
        <h2>Gestión de Sectores</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar sector o zona..." className="search-input" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Sector</button>
        </div>
      </div>
      
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Sector' : 'Crear Sector'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <label>Nombre del Sector</label>
                  <input placeholder="Ej: Sector A" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                  <label>Zona</label>
                  <select value={form.id_zona} onChange={e => setForm({...form, id_zona: e.target.value})} required>
                    <option value="">-- Seleccione zona --</option>
                    {zonas.map(z => (<option key={z.id_zona} value={z.id_zona}>{z.nombre} {z.nombre_distrito ? `(${z.nombre_distrito})` : ''}</option>))}
                  </select>
                  <label>Descripción (opcional)</label>
                  <textarea placeholder="Descripción del sector..." value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
      <table className="crud-table">
        <thead><tr><th>Sector</th><th>Zona</th><th>Distrito</th><th>Descripción</th><th>Acciones</th></tr></thead>
        <tbody>
          {currentItems.map(s => (
            <tr key={s.id_sector}>
              <td style={{ fontWeight: 600 }}>{s.nombre}</td><td>{s.nombre_zona || '-'}</td><td>{s.nombre_distrito || '-'}</td><td style={{ color: 'var(--text-muted)' }}>{s.descripcion || '-'}</td>
              <td>
                <button className="action-btn edit" onClick={() => openModal(s)} title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="action-btn delete" onClick={() => handleDelete(s.id_sector)} title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="pagination">
        <span className="pagination-info">Mostrando {filteredSectores.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredSectores.length)} de {filteredSectores.length}</span>
        <div className="pagination-buttons">
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
          {Array.from({ length: totalPages }, (_, i) => (<button key={i + 1} className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>))}
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
        </div>
      </div>
    </div>
  );
};

export default SectoresModule;