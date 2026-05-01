import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../config/api';

interface Alerta {
  id: number;
  ciudadano_id: number | null;
  latitud: number;
  longitud: number;
  direccion: string | null;
  estado: string;
  sereno_id: number | null;
  atendido_por: string | null;
  observacion: string | null;
  fecha: string;
  fecha_atencion: string | null;
  nombre_ciudadano: string | null;
  telefono: string | null;
  dni: string | null;
}

interface FotoAlerta {
  id: number;
  ruta: string;
  fecha_subida: string;
}

const AlertasPanicoModule: React.FC = () => {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [serenos, setSerenos] = useState<any[]>([]);
  const [asignando, setAsignando] = useState<Alerta | null>(null);
  const [verFotos, setVerFotos] = useState<{ alerta: Alerta; fotos: FotoAlerta[] } | null>(null);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [serenoSel, setSerenoSel] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cerrando, setCerrando] = useState<Alerta | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const cargar = async () => {
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico`);
      if (res.ok) setAlertas(await res.json());
    } catch {}
  };

  const cargarSerenos = async () => {
    try {
      const res = await fetch(`${API_URL}/personal`);
      if (res.ok) {
        const data = await res.json();
        setSerenos(Array.isArray(data) ? data : data.data || []);
      }
    } catch {}
  };

  useEffect(() => { cargar(); cargarSerenos(); }, []);

  const verFotosAlerta = async (alerta: Alerta) => {
    try {
      const res = await fetch(`${API_URL}/serenos/alertas/${alerta.id}/fotos`);
      if (res.ok) setVerFotos({ alerta, fotos: await res.json() });
    } catch {}
  };

  const asignar = async () => {
    if (!serenoSel || !asignando) return;
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico/${asignando.id}/asignar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sereno_id: parseInt(serenoSel), operador: 'Admin' })
      });
      if (res.ok) { setAsignando(null); setSerenoSel(''); cargar(); }
    } catch {}
  };

  const cerrar = async () => {
    if (!cerrando) return;
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico/${cerrando.id}/cerrar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacion: observacion || 'Atendida' })
      });
      if (res.ok) { setCerrando(null); setObservacion(''); cargar(); }
    } catch {}
  };

  const filtradas = useMemo(() => {
    return alertas.filter(a => {
      if (filtro !== 'TODOS' && a.estado !== filtro) return false;
      if (busqueda.trim()) {
        const s = busqueda.toLowerCase();
        return (
          a.nombre_ciudadano?.toLowerCase().includes(s) ||
          a.telefono?.includes(s) ||
          a.dni?.includes(s) ||
          a.direccion?.toLowerCase().includes(s) ||
          String(a.id).includes(s)
        );
      }
      return true;
    });
  }, [alertas, filtro, busqueda]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageActual = Math.min(page, totalPages);
  const paginadas = filtradas.slice((pageActual - 1) * PAGE_SIZE, pageActual * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filtro, busqueda]);

  const colorChip = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return { bg: '#FFEBEE', color: '#C62828' };
      case 'ASIGNADO': return { bg: '#E3F2FD', color: '#1565C0' };
      case 'EN_CAMINO': return { bg: '#E0F2FE', color: '#0369A1' };
      case 'CERRADO': return { bg: '#E8F5E9', color: '#2E7D32' };
      default: return { bg: '#F5F5F5', color: '#616161' };
    }
  };

  const stats = useMemo(() => ({
    total: alertas.length,
    activas: alertas.filter(a => a.estado === 'ACTIVO').length,
    asignadas: alertas.filter(a => a.estado === 'ASIGNADO').length,
    enCamino: alertas.filter(a => a.estado === 'EN_CAMINO').length,
    cerradas: alertas.filter(a => a.estado === 'CERRADO').length,
  }), [alertas]);

  return (
    <div className="crud-module">
      {/* Header */}
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Alertas de Pánico</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Gestión de alertas de emergencia ciudadana
          </p>
        </div>
        <button onClick={cargar} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-light)',
          background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Actualizar
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total', value: stats.total, color: '#374151' },
          { label: 'Activas', value: stats.activas, color: '#C62828' },
          { label: 'Asignadas', value: stats.asignadas, color: '#1565C0' },
          { label: 'En camino', value: stats.enCamino, color: '#0369A1' },
          { label: 'Cerradas', value: stats.cerradas, color: '#2E7D32' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 10,
            border: '1px solid var(--border-light)', borderLeft: `4px solid ${s.color}`
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Buscar por nombre, teléfono, DNI, dirección..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)} style={{
          flex: 1, minWidth: 240, padding: '9px 14px', borderRadius: 8,
          border: '1px solid var(--border-light)', fontSize: '0.88rem'
        }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['TODOS', 'ACTIVO', 'ASIGNADO', 'EN_CAMINO', 'CERRADO'].map(f => {
            const c = colorChip(f === 'TODOS' ? 'ACTIVO' : f);
            return (
              <button key={f} onClick={() => setFiltro(f)} style={{
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.78rem',
                background: filtro === f ? c.color : 'var(--bg-input)',
                color: filtro === f ? '#fff' : 'var(--text-primary)'
              }}>{f === 'TODOS' ? 'Todos' : f}</button>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>#</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Estado</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Ciudadano</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Teléfono</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Ubicación</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Fecha</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Sereno</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginadas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay alertas {filtro !== 'TODOS' ? `con estado ${filtro}` : ''}
                  </td>
                </tr>
              ) : paginadas.map((a, idx) => {
                const c = colorChip(a.estado);
                return (
                  <tr key={a.id} style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                  }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>#{a.id}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                        background: c.bg, color: c.color, whiteSpace: 'nowrap'
                      }}>{a.estado}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                      {a.nombre_ciudadano || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Anónimo</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {a.telefono ? (
                        <a href={`tel:${a.telefono}`} style={{ color: '#C62828', fontWeight: 600, textDecoration: 'none' }}>{a.telefono}</a>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <a href={`https://www.google.com/maps?q=${a.latitud},${a.longitud}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1565C0', textDecoration: 'none', fontSize: '0.8rem' }}>
                        Ver mapa
                      </a>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(a.fecha).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                      {a.atendido_por || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {a.estado === 'ACTIVO' && (
                          <button onClick={() => { setAsignando(a); setSerenoSel(''); }} style={{
                            padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: '#1565C0', color: '#fff', fontWeight: 600, fontSize: '0.72rem'
                          }}>Asignar</button>
                        )}
                        {(a.estado === 'ACTIVO' || a.estado === 'ASIGNADO' || a.estado === 'EN_CAMINO') && (
                          <button onClick={() => { setCerrando(a); setObservacion(''); }} style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #E0E0E0', cursor: 'pointer',
                            background: 'var(--bg-card)', color: '#2E7D32', fontWeight: 600, fontSize: '0.72rem'
                          }}>Cerrar</button>
                        )}
                        {a.estado === 'CERRADO' && (
                          <button onClick={() => verFotosAlerta(a)} style={{
                            padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: '#7C3AED', color: '#fff', fontWeight: 600, fontSize: '0.72rem'
                          }}>Evidencias</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filtradas.length > 0 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
          }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Mostrando <strong>{(pageActual - 1) * PAGE_SIZE + 1}</strong>-<strong>{Math.min(pageActual * PAGE_SIZE, filtradas.length)}</strong> de <strong>{filtradas.length}</strong>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPage(1)} disabled={pageActual === 1} style={btnPag(pageActual === 1)}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageActual === 1} style={btnPag(pageActual === 1)}>‹</button>
              <span style={{ padding: '0 12px', fontSize: '0.85rem', fontWeight: 600 }}>
                {pageActual} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageActual === totalPages} style={btnPag(pageActual === totalPages)}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={pageActual === totalPages} style={btnPag(pageActual === totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Asignar sereno */}
      {asignando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setAsignando(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0 }}>Asignar sereno a alerta #{asignando.id}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {asignando.nombre_ciudadano || 'Anónimo'} {asignando.telefono && `· ${asignando.telefono}`}
              </p>
            </div>
            <div style={{ padding: 18 }}>
              <select value={serenoSel} onChange={e => setSerenoSel(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.9rem'
              }}>
                <option value="">Seleccionar sereno...</option>
                {serenos.map((s: any) => (
                  <option key={s.id_personal || s.id} value={s.id_personal || s.id}>
                    {s.nombres} {s.apellidos}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
              <button onClick={() => setAsignando(null)} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-light)',
                background: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600
              }}>Cancelar</button>
              <button onClick={asignar} disabled={!serenoSel} style={{
                flex: 2, padding: '10px', borderRadius: 8, border: 'none', cursor: serenoSel ? 'pointer' : 'not-allowed',
                background: serenoSel ? '#1565C0' : '#E0E0E0', color: '#fff', fontWeight: 600
              }}>Asignar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cerrar alerta */}
      {cerrando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setCerrando(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0 }}>Cerrar alerta #{cerrando.id}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {cerrando.nombre_ciudadano || 'Anónimo'}
              </p>
            </div>
            <div style={{ padding: 18 }}>
              <textarea value={observacion} onChange={e => setObservacion(e.target.value)} placeholder="Observación de cierre..." rows={4} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)',
                fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
              }} />
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
              <button onClick={() => setCerrando(null)} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-light)',
                background: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600
              }}>Cancelar</button>
              <button onClick={cerrar} style={{
                flex: 2, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#2E7D32', color: '#fff', fontWeight: 600
              }}>Cerrar alerta</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver evidencias */}
      {verFotos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setVerFotos(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>Evidencias de la atención</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Alerta #{verFotos.alerta.id} · {verFotos.alerta.nombre_ciudadano || 'Anónimo'}
                </p>
              </div>
              <button onClick={() => setVerFotos(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 18 }}>
              {verFotos.alerta.observacion && (
                <div style={{ background: '#F0FDF4', border: '1px solid #86efac', padding: 14, borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', marginBottom: 4 }}>OBSERVACIÓN DEL SERENO</div>
                  <div style={{ fontSize: '0.9rem', color: '#1f2937' }}>{verFotos.alerta.observacion}</div>
                  {verFotos.alerta.atendido_por && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6 }}>Atendido por: <strong>{verFotos.alerta.atendido_por}</strong></div>
                  )}
                  {verFotos.alerta.fecha_atencion && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Cerrado: {new Date(verFotos.alerta.fecha_atencion).toLocaleString()}</div>
                  )}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>FOTOS DE EVIDENCIA ({verFotos.fotos.length})</div>
              {verFotos.fotos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Sin fotos de evidencia</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {verFotos.fotos.map(f => {
                    const url = `${API_URL.replace(/\/api\/?$/, '')}/${f.ruta}`;
                    return (
                      <div key={f.id} onClick={() => setFotoZoom(url)} style={{
                        aspectRatio: '1', cursor: 'pointer', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)'
                      }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fotoZoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setFotoZoom(null)}>
          <img src={fotoZoom} alt="" style={{ maxWidth: '95%', maxHeight: '95vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
};

const btnPag = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-light)',
  background: disabled ? 'var(--bg-input)' : 'var(--bg-card)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
  opacity: disabled ? 0.5 : 1
});

export default AlertasPanicoModule;
