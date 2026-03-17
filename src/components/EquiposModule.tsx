import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { API_URL } from '../config/api';

// Interfaces for the new module
interface TipoEquipo {
  id: number;
  nombre: string;
}

interface Equipo {
  id: number;
  tipo_id: number;
  descripcion: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  identificador: string | null;
  fecha_registro: string;
  estado: 'ALMACEN' | 'ASIGNADO' | 'MANTENIMIENTO' | 'BAJA';
  tipo_nombre: string;
  persona_asignada: string | null;
  area_asignada: string | null;
}

interface Pagination {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
}

interface EquiposApiResponse {
    data: Equipo[];
    pagination: Pagination;
}



const EquiposModule = () => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tiposEquipo, setTiposEquipo] = useState<TipoEquipo[]>([]);
    const initialFormState = {
        tipo_id: '',
        descripcion: '',
        marca: '',
        modelo: '',
        numero_serie: '',
        identificador: ''
    };
    const [form, setForm] = useState(initialFormState);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pagination, setPagination] = useState<Pagination>({totalItems: 0, totalPages: 1, currentPage: 1, limit: 15});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { notification, showNotification, hideNotification } = useNotification();
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [resEquipos, resTipos] = await Promise.all([
                fetch(`${API_URL}/equipos?searchTerm=${searchTerm}&page=${currentPage}`),
                fetch(`${API_URL}/tipos-equipo`)
            ]);
            if (resEquipos.ok) {
                const responseJson: EquiposApiResponse = await resEquipos.json();
                const equiposArray = Array.isArray(responseJson.data) ? responseJson.data : [];
                setEquipos(equiposArray);
                setPagination(responseJson.pagination);
            }


            if (resTipos.ok) setTiposEquipo(await resTipos.json());
            setLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            showNotification('Error al cargar los datos del almacén.', 'error');
            setLoading(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, searchTerm]);


    const resetForm = () => {
        setForm(initialFormState);
        setEditingId(null);
        setError(null);
    };

    const openModal = (item?: Equipo) => {
        if (item) {
            setForm({
                tipo_id: item.tipo_id.toString(),
                descripcion: item.descripcion,
                marca: item.marca,
                modelo: item.modelo,
                numero_serie: item.numero_serie,
                identificador: item.identificador || ''
            });
            setEditingId(item.id);
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const url = editingId ? `${API_URL}/equipos/${editingId}` : `${API_URL}/equipos`;
        const method = editingId ? 'PUT' : 'POST';
        
        const originalEquipo = equipos.find(e => e.id === editingId);
        const body = { 
            ...form, 
            tipo_id: parseInt(form.tipo_id),
            // Preserve status on edit
            ...(editingId && { estado: originalEquipo?.estado })
        };

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al guardar el equipo.');
            }
            closeModal();
            fetchData();
            showNotification(`Equipo ${editingId ? 'actualizado' : 'creado'} con éxito.`, 'success');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Eliminar este equipo? Esta acción no se puede deshacer.')) {
            try {
                const response = await fetch(`${API_URL}/equipos/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al eliminar el equipo.');
                }
                fetchData();
                showNotification('Equipo eliminado con éxito.', 'success');
            } catch (error: any) {
                showNotification(error.message, 'error');
            }
        }
    };

    const handleExport = async () => {
            const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventario');

        const headerStyle = {
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

        const cellBorderStyle = {
            border: {
                top: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                left: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                bottom: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color },
                right: { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } as ExcelJS.Color }
            }
        };

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Tipo', key: 'tipo_nombre', width: 20 },
            { header: 'Descripción', key: 'descripcion', width: 30 },
            { header: 'Marca', key: 'marca', width: 20 },
            { header: 'Modelo', key: 'modelo', width: 20 },
            { header: 'Serie', key: 'numero_serie', width: 25 },
            { header: 'Identificador', key: 'identificador', width: 20 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Asignado A', key: 'persona_asignada', width: 25 },
            { header: 'Área Asignada', key: 'area_asignada', width: 25 },
        ];

           // Fetch all equipos without pagination
            const resEquipos = await fetch(`${API_URL}/equipos?searchTerm=${searchTerm}&forExport=true`);
            if (!resEquipos.ok) {
                throw new Error('Error al obtener los equipos para exportar.');
            }
            const responseJson = await resEquipos.json();
            const allEquipos = Array.isArray(responseJson.data) ? responseJson.data : [];

            const data = allEquipos.map((item: Equipo) => ({
            ...item,
            identificador: item.identificador || '',
            persona_asignada: item.persona_asignada || '',
            area_asignada: item.area_asignada || '',
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
        saveAs(blob, 'inventario_equipos.xlsx');
    };

    return (
        <div className="crud-module">
            <Notification notification={notification} onClose={hideNotification} />
            <div className="crud-header">
                <h2>Inventario de Equipos</h2>
                <div style={{display: 'flex', gap: '10px'}}>
                    <button className="action-btn" onClick={handleExport} title="Descargar reporte en Excel" style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none', whiteSpace: 'nowrap'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Exportar Excel
                    </button>
                    <button className="login-button" onClick={() => openModal()}>+ Nuevo Equipo</button>
                </div>
            </div>

            <div className="search-bar-container">
                <input
                    type="text"
                    placeholder="Buscar por tipo, descripción, marca, modelo, serie, estado, asignado..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                    />
            </div>
            {isModalOpen && createPortal(
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>{editingId ? 'Editar' : 'Nuevo'} Equipo</h3><button className="modal-close" onClick={closeModal}>×</button></div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="error-message">{error}</div>}
                                <div className="crud-form grid-form-2-cols">
                                    <select name="tipo_id" value={form.tipo_id} onChange={e => setForm({...form, tipo_id: e.target.value})} required>
                                        <option value="">-- Tipo de Equipo --</option>
                                        {tiposEquipo.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                    <input name="descripcion" placeholder="Descripción (ej: BODYCAM)" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} required />
                                    <input name="marca" placeholder="Marca (ej: HYTERA)" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} />
                                    <input name="modelo" placeholder="Modelo (ej: VM780-64GB)" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} />
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input name="numero_serie" placeholder="Número de Serie" value={form.numero_serie} onChange={e => setForm({...form, numero_serie: e.target.value})} required style={{flex: 1}} />
                                        <button type="button" className="action-btn" title="Escanear Código" onClick={() => alert('Función de escaneo en construcción')} style={{height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                                                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                                                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                                                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                                                <path d="M7 12h10"></path>
                                            </svg>
                                        </button>
                                    </div>
                                    <input name="identificador" placeholder="Identificador Interno (ej: CAM-01)" value={form.identificador} onChange={e => setForm({...form, identificador: e.target.value || ''})} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Registrar Equipo'}</button>
                            </div>
                        </form>
                    </div>

                </div>,
                document.body
            )}
            <div className="table-responsive">
                <table className="crud-table">
                    <thead><tr><th>Tipo</th><th>Descripción</th><th>Marca/Modelo</th><th>N/S</th><th>Estado</th><th>Asignado a</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {equipos.map(item => (
                            <tr key={item.id}>
                                <td>{item.tipo_nombre}</td><td>{item.descripcion}</td><td>{item.marca} {item.modelo}</td><td>{item.numero_serie}</td>
                                <td><span className={`badge status-${item.estado.toLowerCase()}`}>{item.estado}</span></td>
                                <td>
                                    {item.estado === 'ASIGNADO' 
                                        ? (item.persona_asignada 
                                            ? `${item.persona_asignada} (${item.area_asignada || 'Área no especificada'})` 
                                            : `Área: ${item.area_asignada || 'No especificada'}`)
                                        : (item.estado === 'ALMACEN' ? 'Libre en Almacén' : item.estado)}
                                </td>
                                <td>
                                    <button className="action-btn edit" onClick={() => openModal(item)} title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                    <button className="action-btn delete" onClick={() => handleDelete(item.id)} title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                                </td>
                            </tr>

                        ))}
                    </tbody>
                </table>
            </div>
             <div className="pagination">
                <span className="pagination-info">Mostrando {pagination.currentPage} de {pagination.totalPages} páginas</span>
                <div className="pagination-buttons">
                    <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={pagination.currentPage === 1}>Anterior</button>
                    <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.currentPage === pagination.totalPages}>Siguiente</button>
                </div>
             </div>

        </div>
    );
};

export default EquiposModule;