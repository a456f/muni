import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Equipo { id: number; descripcion: string; numero_serie: string; estado: string; }
interface Persona { id: number; nombre: string; }
interface Area { id: number; nombre: string; }

interface Asignacion {
  id: number;
  fecha_asignacion: string;
  fecha_devolucion: string | null;
  estado: 'ACTIVO' | 'DEVUELTO';
  equipo_id: number;
  equipo_descripcion: string;
  numero_serie: string;
  persona_id: number;
  persona_nombre: string;
  area_id: number;
  area_nombre: string;
}

const AsignacionesEquiposModule = () => {
    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
    const [equiposDisponibles, setEquiposDisponibles] = useState<Equipo[]>([]);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    
    const { notification, showNotification, hideNotification } = useNotification();
    const [error, setError] = useState<string | null>(null);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const initialAssignForm = { equipo_id: '', persona_id: '', area_id: '', fecha_asignacion: new Date().toISOString().slice(0, 16) };
    const [assignForm, setAssignForm] = useState(initialAssignForm);

    // State for search inputs in modal
    const [equipoSearch, setEquipoSearch] = useState('');
    const [personaSearch, setPersonaSearch] = useState('');
    const [areaSearch, setAreaSearch] = useState('');

    const [returnModalData, setReturnModalData] = useState<{ id: number; equipo_descripcion: string } | null>(null);
    const initialReturnForm = { fecha_devolucion: new Date().toISOString().slice(0, 16), observaciones: '' };
    const [returnForm, setReturnForm] = useState(initialReturnForm);

    const fetchData = async () => {
        try {
            const [resAsig, resEquipos, resPersonas, resAreas] = await Promise.all([
                fetch('http://localhost:3001/api/asignaciones-equipos'),
                fetch('http://localhost:3001/api/equipos'),
                fetch('http://localhost:3001/api/personas'),
                fetch('http://localhost:3001/api/areas')
            ]);
            if (resAsig.ok) setAsignaciones(await resAsig.json());
            if (resEquipos.ok) {
                // La API de equipos ahora devuelve un objeto con paginación
                const { data: allEquipos } = await resEquipos.json();
                setEquiposDisponibles(allEquipos.filter((e: Equipo) => e.estado === 'ALMACEN'));
            }
            if (resPersonas.ok) setPersonas(await resPersonas.json());
            if (resAreas.ok) setAreas(await resAreas.json());
        } catch (err) {
            console.error("Error fetching data:", err);
            showNotification('Error al cargar los datos de asignaciones.', 'error');
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAssignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch('http://localhost:3001/api/asignaciones-equipos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignForm)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al crear la asignación.');
            }
            setIsAssignModalOpen(false);
            setAssignForm(initialAssignForm);
            setEquipoSearch('');
            setPersonaSearch('');
            setAreaSearch('');
            fetchData();
            showNotification('Asignación creada con éxito.', 'success');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleReturnSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnModalData) return;
        setError(null);
        try {
            const response = await fetch(`http://localhost:3001/api/asignaciones-equipos/${returnModalData.id}/devolucion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(returnForm)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al procesar la devolución.');
            }
            setReturnModalData(null);
            setReturnForm(initialReturnForm);
            fetchData();
            showNotification('Equipo devuelto a almacén.', 'success');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Asignaciones');

        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } as ExcelJS.Color },
            fill: {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: 'FF2F5597' } as ExcelJS.Color, // Blue
            },
            border: {
                top: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                left: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                bottom: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                right: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color }
            }
        };

        const cellBorderStyle: Partial<ExcelJS.Style> = {
            border: {
                top: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                left: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                bottom: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                right: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color }
            }
        };

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Equipo', key: 'equipo_descripcion', width: 30 },
            { header: 'Serie', key: 'numero_serie', width: 25 },
            { header: 'Persona Asignada', key: 'persona_nombre', width: 30 },
            { header: 'Área', key: 'area_nombre', width: 25 },
            { header: 'Fecha Asignación', key: 'fecha_asignacion', width: 25 },
            { header: 'Fecha Devolución', key: 'fecha_devolucion', width: 25 },
            { header: 'Estado', key: 'estado', width: 15 },
        ];

        const data = asignaciones.map(item => ({
            ...item,
            fecha_asignacion: new Date(item.fecha_asignacion).toLocaleString(),
            fecha_devolucion: item.fecha_devolucion ? new Date(item.fecha_devolucion).toLocaleString() : '',
        }));

        worksheet.addRows(data);

        // Apply styles
        worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
            row.eachCell({ includeEmpty: true }, function(cell) {
                if (rowNumber === 1) {
                    cell.style = headerStyle;
                } else {
                    cell.style = cellBorderStyle;
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'asignaciones_equipos.xlsx');
    };

    return (
        <div className="crud-module">
            <Notification notification={notification} onClose={hideNotification} />
            <div className="crud-header">
                <h2>Gestión de Asignaciones de Equipos</h2>
                <div style={{display: 'flex', gap: '10px'}}>
                    <button className="action-btn" onClick={handleExport} title="Descargar reporte en Excel" style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Exportar Excel
                    </button>
                    <button className="login-button" onClick={() => setIsAssignModalOpen(true)}>+ Nueva Asignación</button>
                </div>
            </div>

            {isAssignModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Nueva Asignación</h3><button className="modal-close" onClick={() => setIsAssignModalOpen(false)}>×</button></div>
                        <form onSubmit={handleAssignSubmit}>
                            <div className="modal-body"><div className="crud-form">
                                {error && <div className="error-message">{error}</div>}
                                <label>Equipo a Asignar</label>
                                <input type="text" placeholder="Buscar equipo por descripción o S/N..." value={equipoSearch} onChange={e => setEquipoSearch(e.target.value)} />
                                <select value={assignForm.equipo_id} onChange={e => setAssignForm({ ...assignForm, equipo_id: e.target.value })} required>
                                    <option value="">-- Seleccione Equipo Disponible --</option>
                                    {equiposDisponibles
                                        .filter(eq => 
                                            eq.descripcion.toLowerCase().includes(equipoSearch.toLowerCase()) || 
                                            eq.numero_serie.toLowerCase().includes(equipoSearch.toLowerCase())
                                        )
                                        .map(eq => <option key={eq.id} value={eq.id}>{eq.descripcion} (S/N: {eq.numero_serie})</option>)}
                                </select>

                                <label>Persona (Opcional)</label>
                                <input type="text" placeholder="Buscar persona..." value={personaSearch} onChange={e => setPersonaSearch(e.target.value)} />
                                <select value={assignForm.persona_id} onChange={e => setAssignForm({ ...assignForm, persona_id: e.target.value })}>
                                    <option value="">-- Asignar solo a Área (Sin Persona) --</option>
                                    {personas
                                        .filter(p => p.nombre.toLowerCase().includes(personaSearch.toLowerCase()))
                                        .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>

                                <label>Área de Destino</label>
                                <input type="text" placeholder="Buscar área..." value={areaSearch} onChange={e => setAreaSearch(e.target.value)} />
                                <select value={assignForm.area_id} onChange={e => setAssignForm({ ...assignForm, area_id: e.target.value })} required>
                                    <option value="">-- Seleccione Área --</option>
                                    {areas
                                        .filter(a => a.nombre.toLowerCase().includes(areaSearch.toLowerCase()))
                                        .map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                </select>

                                <label>Fecha de Asignación</label>
                                <input type="datetime-local" value={assignForm.fecha_asignacion} onChange={e => setAssignForm({ ...assignForm, fecha_asignacion: e.target.value })} required />
                            </div></div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => { setIsAssignModalOpen(false); setEquipoSearch(''); setPersonaSearch(''); setAreaSearch(''); }}>Cancelar</button>
                                <button type="submit" className="login-button">Asignar Equipo</button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}

            {returnModalData && createPortal(
                <div className="modal-overlay" onClick={() => setReturnModalData(null)}>
                    <div className="modal-content" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Devolución de Equipo</h3><button className="modal-close" onClick={() => setReturnModalData(null)}>×</button></div>
                        <form onSubmit={handleReturnSubmit}>
                            <div className="modal-body">
                                <p>Devolviendo: <strong>{returnModalData.equipo_descripcion}</strong></p>
                                {error && <div className="error-message">{error}</div>}
                                <div className="crud-form">
                                    <label>Fecha de Devolución</label>
                                    <input type="datetime-local" value={returnForm.fecha_devolucion} onChange={e => setReturnForm({ ...returnForm, fecha_devolucion: e.target.value })} required />
                                    <label>Observaciones (opcional)</label>
                                    <textarea placeholder="Ej: El equipo se devuelve en buen estado." value={returnForm.observaciones} onChange={e => setReturnForm({ ...returnForm, observaciones: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setReturnModalData(null)}>Cancelar</button>
                                <button type="submit" className="login-button">Confirmar Devolución</button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}

            <div className="table-responsive">
                <table className="crud-table">
                    <thead><tr><th>Equipo (S/N)</th><th>Persona Asignada</th><th>Área</th><th>Fecha Asignación</th><th>Fecha Devolución</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {asignaciones.map(item => (
                            <tr key={item.id}>
                                <td>{item.equipo_descripcion} ({item.numero_serie})</td>
                                <td>{item.persona_nombre || 'N/A'}</td>
                                <td>{item.area_nombre}</td>
                                <td>{new Date(item.fecha_asignacion).toLocaleString()}</td>
                                <td>{item.fecha_devolucion ? new Date(item.fecha_devolucion).toLocaleString() : 'N/A'}</td>
                                <td><span className={`badge status-${item.estado.toLowerCase()}`}>{item.estado}</span></td>
                                <td>
                                    {item.estado === 'ACTIVO' && (
                                        <button className="action-btn" onClick={() => setReturnModalData({ id: item.id, equipo_descripcion: item.equipo_descripcion })} title="Registrar Devolución">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
                                            Devolver
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AsignacionesEquiposModule;
