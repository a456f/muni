import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import './PersonalModule.css';

interface Area {
  id: number;
  nombre: string;
}

interface Sector {
  id_sector: number;
  nombre: string;
  nombre_zona?: string;
}

interface Personal {
  id: number;
  id_personal?: number;
  codigo_personal?: string;
  nombres?: string;
  apellidos?: string;
  nombre: string;
  area_id: number | null;
  area_nombre: string | null;
  sector_id: number | null;
  sector_nombre: string | null;
  zona_nombre: string | null;
}

interface PersonalAreasModuleProps {
  title?: string;
}

const PersonalAreasModule = ({ title = 'Gestión de Personal' }: PersonalAreasModuleProps) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [personas, setPersonas] = useState<Personal[]>([]);
  const [activeTab, setActiveTab] = useState<'areas' | 'personal'>('personal');
  const [personalSearch, setPersonalSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<'all' | 'with-area' | 'without-area'>('all');
  const [personalRowsPerPage, setPersonalRowsPerPage] = useState(8);
  const [areaRowsPerPage, setAreaRowsPerPage] = useState(8);
  const [personalPage, setPersonalPage] = useState(1);
  const [areaPage, setAreaPage] = useState(1);
  const { notification, showNotification, hideNotification } = useNotification();

  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaForm, setAreaForm] = useState({ nombre: '' });
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);

  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [personaForm, setPersonaForm] = useState({ nombre: '', area_id: '', sector_id: '' });
  const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [resAreas, resPersonas, resSectores] = await Promise.all([
        fetch(`${API_URL}/areas`),
        fetch(`${API_URL}/personas`),
        fetch(`${API_URL}/sectores`)
      ]);

      if (resAreas.ok) setAreas(await resAreas.json());
      if (resPersonas.ok) setPersonas(await resPersonas.json());
      if (resSectores.ok) setSectores(await resSectores.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error al cargar los datos.', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const personalStats = useMemo(() => {
    const conArea = personas.filter((persona) => persona.area_id).length;
    const sinArea = personas.length - conArea;

    return {
      total: personas.length,
      conArea,
      sinArea,
      totalAreas: areas.length
    };
  }, [areas.length, personas]);

  const filteredPersonas = useMemo(() => {
    const normalizedSearch = personalSearch.trim().toLowerCase();

    return personas.filter((persona) => {
      const matchesSearch =
        !normalizedSearch ||
        (persona.codigo_personal || '').toLowerCase().includes(normalizedSearch) ||
        persona.nombre.toLowerCase().includes(normalizedSearch) ||
        (persona.area_nombre || 'sin area').toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (areaFilter === 'with-area') {
        return Boolean(persona.area_id);
      }

      if (areaFilter === 'without-area') {
        return !persona.area_id;
      }

      return true;
    });
  }, [areaFilter, personalSearch, personas]);

  const filteredAreas = useMemo(() => {
    const normalizedSearch = areaSearch.trim().toLowerCase();

    return areas.filter((area) => {
      if (!normalizedSearch) {
        return true;
      }

      const assignedCount = personas.filter((persona) => persona.area_id === area.id).length;
      return (
        area.nombre.toLowerCase().includes(normalizedSearch) ||
        String(area.id).includes(normalizedSearch) ||
        String(assignedCount).includes(normalizedSearch)
      );
    });
  }, [areaSearch, areas, personas]);

  const personalTotalPages = Math.max(1, Math.ceil(filteredPersonas.length / personalRowsPerPage));
  const areaTotalPages = Math.max(1, Math.ceil(filteredAreas.length / areaRowsPerPage));

  const paginatedPersonas = useMemo(() => {
    const startIndex = (personalPage - 1) * personalRowsPerPage;
    return filteredPersonas.slice(startIndex, startIndex + personalRowsPerPage);
  }, [filteredPersonas, personalPage, personalRowsPerPage]);

  const paginatedAreas = useMemo(() => {
    const startIndex = (areaPage - 1) * areaRowsPerPage;
    return filteredAreas.slice(startIndex, startIndex + areaRowsPerPage);
  }, [areaPage, areaRowsPerPage, filteredAreas]);

  useEffect(() => {
    setPersonalPage(1);
  }, [personalSearch, areaFilter, personalRowsPerPage]);

  useEffect(() => {
    setAreaPage(1);
  }, [areaSearch, areaRowsPerPage]);

  useEffect(() => {
    if (personalPage > personalTotalPages) {
      setPersonalPage(personalTotalPages);
    }
  }, [personalPage, personalTotalPages]);

  useEffect(() => {
    if (areaPage > areaTotalPages) {
      setAreaPage(areaTotalPages);
    }
  }, [areaPage, areaTotalPages]);

  const openAreaModal = (area?: Area) => {
    if (area) {
      setAreaForm({ nombre: area.nombre });
      setEditingAreaId(area.id);
    } else {
      setAreaForm({ nombre: '' });
      setEditingAreaId(null);
    }
    setIsAreaModalOpen(true);
  };

  const handleAreaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = editingAreaId ? `${API_URL}/areas/${editingAreaId}` : `${API_URL}/areas`;
    const method = editingAreaId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaForm)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Error al guardar el area.');
      }

      setIsAreaModalOpen(false);
      fetchData();
      showNotification(`Área ${editingAreaId ? 'actualizada' : 'creada'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleAreaDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta área? El personal asignado quedará sin área.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/areas/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Error al eliminar el área.');
      }

      fetchData();
      showNotification('Área eliminada con éxito.', 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openPersonaModal = (persona?: Personal) => {
    if (persona) {
      setPersonaForm({ nombre: persona.nombre, area_id: persona.area_id?.toString() || '', sector_id: persona.sector_id?.toString() || '' });
      setEditingPersonaId(persona.id);
    } else {
      setPersonaForm({ nombre: '', area_id: '', sector_id: '' });
      setEditingPersonaId(null);
    }
    setIsPersonaModalOpen(true);
  };

  const handlePersonaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = editingPersonaId ? `${API_URL}/personas/${editingPersonaId}` : `${API_URL}/personas`;
    const method = editingPersonaId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personaForm)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Error al guardar el personal.');
      }

      setIsPersonaModalOpen(false);
      fetchData();
      showNotification(`Personal ${editingPersonaId ? 'actualizado' : 'creado'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleQuickAreaUpdate = async (persona: Personal, areaId: string) => {
    try {
      const response = await fetch(`${API_URL}/personas/${persona.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: persona.nombre,
          area_id: areaId
        })
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'No se pudo actualizar el área.');
      }

      fetchData();
      showNotification(`Área actualizada para ${persona.nombre}.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleExportAreas = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Areas');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre Area', key: 'nombre', width: 40 },
      { header: 'Personal Asignado', key: 'asignados', width: 20 }
    ];

    const areaRows = areas.map((area) => ({
      ...area,
      asignados: personas.filter((persona) => persona.area_id === area.id).length
    }));

    worksheet.addRows(areaRows);
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'areas.xlsx');
  };

  const handleExportPersonas = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Personal');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Codigo', key: 'codigo_personal', width: 18 },
      { header: 'Nombre', key: 'nombre', width: 40 },
      { header: 'Area', key: 'area_nombre', width: 30 }
    ];

    worksheet.addRows(personas.map((persona) => ({ ...persona, area_nombre: persona.area_nombre || 'Sin área' })));
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'personal.xlsx');
  };

  return (
    <div className="personal-areas-container">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-module">
        <div className="crud-header">
          <div>
            <h2>{title}</h2>
          </div>
        </div>

        <div className="sub-nav" style={{ marginTop: '1rem' }}>
          <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>Personal</button>
          <button className={activeTab === 'areas' ? 'active' : ''} onClick={() => setActiveTab('areas')}>Áreas</button>
        </div>

        {activeTab === 'personal' && (
          <>
            <div className="stats-grid" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <div className="stat-card">
                <h3>Total personal</h3>
                <p className="stat-number">{personalStats.total}</p>
              </div>
              <div className="stat-card">
                <h3>Con área</h3>
                <p className="stat-number" style={{ color: '#10b981' }}>{personalStats.conArea}</p>
              </div>
              <div className="stat-card">
                <h3>Sin área</h3>
                <p className="stat-number" style={{ color: '#f59e0b' }}>{personalStats.sinArea}</p>
              </div>
              <div className="stat-card">
                <h3>Áreas creadas</h3>
                <p className="stat-number" style={{ color: '#3b82f6' }}>{personalStats.totalAreas}</p>
              </div>
            </div>

            <div className="crud-header">
              <h2>Gestión de Personal</h2>
              <div className="header-actions">
                <div className="search-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Buscar por codigo, nombre o area..."
                    className="search-input"
                    value={personalSearch}
                    onChange={(event) => setPersonalSearch(event.target.value)}
                  />
                </div>
                <select
                  className="table-filter-select"
                  value={areaFilter}
                  onChange={(event) => setAreaFilter(event.target.value as typeof areaFilter)}
                >
                  <option value="all">Todo el personal</option>
                  <option value="with-area">Con area</option>
                  <option value="without-area">Sin area</option>
                </select>
                <select
                  className="table-filter-select compact"
                  value={personalRowsPerPage}
                  onChange={(event) => setPersonalRowsPerPage(Number(event.target.value))}
                >
                  <option value={8}>8 por pagina</option>
                  <option value={12}>12 por pagina</option>
                  <option value={20}>20 por pagina</option>
                </select>
                <button className="action-btn" onClick={handleExportPersonas} title="Descargar reporte en Excel" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Exportar Excel
                </button>
                <button className="login-button" onClick={() => openPersonaModal()}>+ Nuevo Personal</button>
              </div>
            </div>

            <div className="table-toolbar">
              <span className="table-results">
                Mostrando {filteredPersonas.length === 0 ? 0 : (personalPage - 1) * personalRowsPerPage + 1}
                {' '}-{' '}
                {Math.min(personalPage * personalRowsPerPage, filteredPersonas.length)} de {filteredPersonas.length} registros
              </span>
            </div>

            <div className="table-responsive">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Área</th>
                    <th>Sector</th>
                    <th>Asignar área</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPersonas.map((persona) => (
                    <tr key={persona.id}>
                      <td>{persona.codigo_personal || `P-${persona.id}`}</td>
                      <td>{persona.nombre}</td>
                      <td>{persona.area_nombre || <span style={{color:'var(--text-muted)'}}>-</span>}</td>
                      <td>{persona.sector_nombre ? <span>{persona.sector_nombre} <small style={{color:'var(--text-muted)'}}>({persona.zona_nombre})</small></span> : <span style={{color:'var(--text-muted)'}}>-</span>}</td>
                      <td>
                        <select
                          className="table-filter-select row-select"
                          value={persona.area_id?.toString() || ''}
                          onChange={(event) => handleQuickAreaUpdate(persona, event.target.value)}
                        >
                          <option value="">-- Sin área --</option>
                          {areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="action-btn edit" onClick={() => openPersonaModal(persona)} title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedPersonas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-state-cell">
                        No se encontraron personas con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPersonalPage((page) => Math.max(1, page - 1))}
                disabled={personalPage === 1}
              >
                Anterior
              </button>
              <span className="pagination-info">Página {personalPage} de {personalTotalPages}</span>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPersonalPage((page) => Math.min(personalTotalPages, page + 1))}
                disabled={personalPage === personalTotalPages}
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {activeTab === 'areas' && (
          <>
            <div className="crud-header" style={{ marginTop: '1rem' }}>
              <h2>Gestión de Áreas</h2>
              <div className="header-actions">
                <div className="search-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Buscar por area, ID o cantidad..."
                    className="search-input"
                    value={areaSearch}
                    onChange={(event) => setAreaSearch(event.target.value)}
                  />
                </div>
                <select
                  className="table-filter-select compact"
                  value={areaRowsPerPage}
                  onChange={(event) => setAreaRowsPerPage(Number(event.target.value))}
                >
                  <option value={8}>8 por pagina</option>
                  <option value={12}>12 por pagina</option>
                  <option value={20}>20 por pagina</option>
                </select>
                <button className="action-btn" onClick={handleExportAreas} title="Descargar reporte en Excel" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Exportar Excel
                </button>
                <button className="login-button" onClick={() => openAreaModal()}>+ Nueva Área</button>
              </div>
            </div>

            <div className="table-toolbar">
              <span className="table-results">
                Mostrando {filteredAreas.length === 0 ? 0 : (areaPage - 1) * areaRowsPerPage + 1}
                {' '}-{' '}
                {Math.min(areaPage * areaRowsPerPage, filteredAreas.length)} de {filteredAreas.length} áreas
              </span>
            </div>

            <div className="table-responsive">
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Personal asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAreas.map((area) => (
                    <tr key={area.id}>
                      <td>{area.id}</td>
                      <td>{area.nombre}</td>
                      <td>{personas.filter((persona) => persona.area_id === area.id).length}</td>
                      <td>
                        <button className="action-btn edit" onClick={() => openAreaModal(area)} title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button className="action-btn delete" onClick={() => handleAreaDelete(area.id)} title="Eliminar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedAreas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-state-cell">
                        No se encontraron áreas con el criterio actual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setAreaPage((page) => Math.max(1, page - 1))}
                disabled={areaPage === 1}
              >
                Anterior
              </button>
              <span className="pagination-info">Página {areaPage} de {areaTotalPages}</span>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setAreaPage((page) => Math.min(areaTotalPages, page + 1))}
                disabled={areaPage === areaTotalPages}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>

      {isAreaModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsAreaModalOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAreaId ? 'Editar' : 'Nueva'} Área</h3>
              <button className="modal-close" onClick={() => setIsAreaModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAreaSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <input placeholder="Nombre del Área" value={areaForm.nombre} onChange={(event) => setAreaForm({ ...areaForm, nombre: event.target.value })} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsAreaModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingAreaId ? 'Guardar Cambios' : 'Crear Área'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isPersonaModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsPersonaModalOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPersonaId ? 'Editar' : 'Nuevo'} Personal</h3>
              <button className="modal-close" onClick={() => setIsPersonaModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handlePersonaSubmit}>
              <div className="modal-body">
                <div className="crud-form">
                  <input placeholder="Nombre Completo" value={personaForm.nombre} onChange={(event) => setPersonaForm({ ...personaForm, nombre: event.target.value })} required />
                  <select value={personaForm.area_id} onChange={(event) => setPersonaForm({ ...personaForm, area_id: event.target.value })}>
                    <option value="">-- Sin Área --</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
                  </select>
                  <select value={personaForm.sector_id} onChange={(event) => setPersonaForm({ ...personaForm, sector_id: event.target.value })}>
                    <option value="">-- Sin Sector (opcional) --</option>
                    {sectores.map((s) => <option key={s.id_sector} value={s.id_sector}>{s.nombre} ({s.nombre_zona})</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsPersonaModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">{editingPersonaId ? 'Guardar Cambios' : 'Crear Personal'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PersonalAreasModule;
