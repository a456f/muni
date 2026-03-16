import React, { useState, useEffect } from 'react';
import './DistritosModule.css';
import { createPortal } from 'react-dom';

interface Distrito {
  id_distrito: number;
  nombre: string;
}

const DistritosModule = () => {
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [form, setForm] = useState({ nombre: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado
  const filteredDistritos = distritos.filter(d => 
    d.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredDistritos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDistritos.length / itemsPerPage);

  const fetchDistritos = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/distritos');
      if (res.ok) setDistritos(await res.json());
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchDistritos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId 
      ? `http://localhost:3001/api/distritos/${editingId}` 
      : 'http://localhost:3001/api/distritos';
    const method = editingId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    
    setForm({ nombre: '' });
    setEditingId(null);
    setIsModalOpen(false);
    fetchDistritos();
  };

  const openModal = (d?: Distrito) => {
    if (d) {
      setForm({ nombre: d.nombre });
      setEditingId(d.id_distrito);
    } else {
      setForm({ nombre: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este distrito?')) {
      await fetch(`http://localhost:3001/api/distritos/${id}`, { method: 'DELETE' });
      fetchDistritos();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="crud-module distritos-module">
      <div className="crud-header">
        <h2>Gestión de Distritos</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Buscar distrito..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Distrito</button>
        </div>
      </div>
      
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Distrito' : 'Crear Distrito'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <input 
                    placeholder="Nombre del Distrito" 
                    value={form.nombre} 
                    onChange={e => setForm({...form, nombre: e.target.value})} 
                    required 
                    autoFocus
                  />
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

      <div className="table-responsive">
        <table className="crud-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre del Distrito</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {distritos.length === 0 ? (
              <tr><td colSpan={3} style={{textAlign: 'center', padding: '2rem'}}>No hay distritos registrados.</td></tr>
            ) : (
              currentItems.map(d => (
                <tr key={d.id_distrito}>
                  <td>{d.id_distrito}</td>
                  <td><strong>{d.nombre}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="action-btn edit" onClick={() => openModal(d)} title="Editar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(d.id_distrito)} title="Eliminar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">Mostrando {filteredDistritos.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredDistritos.length)} de {filteredDistritos.length}</span>
        <div className="pagination-buttons">
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i + 1} className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
          ))}
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
        </div>
      </div>
    </div>
  );
};

export default DistritosModule;
