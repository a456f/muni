import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface TipoEquipo {
  id: number;
  nombre: string;
}

const TiposEquipoModule = () => {
  const [tipos, setTipos] = useState<TipoEquipo[]>([]);
  const [form, setForm] = useState({ nombre: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();

    const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/tipos-equipo`);
      if (res.ok) setTipos(await res.json());
    } catch (error) { 
        console.error("Error fetching data:", error);
        showNotification('Error al cargar los tipos de equipo.', 'error');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ nombre: '' });
    setEditingId(null);
  };

  const openModal = (item?: TipoEquipo) => {
    if (item) {
      setForm({ nombre: item.nombre });
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
    const url = editingId ? `${API_URL}/tipos-equipo/${editingId}` : `${API_URL}/tipos-equipo`;
    const method = editingId ? 'PUT' : 'POST';
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el tipo de equipo.');
      }
      closeModal();
      fetchData();
      showNotification(`Tipo de equipo ${editingId ? 'actualizado' : 'creado'} con éxito.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este tipo de equipo?')) {
      try {
        const response = await fetch(`${API_URL}/tipos-equipo/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar el tipo de equipo.');
        }
        fetchData();
        showNotification('Tipo de equipo eliminado con éxito.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };
  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tipos de Equipo');

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
        { header: 'Nombre Tipo', key: 'nombre', width: 40 },
    ];
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
    saveAs(new Blob([buffer]), 'tipos_equipo.xlsx');
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      <div className="crud-header">
        <h2>Gestión de Tipos de Equipo</h2>
        <div style={{display: 'flex', gap: '10px'}}>
            <button className="action-btn" onClick={handleExport} title="Descargar reporte en Excel" style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', height: 'auto', backgroundColor: '#107c41', color: 'white', border: 'none'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Exportar Excel
            </button>
            <button className="login-button" onClick={() => openModal()}>+ Nuevo Tipo</button>
        </div>
      </div>
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Nuevo'} Tipo de Equipo</h3><button className="modal-close" onClick={closeModal}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body"><div className="crud-form">
                <input placeholder="Nombre del Tipo (ej: CÁMARA, RADIO)" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required autoFocus />
              </div></div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="login-button">{editingId ? 'Guardar Cambios' : 'Crear Tipo'}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>ID</th><th>Nombre</th><th>Acciones</th></tr></thead>
          <tbody>
            {tipos.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td><td>{item.nombre.toUpperCase()}</td>
                <td>
                  <button className="action-btn edit" onClick={() => openModal(item)} title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                  <button className="action-btn delete" onClick={() => handleDelete(item.id)} title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TiposEquipoModule;