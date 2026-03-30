import React, { useState } from 'react';
import type { User } from '../services/authService';
import './Sidebar.css';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  user?: User;
  isOpen?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const Sidebar = ({ activeTab, setActiveTab, onLogout, user, isOpen }: SidebarProps) => {
  const userName = user?.nombre || user?.username || 'Usuario';
  const userRole = user?.role || 'Administrador';
  const initials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Items sin submenú (top level)
  const topItems: MenuItem[] = [
    { id: 'inicio', label: 'Inicio', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
    { id: 'denuncias', label: 'Incidencias', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> },
  ];

  // Grupos con submenú
  const menuGroups: MenuGroup[] = [
    {
      label: 'Personal',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
      items: [
        { id: 'registro-personal', label: 'Registro Personal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> },
        { id: 'gestion-personal', label: 'Gestión Personal', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
      ]
    },
    {
      label: 'Salud',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>,
      items: [
        { id: 'salud-atenciones', label: 'Atenciones', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> },
        { id: 'salud-tipos', label: 'Tipos de Atención', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> },
        { id: 'salud-establecimientos', label: 'Establecimientos', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
        { id: 'salud-dashboard', label: 'Estadísticas', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> },
      ]
    },
  ];

  // Items sin submenú (después de los grupos)
  const bottomItems: MenuItem[] = [
    { id: 'supervisores', label: 'Supervisores', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> },
    { id: 'almacen', label: 'Almacén', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
    { id: 'patrullaje', label: 'Patrullaje', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg> },
    { id: 'criminalidad', label: 'Criminalidad', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> },
    { id: 'geografia', label: 'Geografía', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg> },
    { id: 'configuracion', label: 'Configuración', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
  ];

  // Auto-abrir el grupo que contiene el tab activo
  const getActiveGroup = () => {
    for (const group of menuGroups) {
      if (group.items.some(item => item.id === activeTab)) return group.label;
    }
    return null;
  };

  const [openGroup, setOpenGroup] = useState<string | null>(getActiveGroup());

  const toggleGroup = (label: string) => {
    setOpenGroup(prev => prev === label ? null : label);
  };

  const isGroupOpen = (group: MenuGroup) => openGroup === group.label;
  const isGroupActive = (group: MenuGroup) => group.items.some(item => item.id === activeTab);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Header verde */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <span className="sidebar-brand-text">OISGO</span>
      </div>

      {/* Perfil */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-profile-info">
          <span className="sidebar-profile-name">{userName}</span>
          <span className="sidebar-profile-role">{userRole}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-profile-arrow"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>

      {/* Menu */}
      <nav className="sidebar-menu">
        {/* Items sin submenú */}
        {topItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-item-arrow"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        ))}

        {/* Grupos con submenú */}
        {menuGroups.map(group => (
          <div key={group.label} className="sidebar-group">
            <button
              className={`sidebar-group-toggle ${isGroupOpen(group) ? 'open' : ''} ${isGroupActive(group) ? 'group-active' : ''}`}
              onClick={() => toggleGroup(group.label)}
            >
              <span className="sidebar-item-icon">{group.icon}</span>
              <span className="sidebar-item-label">{group.label}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`sidebar-group-chevron ${isGroupOpen(group) ? 'rotated' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div className={`sidebar-submenu ${isGroupOpen(group) ? 'open' : ''}`}>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-subitem ${activeTab === item.id ? 'active' : ''}`}
                >
                  <span className="sidebar-subitem-icon">{item.icon}</span>
                  <span className="sidebar-item-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Items sin submenú (resto) */}
        {bottomItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-item-arrow"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Cerrar Sesión
        </button>
        <svg className="sidebar-wave" viewBox="0 0 270 60" preserveAspectRatio="none">
          <path d="M0,35 C60,15 120,45 180,25 C220,12 260,30 270,20 L270,60 L0,60 Z" fill="rgba(46,125,50,0.12)"/>
          <path d="M0,40 C50,22 130,50 200,30 C240,18 265,35 270,28 L270,60 L0,60 Z" fill="rgba(46,125,50,0.25)"/>
          <path d="M0,48 C70,30 150,55 220,38 C250,28 265,42 270,36 L270,60 L0,60 Z" fill="#2E7D32"/>
        </svg>
        <div className="sidebar-version">Versión 1.0.0</div>
      </div>
    </aside>
  );
};

export default Sidebar;
