import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/Dashboard.css';
import '../styles/Crud.css'; // Importamos los estilos base para los módulos
import Sidebar from '../components/Sidebar';
import UsuariosModule from '../components/UsuariosModule';
import ZonasModule from '../components/ZonasModule';
import DistritosModule from '../components/DistritosModule';
import SectoresModule from '../components/SectoresModule';
import PuntosModule from '../components/PuntosModule';
import IncidenciasModule from '../components/IncidenciasModule'; // This was already here
import SerenazgoModule from '../components/SerenazgoModule';
import PatrullajeModule from '../components/PatrullajeModule';
import TiposIncidenciaModule from '../components/TiposIncidenciaModule';
import EstadosIncidenciaModule from '../components/EstadosIncidenciaModule';
import PrioridadIncidenciaModule from '../components/PrioridadIncidenciaModule';
import type { User } from '../services/authService';
import AlmacenModule from '../components/AlmacenModule';
import SaludModule from '../components/SaludModule';
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
  const [geoTab, setGeoTab] = useState('distritos'); // Sub-tab para geografía
  const [configTab, setConfigTab] = useState('tipos'); // Sub-tab para configuración
  const [kpis, setKpis] = useState({ total: 0, resueltas: 0, pendientes: 0, efectividad: 0 });
  const [realtimeNotification, setRealtimeNotification] = useState<{ id_incidencia: number; message: string; tipo: string; } | null>(null);
  const [notifications, setNotifications] = useState<{ id_incidencia: number; message: string; tipo: string; read: boolean }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Cargar KPIs al montar el componente o al cambiar a la pestaña de inicio
  useEffect(() => {
    if (activeTab === 'inicio') {
      updateKpis();
    }
  }, [activeTab]);

  // --- LÓGICA DE TIEMPO REAL (SOCKET.IO) ---
  useEffect(() => {
    const socket = io(BASE_URL);

    socket.on('connect', () => {
      console.log('Conectado al servidor de notificaciones');
    });

    socket.on('nueva_incidencia', (data: any) => {
      // 1. Reproducir sonido (asegúrate de tener alert.mp3 en la carpeta public)
      const audio = new Audio('/alert.mp3'); 
      audio.play().catch(e => console.log('No se pudo reproducir audio:', e));

      // Mostrar el toast y también agregar a la lista de notificaciones de la campana
      setRealtimeNotification({ id_incidencia: data.id_incidencia, message: data.message, tipo: data.tipo });
      setIsClosing(false);
      setNotifications(prev => [{ ...data, read: false }, ...prev]);
      // 3. Actualizar contadores si estamos en inicio
      updateKpis();
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
    // Al abrir el panel, marcamos todas como leídas para resetear el contador
    if (!showNotifications) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotificationClick = (id_incidencia: number) => {
    setActiveTab('denuncias');
    // Guardamos el ID en sessionStorage para que el otro componente lo lea
    sessionStorage.setItem('highlightIncidencia', id_incidencia.toString());
    // Cerramos los paneles de notificación
    setShowNotifications(false);
    setRealtimeNotification(null);
  };

  const removeNotification = (id_incidencia: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que el clic en el botón de borrar active el panel
    setNotifications(prev => prev.filter(n => n.id_incidencia !== id_incidencia));
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
        return (
          <div>
            <h1>Panel de Control</h1>
            <p>Resumen general del estado de las incidencias.</p>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Incidencias</h3>
                <p className="stat-number">{kpis.total}</p>
              </div>
              <div className="stat-card">
                <h3>Pendientes</h3>
                <p className="stat-number" style={{ color: '#f59e0b' }}>{kpis.pendientes}</p>
              </div>
              <div className="stat-card">
                <h3>Resueltas</h3>
                <p className="stat-number" style={{ color: '#10b981' }}>{kpis.resueltas}</p>
              </div>
              <div className="stat-card">
                <h3>Efectividad</h3>
                <p className="stat-number" style={{ color: '#3b82f6' }}>
                  {kpis.efectividad}%
                </p>
              </div>
            </div>
          </div>
        );
      case 'denuncias':
        return <IncidenciasModule user={user} />;
      case 'serenazgo':
        return <SerenazgoModule />;
      case 'patrullaje':
        return <PatrullajeModule />;
      case 'almacen':
        return <AlmacenModule />;
      case 'salud':
        return <SaludModule />;
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
      case 'usuarios':
        return <UsuariosModule />;
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

  return (
    <div className="dashboard-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
      />
      <main className="main-content">
        <header className="top-bar">
          <div className="breadcrumb">
            <span className="path">Sistema</span>
            <span className="separator">/</span>
            <span className="current">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
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
                  </div>
                  <div className="notifications-list">
                    {notifications.length === 0 ? <div className="no-notifications">No hay notificaciones</div> :
                      notifications.map((n, index) => (
                        <div key={index} className="notification-item-panel" onClick={() => handleNotificationClick(n.id_incidencia)}>
                          <span>{n.message}</span>
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
        <div className={`realtime-notification ${isClosing ? 'closing' : ''}`} onClick={() => handleNotificationClick(realtimeNotification.id_incidencia)}>
          <div className="realtime-notification-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="realtime-notification-content">
            <h4>¡Nueva Incidencia!</h4>
            <p>{realtimeNotification.message}</p>
          </div>
          <button className="realtime-notification-close" onClick={handleCloseNotification} title="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
