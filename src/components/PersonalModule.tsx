import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './UsuariosModule.css';
import './PersonalModule.css';
import Notification from '../hooks/Notification';
import { useNotification } from './useNotification';
import { API_URL } from '../config/api';

interface Role {
  id_rol: number;
  nombre: string;
  sistema: string;
}

interface PersonalRecord {
  id_personal: number;
  codigo_personal: string;
  nombres: string;
  apellidos: string;
  dni: string | null;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  id_usuario: number | null;
  username: string | null;
  estado_personal: number;
  estado_usuario: number | null;
  roleIds: number[];
  roles: string[];
  sistemas: string[];
}

const initialForm = {
  codigo_personal: '',
  nombres: '',
  apellidos: '',
  dni: '',
  correo: '',
  telefono: '',
  direccion: '',
  username: '',
  password: '',
  roleIds: [] as number[]
};

const systemLabels: Record<string, string> = {
  WEB: 'Acceso Web',
  APP_SERENO: 'App Serenazgo',
  APP_ALMACEN: 'App Almacen'
};

interface PersonalModuleProps {
  title?: string;
}

const PersonalModule = ({ title = 'Gestion de Personal y Accesos' }: PersonalModuleProps) => {
  const [personal, setPersonal] = useState<PersonalRecord[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with-account' | 'without-account' | 'active' | 'inactive'>('all');
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; idPersonal: number | null; personName: string }>({
    isOpen: false,
    idPersonal: null,
    personName: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const { notification, showNotification, hideNotification } = useNotification();

  const fetchData = async () => {
    try {
      const [personalRes, rolesRes] = await Promise.all([
        fetch(`${API_URL}/personal`),
        fetch(`${API_URL}/roles`)
      ]);

      if (personalRes.ok) {
        setPersonal(await personalRes.json());
      }

      if (rolesRes.ok) {
        setRoles(await rolesRes.json());
      }
    } catch (fetchError) {
      console.error(fetchError);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const groupedRoles = useMemo(() => {
    return roles.reduce<Record<string, Role[]>>((acc, role) => {
      if (!acc[role.sistema]) {
        acc[role.sistema] = [];
      }
      acc[role.sistema].push(role);
      return acc;
    }, {});
  }, [roles]);

  const filteredPersonal = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return personal.filter((item) => {
      const fullName = `${item.nombres} ${item.apellidos}`.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        item.codigo_personal.toLowerCase().includes(normalizedSearch) ||
        (item.dni || '').includes(normalizedSearch) ||
        (item.username || '').toLowerCase().includes(normalizedSearch) ||
        item.roles.some((role) => role.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) {
        return false;
      }

      switch (statusFilter) {
        case 'with-account':
          return Boolean(item.id_usuario);
        case 'without-account':
          return !item.id_usuario;
        case 'active':
          return item.id_usuario !== null && item.estado_usuario === 1;
        case 'inactive':
          return item.id_usuario !== null && item.estado_usuario !== 1;
        default:
          return true;
      }
    });
  }, [personal, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPersonal.length / rowsPerPage));
  const paginatedPersonal = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPersonal.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredPersonal, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError('');
  };

  const openModal = (item?: PersonalRecord) => {
    if (item) {
      setEditingId(item.id_personal);
      setForm({
        codigo_personal: item.codigo_personal,
        nombres: item.nombres,
        apellidos: item.apellidos,
        dni: item.dni || '',
        correo: item.correo || '',
        telefono: item.telefono || '',
        direccion: item.direccion || '',
        username: item.username || '',
        password: '',
        roleIds: item.roleIds || []
      });
    } else {
      resetForm();
    }

    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const toggleRole = (idRol: number) => {
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(idRol)
        ? current.roleIds.filter((roleId) => roleId !== idRol)
        : [...current.roleIds, idRol]
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const url = editingId ? `${API_URL}/personal/${editingId}` : `${API_URL}/personal`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar el registro.');
      }

      closeModal();
      fetchData();
      showNotification(`Personal ${editingId ? 'actualizado' : 'registrado'} correctamente.`, 'success');
    } catch (submitError: any) {
      setError(submitError.message);
    }
  };

  const handleDelete = async (idPersonal: number) => {
    if (!window.confirm('¿Eliminar este registro de personal y su cuenta asociada?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/personal/${idPersonal}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo eliminar el registro.');
      }

      fetchData();
      showNotification('Registro eliminado correctamente.', 'success');
    } catch (deleteError: any) {
      showNotification(deleteError.message, 'error');
    }
  };

  const handleToggleStatus = async (idPersonal: number) => {
    try {
      const response = await fetch(`${API_URL}/personal/${idPersonal}/toggle-status`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cambiar el estado.');
      }

      fetchData();
      showNotification('Estado de cuenta actualizado.', 'success');
    } catch (toggleError: any) {
      showNotification(toggleError.message, 'error');
    }
  };

  const openPasswordModal = (item: PersonalRecord) => {
    setPasswordModal({
      isOpen: true,
      idPersonal: item.id_personal,
      personName: `${item.nombres} ${item.apellidos}`
    });
    setNewPassword('');
    setError('');
  };

  const closePasswordModal = () => {
    setPasswordModal({ isOpen: false, idPersonal: null, personName: '' });
    setNewPassword('');
    setError('');
  };

  const generatePassword = () => {
    const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let value = '';
    for (let index = 0; index < 10; index += 1) {
      value += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setNewPassword(value);
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordModal.idPersonal || !newPassword) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/personal/${passwordModal.idPersonal}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar la contrasena.');
      }

      closePasswordModal();
      showNotification('Contrasena actualizada correctamente.', 'success');
    } catch (passwordError: any) {
      setError(passwordError.message);
    }
  };

  return (
    <div className="crud-module usuarios-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>{title}</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Buscar por nombre, codigo, DNI o usuario..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="table-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">Todos los estados</option>
            <option value="with-account">Con cuenta</option>
            <option value="without-account">Sin cuenta</option>
            <option value="active">Cuenta activa</option>
            <option value="inactive">Cuenta inactiva</option>
          </select>
          <select
            className="table-filter-select compact"
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
          >
            <option value={8}>8 por pagina</option>
            <option value={12}>12 por pagina</option>
            <option value={20}>20 por pagina</option>
          </select>
          <button className="login-button" onClick={() => openModal()}>+ Nuevo Personal</button>
        </div>
      </div>

      <div className="table-toolbar">
        <span className="table-results">
          Mostrando {filteredPersonal.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}
          {' '}-{' '}
          {Math.min(currentPage * rowsPerPage, filteredPersonal.length)} de {filteredPersonal.length} registros
        </span>
      </div>

      <table className="crud-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Personal</th>
            <th>DNI</th>
            <th>Usuario</th>
            <th>Accesos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {paginatedPersonal.map((item) => (
            <tr key={item.id_personal}>
              <td>{item.codigo_personal}</td>
              <td>{item.nombres} {item.apellidos}</td>
              <td>{item.dni || '-'}</td>
              <td>{item.username || 'Sin cuenta'}</td>
              <td>{item.roles.length > 0 ? item.roles.join(', ') : 'Sin roles'}</td>
              <td>
                {item.id_usuario ? (
                  <span className={`badge ${item.estado_usuario === 1 ? 'status-active' : 'status-inactive'}`}>
                    {item.estado_usuario === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                ) : (
                  <span className="badge status-inactive">Sin cuenta</span>
                )}
              </td>
              <td>
                {item.id_usuario && (
                  <>
                    <button className="action-btn" onClick={() => handleToggleStatus(item.id_personal)} title="Activar o desactivar cuenta">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"></path><path d="M18.4 5.6a9 9 0 1 1-12.8 0"></path></svg>
                    </button>
                    <button className="action-btn" onClick={() => openPasswordModal(item)} title="Cambiar contrasena">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                    </button>
                  </>
                )}
                <button className="action-btn edit" onClick={() => openModal(item)} title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="action-btn delete" onClick={() => handleDelete(item.id_personal)} title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </td>
            </tr>
          ))}
          {paginatedPersonal.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-state-cell">
                No se encontraron registros con los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="table-pagination">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span className="pagination-info">Página {currentPage} de {totalPages}</span>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content personal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header personal-modal-header">
              <div className="personal-modal-title">
                <span className="personal-modal-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <div>
                  <h3>{editingId ? 'Editar Personal' : 'Registrar Personal'}</h3>
                  <p>{editingId ? 'Actualiza los datos, accesos y roles del registro.' : 'Crea un registro ordenado con sus accesos al sistema.'}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="error-message">{error}</div>}
                <div className="personal-form-layout">
                  <section className="personal-section">
                    <div className="personal-section-header">
                      <span className="personal-section-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V4.75A1.75 1.75 0 0 1 5.75 3h8.586A2 2 0 0 1 15.75 3.586l3.664 3.664A2 2 0 0 1 20 8.664V19.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5z"></path><path d="M8 7h4"></path><path d="M8 11h8"></path><path d="M8 15h8"></path></svg>
                      </span>
                      <div>
                        <h4>Datos personales</h4>
                        <p>Información base del trabajador.</p>
                      </div>
                    </div>
                    <div className="personal-grid">
                      <label className="personal-field">
                        <span>Código personal</span>
                        <input placeholder="P001" value={form.codigo_personal} onChange={(e) => setForm({ ...form, codigo_personal: e.target.value })} required />
                      </label>
                      <label className="personal-field">
                        <span>Nombres</span>
                        <input placeholder="Nombres" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} required />
                      </label>
                      <label className="personal-field">
                        <span>Apellidos</span>
                        <input placeholder="Apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required />
                      </label>
                      <label className="personal-field">
                        <span>DNI</span>
                        <input placeholder="00000000" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
                      </label>
                      <label className="personal-field">
                        <span>Correo</span>
                        <input placeholder="correo@empresa.com" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
                      </label>
                      <label className="personal-field">
                        <span>Telefono</span>
                        <input placeholder="999999999" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                      </label>
                      <label className="personal-field personal-field-full">
                        <span>Direccion</span>
                        <input placeholder="Direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                      </label>
                    </div>
                  </section>

                  <section className="personal-section">
                    <div className="personal-section-header">
                      <span className="personal-section-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      </span>
                      <div>
                        <h4>Cuenta de acceso</h4>
                        <p>Credenciales para web y aplicativos.</p>
                      </div>
                    </div>
                    <div className="personal-grid">
                      <label className="personal-field">
                        <span>Usuario</span>
                        <input placeholder="usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                      </label>
                      <label className="personal-field">
                        <span>{editingId ? 'Nueva contrasena' : 'Contrasena'}</span>
                        <input placeholder={editingId ? 'Opcional al editar' : 'Contrasena'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                      </label>
                    </div>
                  </section>

                  <section className="personal-section">
                    <div className="personal-section-header">
                      <span className="personal-section-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"></path><path d="M9 12l2 2 4-4"></path></svg>
                      </span>
                      <div>
                        <h4>Roles y accesos</h4>
                        <p>Selecciona los permisos por sistema.</p>
                      </div>
                    </div>
                  {Object.entries(groupedRoles).map(([sistema, systemRoles]) => (
                    <div key={sistema} className="personal-role-group">
                      <div className="personal-role-title">{systemLabels[sistema] || sistema}</div>
                      <div className="personal-role-list">
                        {systemRoles.map((role) => (
                          <label key={role.id_rol} className={`personal-role-chip ${form.roleIds.includes(role.id_rol) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={form.roleIds.includes(role.id_rol)}
                              onChange={() => toggleRole(role.id_rol)}
                            />
                            <span>{role.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  </section>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar cambios' : 'Registrar personal'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {passwordModal.isOpen && createPortal(
        <div className="modal-overlay" onClick={closePasswordModal}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cambiar contrasena</h3>
              <button className="modal-close" onClick={closePasswordModal}>×</button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                <p style={{ marginTop: 0 }}>Cuenta de: <strong>{passwordModal.personName}</strong></p>
                {error && <div className="error-message">{error}</div>}
                <div className="crud-form">
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contrasena" required />
                  <button type="button" className="cancel-btn" onClick={generatePassword}>Generar contrasena</button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closePasswordModal}>Cancelar</button>
                <button type="submit" className="login-button">Guardar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PersonalModule;
