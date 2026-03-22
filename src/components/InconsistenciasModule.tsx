import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';

interface Inconsistencia {
  id: number;
  usuario_id: number;
  codigo_encontrado: string;
  descripcion: string | null;
  motivo: string | null;
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  foto_ruta: string | null;
  estado: 'PENDIENTE' | 'RESUELTA';
  resolucion: string | null;
  fecha_reporte: string;
  fecha_resolucion: string | null;
  nombre_reportante: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const InconsistenciasModule = () => {
  const [items, setItems] = useState<Inconsistencia[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolverModal, setResolverModal] = useState<Inconsistencia | null>(null);
  const [resolucionText, setResolucionText] = useState('');
  const [fotoModal, setFotoModal] = useState<string | null>(null);
  const [detalleModal, setDetalleModal] = useState<Inconsistencia | null>(null);
  const { notification, showNotification, hideNotification } = useNotification();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: '15' });
      if (filtroEstado) params.append('estado', filtroEstado);
      const res = await fetch(`${API_URL}/almacen/inconsistencias?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error('Error cargando inconsistencias:', err);
      showNotification('Error al cargar inconsistencias.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentPage, filtroEstado]);

  const handleResolver = async () => {
    if (!resolverModal || !resolucionText.trim()) return;
    try {
      const res = await fetch(`${API_URL}/almacen/inconsistencias/${resolverModal.id}/resolver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolucion: resolucionText })
      });
      if (res.ok) {
        showNotification('Inconsistencia marcada como resuelta.', 'success');
        setResolverModal(null);
        setResolucionText('');
        fetchData();
      } else {
        showNotification('Error al resolver inconsistencia.', 'error');
      }
    } catch {
      showNotification('Error de conexión.', 'error');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const baseUrl = API_URL.replace(/\/api\/?$/, '');

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      <div className="crud-header">
        <h2>Inconsistencias de Equipos</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="RESUELTA">Resueltas</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Motivo</th>
              <th>Reportado por</th>
              <th>Ubicación</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay inconsistencias registradas.</td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.codigo_encontrado}</strong></td>
                  <td>{item.descripcion || '-'}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.motivo || '-'}</td>
                  <td>{item.nombre_reportante}</td>
                  <td>{item.ubicacion || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.fecha_reporte)}</td>
                  <td><span className={`badge status-${item.estado.toLowerCase()}`}>{item.estado}</span></td>
                  <td>
                    <button className="action-btn" onClick={() => setDetalleModal(item)} title="Ver detalle">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    {item.estado === 'PENDIENTE' && (
                      <button className="action-btn edit" onClick={() => { setResolverModal(item); setResolucionText(''); }} title="Resolver">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">Mostrando {pagination.page} de {pagination.totalPages} páginas ({pagination.total} registros)</span>
        <div className="pagination-buttons">
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={pagination.page === 1}>Anterior</button>
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page === pagination.totalPages}>Siguiente</button>
        </div>
      </div>

      {/* Modal Detalle */}
      {detalleModal && createPortal(
        <div className="modal-overlay" onClick={() => setDetalleModal(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de Inconsistencia</h3>
              <button className="modal-close" onClick={() => setDetalleModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Código encontrado</label>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '1.1rem' }}>{detalleModal.codigo_encontrado}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Estado</label>
                  <p style={{ margin: '4px 0 0' }}><span className={`badge status-${detalleModal.estado.toLowerCase()}`}>{detalleModal.estado}</span></p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Reportado por</label>
                  <p style={{ margin: '4px 0 0' }}>{detalleModal.nombre_reportante}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Fecha reporte</label>
                  <p style={{ margin: '4px 0 0' }}>{formatDate(detalleModal.fecha_reporte)}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Descripción del equipo</label>
                  <p style={{ margin: '4px 0 0' }}>{detalleModal.descripcion || 'Sin descripción'}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Motivo</label>
                  <p style={{ margin: '4px 0 0' }}>{detalleModal.motivo || 'Sin motivo especificado'}</p>
                </div>
                {detalleModal.ubicacion && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Ubicación</label>
                    <p style={{ margin: '4px 0 0' }}>
                      {detalleModal.ubicacion}
                      {detalleModal.latitud && detalleModal.longitud && (
                        <a href={`https://www.google.com/maps?q=${detalleModal.latitud},${detalleModal.longitud}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', color: 'var(--primary-500)', fontSize: '0.8rem' }}>
                          Ver en mapa ↗
                        </a>
                      )}
                    </p>
                  </div>
                )}
                {detalleModal.foto_ruta && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Foto evidencia</label>
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={`${baseUrl}/${detalleModal.foto_ruta}`}
                        alt="Evidencia"
                        style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-light)' }}
                        onClick={() => setFotoModal(`${baseUrl}/${detalleModal.foto_ruta}`)}
                      />
                    </div>
                  </div>
                )}
                {detalleModal.estado === 'RESUELTA' && (
                  <>
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Resolución</label>
                      <p style={{ margin: '4px 0 0' }}>{detalleModal.resolucion}</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Fecha resolución</label>
                      <p style={{ margin: '4px 0 0' }}>{detalleModal.fecha_resolucion ? formatDate(detalleModal.fecha_resolucion) : '-'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {detalleModal.estado === 'PENDIENTE' && (
                <button className="login-button" onClick={() => { setResolverModal(detalleModal); setDetalleModal(null); setResolucionText(''); }}>Resolver</button>
              )}
              <button type="button" className="cancel-btn" onClick={() => setDetalleModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Resolver */}
      {resolverModal && createPortal(
        <div className="modal-overlay" onClick={() => setResolverModal(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Resolver Inconsistencia</h3>
              <button className="modal-close" onClick={() => setResolverModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '8px' }}>Código: <strong>{resolverModal.codigo_encontrado}</strong></p>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{resolverModal.motivo || resolverModal.descripcion || 'Sin detalle'}</p>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>¿Cómo se resolvió?</label>
              <textarea
                value={resolucionText}
                onChange={e => setResolucionText(e.target.value)}
                placeholder="Ej: Se registró el equipo en el sistema / Se descartó por duplicado / Se reasignó código..."
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)', resize: 'vertical', fontSize: '0.85rem' }}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="cancel-btn" onClick={() => setResolverModal(null)}>Cancelar</button>
              <button className="login-button" onClick={handleResolver} disabled={!resolucionText.trim()}>Marcar como Resuelta</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Foto */}
      {fotoModal && createPortal(
        <div className="modal-overlay" onClick={() => setFotoModal(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={fotoModal} alt="Foto evidencia" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px' }} onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default InconsistenciasModule;
