import React, { useState, useEffect } from 'react';
import './PuntosModule.css';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';

interface Punto {
  id_punto: number;
  latitud: number;
  longitud: number;
  nombre?: string;
}

const PuntosModule = () => {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [form, setForm] = useState({ latitud: '', longitud: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado (por ID o coordenadas)
  const filteredPuntos = puntos.filter(p => 
    p.id_punto.toString().includes(searchTerm) ||
    p.latitud.toString().includes(searchTerm) ||
    p.longitud.toString().includes(searchTerm)
  );

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPuntos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPuntos.length / itemsPerPage);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/puntos`);
      if (res.ok) setPuntos(await res.json());
    } catch (error) { console.error("Error cargando datos:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId
      ? `${API_URL}/puntos/${editingId}`
      : `${API_URL}/puntos`;
    const method = editingId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    
    setForm({ latitud: '', longitud: '' });
    setEditingId(null);
    setIsModalOpen(false);
    fetchData();
  };

  const openModal = (p?: Punto) => {
    if (p) {
      setForm({ latitud: p.latitud.toString(), longitud: p.longitud.toString() });
      setEditingId(p.id_punto);
    } else {
      setForm({ latitud: '', longitud: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar punto geográfico?')) {
      await fetch(`${API_URL}/puntos/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="crud-module puntos-module">
      <div className="crud-header">
        <h2>Puntos Geográficos</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar coordenadas..." className="search-input" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Punto</button>
        </div>
      </div>
      
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Punto' : 'Crear Punto'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <input placeholder="Latitud (ej: -12.046)" type="number" step="any" value={form.latitud} onChange={e => setForm({...form, latitud: e.target.value})} required />
                  <input placeholder="Longitud (ej: -77.042)" type="number" step="any" value={form.longitud} onChange={e => setForm({...form, longitud: e.target.value})} required />
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

      <table className="crud-table">
        <thead><tr><th>ID</th><th>Latitud</th><th>Longitud</th><th>Acciones</th></tr></thead>
        <tbody>
          {currentItems.map(p => (
            <tr key={p.id_punto}>
              <td>{p.id_punto}</td><td>{p.latitud}</td><td>{p.longitud}</td>
              <td>
                <button className="action-btn edit" onClick={() => openModal(p)} title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="action-btn delete" onClick={() => handleDelete(p.id_punto)} title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <span className="pagination-info">Mostrando {filteredPuntos.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredPuntos.length)} de {filteredPuntos.length}</span>
        <div className="pagination-buttons">
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
          {Array.from({ length: totalPages }, (_, i) => (<button key={i + 1} className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>))}
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
        </div>
      </div>
    </div>
  );
};

export default PuntosModule;