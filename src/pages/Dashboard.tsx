import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/Dashboard.css';
import '../styles/Crud.css'; // Importamos los estilos base para los módulos
import Sidebar from '../components/Sidebar';
import PersonalModule from '../components/PersonalModule';
import PersonalAreasModule from '../components/PersonalAreasModule';
import ZonasModule from '../components/ZonasModule';
import DistritosModule from '../components/DistritosModule';
import SectoresModule from '../components/SectoresModule';
import PuntosModule from '../components/PuntosModule';
import IncidenciasModule from '../components/IncidenciasModule'; // This was already here
import PatrullajeModule from '../components/PatrullajeModule';
import TiposIncidenciaModule from '../components/TiposIncidenciaModule';
import EstadosIncidenciaModule from '../components/EstadosIncidenciaModule';
import PrioridadIncidenciaModule from '../components/PrioridadIncidenciaModule';
import type { User } from '../services/authService';
import AlmacenModule from '../components/AlmacenModule';
import SaludModule from '../components/SaludModule';
import TipoAtencionSaludModule from '../components/TipoAtencionSaludModule';
import EstablecimientoSaludModule from '../components/EstablecimientoSaludModule';
import SaludDashboard from '../components/SaludDashboard';
import SupervisoresModule from '../components/SupervisoresModule';
import { API_URL, BASE_URL } from '../config/api';
import { io } from 'socket.io-client';
import '../styles/RealtimeNotification.css';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const Dashboard = ({ user, onLogout, toggleTheme, isDarkMode }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [geoTab, setGeoTab] = useState('distritos');
  const [configTab, setConfigTab] = useState('tipos');
  const [kpis, setKpis] = useState({ total: 0, resueltas: 0, pendientes: 0, efectividad: 0 });
  const [stats, setStats] = useState<any>(null);
  const [realtimeNotification, setRealtimeNotification] = useState<{ id_incidencia: number; message: string; tipo: string; timestamp: string; numero_serie?: string } | null>(null);
  const [notifications, setNotifications] = useState<{ id_incidencia: number; message: string; tipo: string; read: boolean; timestamp: string; numero_serie?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('sys_notifications') || '[]'); } catch { return []; }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Cargar KPIs al montar el componente o al cambiar a la pestaña de inicio
  useEffect(() => {
    if (activeTab === 'inicio') {
      updateKpis();
      fetchEstadisticas();
    }
  }, [activeTab]);

  const fetchEstadisticas = async () => {
    try {
      const res = await fetch(`${API_URL}/estadisticas`);
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error("Error cargando estadísticas:", err); }
  };

  // --- LÓGICA DE TIEMPO REAL (SOCKET.IO) ---
  useEffect(() => {
    const socket = io(BASE_URL);

    socket.on('connect', () => {
      console.log('Conectado al servidor de notificaciones');
    });

    socket.on('nueva_incidencia', (data: any) => {
      const audio = new Audio('/alert.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir audio:', e));
      const ts = new Date().toISOString();

      setRealtimeNotification({ id_incidencia: data.id_incidencia, message: data.message, tipo: data.tipo, timestamp: ts });
      setIsClosing(false);
      setNotifications(prev => {
        const updated = [{ id_incidencia: data.id_incidencia, message: data.message, tipo: data.tipo || 'incidencia', read: false, timestamp: ts }, ...prev].slice(0, 50);
        localStorage.setItem('sys_notifications', JSON.stringify(updated));
        return updated;
      });
      updateKpis();
    });

    socket.on('nueva_revision', (data: any) => {
      const audio = new Audio('/alert.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir audio:', e));
      const ts = new Date().toISOString();

      setRealtimeNotification({ id_incidencia: data.id_revision, message: data.message, tipo: 'revision_equipo', timestamp: ts, numero_serie: data.numero_serie || '' });
      setIsClosing(false);
      setNotifications(prev => {
        const updated = [{ id_incidencia: data.id_revision, message: data.message, tipo: 'revision_equipo', read: false, timestamp: ts, numero_serie: data.numero_serie || '' }, ...prev].slice(0, 50);
        localStorage.setItem('sys_notifications', JSON.stringify(updated));
        return updated;
      });
    });

    socket.on('nueva_inconsistencia', (data: any) => {
      const audio = new Audio('/alert.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir audio:', e));
      const ts = new Date().toISOString();

      setRealtimeNotification({ id_incidencia: data.id, message: data.message, tipo: 'inconsistencia', timestamp: ts });
      setIsClosing(false);
      setNotifications(prev => {
        const updated = [{ id_incidencia: data.id, message: data.message, tipo: 'inconsistencia', read: false, timestamp: ts }, ...prev].slice(0, 50);
        localStorage.setItem('sys_notifications', JSON.stringify(updated));
        return updated;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Efecto para ocultar automáticamente la notificación
  useEffect(() => {
    if (realtimeNotification) {
      const timer = setTimeout(() => {
        handleCloseNotification();
      }, 7000); // Ocultar después de 7 segundos
      return () => clearTimeout(timer);
    }
  }, [realtimeNotification]);

  const handleCloseNotification = () => {
    setIsClosing(true);
    setTimeout(() => {
      setRealtimeNotification(null);
      setIsClosing(false);
    }, 500); // Debe coincidir con la duración de la animación de salida
  };

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        localStorage.setItem('sys_notifications', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleNotificationClick = (n: { id_incidencia: number; tipo: string; numero_serie?: string }) => {
    if (n.tipo === 'revision_equipo' || n.tipo === 'inconsistencia') {
      setActiveTab('almacen');
      if (n.numero_serie) {
        sessionStorage.setItem('searchEquipo', n.numero_serie);
      }
    } else {
      setActiveTab('denuncias');
      sessionStorage.setItem('highlightIncidencia', n.id_incidencia.toString());
    }
    setShowNotifications(false);
    setRealtimeNotification(null);
  };

  const removeNotification = (id_incidencia: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => {
      const updated = prev.filter(n => n.id_incidencia !== id_incidencia);
      localStorage.setItem('sys_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('sys_notifications');
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
  };
  const updateKpis = () => {
      fetch(`${API_URL}/kpis`)
        .then(res => res.json())
        .then(data => setKpis(data))
        .catch(err => console.error("Error cargando KPIs:", err));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'inicio':
        const tendencia = stats ? ((stats.mesActual - stats.mesAnterior) / Math.max(stats.mesAnterior, 1) * 100) : 0;
        const maxBarValue = (arr: any[]) => Math.max(...(arr || []).map((i: any) => i.cantidad), 1);

        return (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ margin: 0 }}>Panel de Control</h1>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Estadísticas de incidencias en tiempo real</p>
            </div>

            {/* KPIs principales */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <h3>Total Incidencias</h3>
                <p className="stat-number">{stats?.totales?.total_incidencias || kpis.total}</p>
              </div>
              <div className="stat-card">
                <h3>Este Mes</h3>
                <p className="stat-number" style={{ color: '#3b82f6' }}>{stats?.mesActual || 0}</p>
                {stats && (
                  <span style={{ fontSize: '0.78rem', color: tendencia >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(0)}% vs mes anterior
                  </span>
                )}
              </div>
              <div className="stat-card">
                <h3>Serenos Activos</h3>
                <p className="stat-number" style={{ color: '#10b981' }}>{stats?.totales?.serenos_activos || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Zonas Cubiertas</h3>
                <p className="stat-number" style={{ color: '#f59e0b' }}>{stats?.totales?.zonas_cubiertas || 0}</p>
              </div>
            </div>

            {stats && (
              <>
                {/* Fila 1: Tipo de hecho + Zona */}
                <div className="dash-grid-2">
                  {/* Por tipo de hecho */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Incidencias por Tipo de Hecho</h3>
                    {(stats.porTipo || []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Sin datos</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {stats.porTipo.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={item.nombre}>{item.nombre}</span>
                            <div style={{ flex: 1, height: '18px', background: 'var(--bg-input, #f1f5f9)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${(item.cantidad / maxBarValue(stats.porTipo)) * 100}%`, height: '100%', background: `hsl(${220 - i * 20}, 70%, 55%)`, borderRadius: '4px', transition: 'width 0.5s', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                                <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 700 }}>{item.cantidad}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Por zona */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Incidencias por Zona</h3>
                    {(stats.porZona || []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Sin datos</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {stats.porZona.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>Zona {item.nombre}</span>
                            <div style={{ flex: 1, height: '18px', background: 'var(--bg-input, #f1f5f9)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${(item.cantidad / maxBarValue(stats.porZona)) * 100}%`, height: '100%', background: `hsl(${140 + i * 25}, 60%, 45%)`, borderRadius: '4px', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                                <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 700 }}>{item.cantidad}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fila 2: Modalidad + Servicio + Día semana */}
                <div className="dash-grid-3">
                  {/* Por modalidad */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Tipo Intervención</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(stats.porModalidad || []).map((item: any, i: number) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                        const pct = stats.totales.total_incidencias > 0 ? Math.round((item.cantidad / stats.totales.total_incidencias) * 100) : 0;
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                              <span>{item.nombre}</span>
                              <span style={{ fontWeight: 700 }}>{item.cantidad} ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--bg-input, #f1f5f9)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: colors[i % colors.length], borderRadius: '3px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Por servicio */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Por Servicio</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '8px' }}>
                      {(stats.porServicio || []).map((item: any, i: number) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
                        return (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                              width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: colors[i % colors.length], color: '#fff', fontWeight: 800, fontSize: '1.2rem', margin: '0 auto 6px'
                            }}>
                              {item.cantidad}
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Servicio {item.nombre}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Por día de la semana */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Por Día de la Semana</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '100px', gap: '4px', paddingTop: '8px' }}>
                      {(stats.porDiaSemana || []).map((item: any, i: number) => {
                        const maxVal = maxBarValue(stats.porDiaSemana);
                        const h = Math.max((item.cantidad / maxVal) * 80, 8);
                        const dayMap: Record<string, string> = { Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié', Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom', Lunes: 'Lun', Martes: 'Mar', 'Miércoles': 'Mié', Jueves: 'Jue', Viernes: 'Vie', 'Sábado': 'Sáb', Domingo: 'Dom' };
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{item.cantidad}</span>
                            <div style={{ width: '22px', height: `${h}px`, background: `hsl(${210 + i * 20}, 65%, 55%)`, borderRadius: '3px 3px 0 0' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{dayMap[item.nombre] || item.nombre?.substring(0, 3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Fila 3: Timeline + Horas + Top Serenos */}
                <div className="dash-grid-2-1">
                  {/* Timeline últimos 30 días */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Actividad Últimos 30 Días</h3>
                    {(stats.porDia || []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px', overflow: 'hidden' }}>
                        {stats.porDia.map((item: any, i: number) => {
                          const maxVal = maxBarValue(stats.porDia);
                          const h = Math.max((item.cantidad / maxVal) * 70, 4);
                          return (
                            <div key={i} title={`${new Date(item.fecha).toLocaleDateString()}: ${item.cantidad}`} style={{
                              flex: 1, minWidth: '4px', height: `${h}px`, background: '#3b82f6',
                              borderRadius: '2px 2px 0 0', cursor: 'pointer', transition: 'opacity 0.2s'
                            }} />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top serenos */}
                  <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Top Serenos</h3>
                    {(stats.topSerenos || []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {stats.topSerenos.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--bg-input, #f1f5f9)',
                              color: i < 3 ? '#fff' : 'inherit', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0
                            }}>{i + 1}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</span>
                            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{item.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fila 4: Últimas incidencias */}
                <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
                  <h3 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Últimas Incidencias Registradas</h3>
                  <div className="table-responsive">
                    <table className="crud-table" style={{ marginBottom: 0 }}>
                      <thead><tr><th>Parte</th><th>Tipo</th><th>Zona</th><th>Lugar</th><th>Sereno</th><th>Modalidad</th><th>Fecha</th></tr></thead>
                      <tbody>
                        {(stats.ultimas || []).map((item: any) => (
                          <tr key={item.id_incidencia} style={{ cursor: 'pointer' }} onClick={() => { setActiveTab('denuncias'); sessionStorage.setItem('highlightIncidencia', item.id_incidencia.toString()); }}>
                            <td><code style={{ background: 'var(--bg-input, #f1f5f9)', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>{item.numero_parte || '-'}</code></td>
                            <td style={{ fontWeight: 500 }}>{item.tipo_hecho}</td>
                            <td>{item.zona || '-'}</td>
                            <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.lugar_hecho}</td>
                            <td>{item.nombre_sereno || 'N/A'}</td>
                            <td><span className="badge status-active" style={{ fontSize: '0.72rem' }}>{item.modalidad_intervencion || '-'}</span></td>
                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(item.fecha_registro).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 'denuncias':
        return <IncidenciasModule user={user} />;
      case 'registro-personal':
        return <PersonalModule title="Registro Personal" />;
      case 'gestion-personal':
        return <PersonalAreasModule title="Gestión de Personal" />;
      case 'patrullaje':
        return <PatrullajeModule />;
      case 'almacen':
        return <AlmacenModule />;
      case 'salud':
      case 'salud-atenciones':
        return <SaludModule />;
      case 'salud-tipos':
        return <TipoAtencionSaludModule />;
      case 'salud-establecimientos':
        return <EstablecimientoSaludModule />;
      case 'salud-dashboard':
        return <SaludDashboard />;
      case 'supervisores':
        return <SupervisoresModule />;
      case 'geografia':
        return (
          <div>
            <div className="sub-nav">
              <button 
                className={geoTab === 'distritos' ? 'active' : ''} 
                onClick={() => setGeoTab('distritos')}>Distritos</button>
              <button 
                className={geoTab === 'zonas' ? 'active' : ''} 
                onClick={() => setGeoTab('zonas')}>Zonas</button>
              <button 
                className={geoTab === 'sectores' ? 'active' : ''} 
                onClick={() => setGeoTab('sectores')}>Sectores</button>
              <button 
                className={geoTab === 'puntos' ? 'active' : ''} 
                onClick={() => setGeoTab('puntos')}>Puntos</button>
            </div>
            {geoTab === 'distritos' && <DistritosModule />}
            {geoTab === 'zonas' && <ZonasModule />}
            {geoTab === 'sectores' && <SectoresModule />}
            {geoTab === 'puntos' && <PuntosModule />}
          </div>
        );
      case 'configuracion':
        return (
          <div>
            <div className="sub-nav">
              <button 
                className={configTab === 'tipos' ? 'active' : ''} 
                onClick={() => setConfigTab('tipos')}>Tipos de Incidencia</button>
              <button 
                className={configTab === 'estados' ? 'active' : ''} 
                onClick={() => setConfigTab('estados')}>Estados</button>
              <button 
                className={configTab === 'prioridades' ? 'active' : ''} 
                onClick={() => setConfigTab('prioridades')}>Prioridades</button>
            </div>
            {configTab === 'tipos' && <TiposIncidenciaModule />} 
            {configTab === 'estados' && <EstadosIncidenciaModule />}
            {configTab === 'prioridades' && <PrioridadIncidenciaModule />}
          </div>
        );
      default:
        return <div><h1>Inicio</h1></div>;
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="dashboard-container">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={onLogout}
        user={user}
        isOpen={sidebarOpen}
      />
      <main className="main-content">
        <header className="top-bar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div className="breadcrumb">
            <span className="path">Sistema</span>
            <span className="separator">/</span>
            <span className="current">
              {{
                inicio: 'Inicio',
                denuncias: 'Incidencias',
                'registro-personal': 'Registro Personal',
                'gestion-personal': 'Gestión de Personal',
                patrullaje: 'Patrullaje',
                almacen: 'Almacén',
                salud: 'Salud',
                'salud-atenciones': 'Salud - Atenciones',
                'salud-tipos': 'Salud - Tipos de Atención',
                'salud-establecimientos': 'Salud - Establecimientos',
                'salud-dashboard': 'Salud - Estadísticas',
                supervisores: 'Supervisores',
                geografia: 'Geografía',
                configuracion: 'Configuración'
              }[activeTab] || activeTab}
            </span>
          </div>
          
          <div className="top-bar-actions">
            <div className="notification-bell" onClick={handleBellClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="notification-badge">{notifications.filter(n => !n.read).length}</span>
              )}
              {showNotifications && (
                <div className="notifications-panel" onClick={e => e.stopPropagation()}>
                  <div className="notifications-header">
                    <h4>Notificaciones</h4>
                    {notifications.length > 0 && (
                      <button onClick={clearAllNotifications} style={{ background:'none', border:'none', color:'var(--accent-red, #D32F2F)', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>Limpiar todo</button>
                    )}
                  </div>
                  <div className="notifications-list">
                    {notifications.length === 0 ? <div className="no-notifications">No hay notificaciones</div> :
                      notifications.map((n, index) => (
                        <div key={index} className={`notification-item-panel ${!n.read ? 'unread' : ''}`} onClick={() => handleNotificationClick(n)}>
                          <div className={`notif-type-dot ${n.tipo === 'revision_equipo' ? 'revision' : n.tipo === 'inconsistencia' ? 'inconsistencia' : 'incidencia'}`} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'0.82rem', fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>
                              {n.tipo === 'revision_equipo' ? 'Revisión equipo' : n.tipo === 'inconsistencia' ? 'Inconsistencia' : 'Incidencia'} · {timeAgo(n.timestamp)}
                            </div>
                          </div>
                          <button className="remove-notification-btn" onClick={(e) => removeNotification(n.id_incidencia, e)}>&times;</button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          <div className="user-info">
            <button onClick={toggleTheme} className="theme-toggle-btn" title="Cambiar tema">
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            
            <div className="user-profile">
              <div className="user-details">
                <span className="name">{user.nombre || user.email}</span>
                <span className="role">{user.role || 'Admin'}</span>
              </div>
              <div className="avatar">
                {user.nombre ? user.nombre.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
          </div>
        </header>
        <div className="content-area">
          {renderContent()}
        </div>
      </main>

      {realtimeNotification && createPortal(
        <div className={`realtime-notification ${isClosing ? 'closing' : ''} ${realtimeNotification.tipo === 'revision_equipo' ? 'type-revision' : realtimeNotification.tipo === 'inconsistencia' ? 'type-inconsistencia' : 'type-incidencia'}`} onClick={() => handleNotificationClick(realtimeNotification)}>
          <div className="realtime-notification-icon">
            {realtimeNotification.tipo === 'revision_equipo' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            ) : realtimeNotification.tipo === 'inconsistencia' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <div className="realtime-notification-content">
            <h4>{realtimeNotification.tipo === 'revision_equipo' ? 'Nueva Revisión de Equipo' : realtimeNotification.tipo === 'inconsistencia' ? 'Inconsistencia Reportada' : 'Nueva Incidencia'}</h4>
            <p>{realtimeNotification.message}</p>
          </div>
          <button className="realtime-notification-close" onClick={(e) => { e.stopPropagation(); handleCloseNotification(); }} title="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
