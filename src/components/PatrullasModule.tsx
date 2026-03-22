import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import PatrullaHistorialModal from './PatrullaHistorialModal';
import { API_URL } from '../config/api';
import './PersonalModule.css';
import './PatrullajeModule.css';

interface Patrulla {
  id_patrulla: number;
  codigo: string;
  tipo: string;
  id_asignacion: number | null;
  fecha_asignacion: string | null;
  id_personal: number | null;
  id_turno: number | null;
  codigo_personal: string | null;
  nombres: string | null;
  apellidos: string | null;
  sereno_nombre: string | null;
  nombre_turno: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado_operativo: 'LIBRE' | 'ASIGNADA';
}

interface Sereno {
  id_sereno: number;
  codigo_sereno: string;
  nombres: string;
  apellidos: string;
  numero_documento?: string | null;
}

interface Turno {
  id_turno: number;
  nombre_turno: string;
  hora_inicio: string;
  hora_fin: string;
}

const initialPatrolForm = { codigo: '', tipo: '' };
const today = new Date().toISOString().split('T')[0];

const PatrullasModule = () => {
  const [patrullas, setPatrullas] = useState<Patrulla[]>([]);
  const [serenos, setSerenos] = useState<Sereno[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'LIBRE' | 'ASIGNADA'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);

  const [patrolForm, setPatrolForm] = useState(initialPatrolForm);
  const [editingPatrolId, setEditingPatrolId] = useState<number | null>(null);
  const [isPatrolModalOpen, setIsPatrolModalOpen] = useState(false);
  const [historyModalPatrol, setHistoryModalPatrol] = useState<string | null>(null);

  const [assignModal, setAssignModal] = useState<{ open: boolean; mode: 'assign' | 'transfer'; patrol: Patrulla | null }>({
    open: false,
    mode: 'assign',
    patrol: null
  });
  const [assignForm, setAssignForm] = useState({ id_sereno: '', id_turno: '', fecha: today });
  const [serenoSearch, setSerenoSearch] = useState('');
  const [patrolError, setPatrolError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  const { notification, showNotification, hideNotification } = useNotification();

  const fetchData = async () => {
    try {
      const [resPatrullas, resSerenos, resTurnos] = await Promise.all([
        fetch(`${API_URL}/patrullas`),
        fetch(`${API_URL}/serenos`),
        fetch(`${API_URL}/turnos`)
      ]);

      if (resPatrullas.ok) {
        setPatrullas(await resPatrullas.json());
      }

      if (resSerenos.ok) {
        setSerenos(await resSerenos.json());
      }

      if (resTurnos.ok) {
        setTurnos(await resTurnos.json());
      }
    } catch (error) {
      console.error('Error fetching patrol data:', error);
      showNotification('No se pudieron cargar las patrullas.', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeSerenoIds = useMemo(
    () => patrullas.filter((item) => item.id_asignacion).map((item) => item.id_personal).filter(Boolean) as number[],
    [patrullas]
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(patrullas.map((item) => item.tipo).filter(Boolean))).sort(),
    [patrullas]
  );

  const fleetStats = useMemo(() => {
    const libres = patrullas.filter((item) => item.estado_operativo === 'LIBRE').length;
    const asignadas = patrullas.length - libres;
    return {
      total: patrullas.length,
      libres,
      asignadas,
      tipos: typeOptions.length
    };
  }, [patrullas, typeOptions.length]);

  const filteredPatrullas = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return patrullas.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.codigo.toLowerCase().includes(normalizedSearch) ||
        item.tipo.toLowerCase().includes(normalizedSearch) ||
        (item.sereno_nombre || '').toLowerCase().includes(normalizedSearch) ||
        (item.codigo_personal || '').toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter !== 'all' && item.estado_operativo !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'all' && item.tipo !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [patrullas, searchTerm, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatrullas.length / rowsPerPage));
  const paginatedPatrullas = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPatrullas.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredPatrullas, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const availableSerenos = useMemo(() => {
    const currentSerenoId = assignModal.patrol?.id_personal || null;
    const normalizedSearch = serenoSearch.trim().toLowerCase();

    return serenos.filter((item) => {
      const isOccupiedByOther = activeSerenoIds.includes(item.id_sereno) && item.id_sereno !== currentSerenoId;
      if (isOccupiedByOther) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        `${item.apellidos} ${item.nombres}`.toLowerCase().includes(normalizedSearch) ||
        (item.codigo_sereno || '').toLowerCase().includes(normalizedSearch) ||
        (item.numero_documento || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [activeSerenoIds, assignModal.patrol?.id_personal, serenoSearch, serenos]);

  const resetPatrolModal = () => {
    setPatrolForm(initialPatrolForm);
    setEditingPatrolId(null);
    setPatrolError('');
    setIsPatrolModalOpen(false);
  };

  const openPatrolModal = (patrulla?: Patrulla) => {
    if (patrulla) {
      setPatrolForm({ codigo: patrulla.codigo, tipo: patrulla.tipo });
      setEditingPatrolId(patrulla.id_patrulla);
    } else {
      setPatrolForm(initialPatrolForm);
      setEditingPatrolId(null);
    }

    setPatrolError('');
    setIsPatrolModalOpen(true);
  };

  const openAssignmentModal = (patrulla: Patrulla, mode: 'assign' | 'transfer') => {
    setAssignModal({ open: true, mode, patrol: patrulla });
    setAssignForm({
      id_sereno: '',
      id_turno: patrulla.id_turno?.toString() || turnos[0]?.id_turno?.toString() || '',
      fecha: patrulla.fecha_asignacion ? new Date(patrulla.fecha_asignacion).toISOString().split('T')[0] : today
    });
    setSerenoSearch('');
    setAssignmentError('');
  };

  const closeAssignmentModal = () => {
    setAssignModal({ open: false, mode: 'assign', patrol: null });
    setAssignForm({ id_sereno: '', id_turno: turnos[0]?.id_turno?.toString() || '', fecha: today });
    setSerenoSearch('');
    setAssignmentError('');
  };

  const handlePatrolSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPatrolError('');

    const url = editingPatrolId ? `${API_URL}/patrullas/${editingPatrolId}` : `${API_URL}/patrullas`;
    const method = editingPatrolId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patrolForm)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la patrulla.');
      }

      resetPatrolModal();
      fetchData();
      showNotification(`Vehiculo ${editingPatrolId ? 'actualizado' : 'creado'} correctamente.`, 'success');
    } catch (error: any) {
      setPatrolError(error.message);
    }
  };

  const handleDeletePatrol = async (patrulla: Patrulla) => {
    if (patrulla.id_asignacion) {
      showNotification('Primero devuelve la patrulla al almacen antes de eliminarla.', 'error');
      return;
    }

    if (!window.confirm(`¿Eliminar la patrulla ${patrulla.codigo}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/patrullas/${patrulla.id_patrulla}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo eliminar la patrulla.');
      }

      fetchData();
      showNotification('Patrulla eliminada correctamente.', 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleAssignmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignModal.patrol) {
      return;
    }

    setAssignmentError('');

    const payload = {
      id_sereno: Number(assignForm.id_sereno),
      id_patrulla: assignModal.patrol.id_patrulla,
      id_turno: Number(assignForm.id_turno),
      fecha: assignForm.fecha
    };

    const url =
      assignModal.mode === 'assign'
        ? `${API_URL}/asignaciones`
        : `${API_URL}/asignaciones/${assignModal.patrol.id_asignacion}`;
    const method = assignModal.mode === 'assign' ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la asignacion.');
      }

      closeAssignmentModal();
      fetchData();
      showNotification(
        assignModal.mode === 'assign' ? 'Patrulla asignada correctamente.' : 'Patrulla transferida correctamente.',
        'success'
      );
    } catch (error: any) {
      setAssignmentError(error.message);
    }
  };

  const handleReturnToWarehouse = async (patrulla: Patrulla) => {
    if (!patrulla.id_asignacion) {
      return;
    }

    if (!window.confirm(`¿Devolver la patrulla ${patrulla.codigo} al almacen?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/asignaciones/${patrulla.id_asignacion}/devolver`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo devolver la patrulla.');
      }

      fetchData();
      showNotification('Patrulla devuelta al almacen correctamente.', 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleExportFleet = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Patrullas');

    worksheet.columns = [
      { header: 'Codigo', key: 'codigo', width: 18 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Sereno Actual', key: 'sereno', width: 34 },
      { header: 'Codigo Sereno', key: 'codigo_sereno', width: 18 },
      { header: 'Turno', key: 'turno', width: 24 },
      { header: 'Fecha Asignacion', key: 'fecha', width: 18 }
    ];

    worksheet.addRows(
      filteredPatrullas.map((item) => ({
        codigo: item.codigo,
        tipo: item.tipo,
        estado: item.estado_operativo,
        sereno: item.sereno_nombre || 'Libre',
        codigo_sereno: item.codigo_personal || '-',
        turno: item.nombre_turno || '-',
        fecha: item.fecha_asignacion ? new Date(item.fecha_asignacion).toLocaleDateString() : '-'
      }))
    );

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'flota-patrullas.xlsx');
  };

  return (
    <div className="crud-module patrullas-dashboard">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="vehicle-kpi-grid">
        <article className="vehicle-kpi-card">
          <span className="vehicle-kpi-label">Total Flota</span>
          <strong>{fleetStats.total}</strong>
        </article>
        <article className="vehicle-kpi-card success">
          <span className="vehicle-kpi-label">Libres</span>
          <strong>{fleetStats.libres}</strong>
        </article>
        <article className="vehicle-kpi-card warning">
          <span className="vehicle-kpi-label">Asignadas</span>
          <strong>{fleetStats.asignadas}</strong>
        </article>
        <article className="vehicle-kpi-card info">
          <span className="vehicle-kpi-label">Tipos de Vehiculo</span>
          <strong>{fleetStats.tipos}</strong>
        </article>
      </div>

      <div className="crud-header fleet-header fleet-header-compact fleet-toolbar-row">
        <div className="header-actions fleet-toolbar">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Buscar por codigo, tipo o sereno..."
              className="search-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            className="table-filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">Todos los estados</option>
            <option value="LIBRE">Libres</option>
            <option value="ASIGNADA">Asignadas</option>
          </select>
          <select
            className="table-filter-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            className="table-filter-select compact"
            value={rowsPerPage}
            onChange={(event) => setRowsPerPage(Number(event.target.value))}
          >
            <option value={8}>8 por pagina</option>
            <option value={12}>12 por pagina</option>
            <option value={20}>20 por pagina</option>
          </select>
          <button
            className="action-btn fleet-action-btn export"
            onClick={handleExportFleet}
            title="Exportar flota"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Exportar Excel
          </button>
          <button className="login-button fleet-primary-btn" onClick={() => openPatrolModal()}>+ Nueva Patrulla</button>
        </div>
      </div>

      <div className="table-toolbar">
        <span className="table-results">
          Mostrando {filteredPatrullas.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}
          {' '}-{' '}
          {Math.min(currentPage * rowsPerPage, filteredPatrullas.length)} de {filteredPatrullas.length} patrullas
        </span>
      </div>

      <div className="table-responsive fleet-table-shell">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Vehiculo</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Sereno actual</th>
              <th>Turno</th>
              <th>Fecha</th>
              <th>Operaciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPatrullas.map((item) => (
              <tr key={item.id_patrulla}>
                <td>
                  <div className="vehicle-cell">
                    <span className="vehicle-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h2m-2 0V8a2 2 0 0 0-2-2h-2l-2-3H7L5 6H3a2 2 0 0 0-2 2v8h2m16 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0M7 16a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0M5 6h10"></path></svg>
                    </span>
                    <div>
                      <strong>{item.codigo}</strong>
                      <span className="vehicle-subtext">{item.id_asignacion ? 'Unidad operativa' : 'Disponible en almacen'}</span>
                    </div>
                  </div>
                </td>
                <td>{item.tipo}</td>
                <td>
                  <span className={`badge ${item.estado_operativo === 'LIBRE' ? 'status-active' : 'status-inactive'}`}>
                    {item.estado_operativo === 'LIBRE' ? 'Libre' : 'Asignada'}
                  </span>
                </td>
                <td>
                  {item.sereno_nombre ? (
                    <div>
                      <strong>{item.sereno_nombre}</strong>
                      <div className="vehicle-subtext">{item.codigo_personal || 'Sin codigo'}</div>
                    </div>
                  ) : (
                    <span className="vehicle-subtext">Sin sereno asignado</span>
                  )}
                </td>
                <td>
                  {item.nombre_turno ? `${item.nombre_turno} (${item.hora_inicio} - ${item.hora_fin})` : 'Sin turno'}
                </td>
                <td>{item.fecha_asignacion ? new Date(item.fecha_asignacion).toLocaleDateString() : '-'}</td>
                <td>
                  <div className="vehicle-actions">
                    {item.estado_operativo === 'LIBRE' ? (
                      <button className="action-btn assign" onClick={() => openAssignmentModal(item, 'assign')} title="Asignar patrulla">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                      </button>
                    ) : (
                      <>
                        <button className="action-btn transfer" onClick={() => openAssignmentModal(item, 'transfer')} title="Transferir a otro sereno">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"></path><path d="M4 7h16"></path><path d="M16 21l4-4-4-4"></path><path d="M20 17H4"></path></svg>
                        </button>
                        <button className="action-btn return" onClick={() => handleReturnToWarehouse(item)} title="Devolver al almacen">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"></path><path d="M4 9h11a4 4 0 1 1 0 8h-1"></path></svg>
                        </button>
                      </>
                    )}
                    <button className="action-btn" onClick={() => setHistoryModalPatrol(item.codigo)} title="Ver historial">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
                    </button>
                    <button className="action-btn edit" onClick={() => openPatrolModal(item)} title="Editar patrulla">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button className="action-btn delete" onClick={() => handleDeletePatrol(item)} title="Eliminar patrulla">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginatedPatrullas.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state-cell">No se encontraron patrullas con los filtros actuales.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {historyModalPatrol && (
        <PatrullaHistorialModal
          patrolCode={historyModalPatrol}
          onClose={() => setHistoryModalPatrol(null)}
        />
      )}

      {isPatrolModalOpen && createPortal(
        <div className="modal-overlay" onClick={resetPatrolModal}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPatrolId ? 'Editar Patrulla' : 'Nueva Patrulla'}</h3>
              <button className="modal-close" onClick={resetPatrolModal}>×</button>
            </div>
            <form onSubmit={handlePatrolSubmit}>
              <div className="modal-body">
                {patrolError && <div className="error-message">{patrolError}</div>}
                <div className="crud-form">
                  <input
                    placeholder="Codigo del vehiculo"
                    value={patrolForm.codigo}
                    onChange={(event) => setPatrolForm({ ...patrolForm, codigo: event.target.value })}
                    required
                  />
                  <input
                    placeholder="Tipo de vehiculo"
                    value={patrolForm.tipo}
                    onChange={(event) => setPatrolForm({ ...patrolForm, tipo: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={resetPatrolModal}>Cancelar</button>
                <button type="submit" className="login-button">{editingPatrolId ? 'Guardar cambios' : 'Crear patrulla'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {assignModal.open && assignModal.patrol && createPortal(
        <div className="modal-overlay" onClick={closeAssignmentModal}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{assignModal.mode === 'assign' ? 'Asignar Patrulla' : 'Transferir Patrulla'}</h3>
              <button className="modal-close" onClick={closeAssignmentModal}>×</button>
            </div>
            <form onSubmit={handleAssignmentSubmit}>
              <div className="modal-body">
                {assignmentError && <div className="error-message">{assignmentError}</div>}

                <div className="vehicle-transfer-panel">
                  <div className="vehicle-transfer-card">
                    <span className="vehicle-transfer-label">Patrulla</span>
                    <strong>{assignModal.patrol.codigo}</strong>
                    <small>{assignModal.patrol.tipo}</small>
                  </div>
                  <div className="vehicle-transfer-card">
                    <span className="vehicle-transfer-label">Estado actual</span>
                    <strong>{assignModal.patrol.estado_operativo === 'LIBRE' ? 'Libre' : 'Asignada'}</strong>
                    <small>{assignModal.patrol.sereno_nombre || 'Sin sereno actual'}</small>
                  </div>
                </div>

                <div className="crud-form" style={{ marginTop: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Buscar sereno por nombre, codigo o DNI..."
                    value={serenoSearch}
                    onChange={(event) => setSerenoSearch(event.target.value)}
                  />
                  <select
                    value={assignForm.id_sereno}
                    onChange={(event) => setAssignForm({ ...assignForm, id_sereno: event.target.value })}
                    required
                  >
                    <option value="">Seleccione un sereno</option>
                    {availableSerenos.map((item) => (
                      <option key={item.id_sereno} value={item.id_sereno}>
                        {item.apellidos}, {item.nombres} - {item.codigo_sereno}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignForm.id_turno}
                    onChange={(event) => setAssignForm({ ...assignForm, id_turno: event.target.value })}
                    required
                  >
                    <option value="">Seleccione un turno</option>
                    {turnos.map((item) => (
                      <option key={item.id_turno} value={item.id_turno}>
                        {item.nombre_turno} ({item.hora_inicio} - {item.hora_fin})
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={assignForm.fecha}
                    onChange={(event) => setAssignForm({ ...assignForm, fecha: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closeAssignmentModal}>Cancelar</button>
                <button type="submit" className="login-button">
                  {assignModal.mode === 'assign' ? 'Confirmar asignacion' : 'Confirmar transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PatrullasModule;
