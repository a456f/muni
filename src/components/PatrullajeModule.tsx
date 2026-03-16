import React, { useState, useEffect } from 'react';
import PatrullasModule from './PatrullasModule';
import AsignacionPatrullasModule from './AsignacionPatrullasModule';

const HistorialAsignacionesModule = () => {
    const [history, setHistory] = useState<any[]>([]);
    useEffect(() => {
        fetch('http://localhost:3001/api/historial-asignaciones')
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="crud-module">
            <div className="crud-header">
                <h2>Historial de Operaciones de Patrullaje</h2>
            </div>
            <div className="table-responsive">
                <table className="crud-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Operación</th>
                            <th>Detalles</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(item => (
                            <tr key={item.id_historial}>
                                <td>{item.id_historial}</td>
                                <td><span className={`badge status-${item.tipo_operacion.toLowerCase()}`}>{item.tipo_operacion}</span></td>
                                <td>{item.detalles}</td>
                                <td>{new Date(item.fecha_operacion).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PatrullajeModule = () => {
  const [patrullajeTab, setPatrullajeTab] = useState('asignaciones');

  return (
    <div>
      <div className="sub-nav">
        <button className={patrullajeTab === 'asignaciones' ? 'active' : ''} onClick={() => setPatrullajeTab('asignaciones')}>Asignaciones y Transferencias</button>
        <button className={patrullajeTab === 'patrullas' ? 'active' : ''} onClick={() => setPatrullajeTab('patrullas')}>Flota de Patrullas</button>
        <button className={patrullajeTab === 'historial' ? 'active' : ''} onClick={() => setPatrullajeTab('historial')}>Historial de Asignaciones</button>
      </div>
      {patrullajeTab === 'asignaciones' && <AsignacionPatrullasModule />}
      {patrullajeTab === 'patrullas' && <PatrullasModule />}
      {patrullajeTab === 'historial' && <HistorialAsignacionesModule />}
    </div>
  );
};

export default PatrullajeModule;