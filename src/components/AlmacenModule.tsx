import React, { useState, useEffect } from 'react';
import EquiposModule from './EquiposModule';
import '../pages/Almacen.css';
import PersonalAreasModule from './PersonalAreasModule';
import TiposEquipoModule from './TiposEquipoModule';
import AsignacionesEquiposModule from './AsignacionesEquiposModule';

// Componentes placeholder para futuras pestañas
const HistorialAlmacenModule = () => <div className="crud-module"><div className="crud-header"><h2>Historial General de Almacén</h2></div><p style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>Módulo de historial general en construcción.</p></div>;

const AlmacenModule = () => {
  const [almacenTab, setAlmacenTab] = useState('equipos');

    return (
        <div>
            <div className="sub-nav">
                <button 
                    className={almacenTab === 'equipos' ? 'active' : ''} 
                    onClick={() => setAlmacenTab('equipos')}>
                    Inventario de Equipos
                </button>
                <button 
                    className={almacenTab === 'asignaciones' ? 'active' : ''} 
                    onClick={() => setAlmacenTab('asignaciones')}>
                    Asignaciones
                </button>
                <button 
                    className={almacenTab === 'personal' ? 'active' : ''} 
                    onClick={() => setAlmacenTab('personal')}>
                    Personal y Áreas
                </button>
                <button 
                    className={almacenTab === 'catalogos' ? 'active' : ''} 
                    onClick={() => setAlmacenTab('catalogos')}>
                    Catálogos
                </button>
                <button 
                    className={almacenTab === 'historial' ? 'active' : ''} 
                    onClick={() => setAlmacenTab('historial')}>
                    Historial General
                </button>
            </div>
            
            {almacenTab === 'equipos' && <EquiposModule />}
            {almacenTab === 'asignaciones' && <AsignacionesEquiposModule />}
            {almacenTab === 'personal' && <PersonalAreasModule />}
            {almacenTab === 'catalogos' && <TiposEquipoModule />}
            {almacenTab === 'historial' && <HistorialAlmacenModule />}
        </div>
    );
};

export default AlmacenModule;