import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';

interface Denuncia {
  id: number;
  numero_denuncia: string;
  tipo_incidencia: string;
  descripcion: string;
  lugar_hecho: string;
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
  es_anonimo: number;
  estado: string;
  fecha_registro: string;
  fecha_actualizacion: string | null;
  nombre_ciudadano: string | null;
  dni_ciudadano: string | null;
  telefono_ciudadano: string | null;
  total_fotos: number;
}

interface Foto { id: number; ruta: string; tipo_archivo: string | null; fecha_subida: string | null; }
interface Seguimiento { id: number; mensaje: string; estado_nuevo: string | null; tipo_autor: string; fecha: string; respondido_por: string | null; }
interface DetalleDenuncia { denuncia: Denuncia; fotos: Foto[]; seguimientos: Seguimiento[]; }

const ESTADOS = ['RECIBIDO', 'EN REVISION', 'EN PROCESO', 'ATENDIDO', 'RECHAZADO', 'ARCHIVADO'];
const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  'RECIBIDO': { bg: '#DBEAFE', text: '#1E40AF' },
  'EN REVISION': { bg: '#FEF3C7', text: '#92400E' },
  'EN PROCESO': { bg: '#FED7AA', text: '#9A3412' },
  'ATENDIDO': { bg: '#D1FAE5', text: '#065F46' },
  'RECHAZADO': { bg: '#FEE2E2', text: '#991B1B' },
  'ARCHIVADO': { bg: '#E5E7EB', text: '#374151' },
};

const BASE = API_URL.replace(/\/api\/?$/, '');

const DenunciasCiudadanoModule: React.FC = () => {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Detalle modal
  const [detalle, setDetalle] = useState<DetalleDenuncia | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Galería fotos
  const [fotoGaleria, setFotoGaleria] = useState<{ fotos: string[]; index: number } | null>(null);

  const fetchDenuncias = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (search) params.set('q', search);
      if (filtroEstado) params.set('estado', filtroEstado);
      const res = await fetch(`${API_URL}/ciudadano/denuncias?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDenuncias(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchDenuncias(); }, [page, filtroEstado]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchDenuncias(); };

  const openDetalle = async (id: number) => {
    setDetalleLoading(true);
    setDetalle(null);
    try {
      const res = await fetch(`${API_URL}/ciudadano/denuncia/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetalle(data);
        setNuevoEstado(data.denuncia.estado);
      }
    } catch (err) { console.error(err); }
    setDetalleLoading(false);
  };

  const enviarRespuesta = async () => {
    if (!detalle || !respuesta.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/ciudadano/denuncia/${detalle.denuncia.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: 1, // TODO: usar usuario logueado
          mensaje: respuesta,
          estado_nuevo: nuevoEstado !== detalle.denuncia.estado ? nuevoEstado : null
        })
      });
      if (res.ok) {
        setRespuesta('');
        openDetalle(detalle.denuncia.id);
        fetchDenuncias();
      }
    } catch (err) { console.error(err); }
    setEnviando(false);
  };

  const estadoBadge = (estado: string) => {
    const c = ESTADO_COLORS[estado] || { bg: '#E5E7EB', text: '#374151' };
    return (
      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
        {estado}
      </span>
    );
  };

  return (
    <div className="crud-module">
      <div className="crud-header">
        <h2>Denuncias Ciudadanas</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{total} registros</span>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <input type="text" placeholder="Buscar por número, DNI, nombre, lugar..." value={search}
            onChange={e => setSearch(e.target.value)} className="crud-search"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
          <button type="submit" className="login-button" style={{ padding: '8px 16px' }}>Buscar</button>
        </form>
        <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Stats rápidos */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', flexWrap: 'wrap' }}>
        {ESTADOS.slice(0, 4).map(e => {
          const count = denuncias.filter(d => d.estado === e).length;
          const c = ESTADO_COLORS[e];
          return (
            <div key={e} onClick={() => { setFiltroEstado(e === filtroEstado ? '' : e); setPage(1); }}
              style={{ padding: '6px 14px', borderRadius: '20px', background: c.bg, color: c.text, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: filtroEstado === e ? `2px solid ${c.text}` : '2px solid transparent' }}>
              {e}: {count}
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table className="crud-table">
          <thead>
            <tr>
              <th>N° Denuncia</th>
              <th>Ciudadano</th>
              <th>Tipo</th>
              <th>Lugar</th>
              <th>Estado</th>
              <th>Fotos</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td></tr>
            ) : denuncias.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay denuncias</td></tr>
            ) : denuncias.map(d => (
              <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => openDetalle(d.id)}>
                <td><strong style={{ color: 'var(--primary, #2E7D32)' }}>{d.numero_denuncia}</strong></td>
                <td>
                  {d.es_anonimo ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Anónimo</span>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.nombre_ciudadano}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.dni_ciudadano} | {d.telefono_ciudadano}</div>
                    </div>
                  )}
                </td>
                <td style={{ fontSize: '0.85rem' }}>{d.tipo_incidencia}</td>
                <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.lugar_hecho}</td>
                <td>{estadoBadge(d.estado)}</td>
                <td style={{ textAlign: 'center' }}>{d.total_fotos > 0 ? `${d.total_fotos}` : '-'}</td>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{d.fecha_registro?.replace('T', ' ').slice(0, 16)}</td>
                <td>
                  <button className="action-btn edit" onClick={e => { e.stopPropagation(); openDetalle(d.id); }}
                    title="Ver detalle" style={{ padding: '4px 10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px' }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="login-button" style={{ padding: '6px 14px', opacity: page <= 1 ? 0.5 : 1 }}>Anterior</button>
          <span style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="login-button" style={{ padding: '6px 14px', opacity: page >= totalPages ? 0.5 : 1 }}>Siguiente</button>
        </div>
      )}

      {/* Modal Detalle */}
      {(detalle || detalleLoading) && createPortal(
        <div className="modal-overlay" onClick={() => { setDetalle(null); setRespuesta(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>{detalle?.denuncia.numero_denuncia || 'Cargando...'}</h3>
              <button className="modal-close" onClick={() => { setDetalle(null); setRespuesta(''); }}>×</button>
            </div>

            {detalleLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando detalle...</div>
            ) : detalle && (
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                {/* Info principal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  {estadoBadge(detalle.denuncia.estado)}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{detalle.denuncia.fecha_registro?.replace('T', ' ').slice(0, 16)}</span>
                </div>

                {/* Ciudadano */}
                {!detalle.denuncia.es_anonimo && detalle.denuncia.nombre_ciudadano && (
                  <div style={{ padding: '10px 14px', background: 'var(--bg-input, #f8fafc)', borderRadius: '8px', marginBottom: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{detalle.denuncia.nombre_ciudadano}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      DNI: {detalle.denuncia.dni_ciudadano} | Tel: {detalle.denuncia.telefono_ciudadano}
                    </div>
                  </div>
                )}
                {!!detalle.denuncia.es_anonimo && (
                  <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: '8px', marginBottom: 12, color: '#92400E', fontWeight: 600, fontSize: '0.85rem' }}>
                    Denuncia anónima
                  </div>
                )}

                {/* Datos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 16, fontSize: '0.88rem' }}>
                  <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>TIPO</strong><br />{detalle.denuncia.tipo_incidencia}</div>
                  <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>LUGAR</strong><br />{detalle.denuncia.lugar_hecho}</div>
                  {detalle.denuncia.referencia && <div><strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>REFERENCIA</strong><br />{detalle.denuncia.referencia}</div>}
                  {detalle.denuncia.latitud && detalle.denuncia.longitud && (
                    <div>
                      <strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>UBICACIÓN</strong><br />
                      <a href={`https://www.google.com/maps?q=${detalle.denuncia.latitud},${detalle.denuncia.longitud}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                        Ver en mapa
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px', background: 'var(--bg-input, #f8fafc)', borderRadius: '8px', marginBottom: 16, fontSize: '0.9rem', lineHeight: 1.5, border: '1px solid var(--border-color)' }}>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DESCRIPCIÓN</strong><br />
                  {detalle.denuncia.descripcion}
                </div>

                {/* Fotos */}
                {detalle.fotos.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>EVIDENCIAS ({detalle.fotos.length})</strong>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {detalle.fotos.map((f, idx) => (
                        <div key={f.id} onClick={() => setFotoGaleria({ fotos: detalle.fotos.map(ff => `${BASE}/${ff.ruta}`), index: idx })}
                          style={{ width: 80, height: 80, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                          <img src={`${BASE}/${f.ruta}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seguimiento */}
                {detalle.seguimientos.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>SEGUIMIENTO</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {detalle.seguimientos.map(s => (
                        <div key={s.id} style={{
                          padding: '10px 14px', borderRadius: '10px', maxWidth: '85%',
                          background: s.tipo_autor === 'OPERADOR' ? '#E8F5E9' : '#E3F2FD',
                          alignSelf: s.tipo_autor === 'OPERADOR' ? 'flex-start' : 'flex-end'
                        }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.tipo_autor === 'OPERADOR' ? '#2E7D32' : '#1565C0', marginBottom: 2 }}>
                            {s.tipo_autor === 'OPERADOR' ? (s.respondido_por || 'Operador') : 'Ciudadano'}
                            {s.estado_nuevo && <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>→ {s.estado_nuevo}</span>}
                          </div>
                          <div style={{ fontSize: '0.88rem' }}>{s.mensaje}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.fecha?.replace('T', ' ').slice(0, 16)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Responder */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>RESPONDER AL CIUDADANO</strong>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
                    <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    {nuevoEstado !== detalle.denuncia.estado && (
                      <span style={{ fontSize: '0.78rem', color: '#f97316', alignSelf: 'center' }}>Cambiará estado a: {nuevoEstado}</span>
                    )}
                  </div>
                  <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Escriba su respuesta..."
                    rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', resize: 'vertical', fontSize: '0.9rem' }} />
                  <button onClick={enviarRespuesta} disabled={enviando || !respuesta.trim()} className="login-button"
                    style={{ marginTop: 8, padding: '10px 24px', opacity: (!respuesta.trim() || enviando) ? 0.5 : 1 }}>
                    {enviando ? 'Enviando...' : 'Enviar Respuesta'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* Galería fotos */}
      {fotoGaleria && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFotoGaleria(null)}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{fotoGaleria.index + 1} / {fotoGaleria.fotos.length}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {fotoGaleria.fotos.length > 1 && (
                <button onClick={() => setFotoGaleria(p => p ? { ...p, index: (p.index - 1 + p.fotos.length) % p.fotos.length } : null)}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>‹</button>
              )}
              <img src={fotoGaleria.fotos[fotoGaleria.index]} alt="" style={{ maxWidth: '80vw', maxHeight: '75vh', borderRadius: '10px', objectFit: 'contain' }} />
              {fotoGaleria.fotos.length > 1 && (
                <button onClick={() => setFotoGaleria(p => p ? { ...p, index: (p.index + 1) % p.fotos.length } : null)}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>›</button>
              )}
            </div>
            <a href={fotoGaleria.fotos[fotoGaleria.index]} download target="_blank" rel="noopener noreferrer"
              style={{ padding: '8px 20px', background: '#22c55e', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
              Descargar
            </a>
            <button onClick={() => setFotoGaleria(null)} style={{ padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default DenunciasCiudadanoModule;
