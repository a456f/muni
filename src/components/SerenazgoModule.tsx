import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';

interface Sereno {
  id_sereno: number;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  codigo_sereno: string | null;
  usuario: string;
  id_credencial: number;
  estado: number;
}

const SerenazgoModule = () => {
  const [serenos, setSerenos] = useState<Sereno[]>([]);
  const [form, setForm] = useState({ 
    nombres: '', 
    apellidos: '', 
    tipo_documento: 'DNI', 
    numero_documento: '', 
    codigo_sereno: '',
    password: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { notification, showNotification, hideNotification } = useNotification();

  // Estado para el modal de contraseña
  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; credencialId: number | null; serenoName: string }>({
    isOpen: false,
    credencialId: null,
    serenoName: ''
  });
  const [newPassword, setNewPassword] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/serenos');
      if (res.ok) setSerenos(await res.json());
    } catch (error) { console.error("Error fetching serenos:", error); }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredSerenos = serenos.filter(s =>
    s.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.numero_documento.includes(searchTerm) ||
    (s.usuario && s.usuario.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setForm({ nombres: '', apellidos: '', tipo_documento: 'DNI', numero_documento: '', codigo_sereno: '', password: '' });
    setEditingId(null);
    setError(null);
  };

  const openModal = (sereno?: Sereno) => {
    if (sereno) {
      setEditingId(sereno.id_sereno);
      setForm({
        nombres: sereno.nombres,
        apellidos: sereno.apellidos,
        tipo_documento: sereno.tipo_documento,
        numero_documento: sereno.numero_documento,
        codigo_sereno: sereno.codigo_sereno || '',
        password: ''
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!editingId && !form.password) {
        setError("La contraseña es obligatoria para nuevos serenos.");
        return;
    }

    const url = editingId ? `http://localhost:3001/api/serenos/${editingId}` : 'http://localhost:3001/api/serenos';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocurrió un error');
      }

      closeModal();
      fetchData();
      showNotification(`Sereno ${editingId ? 'actualizado' : 'creado'} con éxito.`, 'success');

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este sereno y sus credenciales? Esta acción es irreversible.')) {
      try {
        const response = await fetch(`http://localhost:3001/api/serenos/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Error al eliminar');
        fetchData();
        showNotification('Sereno eliminado con éxito.', 'success');
      } catch (err: any) { 
        showNotification(err.message, 'error');
      }
    }
  };
  
  const handleToggleStatus = async (credencialId: number, currentStatus: number) => {
    const action = currentStatus === 1 ? 'desactivar' : 'activar';
    if (window.confirm(`¿Estás seguro de que quieres ${action} la cuenta de este usuario?`)) {
        try {
            const response = await fetch(`http://localhost:3001/api/serenos/credenciales/${credencialId}/toggle-status`, {
                method: 'PUT',
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al cambiar el estado');
            }
            fetchData();
            showNotification('Estado del usuario actualizado.', 'success');
        } catch (err: any) {
            showNotification(err.message, 'error');
        }
    }
  };

  const openPasswordModal = (sereno: Sereno) => {
    setPasswordModal({
      isOpen: true,
      credencialId: sereno.id_credencial,
      serenoName: `${sereno.nombres} ${sereno.apellidos}`
    });
    setNewPassword('');
    setError(null);
  };

  const closePasswordModal = () => {
    setPasswordModal({ isOpen: false, credencialId: null, serenoName: '' });
    setNewPassword('');
    setError(null);
  };

  const generatePassword = () => {
    const length = 8;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setNewPassword(retVal);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !passwordModal.credencialId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/serenos/credenciales/${passwordModal.credencialId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocurrió un error al cambiar la contraseña');
      }

      closePasswordModal();
      showNotification('Contraseña actualizada con éxito.', 'success');

    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeModal();
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>Gestión de Serenazgo</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar por nombre, documento..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Sereno</button>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Sereno' : 'Nuevo Sereno'}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="error-message">{error}</div>}
                <div className="crud-form">
                  <input placeholder="Nombres" value={form.nombres} onChange={e => setForm({ ...form, nombres: e.target.value })} required />
                  <input placeholder="Apellidos" value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} required />
                  <select value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}>
                    <option value="DNI">DNI</option>
                    <option value="CARNET DE EXTRANJERIA">Carnet de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                  <input placeholder="Número de Documento (será su usuario)" value={form.numero_documento} onChange={e => setForm({ ...form, numero_documento: e.target.value })} required disabled={!!editingId} />
                  <input placeholder="Código de Sereno (opcional)" value={form.codigo_sereno} onChange={e => setForm({ ...form, codigo_sereno: e.target.value })} />
                  {!editingId && <input placeholder="Contraseña" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Crear Sereno y Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Password Change Modal */}
      {passwordModal.isOpen && createPortal(
        <div className="modal-overlay" onClick={closePasswordModal}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cambiar Contraseña</h3>
              <button className="modal-close" onClick={closePasswordModal}>×</button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                <p style={{marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)'}}>
                  Cambiando contraseña para: <strong>{passwordModal.serenoName}</strong>
                </p>
                {error && <div className="error-message">{error}</div>}
                <div className="crud-form">
                  <input
                    placeholder="Nueva Contraseña"
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button type="button" className="cancel-btn" onClick={generatePassword}>
                    Generar Contraseña Aleatoria
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closePasswordModal}>Cancelar</button>
                <button type="submit" className="login-button">Guardar Contraseña</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>ID</th><th>Nombres y Apellidos</th><th>Documento</th><th>Usuario (App)</th><th>Código</th><th>Estado App</th><th>Acciones</th></tr></thead>
          <tbody>
            {filteredSerenos.map(s => (
              <tr key={s.id_sereno}>
                <td>{s.id_sereno}</td>
                <td>{s.nombres} {s.apellidos}</td>
                <td>{s.tipo_documento}: {s.numero_documento}</td>
                <td>{s.usuario || 'N/A'}</td>
                <td>{s.codigo_sereno || 'N/A'}</td>
                <td>
                  {s.id_credencial ? (
                      <span className={`badge ${s.estado === 1 ? 'status-active' : 'status-inactive'}`}>
                          {s.estado === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                  ) : (
                      <span className="badge status-inactive">Sin Credencial</span>
                  )}
                </td>
                <td>
                  {s.id_credencial && (
                    <>
                      <button className="action-btn" onClick={() => handleToggleStatus(s.id_credencial, s.estado)} title={s.estado === 1 ? 'Desactivar Usuario' : 'Activar Usuario'}>
                        {s.estado === 1 ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        )}
                      </button>
                      <button className="action-btn" onClick={() => openPasswordModal(s)} title="Cambiar Contraseña">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                      </button>
                    </>
                  )}
                  <button className="action-btn edit" onClick={() => openModal(s)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(s.id_sereno)} title="Eliminar">
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

export default SerenazgoModule;
