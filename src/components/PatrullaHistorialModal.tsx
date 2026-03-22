import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import { createPortal } from 'react-dom';

interface HistorialEntry {
  id_historial: number;
  detalles: string;
  tipo_operacion: 'ASIGNACION' | 'ELIMINACION' | 'TRANSFERENCIA' | 'DEVOLUCION';
  fecha_operacion: string;
}

interface Props {
  patrolCode: string;
  onClose: () => void;
}

const getOperationBadge = (operation: string) => {
  switch (operation) {
    case 'ASIGNACION':
      return <span className="badge status-active">Asignación</span>;
    case 'ELIMINACION':
      return <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c' }}>Eliminación</span>;
    case 'TRANSFERENCIA':
      return <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#b45309' }}>Transferencia</span>;
    case 'DEVOLUCION':
      return <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8' }}>Devolución</span>;
    default:
      return <span className="badge">{operation}</span>;
  }
};

const PatrullaHistorialModal = ({ patrolCode, onClose }: Props) => {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/historial-asignaciones`);
        if (res.ok) {
          const allHistory: HistorialEntry[] = await res.json();
          const filtered = allHistory.filter(entry => 
            entry.detalles.toLowerCase().includes(patrolCode.toLowerCase())
          );
          setHistorial(filtered);
        }
      } catch (error) {
        console.error("Error fetching assignment history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [patrolCode]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Historial de la Patrulla: {patrolCode}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="table-responsive">
            <table className="crud-table">
              <thead><tr><th>Fecha y Hora</th><th>Tipo de Operación</th><th>Detalles</th></tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</td></tr>
                ) : historial.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>No hay historial para esta patrulla.</td></tr>
                ) : (
                  historial.map(entry => (
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
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PatrullaHistorialModal;
