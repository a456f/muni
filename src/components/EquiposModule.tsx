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
  sbn: string | null;
  fecha_registro: string;
  estado: 'ALMACEN' | 'ASIGNADO' | 'MANTENIMIENTO' | 'BAJA';
  operatividad: 'OPERATIVO' | 'INOPERATIVO' | null;
  validacion: 'PENDIENTE' | 'VALIDADO';
  tipo_nombre: string;
  persona_asignada: string | null;
  area_asignada: string | null;
}

interface FotoAlmacen {
  id: number;
  ruta: string;
  fecha_subida: string;
}

interface Revision {
  id: number;
  equipo_id: number;
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  comentario: string | null;
  foto_ruta: string | null;
  fotos: FotoAlmacen[];
  fecha_revision: string;
  nombre_revisor: string;
}

interface Pagination {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
}

interface ResumenItem {
    tipo: string;
    cantidad: number;
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
        identificador: '',
        sbn: ''
    };
    const [form, setForm] = useState(initialFormState);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pagination, setPagination] = useState<Pagination>({totalItems: 0, totalPages: 1, currentPage: 1, limit: 15});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revisiones, setRevisiones] = useState<Revision[]>([]);
    const [revEquipo, setRevEquipo] = useState<Equipo | null>(null);
    const [fotoGaleria, setFotoGaleria] = useState<{ fotos: string[]; index: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const resetViewer = () => { setZoom(1); setRotation(0); setImgPos({ x: 0, y: 0 }); };
    const openGaleria = (fotos: string[], index: number) => { resetViewer(); setFotoGaleria({ fotos, index }); };
    const changePhoto = (newIndex: number) => { resetViewer(); setFotoGaleria(prev => prev ? { ...prev, index: newIndex } : null); };
    const { notification, showNotification, hideNotification } = useNotification();
    const [error, setError] = useState<string | null>(null);
    const [resumen, setResumen] = useState<ResumenItem[]>([]);
    const [totalEquipos, setTotalEquipos] = useState(0);

    const fetchData = async () => {
        try {
            const [resEquipos, resTipos, resResumen] = await Promise.all([
                fetch(`${API_URL}/equipos?searchTerm=${searchTerm}&page=${currentPage}`),
                fetch(`${API_URL}/tipos-equipo`),
                fetch(`${API_URL}/equipos/resumen`)
            ]);
            if (resEquipos.ok) {
                const responseJson: EquiposApiResponse = await resEquipos.json();
                const equiposArray = Array.isArray(responseJson.data) ? responseJson.data : [];
                setEquipos(equiposArray);
                setPagination(responseJson.pagination);
            }

            if (resResumen.ok) {
                const resumenJson = await resResumen.json();
                setResumen(resumenJson.resumen);
                setTotalEquipos(resumenJson.total);
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
        const saved = sessionStorage.getItem('searchEquipo');
        if (saved) {
            setSearchTerm(saved);
            sessionStorage.removeItem('searchEquipo');
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [currentPage, searchTerm]);


    const openRevisiones = async (equipo: Equipo) => {
        setRevEquipo(equipo);
        try {
            const res = await fetch(`${API_URL}/almacen/revisiones/${equipo.id}`);
            if (!res.ok) { setRevisiones([]); return; }
            const revs: Revision[] = await res.json();

            // Cargar fotos de cada revisión desde fotos_almacen
            const revsConFotos = await Promise.all(revs.map(async (rev) => {
                try {
                    const fotosRes = await fetch(`${API_URL}/almacen/fotos/revision/${rev.id}`);
                    const fotos = fotosRes.ok ? await fotosRes.json() : [];
                    return { ...rev, fotos };
                } catch {
                    // Si falla, intentar con foto_ruta legacy
                    return { ...rev, fotos: rev.foto_ruta ? [{ id: 0, ruta: rev.foto_ruta, fecha_subida: rev.fecha_revision }] : [] };
                }
            }));
            setRevisiones(revsConFotos);
        } catch { setRevisiones([]); }
    };

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
                identificador: item.identificador || '',
                sbn: item.sbn || ''
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
            { header: 'SBN', key: 'sbn', width: 20 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Operatividad', key: 'operatividad', width: 15 },
            { header: 'Validación', key: 'validacion', width: 15 },
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
            sbn: item.sbn || '',
            operatividad: item.operatividad || 'OPERATIVO',
            validacion: item.validacion || 'PENDIENTE',
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
            {/* Resumen visual por tipo */}
            {resumen.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '10px',
                    marginBottom: '16px',
                    padding: '0'
                }}>
                    {/* Tarjeta Total */}
                    <div style={{
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '80px'
                    }}>
                        <span style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 500 }}>TOTAL EQUIPOS</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }}>{totalEquipos.toLocaleString()}</span>
                    </div>
                    {/* Tarjetas por tipo */}
                    {resumen.map((item, i) => {
                        const colors = ['#059669','#d97706','#7c3aed','#dc2626','#0891b2','#c026d3','#ea580c','#4f46e5','#0d9488','#be123c','#65a30d','#6366f1','#e11d48','#0284c7','#a21caf'];
                        const color = colors[i % colors.length];
                        return (
                            <div key={item.tipo} style={{
                                background: 'var(--bg-card, #fff)',
                                borderRadius: '10px',
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '80px',
                                borderLeft: `4px solid ${color}`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                            }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 500, textTransform: 'uppercase' }}>{item.tipo}</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{item.cantidad}</span>
                            </div>
                        );
                    })}
                </div>
            )}

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
                                    <input name="sbn" placeholder="Código SBN" value={form.sbn} onChange={e => setForm({...form, sbn: e.target.value || ''})} />
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
                    <thead><tr><th>Tipo</th><th>Descripción</th><th>Marca/Modelo</th><th>N/S</th><th>SBN</th><th>Estado</th><th>Operatividad</th><th>Validación</th><th>Asignado a</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {equipos.map(item => (
                            <tr key={item.id}>
                                <td>{item.tipo_nombre}</td><td>{item.descripcion}</td><td>{item.marca} {item.modelo}</td><td>{item.numero_serie}</td><td>{item.sbn || '-'}</td>
                                <td><span className={`badge status-${item.estado.toLowerCase()}`}>{item.estado}</span></td>
                                <td><span className={`badge status-${(item.operatividad || 'OPERATIVO').toLowerCase()}`}>{item.operatividad || 'OPERATIVO'}</span></td>
                                <td><span className={`badge status-${(item.validacion || 'PENDIENTE').toLowerCase()}`}>{item.validacion || 'PENDIENTE'}</span></td>
                                <td>
                                    {item.estado === 'ASIGNADO' 
                                        ? (item.persona_asignada 
                                            ? `${item.persona_asignada} (${item.area_asignada || 'Área no especificada'})` 
                                            : `Área: ${item.area_asignada || 'No especificada'}`)
                                        : (item.estado === 'ALMACEN' ? 'Libre en Almacén' : item.estado)}
                                </td>
                                <td>
                                    <button className="action-btn" onClick={() => openRevisiones(item)} title="Ver Revisiones">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42Z"></path><circle cx="6" cy="9" r="1" fill="currentColor"></circle></svg>
                                    </button>
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

            {/* Modal Revisiones del Equipo */}
            {revEquipo && createPortal(
                <div className="modal-overlay" onClick={() => { setRevEquipo(null); setRevisiones([]); }}>
                    <div className="modal-content" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Revisiones: {revEquipo.descripcion} ({revEquipo.numero_serie})</h3>
                            <button className="modal-close" onClick={() => { setRevEquipo(null); setRevisiones([]); }}>×</button>
                        </div>
                        <div className="modal-body">
                            {revisiones.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 8 }}><path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42Z"></path><circle cx="6" cy="9" r="1"></circle></svg>
                                    <p>Este equipo no tiene revisiones registradas.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {revisiones.map(rev => (
                                        <div key={rev.id} style={{
                                            display: 'flex', gap: '14px', padding: '14px',
                                            background: 'var(--bg-input, #f8fafc)', borderRadius: '10px',
                                            border: '1px solid var(--border-color, #e2e8f0)'
                                        }}>
                                            {/* Fotos thumbnails */}
                                            {(() => {
                                                const baseUrl = API_URL.replace(/\/api\/?$/, '');
                                                const allFotos = rev.fotos && rev.fotos.length > 0
                                                    ? rev.fotos.map(f => `${baseUrl}/${f.ruta}`)
                                                    : rev.foto_ruta ? [`${baseUrl}/${rev.foto_ruta}`] : [];
                                                if (allFotos.length > 0) return (
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
                                                        {allFotos.map((url, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={() => openGaleria(allFotos, idx)}
                                                                style={{
                                                                    width: 70, height: 70, borderRadius: '8px', overflow: 'hidden',
                                                                    cursor: 'pointer', border: '1px solid var(--border-color, #e2e8f0)'
                                                                }}
                                                            >
                                                                <img src={url} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                                return (
                                                    <div style={{
                                                        width: 70, height: 70, borderRadius: '8px', flexShrink: 0,
                                                        background: 'var(--bg-hover, #e2e8f0)', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #94a3b8)'
                                                    }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                    </div>
                                                );
                                            })()}

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: 4 }}>
                                                    <strong style={{ fontSize: '0.9rem' }}>{rev.nombre_revisor}</strong>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                                                        {new Date(rev.fecha_revision).toLocaleString()}
                                                    </span>
                                                </div>

                                                {rev.comentario && (
                                                    <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', lineHeight: 1.4 }}>{rev.comentario}</p>
                                                )}

                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                                                    {rev.ubicacion && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                            {rev.ubicacion}
                                                        </span>
                                                    )}
                                                    {rev.latitud && rev.longitud && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${rev.latitud},${rev.longitud}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>
                                                            Ver en mapa
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{revisiones.length} revisión{revisiones.length !== 1 ? 'es' : ''}</span>
                            <button className="login-button" onClick={() => { setRevEquipo(null); setRevisiones([]); }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Modal Visor de Evidencias */}
            {fotoGaleria && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.92)',
                        display: 'flex', flexDirection: 'column', userSelect: 'none'
                    }}
                    onWheel={e => { e.preventDefault(); setZoom(z => Math.min(5, Math.max(0.5, z + (e.deltaY > 0 ? -0.2 : 0.2)))); }}
                >
                    {/* Barra superior */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', background: 'rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                            Evidencia {fotoGaleria.index + 1} de {fotoGaleria.fotos.length}
                        </div>

                        {/* Herramientas centrales */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                                { icon: '−', title: 'Alejar', action: () => setZoom(z => Math.max(0.5, z - 0.25)) },
                                { icon: `${Math.round(zoom * 100)}%`, title: 'Zoom actual', action: () => { setZoom(1); setImgPos({ x: 0, y: 0 }); }, wide: true },
                                { icon: '+', title: 'Acercar', action: () => setZoom(z => Math.min(5, z + 0.25)) },
                                { icon: '↻', title: 'Rotar derecha', action: () => setRotation(r => r + 90) },
                                { icon: '↺', title: 'Rotar izquierda', action: () => setRotation(r => r - 90) },
                                { icon: '⟲', title: 'Restablecer', action: resetViewer },
                            ].map((btn, i) => (
                                <button key={i} onClick={btn.action} title={btn.title} style={{
                                    padding: btn.wide ? '6px 14px' : '6px 12px', background: 'rgba(255,255,255,0.12)',
                                    color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    fontSize: btn.wide ? '0.8rem' : '1.1rem', fontWeight: 600,
                                    minWidth: btn.wide ? 60 : 36, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>{btn.icon}</button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <a
                                href={fotoGaleria.fotos[fotoGaleria.index]}
                                download={`evidencia_${fotoGaleria.index + 1}.jpg`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                                    background: '#22c55e', color: '#fff', borderRadius: '6px', textDecoration: 'none',
                                    fontWeight: 600, fontSize: '0.85rem'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Descargar
                            </a>
                            <button onClick={() => { setFotoGaleria(null); resetViewer(); }} style={{
                                padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
                            }}>Cerrar</button>
                        </div>
                    </div>

                    {/* Área principal: flechas + imagen */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                        {/* Flecha izquierda */}
                        {fotoGaleria.fotos.length > 1 && (
                            <button onClick={() => changePhoto((fotoGaleria.index - 1 + fotoGaleria.fotos.length) % fotoGaleria.fotos.length)} style={{
                                position: 'absolute', left: 16, width: 50, height: 50, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
                                cursor: 'pointer', fontSize: '1.8rem', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)'
                            }}>‹</button>
                        )}

                        {/* Imagen con zoom, rotación y drag */}
                        <div
                            style={{
                                cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '100%', height: '100%', overflow: 'hidden'
                            }}
                            onMouseDown={e => {
                                if (zoom > 1) { setDragging(true); setDragStart({ x: e.clientX - imgPos.x, y: e.clientY - imgPos.y }); }
                            }}
                            onMouseMove={e => {
                                if (dragging) setImgPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                            }}
                            onMouseUp={() => setDragging(false)}
                            onMouseLeave={() => setDragging(false)}
                            onDoubleClick={() => { if (zoom === 1) { setZoom(2.5); } else { resetViewer(); } }}
                        >
                            <img
                                src={fotoGaleria.fotos[fotoGaleria.index]}
                                alt={`Evidencia ${fotoGaleria.index + 1}`}
                                draggable={false}
                                style={{
                                    maxWidth: zoom === 1 ? '85vw' : 'none',
                                    maxHeight: zoom === 1 ? '78vh' : 'none',
                                    width: zoom > 1 ? `${zoom * 50}vw` : undefined,
                                    borderRadius: '8px',
                                    objectFit: 'contain',
                                    transform: `translate(${imgPos.x}px, ${imgPos.y}px) rotate(${rotation}deg)`,
                                    transition: dragging ? 'none' : 'transform 0.2s ease'
                                }}
                            />
                        </div>

                        {/* Flecha derecha */}
                        {fotoGaleria.fotos.length > 1 && (
                            <button onClick={() => changePhoto((fotoGaleria.index + 1) % fotoGaleria.fotos.length)} style={{
                                position: 'absolute', right: 16, width: 50, height: 50, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
                                cursor: 'pointer', fontSize: '1.8rem', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)'
                            }}>›</button>
                        )}
                    </div>

                    {/* Thumbnails abajo */}
                    {fotoGaleria.fotos.length > 1 && (
                        <div style={{
                            display: 'flex', gap: '8px', justifyContent: 'center',
                            padding: '12px 20px', background: 'rgba(0,0,0,0.5)'
                        }}>
                            {fotoGaleria.fotos.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => changePhoto(idx)}
                                    style={{
                                        width: 56, height: 56, borderRadius: '8px', overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: idx === fotoGaleria.index ? '3px solid #22c55e' : '2px solid rgba(255,255,255,0.25)',
                                        opacity: idx === fotoGaleria.index ? 1 : 0.5,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            , document.body)}
        </div>
    );
};

export default EquiposModule;