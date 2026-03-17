import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Interfaces
interface Area {
  id: number;
  nombre: string;
}

interface Persona {
  id: number;
  nombre: string;
  area_id: number | null;
  area_nombre: string | null;
}

const PersonalAreasModule = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const { notification, showNotification, hideNotification } = useNotification();

  // State for Areas Modal
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaForm, setAreaForm] = useState({ nombre: '' });
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);

  // State for Personas Modal
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [personaForm, setPersonaForm] = useState({ nombre: '', area_id: '' });
  const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [resAreas, resPersonas] = await Promise.all([
        fetch(`${API_URL}/areas`),
        fetch(`${API_URL}/personas`)
      ]);
      if (resAreas.ok) setAreas(await resAreas.json());
      if (resPersonas.ok) setPersonas(await resPersonas.json());
    } catch (error) {
      console.error("Error fetching data:", error);
      showNotification('Error al cargar los datos.', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Areas Logic ---
  const openAreaModal = (area?: Area) => {
    if (area) {
      setAreaForm({ nombre: area.nombre });
      setEditingAreaId(area.id);
    } else {
      setAreaForm({ nombre: '' });
      setEditingAreaId(null);
    }
    setIsAreaModalOpen(true);
  };

  const handleAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingAreaId ? `${API_URL}/areas/${editingAreaId}` : `${API_URL}/areas`;
    const method = editingAreaId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(areaForm) });
      if (!response.ok) throw new Error((await response.json()).error || 'Error al guardar el área.');
      setIsAreaModalOpen(false);
      fetchData();
      showNotification(`Área ${editingAreaId ? 'actualizada' : 'creada'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleAreaDelete = async (id: number) => {
    if (window.confirm('¿Eliminar esta área? El personal asignado quedará sin área.')) {
      try {
        const response = await fetch(`${API_URL}/areas/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al eliminar el área.');
        fetchData();
        showNotification('Área eliminada con éxito.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  // --- Personas Logic ---
  const openPersonaModal = (persona?: Persona) => {
    if (persona) {
      setPersonaForm({ nombre: persona.nombre, area_id: persona.area_id?.toString() || '' });
      setEditingPersonaId(persona.id);
    } else {
      setPersonaForm({ nombre: '', area_id: '' });
      setEditingPersonaId(null);
    }
    setIsPersonaModalOpen(true);
  };

  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingPersonaId ? `${API_URL}/personas/${editingPersonaId}` : `${API_URL}/personas`;
    const method = editingPersonaId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(personaForm) });
      if (!response.ok) throw new Error((await response.json()).error || 'Error al guardar la persona.');
      setIsPersonaModalOpen(false);
      fetchData();
      showNotification(`Persona ${editingPersonaId ? 'actualizada' : 'creada'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handlePersonaDelete = async (id: number) => {
    if (window.confirm('¿Eliminar esta persona?')) {
      try {
        const response = await fetch(`${API_URL}/personas/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al eliminar la persona.');
        fetchData();
        showNotification('Persona eliminada con éxito.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  const handleExportAreas = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Áreas');
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
        { header: 'Nombre Área', key: 'nombre', width: 40 },
    ];
    worksheet.addRows(areas);

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
    saveAs(new Blob([buffer]), 'areas.xlsx');
  };

  const handleExportPersonas = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Personal');

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
        { header: 'Nombre', key: 'nombre', width: 40 },
        { header: 'Área', key: 'area_nombre', width: 30 },
    ];

    const data = personas.map(p => ({ ...p, area_nombre: p.area_nombre || 'N/A' }));
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
    saveAs(new Blob([buffer]), 'personal.xlsx');
  };

  return (
    <div className="personal-areas-container">
      <Notification notification={notification} onClose={hideNotification} />
      
      <div className="crud-module">
        <div className="crud-header"><h2>Gestión de Áreas</h2><div style={{display: 'flex', gap: '10px'}}><button className="action-btn" onClick={handleExportAreas} title="Descargar reporte en Excel" style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none'}}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>Exportar Excel</button><button className="login-button" onClick={() => openAreaModal()}>+ Nueva Área</button></div></div>
        <div className="table-responsive"><table className="crud-table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Acciones</th></tr></thead>
            <tbody>{areas.map(area => (<tr key={area.id}><td>{area.id}</td><td>{area.nombre}</td><td>
              <button className="action-btn edit" onClick={() => openAreaModal(area)} title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
              <button className="action-btn delete" onClick={() => handleAreaDelete(area.id)} title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </td></tr>))}</tbody>
        </table></div>
      </div>

      <div className="crud-module">
        <div className="crud-header"><h2>Gestión de Personal</h2><div style={{display: 'flex', gap: '10px'}}><button className="action-btn" onClick={handleExportPersonas} title="Descargar reporte en Excel" style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none'}}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>Exportar Excel</button><button className="login-button" onClick={() => openPersonaModal()}>+ Nueva Persona</button></div></div>
        <div className="table-responsive"><table className="crud-table">
            <thead><tr><th>Nombre</th><th>Área</th><th>Acciones</th></tr></thead>
            <tbody>{personas.map(p => (<tr key={p.id}><td>{p.nombre}</td><td>{p.area_nombre || 'N/A'}</td><td>
              <button className="action-btn edit" onClick={() => openPersonaModal(p)} title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
              <button className="action-btn delete" onClick={() => handlePersonaDelete(p.id)} title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </td></tr>))}</tbody>
        </table></div>
      </div>

      {isAreaModalOpen && createPortal(<div className="modal-overlay" onClick={() => setIsAreaModalOpen(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{editingAreaId ? 'Editar' : 'Nueva'} Área</h3><button className="modal-close" onClick={() => setIsAreaModalOpen(false)}>×</button></div>
        <form onSubmit={handleAreaSubmit}><div className="modal-body"><div className="crud-form">
          <input placeholder="Nombre del Área" value={areaForm.nombre} onChange={e => setAreaForm({ ...areaForm, nombre: e.target.value })} required />
        </div></div><div className="modal-footer">
          <button type="button" className="cancel-btn" onClick={() => setIsAreaModalOpen(false)}>Cancelar</button>
          <button type="submit" className="login-button">{editingAreaId ? 'Guardar Cambios' : 'Crear Área'}</button>
        </div></form>
      </div></div>, document.body)}

      {isPersonaModalOpen && createPortal(<div className="modal-overlay" onClick={() => setIsPersonaModalOpen(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{editingPersonaId ? 'Editar' : 'Nueva'} Persona</h3><button className="modal-close" onClick={() => setIsPersonaModalOpen(false)}>×</button></div>
        <form onSubmit={handlePersonaSubmit}><div className="modal-body"><div className="crud-form">
          <input placeholder="Nombre Completo" value={personaForm.nombre} onChange={e => setPersonaForm({ ...personaForm, nombre: e.target.value })} required />
          <select value={personaForm.area_id} onChange={e => setPersonaForm({ ...personaForm, area_id: e.target.value })}>
            <option value="">-- Sin Área --</option>
            {areas.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}
          </select>
        </div></div><div className="modal-footer">
          <button type="button" className="cancel-btn" onClick={() => setIsPersonaModalOpen(false)}>Cancelar</button>
          <button type="submit" className="login-button">{editingPersonaId ? 'Guardar Cambios' : 'Crear Persona'}</button>
        </div></form>
      </div></div>, document.body)}
    </div>
  );
};

export default PersonalAreasModule;