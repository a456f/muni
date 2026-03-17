import React, { useState, useEffect } from 'react';
import './UsuariosModule.css';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';
interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
}

const UsuariosModule = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', telefono: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { notification, showNotification, hideNotification } = useNotification();

  // Filtrado
  const filteredUsuarios = usuarios.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.correo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsuarios.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsuarios.length / itemsPerPage);

  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      } else {
        console.error("Error al obtener usuarios");
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId
      ? `${API_URL}/usuarios/${editingId}`
      : `${API_URL}/usuarios`;
    
    const method = editingId ? 'PUT' : 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocurrió un error al guardar el usuario.');
      }
      setForm({ nombre: '', correo: '', password: '', telefono: '' });
      setEditingId(null);
      setIsModalOpen(false); // Cerrar modal
      fetchUsuarios();
      showNotification(`Usuario ${editingId ? 'actualizado' : 'creado'} correctamente.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openModal = (u?: Usuario) => {
    if (u) {
      setForm({ nombre: u.nombre, correo: u.correo, password: '', telefono: u.telefono || '' });
      setEditingId(u.id_usuario);
    } else {
      setForm({ nombre: '', correo: '', password: '', telefono: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        const response = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar el usuario.');
        }
        fetchUsuarios();
        showNotification('Usuario eliminado correctamente.', 'success');
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
    <div className="crud-module usuarios-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>Gestión de Usuarios</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Buscar por nombre o correo..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Usuario</button>
        </div>
      </div>
      
      {/* MODAL */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Usuario' : 'Crear Usuario'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <input placeholder="Nombre Completo" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                  <input placeholder="Correo Electrónico" type="email" value={form.correo} onChange={e => setForm({...form, correo: e.target.value})} required />
                  <input placeholder="Contraseña" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editingId} />
                  <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      <table className="crud-table">
        <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Acciones</th></tr></thead>
        <tbody>
          {currentItems.map(u => (
            <tr key={u.id_usuario}>
              <td>{u.id_usuario}</td><td>{u.nombre}</td><td>{u.correo}</td><td>{u.telefono}</td>
              <td>
                <button className="action-btn edit" onClick={() => openModal(u)} title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="action-btn delete" onClick={() => handleDelete(u.id_usuario)} title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINACIÓN */}
      <div className="pagination">
        <span className="pagination-info">Mostrando {filteredUsuarios.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredUsuarios.length)} de {filteredUsuarios.length}</span>
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

export default UsuariosModule;
