import React, { useState, useEffect } from 'react';
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
import { API_URL } from '../config/api';

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

  // Cargar KPIs al montar el componente o al cambiar a la pestaña de inicio
  useEffect(() => {
    if (activeTab === 'inicio') {
      fetch(`${API_URL}/kpis`)
        .then(res => res.json())
        .then(data => setKpis(data))
        .catch(err => console.error("Error cargando KPIs:", err));
    }
  }, [activeTab]);

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
        </header>
        <div className="content-area">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
