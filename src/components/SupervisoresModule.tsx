import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';

interface Supervisor {
  id_personal: number;
  codigo_personal: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  serenos_asignados: number;
}

interface Sereno {
  id_personal: number;
  codigo_personal: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
}

interface Asignacion {
  id_asignacion: number;
  fecha_asignacion: string;
  observaciones: string | null;
  id_personal: number;
  codigo_personal: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
}

interface Historial {
  id: number;
  accion: string;
  fecha: string;
  detalle: string;
  nombre_supervisor: string;
  nombre_sereno: string;
}

const SupervisoresModule = () => {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [serenosDisponibles, setSerenosDisponibles] = useState<Sereno[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [serenosAsignados, setSerenosAsignados] = useState<Asignacion[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [activeTab, setActiveTab] = useState<'asignaciones' | 'historial'>('asignaciones');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [asignForm, setAsignForm] = useState({ sereno_id: '', observaciones: '' });
  const { notification, showNotification, hideNotification } = useNotification();

  // Búsquedas y paginación
  const [supSearch, setSupSearch] = useState('');
  const [serenoSearch, setSerenoSearch] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [serenoPage, setSerenoPage] = useState(1);
  const [histPage, setHistPage] = useState(1);
  const serenoPerPage = 10;
  const histPerPage = 15;

  const fetchSupervisores = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisores`);
      if (res.ok) setSupervisores(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSerenosDisponibles = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisores/serenos-disponibles`);
      if (res.ok) setSerenosDisponibles(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSerenosAsignados = async (supId: number) => {
    try {
      const res = await fetch(`${API_URL}/supervisores/${supId}/serenos`);
      if (res.ok) {
        setSerenosAsignados(await res.json());
        setSerenoPage(1);
      }
    } catch (err) { console.error(err); }
  };

  const fetchHistorial = async () => {
    try {
      const res = await fetch(`${API_URL}/supervisores/historial`);
      if (res.ok) setHistorial(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchSupervisores(); fetchHistorial(); }, []);

  const selectSupervisor = (sup: Supervisor) => {
    setSelectedSupervisor(sup);
    fetchSerenosAsignados(sup.id_personal);
    fetchSerenosDisponibles();
    setSerenoSearch('');
  };

  const refreshAll = () => {
    if (selectedSupervisor) fetchSerenosAsignados(selectedSupervisor.id_personal);
    fetchSupervisores();
    fetchSerenosDisponibles();
    fetchHistorial();
  };

  const handleAsignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisor || !asignForm.sereno_id) return;
    try {
      const res = await fetch(`${API_URL}/supervisores/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisor_id: selectedSupervisor.id_personal,
          sereno_id: parseInt(asignForm.sereno_id),
          observaciones: asignForm.observaciones || null
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al asignar');
      showNotification('Sereno asignado correctamente.', 'success');
      setIsModalOpen(false);
      setAsignForm({ sereno_id: '', observaciones: '' });
      refreshAll();
    } catch (err: any) { showNotification(err.message, 'error'); }
  };

  const handleDesasignar = async (idAsignacion: number) => {
    if (!window.confirm('¿Desasignar este sereno del supervisor?')) return;
    try {
      const res = await fetch(`${API_URL}/supervisores/desasignar/${idAsignacion}`, { method: 'PUT' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      showNotification('Sereno desasignado correctamente.', 'success');
      refreshAll();
    } catch (err: any) { showNotification(err.message, 'error'); }
  };

  // --- Stats ---
  const stats = useMemo(() => {
    const totalSerenos = supervisores.reduce((a, s) => a + s.serenos_asignados, 0);
    return {
      totalSupervisores: supervisores.length,
      totalSerenos,
      promedio: supervisores.length ? Math.round(totalSerenos / supervisores.length) : 0,
      disponibles: serenosDisponibles.length
    };
  }, [supervisores, serenosDisponibles]);

  // --- Filtered supervisores ---
  const filteredSupervisores = useMemo(() => {
    const q = supSearch.toLowerCase().trim();
    if (!q) return supervisores;
    return supervisores.filter(s =>
      s.nombre_completo.toLowerCase().includes(q) ||
      (s.codigo_personal || '').toLowerCase().includes(q)
    );
  }, [supervisores, supSearch]);

  // --- Filtered y paginado serenos asignados ---
  const filteredSerenos = useMemo(() => {
    const q = serenoSearch.toLowerCase().trim();
    if (!q) return serenosAsignados;
    return serenosAsignados.filter(s =>
      s.nombre_completo.toLowerCase().includes(q) ||
      (s.codigo_personal || '').toLowerCase().includes(q)
    );
  }, [serenosAsignados, serenoSearch]);

  const serenoTotalPages = Math.max(1, Math.ceil(filteredSerenos.length / serenoPerPage));
  const paginatedSerenos = filteredSerenos.slice((serenoPage - 1) * serenoPerPage, serenoPage * serenoPerPage);

  // --- Filtered y paginado historial ---
  const filteredHistorial = useMemo(() => {
    const q = histSearch.toLowerCase().trim();
    if (!q) return historial;
    return historial.filter(h =>
      h.nombre_supervisor.toLowerCase().includes(q) ||
      h.nombre_sereno.toLowerCase().includes(q) ||
      h.accion.toLowerCase().includes(q) ||
      (h.detalle || '').toLowerCase().includes(q)
    );
  }, [historial, histSearch]);

  const histTotalPages = Math.max(1, Math.ceil(filteredHistorial.length / histPerPage));
  const paginatedHistorial = filteredHistorial.slice((histPage - 1) * histPerPage, histPage * histPerPage);

  useEffect(() => { setSerenoPage(1); }, [serenoSearch]);
  useEffect(() => { setHistPage(1); }, [histSearch]);

  // --- Colores para los avatares ---
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const getColor = (i: number) => colors[i % colors.length];
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>Gestión de Supervisores</h2>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <div className="stat-card">
          <h3>Supervisores</h3>
          <p className="stat-number" style={{ color: '#3b82f6' }}>{stats.totalSupervisores}</p>
        </div>
        <div className="stat-card">
          <h3>Serenos Asignados</h3>
          <p className="stat-number" style={{ color: '#10b981' }}>{stats.totalSerenos}</p>
        </div>
        <div className="stat-card">
          <h3>Promedio por Sup.</h3>
          <p className="stat-number" style={{ color: '#f59e0b' }}>{stats.promedio}</p>
        </div>
        <div className="stat-card">
          <h3>Serenos Disponibles</h3>
          <p className="stat-number" style={{ color: '#8b5cf6' }}>{stats.disponibles}</p>
        </div>
      </div>

      <div className="sub-nav">
        <button className={activeTab === 'asignaciones' ? 'active' : ''} onClick={() => setActiveTab('asignaciones')}>Asignaciones</button>
        <button className={activeTab === 'historial' ? 'active' : ''} onClick={() => { setActiveTab('historial'); fetchHistorial(); }}>Historial</button>
      </div>

      {/* ============ TAB ASIGNACIONES ============ */}
      {activeTab === 'asignaciones' && (
        <div className="supervisores-layout">
          {/* Panel izquierdo - Supervisores */}
          <div style={{ background: 'var(--bg-card, #fff)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-input, #f8fafc)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>Supervisores ({filteredSupervisores.length})</h3>
              <div className="search-wrapper" style={{ width: '100%' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar supervisor..." className="search-input" value={supSearch} onChange={e => setSupSearch(e.target.value)} style={{ fontSize: '0.85rem' }} />
              </div>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {filteredSupervisores.map((sup, i) => (
                <div
                  key={sup.id_personal}
                  onClick={() => selectSupervisor(sup)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color, #f1f5f9)',
                    background: selectedSupervisor?.id_personal === sup.id_personal ? 'var(--bg-hover, #e0f2fe)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: getColor(i),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                  }}>
                    {getInitials(sup.nombre_completo)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sup.nombre_completo}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>{sup.codigo_personal}</div>
                  </div>
                  <div style={{
                    background: sup.serenos_asignados > 0 ? '#dcfce7' : '#f1f5f9',
                    color: sup.serenos_asignados > 0 ? '#16a34a' : '#94a3b8',
                    fontWeight: 700, fontSize: '0.8rem', borderRadius: '12px',
                    padding: '2px 10px', minWidth: 28, textAlign: 'center'
                  }}>
                    {sup.serenos_asignados}
                  </div>
                </div>
              ))}
              {filteredSupervisores.length === 0 && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
                  {supSearch ? 'Sin resultados.' : 'No hay supervisores. Asigne el rol "supervisor_sereno" desde Configuración.'}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho - Serenos del supervisor */}
          <div style={{ background: 'var(--bg-card, #fff)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
            {selectedSupervisor ? (
              <>
                {/* Header con info del supervisor */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-input, #f8fafc)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                      {selectedSupervisor.nombre_completo}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.85rem' }}>
                        {serenosAsignados.length} sereno{serenosAsignados.length !== 1 ? 's' : ''}
                      </span>
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="search-wrapper">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" placeholder="Buscar sereno..." className="search-input" value={serenoSearch} onChange={e => setSerenoSearch(e.target.value)} style={{ fontSize: '0.85rem', minWidth: '120px', flex: 1 }} />
                    </div>
                    <button className="login-button" style={{ whiteSpace: 'nowrap', padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => { fetchSerenosDisponibles(); setIsModalOpen(true); }}>+ Asignar</button>
                  </div>
                </div>

                {/* Tabla de serenos */}
                <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                  <table className="crud-table" style={{ marginBottom: 0 }}>
                    <thead><tr><th style={{ width: 50 }}>#</th><th>Código</th><th>Nombre</th><th>Asignado</th><th>Observaciones</th><th style={{ width: 60 }}>Acción</th></tr></thead>
                    <tbody>
                      {paginatedSerenos.map((s, idx) => (
                        <tr key={s.id_asignacion}>
                          <td style={{ color: 'var(--text-muted)' }}>{(serenoPage - 1) * serenoPerPage + idx + 1}</td>
                          <td><code style={{ background: 'var(--bg-input, #f1f5f9)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>{s.codigo_personal}</code></td>
                          <td style={{ fontWeight: 500 }}>{s.nombre_completo}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(s.fecha_asignacion).toLocaleDateString()}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.observaciones || '-'}</td>
                          <td>
                            <button className="action-btn delete" onClick={() => handleDesasignar(s.id_asignacion)} title="Desasignar">
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paginatedSerenos.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{serenoSearch ? 'Sin resultados.' : 'No tiene serenos asignados.'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginación serenos */}
                {filteredSerenos.length > serenoPerPage && (
                  <div className="table-pagination" style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', padding: '8px 14px' }}>
                    <button type="button" className="pagination-btn" onClick={() => setSerenoPage(p => Math.max(1, p - 1))} disabled={serenoPage === 1}>Anterior</button>
                    <span className="pagination-info">Pág. {serenoPage} de {serenoTotalPages} ({filteredSerenos.length} serenos)</span>
                    <button type="button" className="pagination-btn" onClick={() => setSerenoPage(p => Math.min(serenoTotalPages, p + 1))} disabled={serenoPage === serenoTotalPages}>Siguiente</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted, #94a3b8)', gap: '12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span style={{ fontSize: '0.95rem' }}>Seleccione un supervisor de la lista</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB HISTORIAL ============ */}
      {activeTab === 'historial' && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{filteredHistorial.length} registro{filteredHistorial.length !== 1 ? 's' : ''}</span>
            <div className="search-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Buscar en historial..." className="search-input" value={histSearch} onChange={e => setHistSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-responsive">
            <table className="crud-table">
              <thead><tr><th style={{ width: 50 }}>#</th><th>Fecha</th><th>Acción</th><th>Supervisor</th><th>Sereno</th><th>Detalle</th></tr></thead>
              <tbody>
                {paginatedHistorial.map((h, idx) => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{(histPage - 1) * histPerPage + idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(h.fecha).toLocaleString()}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                        background: h.accion === 'ASIGNADO' ? '#dcfce7' : h.accion === 'DESASIGNADO' ? '#fee2e2' : '#e0f2fe',
                        color: h.accion === 'ASIGNADO' ? '#16a34a' : h.accion === 'DESASIGNADO' ? '#dc2626' : '#2563eb'
                      }}>
                        {h.accion}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{h.nombre_supervisor}</td>
                    <td>{h.nombre_sereno}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.detalle}</td>
                  </tr>
                ))}
                {paginatedHistorial.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{histSearch ? 'Sin resultados.' : 'No hay historial aún.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredHistorial.length > histPerPage && (
            <div className="table-pagination">
              <button type="button" className="pagination-btn" onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}>Anterior</button>
              <span className="pagination-info">Pág. {histPage} de {histTotalPages}</span>
              <button type="button" className="pagination-btn" onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))} disabled={histPage === histTotalPages}>Siguiente</button>
            </div>
          )}
        </div>
      )}

      {/* ============ MODAL ASIGNAR ============ */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Asignar Sereno</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAsignar}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-input, #f8fafc)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
                  <strong>Supervisor:</strong> {selectedSupervisor?.nombre_completo}
                </div>
                <div className="crud-form">
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sereno disponible</label>
                  <select value={asignForm.sereno_id} onChange={e => setAsignForm({ ...asignForm, sereno_id: e.target.value })} required>
                    <option value="">-- Seleccione un sereno --</option>
                    {serenosDisponibles.map(s => (
                      <option key={s.id_personal} value={s.id_personal}>{s.nombre_completo} ({s.codigo_personal})</option>
                    ))}
                  </select>
                  {serenosDisponibles.length === 0 && (
                    <p style={{ color: '#f59e0b', fontSize: '0.82rem', margin: '4px 0' }}>Todos los serenos ya están asignados.</p>
                  )}
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '8px' }}>Observaciones</label>
                  <textarea value={asignForm.observaciones} onChange={e => setAsignForm({ ...asignForm, observaciones: e.target.value })} placeholder="Ej: Turno nocturno, zona 5..." rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button" disabled={serenosDisponibles.length === 0}>Asignar Sereno</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SupervisoresModule;
