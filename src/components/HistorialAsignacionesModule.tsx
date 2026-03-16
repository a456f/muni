import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface HistorialEntry {
  id_historial: number;
  detalles: string;
  tipo_operacion: 'ASIGNACION' | 'ELIMINACION' | 'TRANSFERENCIA';
  fecha_operacion: string;
}

const getOperationBadge = (operation: string) => {
  switch (operation) {
    case 'ASIGNACION':
      return <span className="badge status-active">Asignación</span>;
    case 'ELIMINACION':
      return <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c' }}>Eliminación</span>;
    case 'TRANSFERENCIA':
      return <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#b45309' }}>Transferencia</span>;
    default:
      return <span className="badge">{operation}</span>;
  }
};

const HistorialAsignacionesModule = () => {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/historial-asignaciones`);
      if (res.ok) setHistorial(await res.json());
    } catch (error) {
      console.error("Error fetching assignment history:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredHistorial = historial.filter(entry =>
    entry.detalles.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.tipo_operacion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="crud-module">
      <div className="crud-header">
        <h2>Historial de Operaciones de Patrullaje</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Buscar por detalles, sereno, patrulla..."
              className="search-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Fecha y Hora</th><th>Tipo de Operación</th><th>Detalles</th></tr></thead>
          <tbody>
            {filteredHistorial.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>No hay registros en el historial.</td></tr>
            ) : (
              filteredHistorial.map(entry => (
                <tr key={entry.id_historial}>
                  <td>{new Date(entry.fecha_operacion).toLocaleString()}</td>
                  <td>{getOperationBadge(entry.tipo_operacion)}</td>
                  <td>{entry.detalles}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistorialAsignacionesModule;