import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';
import Notification from '../hooks/Notification';
import { useNotification } from './useNotification';

interface Turno {
  id_turno: number;
  nombre_turno: string;
  hora_inicio: string;
  hora_fin: string;
}

const initialForm = { nombre_turno: '', hora_inicio: '', hora_fin: '' };

const TurnosModule: React.FC = () => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);
  const { notification, showNotification, hideNotification } = useNotification();
  const [confirmDel, setConfirmDel] = useState<Turno | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch(`${API_URL}/turnos`);
      if (res.ok) setTurnos(await res.json());
    } catch {
      showNotification('Error al cargar turnos', 'error');
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const abrirEditar = (t: Turno) => {
    setEditingId(t.id_turno);
    setForm({
      nombre_turno: t.nombre_turno,
      hora_inicio: t.hora_inicio?.slice(0, 5) || '',
      hora_fin: t.hora_fin?.slice(0, 5) || ''
    });
    setModalOpen(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_turno.trim() || !form.hora_inicio || !form.hora_fin) {
      showNotification('Complete todos los campos', 'error');
      return;
    }
    const url = editingId ? `${API_URL}/turnos/${editingId}` : `${API_URL}/turnos`;
    const method = editingId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setModalOpen(false);
        cargar();
        showNotification(editingId ? 'Turno actualizado' : 'Turno creado', 'success');
      } else {
        const err = await res.json();
        showNotification(err.error || 'Error al guardar', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    }
  };

  const eliminar = async () => {
    if (!confirmDel) return;
    try {
      const res = await fetch(`${API_URL}/turnos/${confirmDel.id_turno}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Turno eliminado', 'success');
        cargar();
      } else {
        showNotification('No se puede eliminar este turno', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setConfirmDel(null);
    }
  };

  const filtrados = turnos.filter(t =>
    !busqueda.trim() ||
    t.nombre_turno.toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatearHora = (h: string) => h ? h.slice(0, 5) : '-';

  const calcularDuracion = (inicio: string, fin: string) => {
    if (!inicio || !fin) return '-';
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="crud-module">
      <div className="crud-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestión de Turnos</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Define los horarios de patrullaje
          </p>
        </div>
        <button onClick={abrirNuevo} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.88rem',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          + Nuevo Turno
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input type="text" placeholder="Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', maxWidth: 380, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.88rem' }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-input)', borderBottom: '2px solid var(--border-light)' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>#</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Nombre</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Hora inicio</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Hora fin</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Duración</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No hay turnos registrados</td></tr>
            ) : filtrados.map((t, i) => (
              <tr key={t.id_turno} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{t.id_turno}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, textTransform: 'uppercase' }}>{t.nombre_turno}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '3px 10px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>{formatearHora(t.hora_inicio)}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '3px 10px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>{formatearHora(t.hora_fin)}</span>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{calcularDuracion(formatearHora(t.hora_inicio), formatearHora(t.hora_fin))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button onClick={() => abrirEditar(t)} style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: '#1565C0', color: '#fff', fontSize: '0.78rem', fontWeight: 600, marginRight: 4
                  }}>Editar</button>
                  <button onClick={() => setConfirmDel(t)} style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: '#dc2626', color: '#fff', fontSize: '0.78rem', fontWeight: 600
                  }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModalOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0 }}>{editingId ? 'Editar turno' : 'Nuevo turno'}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Define el horario del turno</p>
            </div>
            <form onSubmit={guardar}>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre del turno *</div>
                  <input type="text" placeholder="Ej: Mañana, Tarde, Noche"
                    value={form.nombre_turno}
                    onChange={e => setForm({ ...form, nombre_turno: e.target.value })}
                    required maxLength={50}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.9rem', boxSizing: 'border-box', textTransform: 'uppercase' }} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hora inicio *</div>
                    <input type="time" value={form.hora_inicio}
                      onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </label>
                  <label>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hora fin *</div>
                    <input type="time" value={form.hora_fin}
                      onChange={e => setForm({ ...form, hora_fin: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </label>
                </div>
                {form.hora_inicio && form.hora_fin && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #86efac', padding: 10, borderRadius: 8, fontSize: '0.82rem', color: '#166534' }}>
                    Duración del turno: <strong>{calcularDuracion(form.hora_inicio, form.hora_fin)}</strong>
                  </div>
                )}
              </div>
              <div style={{ padding: 14, borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{
                  padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)', cursor: 'pointer', fontWeight: 600
                }}>Cancelar</button>
                <button type="submit" style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600
                }}>{editingId ? 'Actualizar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmación eliminar */}
      {confirmDel && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setConfirmDel(null)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEE2E2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>¿Eliminar turno?</h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#6b7280' }}>
                  Se eliminará el turno <strong>{confirmDel.nombre_turno}</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDel(null)} style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
              }}>Cancelar</button>
              <button onClick={eliminar} style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
              }}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Notification notification={notification} onClose={hideNotification} />
    </div>
  );
};

export default TurnosModule;
