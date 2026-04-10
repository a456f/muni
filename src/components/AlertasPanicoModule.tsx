import React, { useState, useEffect } from 'react';
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

const AlertasPanicoModule: React.FC = () => {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [serenos, setSerenos] = useState<any[]>([]);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [serenoSel, setSerenoSel] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cerrando, setCerrando] = useState<number | null>(null);

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

  const asignar = async (alertaId: number) => {
    if (!serenoSel) return;
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico/${alertaId}/asignar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sereno_id: parseInt(serenoSel), operador: 'Admin' })
      });
      if (res.ok) {
        setAsignando(null);
        setSerenoSel('');
        cargar();
      }
    } catch {}
  };

  const cerrar = async (alertaId: number) => {
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico/${alertaId}/cerrar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacion: observacion || 'Atendida' })
      });
      if (res.ok) {
        setCerrando(null);
        setObservacion('');
        cargar();
      }
    } catch {}
  };

  const filtradas = alertas.filter(a => filtro === 'TODOS' || a.estado === filtro);

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' };
      case 'ASIGNADO': return { bg: '#E3F2FD', color: '#1565C0', border: '#BBDEFB' };
      case 'CERRADO': return { bg: '#E8F5E9', color: '#2E7D32', border: '#C8E6C9' };
      default: return { bg: '#F5F5F5', color: '#616161', border: '#E0E0E0' };
    }
  };

  return (
    <div className="crud-module">
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Alertas de Panico</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {alertas.filter(a => a.estado === 'ACTIVO').length} activas &middot; {alertas.filter(a => a.estado === 'ASIGNADO').length} asignadas &middot; {alertas.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['TODOS', 'ACTIVO', 'ASIGNADO', 'CERRADO'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem',
              background: filtro === f ? (f === 'ACTIVO' ? '#C62828' : f === 'ASIGNADO' ? '#1565C0' : f === 'CERRADO' ? '#2E7D32' : 'var(--primary)') : 'var(--bg-input)',
              color: filtro === f ? '#fff' : 'var(--text-primary)'
            }}>{f === 'TODOS' ? 'Todos' : f}</button>
          ))}
          <button onClick={cargar} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-light)',
            background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.82rem'
          }}>Actualizar</button>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p>No hay alertas {filtro !== 'TODOS' ? `con estado ${filtro}` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
          {filtradas.map(a => {
            const ec = estadoColor(a.estado);
            return (
              <div key={a.id} style={{
                background: 'var(--bg-card)', borderRadius: 14, border: `1px solid var(--border-light)`,
                borderLeft: `4px solid ${ec.color}`, overflow: 'hidden'
              }}>
                <div style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Icono */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: ec.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ec.color} strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                      <strong style={{ fontSize: '0.95rem' }}>
                        {a.nombre_ciudadano || 'Ciudadano anonimo'}
                      </strong>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                        background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`
                      }}>{a.estado}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {a.telefono && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <a href={`tel:${a.telefono}`} style={{ color: '#C62828', fontWeight: 600, textDecoration: 'none' }}>{a.telefono}</a>
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 0 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
                        <a href={`https://www.google.com/maps?q=${a.latitud},${a.longitud}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1565C0', textDecoration: 'none' }}>
                          Ver en mapa
                        </a>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {new Date(a.fecha).toLocaleString()}
                      </span>
                    </div>

                    {a.atendido_por && (
                      <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Atendido por: <strong>{a.atendido_por}</strong>
                        {a.fecha_atencion && ` - ${new Date(a.fecha_atencion).toLocaleString()}`}
                      </div>
                    )}
                    {a.observacion && (
                      <div style={{ marginTop: 4, fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{a.observacion}"
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {a.estado === 'ACTIVO' && (
                      <button onClick={() => { setAsignando(a.id); setSerenoSel(''); }} style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: '#1565C0', color: '#fff', fontWeight: 600, fontSize: '0.8rem'
                      }}>Asignar Sereno</button>
                    )}
                    {(a.estado === 'ACTIVO' || a.estado === 'ASIGNADO') && (
                      <button onClick={() => setCerrando(a.id)} style={{
                        padding: '7px 14px', borderRadius: 8, border: '1px solid #E0E0E0', cursor: 'pointer',
                        background: 'var(--bg-card)', color: '#2E7D32', fontWeight: 600, fontSize: '0.8rem'
                      }}>Cerrar</button>
                    )}
                  </div>
                </div>

                {/* Panel de asignar sereno */}
                {asignando === a.id && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={serenoSel} onChange={e => setSerenoSel(e.target.value)} style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.85rem'
                    }}>
                      <option value="">Seleccionar sereno...</option>
                      {serenos.map((s: any) => (
                        <option key={s.id_personal || s.id} value={s.id_personal || s.id}>
                          {s.nombres} {s.apellidos}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => asignar(a.id)} disabled={!serenoSel} style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: serenoSel ? 'pointer' : 'not-allowed',
                      background: serenoSel ? '#1565C0' : '#E0E0E0', color: '#fff', fontWeight: 600, fontSize: '0.82rem'
                    }}>Asignar</button>
                    <button onClick={() => setAsignando(null)} style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-light)',
                      background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.82rem'
                    }}>Cancelar</button>
                  </div>
                )}

                {/* Panel de cerrar */}
                {cerrando === a.id && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={observacion} onChange={e => setObservacion(e.target.value)} placeholder="Observacion (opcional)"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.85rem' }} />
                    <button onClick={() => cerrar(a.id)} style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#2E7D32', color: '#fff', fontWeight: 600, fontSize: '0.82rem'
                    }}>Cerrar alerta</button>
                    <button onClick={() => setCerrando(null)} style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-light)',
                      background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.82rem'
                    }}>Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertasPanicoModule;
