// c:\Users\ANTHONY\sistema-denuncias\src\components\SaludModule.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from './useNotification';
import Notification from '../hooks/Notification';
import { API_URL } from '../config/api';
// jsPDF se carga dinámicamente al exportar PDF
import './SaludModule.css'; // Importar los estilos

// Interfaces para el tipado de datos
interface Paciente {
  id?: number;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  edad: number | '';
  sexo: string;
}

interface Personal {
  id: number;
  id_personal?: number; // Añadimos esto por si la BD usa este nombre
  nombre: string;
  rol: string;
  area?: string;
}

interface AtencionResumen {
  id: number;
  numero: string;
  fecha: string;
  hora_inicio: string;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  clasificacion: string;
}

// Interfaz para el detalle completo
interface AtencionDetalle extends AtencionResumen {
  hora_fin: string;
  apellido_materno: string;
  edad: number;
  sexo: string;
  direccion: string;
  telefono: string;
  operador: string;
  hora_llamada: string;
  hora_ingreso: string;
  motivo: string;
  enfermedad_actual: string;
  examen_fisico: string;
  diagnosticos: { descripcion: string }[];
  tratamientos: { descripcion: string }[];
  personal: { nombre: string; rol: string }[];
}

const SaludModule = () => {
  const [atenciones, setAtenciones] = useState<AtencionResumen[]>([]);
  const [personalList, setPersonalList] = useState<Personal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewDetails, setViewDetails] = useState<AtencionDetalle | null>(null);
  const [saludPage, setSaludPage] = useState(1);
  const [saludPagination, setSaludPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();
  
  // Estado inicial del formulario complejo
  const initialFormState = {
    paciente: { dni: '', nombres: '', apellido_paterno: '', apellido_materno: '', edad: '' as number | '', sexo: 'M' },
    atencion: { 
        fecha: new Date().toISOString().split('T')[0], 
        hora_inicio: '', 
        hora_fin: '' 
    },
    ocurrencia: { direccion: '', telefono: '', operador: '', hora_llamada: '', hora_ingreso: '' },
    evaluacion: { motivo: '', enfermedad_actual: '', examen_fisico: '' },
    diagnostico: '', // Manejo simple de un diagnóstico principal para la UI
    tratamiento: '',
    clasificacion: 'Consulta',
    personal_ids: [] as number[] // IDs seleccionados
  };

  const [form, setForm] = useState(initialFormState);

  const fetchData = async (page = saludPage) => {
    setLoading(true);
    try {
        const [resAtenciones, resPersonal] = await Promise.all([
            fetch(`${API_URL}/salud/atenciones?page=${page}&limit=20`),
            fetch(`${API_URL}/salud/personal`)
        ]);
        if (resAtenciones.ok) {
            const json = await resAtenciones.json();
            setAtenciones(json.data || json);
            if (json.pagination) setSaludPagination(json.pagination);
        }
        if (resPersonal.ok) setPersonalList(await resPersonal.json());
    } catch (error) {
        console.error("Error cargando datos de salud:", error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchData(saludPage); }, [saludPage]);

  const buscarPaciente = async () => {
    if (form.paciente.dni.length < 8) {
        showNotification('El DNI debe tener 8 dígitos.', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/salud/pacientes/buscar/${form.paciente.dni}`);
        if (res.ok) {
            const data = await res.json();
            setForm(prev => ({
                ...prev,
                paciente: { ...prev.paciente, ...data, id: data.id } // Guardamos ID si existe
            }));
            showNotification('Paciente encontrado.', 'success');
        } else {
            // Limpiar datos excepto DNI para ingreso manual
            setForm(prev => ({
                ...prev,
                paciente: { ...initialFormState.paciente, dni: prev.paciente.dni }
            }));
            showNotification('Paciente no encontrado. Ingrese los datos manualmente.', 'error');
        }
    } catch (err) { console.error(err); }
  };

  const handlePersonalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value));
      setForm(prev => ({ ...prev, personal_ids: selectedIds }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        buscarPaciente();
    }
  };

  // Función auxiliar para obtener el ID del personal sin importar cómo venga de la BD
  const getPersonalId = (p: Personal) => p.id || p.id_personal || 0;

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Estructurar los datos para el backend
      const payload = {
          paciente: form.paciente,
          atencion: form.atencion,
          ocurrencia: form.ocurrencia,
          evaluacion: form.evaluacion,
          diagnosticos: [{ descripcion: form.diagnostico }],
          tratamiento: { descripcion: form.tratamiento },
          clasificacion: { tipo: form.clasificacion },
          personal_ids: form.personal_ids
      };

      try {
          const res = await fetch(`${API_URL}/salud/atenciones`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');

          showNotification('Atención registrada correctamente.', 'success');
          setIsModalOpen(false);
          setForm(initialFormState);
          fetchData();
      } catch (err: any) {
          showNotification(err.message, 'error');
      }
  };

  const handleView = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/salud/atenciones/${id}`);
      if (!res.ok) throw new Error('Error al cargar detalles');
      const data = await res.json();
      setViewDetails(data);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const exportarHojaAtencionPDF = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/salud/atenciones/${id}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      const det: AtencionDetalle = await res.json();

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const ml = 10;
      const mr = 200;
      const W = mr - ml;

      // Fondo blanco
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, 297, 'F');

      // Borde principal
      doc.setDrawColor(0);
      doc.setLineWidth(0.6);
      doc.rect(ml, 8, W, 278, 'S');

      const L = ml + 3;
      const R = mr - 3;
      const IW = R - L;
      let y = 14;

      // ============ HEADER ============
      // Logo Miraflores
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.circle(L + 10, y + 8, 7, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(0);
      doc.text('MIRAFLORES', L + 10, y + 6, { align: 'center' });
      doc.setFontSize(3.5);
      doc.setFont('helvetica', 'italic');
      doc.text('se vive mejor', L + 10, y + 9, { align: 'center' });

      // Titulo institucional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0);
      doc.text('MUNICIPALIDAD DE MIRAFLORES', L + 22, y + 2);
      doc.setFontSize(6.5);
      doc.text('GERENCIA DE SEGURIDAD CIUDADANA', L + 22, y + 6);

      // N° y sufijo
      doc.setFontSize(10);
      doc.text('N\u00b0', R - 45, y + 3);
      doc.setFontSize(14);
      doc.text(det.numero || 'S/N', R - 38, y + 3);
      doc.setFontSize(9);
      doc.text('-A', R - 5, y + 3);

      y += 14;

      // HOJA DE ATENCION titulo
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('HOJA DE ATENCIÓN', L + IW / 2, y, { align: 'center' });
      y += 3;

      // Fecha, Hora inicio, Hora fin a la derecha
      const fechaStr = det.fecha ? new Date(det.fecha).toLocaleDateString('es-PE') : '';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`FECHA: ${fechaStr}`, R - 60, y);
      y += 4;
      doc.text(`Hora Inicio: ${det.hora_inicio || ''}     Hora Term: ${det.hora_fin || ''}`, R - 60, y);
      y += 4;

      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 1;

      // ============ HELPERS ============
      const lh = 5.5;

      const field = (label: string, val: string, x: number, yy: number, endX: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(0);
        doc.text(label, x, yy);
        const lw = doc.getTextWidth(label) + 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        if (val) doc.text(val, x + lw + 1, yy);
        doc.setDrawColor(0);
        doc.setLineWidth(0.15);
        doc.line(x + lw, yy + 0.8, endX, yy + 0.8);
      };

      const fieldLabel = (label: string, x: number, yy: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(100);
        doc.text(label, x, yy);
      };

      const check = (label: string, checked: boolean, x: number, yy: number): number => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(x, yy - 2.8, 3, 3, 'S');
        if (checked) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('X', x + 0.4, yy);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(label, x + 4, yy);
        return x + 5 + doc.getTextWidth(label) + 3;
      };

      // ============ DATOS DEL PACIENTE ============
      y += 5;
      // Apellidos y Nombres en una fila con sublabels
      const col1 = L;
      const col2 = L + IW * 0.33;
      const col3 = L + IW * 0.66;

      field('', det.apellido_paterno || '', col1, y, col2 - 3);
      field('', det.apellido_materno || '', col2, y, col3 - 3);
      field('', det.nombres || '', col3, y, R);
      y += 3;
      fieldLabel('APELLIDO PATERNO', col1, y);
      fieldLabel('APELLIDO MATERNO', col2, y);
      fieldLabel('NOMBRES', col3, y);
      y += lh;

      // Dirección, Edad, Sexo
      field('', det.direccion || '', col1, y, L + IW * 0.55);
      // Edad box
      const edadX = L + IW * 0.58;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(edadX, y - 3.5, 12, 4.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('EDAD', edadX + 0.5, y - 0.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(String(det.edad || ''), edadX + 6, y);
      // Sexo
      const sexoX = edadX + 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('SEXO', sexoX, y - 0.5);
      let sxc = sexoX + 10;
      sxc = check('M', det.sexo === 'M', sxc, y);
      check('F', det.sexo === 'F', sxc, y);
      y += 3;
      fieldLabel('DIRECCIÓN DE LA OCURRENCIA', col1, y);
      y += lh;

      // Operador, Teléfono, N° de Caso
      field('', det.telefono || '', col1, y, col2 - 3);
      field('', det.operador || '', col2 + 15, y, col3 + 10);
      y += 3;
      fieldLabel('TELEFONO', col1, y);
      fieldLabel('OPERADOR', col2 + 15, y);
      fieldLabel('N° DE CASO', col3 + 15, y);
      y += lh;

      // Doc Identidad, Motivo de llamada, Hora ingreso
      field('Doc. Identidad (DNI)', det.dni || '', col1, y, col2 + 10);
      field('Motivo de la llamada', det.motivo || '', col2 + 15, y, R - 25);
      field('Hora ingreso', det.hora_ingreso || det.hora_llamada || '', R - 24, y, R);
      y += 3;
      fieldLabel('Doc. Identidad (DNI, CE, CIP)', col1, y);
      fieldLabel('Motivo de la llamada', col2 + 15, y);
      fieldLabel('Hora de ingreso de la llamada', R - 40, y);
      y += lh + 2;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ ANTECEDENTES PERSONALES ============
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('ANTECEDENTES PERSONALES', L, y);
      y += lh;

      // Alergias
      field('ALERGIAS A:', '', L, y, R);
      y += lh;

      // Checkboxes de antecedentes
      const antecedentes = ['Patológico', 'HTA', 'DM', 'DCV', 'Cardiopatía', 'Migraña', 'Gastritis', 'Asma', 'Dislip.', 'Psiq.', 'HIV', 'FUR'];
      let ax = L;
      antecedentes.forEach(a => {
        if (ax + doc.getTextWidth(a) + 8 > R) { ax = L; y += lh; }
        ax = check(a, false, ax, y);
      });
      y += lh;

      field('GESTA', '', L, y, L + 30);
      y += lh;
      field('OTROS:', '', L, y, R);
      y += lh + 2;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ EVALUACIÓN MÉDICA ============
      // Tratamiento Actual
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('Tratamiento Actual:', L, y);
      doc.text('T.E', L + 50, y);
      doc.text('F.I', L + 70, y);
      doc.text('CURSO', L + 90, y);
      y += lh;

      // Enfermedad Actual
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('Enfermedad actual:', L, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const enfLines = doc.splitTextToSize(det.enfermedad_actual || '', IW - 5);
      // Líneas horizontales
      doc.setDrawColor(180);
      doc.setLineWidth(0.1);
      const enfNumLines = Math.max(enfLines.length, 3);
      for (let i = 0; i < enfNumLines; i++) {
        doc.line(L, y + (i * 5) + 2, R, y + (i * 5) + 2);
      }
      doc.setTextColor(0);
      enfLines.forEach((line: string, i: number) => {
        doc.text(line, L + 1, y + (i * 5) + 1);
      });
      y += enfNumLines * 5 + 3;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ EXAMEN FISICO ============
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('EXAMEN FISICO', L, y);
      doc.text('P.A.', L + 30, y);
      doc.text('F.C.', L + 45, y);
      doc.text('F.R.', L + 60, y);
      doc.text('SAT.O2', L + 75, y);
      doc.text('T\u00b0', L + 95, y);
      doc.text('GLASGOW', L + 110, y);
      y += lh;

      // Examen físico texto
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const exLines = doc.splitTextToSize(det.examen_fisico || '', IW - 5);
      const exNumLines = Math.max(exLines.length, 2);
      doc.setDrawColor(180);
      doc.setLineWidth(0.1);
      for (let i = 0; i < exNumLines; i++) {
        doc.line(L, y + (i * 5) + 2, R, y + (i * 5) + 2);
      }
      exLines.forEach((line: string, i: number) => {
        doc.text(line, L + 1, y + (i * 5) + 1);
      });
      y += exNumLines * 5 + 3;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ EVOLUCIÓN / OBSERVACIONES ============
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Evolución / Observaciones:', L, y);
      y += lh;

      // Diagnostico e Impresión Diagnóstica
      const halfW = IW / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('CIE .10', L, y);
      doc.text('Impresión Diagnóstica:', L + 20, y);
      doc.text('Terapéutica:', L + halfW + 5, y);
      doc.text('Insumo:', R - 30, y);
      y += 4;

      // Diagnósticos
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      if (det.diagnosticos && det.diagnosticos.length > 0) {
        det.diagnosticos.forEach((d, i) => {
          doc.text(`- ${d.descripcion}`, L + 20, y + (i * 4));
        });
      }
      // Tratamientos
      if (det.tratamientos && det.tratamientos.length > 0) {
        det.tratamientos.forEach((t, i) => {
          doc.text(`- ${t.descripcion}`, L + halfW + 5, y + (i * 4));
        });
      }
      const diagLines = Math.max((det.diagnosticos?.length || 1), (det.tratamientos?.length || 1));
      y += diagLines * 4 + 4;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ CLASIFICACION ============
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('Clasificación de atención:', L, y);
      let clx = L + 42;
      const clasificaciones = ['Consulta', 'Emergencias', 'Urgencia', 'Traslado', 'Fallecido'];
      // Map to match stored values
      const clasMap: Record<string, string> = { 'Emergencia': 'Emergencias' };
      clasificaciones.forEach(c => {
        const storedVal = Object.entries(clasMap).find(([, v]) => v === c)?.[0] || c;
        clx = check(c, det.clasificacion === storedVal || det.clasificacion === c, clx, y);
      });

      // Destino
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      y += lh;
      doc.text('Destino:', R - 40, y);
      doc.line(R - 30, y + 0.8, R, y + 0.8);
      y += lh + 2;

      // Separador
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);
      y += 4;

      // ============ FIRMAS ============
      const third = IW / 3;
      const fc1 = L + third / 2;
      const fc2 = L + third + third / 2;
      const fc3 = L + 2 * third + third / 2;

      // Líneas de firma
      const fLineW = 30;
      y += 12;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(fc1 - fLineW / 2, y, fc1 + fLineW / 2, y);
      doc.line(fc2 - fLineW / 2, y, fc2 + fLineW / 2, y);
      doc.line(fc3 - fLineW / 2, y, fc3 + fLineW / 2, y);
      y += 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Firma', fc1, y, { align: 'center' });
      doc.text('Firma', fc2, y, { align: 'center' });
      doc.text('Firma', fc3, y, { align: 'center' });
      y += 4;

      // Nombres del personal
      if (det.personal && det.personal.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        det.personal.forEach((p, i) => {
          const center = i === 0 ? fc1 : i === 1 ? fc2 : fc3;
          if (i < 3) {
            doc.text(`Nombre: ${p.nombre}`, center - fLineW / 2, y);
          }
        });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Nombre:', fc1 - fLineW / 2, y);
        doc.text('Nombre:', fc2 - fLineW / 2, y);
        doc.text('Nombre:', fc3 - fLineW / 2, y);
      }
      y += 4;

      // Labels
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('Paciente o familiar: Responsable', fc1, y, { align: 'center' });
      doc.text('Paramédicos Responsable', fc2, y, { align: 'center' });
      doc.text('Recepcionado Por:', fc3, y, { align: 'center' });

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5);
      doc.setTextColor(120);
      doc.text(`Documento generado digitalmente - ${new Date().toLocaleString('es-PE')}`, pageW / 2, 287, { align: 'center' });

      // Vista previa
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch (err: any) {
      showNotification(err.message || 'Error al generar PDF', 'error');
    }
  };

  return (
    <div className="crud-module">
      <Notification notification={notification} onClose={hideNotification} />
      
      <div className="crud-header">
        <h2>Área de Salud: Registro de Atenciones</h2>
        <button className="login-button" onClick={() => setIsModalOpen(true)}>+ Nueva Atención</button>
      </div>

      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>DNI</th><th>Clasificación</th><th>Acciones</th></tr></thead>
          <tbody>
            {atenciones.map(a => (
              <tr key={a.id}>
                <td>{new Date(a.fecha).toLocaleDateString()}</td>
                <td>{a.hora_inicio}</td>
                <td>{a.nombres} {a.apellido_paterno}</td>
                <td>{a.dni}</td>
                <td><span className="badge status-active">{a.clasificacion || 'N/A'}</span></td>
                <td>
                  <button className="action-btn" onClick={() => exportarHojaAtencionPDF(a.id)} title="Ver PDF">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>
                  <button className="action-btn" onClick={() => handleView(a.id)} title="Ver Detalle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Cargando...</div>}

      {saludPagination.totalPages > 1 && (
        <div className="table-pagination">
          <button className="pagination-btn" onClick={() => setSaludPage(p => Math.max(1, p - 1))} disabled={saludPage <= 1}>Anterior</button>
          <span className="pagination-info">Página {saludPage} de {saludPagination.totalPages} ({saludPagination.total} registros)</span>
          <button className="pagination-btn" onClick={() => setSaludPage(p => Math.min(saludPagination.totalPages, p + 1))} disabled={saludPage >= saludPagination.totalPages}>Siguiente</button>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header">
              <h3>Registro de Atención Médica</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {/* SECCIÓN PACIENTE */}
                <h4>1. Datos del Paciente</h4>
                <div className="crud-form salud-grid-3">
                    <div className="salud-search-box">
                        <div className="input-wrapper">
                            <label>DNI</label>
                            <input 
                                value={form.paciente.dni} 
                                onChange={e => setForm({...form, paciente: {...form.paciente, dni: e.target.value}})} 
                                onBlur={buscarPaciente} // Busca al salir del campo
                                onKeyDown={handleKeyDown} // Busca al presionar Enter
                                placeholder="Ingrese DNI" required maxLength={8}
                            />
                        </div>
                        <button type="button" className="action-btn search-btn" onClick={buscarPaciente} title="Buscar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </button>
                    </div>
                    <div><label>Nombres</label><input value={form.paciente.nombres} onChange={e => setForm({...form, paciente: {...form.paciente, nombres: e.target.value}})} required placeholder="Nombres del paciente" /></div>
                    <div><label>Ap. Paterno</label><input value={form.paciente.apellido_paterno} onChange={e => setForm({...form, paciente: {...form.paciente, apellido_paterno: e.target.value}})} required /></div>
                    <div><label>Ap. Materno</label><input value={form.paciente.apellido_materno} onChange={e => setForm({...form, paciente: {...form.paciente, apellido_materno: e.target.value}})} /></div>
                    <div><label>Edad</label><input type="number" value={form.paciente.edad} onChange={e => setForm({...form, paciente: {...form.paciente, edad: parseInt(e.target.value) || ''}})} required /></div>
                    <div>
                        <label>Sexo</label>
                        <select value={form.paciente.sexo} onChange={e => setForm({...form, paciente: {...form.paciente, sexo: e.target.value}})}>
                            <option value="M">Masculino</option><option value="F">Femenino</option>
                        </select>
                    </div>
                </div>

                {/* SECCIÓN ATENCIÓN Y OCURRENCIA */}
                <h4>2. Datos de la Atención</h4>
                <div className="crud-form salud-grid-3">
                    <div><label>Fecha</label><input type="date" value={form.atencion.fecha} onChange={e => setForm({...form, atencion: {...form.atencion, fecha: e.target.value}})} required /></div>
                    <div><label>Hora Inicio</label><input type="time" value={form.atencion.hora_inicio} onChange={e => setForm({...form, atencion: {...form.atencion, hora_inicio: e.target.value}})} required /></div>
                    <div><label>Hora Fin</label><input type="time" value={form.atencion.hora_fin} onChange={e => setForm({...form, atencion: {...form.atencion, hora_fin: e.target.value}})} /></div>
                    
                    <div className="full-width"><label>Dirección Ocurrencia</label><input value={form.ocurrencia.direccion} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, direccion: e.target.value}})} placeholder="Lugar donde ocurrió el incidente" /></div>
                    <div><label>Teléfono</label><input value={form.ocurrencia.telefono} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, telefono: e.target.value}})} /></div>
                    <div><label>Hora Llamada</label><input type="time" value={form.ocurrencia.hora_llamada} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, hora_llamada: e.target.value}})} /></div>
                    <div><label>Operador</label><input value={form.ocurrencia.operador} onChange={e => setForm({...form, ocurrencia: {...form.ocurrencia, operador: e.target.value}})} /></div>
                </div>

                {/* SECCIÓN EVALUACIÓN */}
                <h4>3. Evaluación Médica</h4>
                <div className="crud-form">
                    <label>Motivo de Consulta</label>
                    <input value={form.evaluacion.motivo} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, motivo: e.target.value}})} required placeholder="Ej: Dolor abdominal, accidente de tránsito..." />
                    
                    <label>Enfermedad Actual / Relato</label>
                    <textarea value={form.evaluacion.enfermedad_actual} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, enfermedad_actual: e.target.value}})} rows={2}></textarea>
                    
                    <label>Examen Físico</label>
                    <textarea value={form.evaluacion.examen_fisico} onChange={e => setForm({...form, evaluacion: {...form.evaluacion, examen_fisico: e.target.value}})} rows={2} placeholder="PA, FC, FR, SatO2, T°, etc."></textarea>
                </div>

                {/* SECCIÓN DIAGNÓSTICO Y TRATAMIENTO */}
                <div className="crud-form salud-grid-2">
                    <div>
                        <label>Diagnóstico (CIE-10 o descriptivo)</label>
                        <textarea value={form.diagnostico} onChange={e => setForm({...form, diagnostico: e.target.value})} rows={3} required></textarea>
                    </div>
                    <div>
                        <label>Tratamiento / Indicaciones</label>
                        <textarea value={form.tratamiento} onChange={e => setForm({...form, tratamiento: e.target.value})} rows={3}></textarea>
                    </div>
                </div>

                <div className="crud-form salud-grid-2">
                    <div>
                        <label>Clasificación</label>
                        <select value={form.clasificacion} onChange={e => setForm({...form, clasificacion: e.target.value})}>
                            <option value="Consulta">Consulta</option>
                            <option value="Emergencia">Emergencia</option>
                            <option value="Urgencia">Urgencia</option>
                            <option value="Traslado">Traslado</option>
                            <option value="Fallecido">Fallecido</option>
                        </select>
                    </div>
                    <div>
                        <label>Personal Asignado (Ctrl+Click para varios)</label>
                        <select multiple value={form.personal_ids.map(String)} onChange={handlePersonalChange} style={{height: '80px'}}>
                            {personalList.map(p => (
                                <option key={getPersonalId(p)} value={getPersonalId(p)}>
                                    {p.nombre} ({p.area || p.rol})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">Registrar Atención</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* MODAL DE DETALLE */}
      {viewDetails && createPortal(
        <div className="modal-overlay" onClick={() => setViewDetails(null)}>
          <div className="modal-content" style={{maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de Atención: {viewDetails.numero}</h3>
              <button className="modal-close" onClick={() => setViewDetails(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="salud-grid-2">
                <div>
                  <h4>Paciente</h4>
                  <p><strong>Nombre:</strong> {viewDetails.nombres} {viewDetails.apellido_paterno} {viewDetails.apellido_materno}</p>
                  <p><strong>DNI:</strong> {viewDetails.dni}</p>
                  <p><strong>Edad:</strong> {viewDetails.edad} años</p>
                  <p><strong>Sexo:</strong> {viewDetails.sexo}</p>
                </div>
                <div>
                  <h4>Ocurrencia</h4>
                  <p><strong>Fecha:</strong> {new Date(viewDetails.fecha).toLocaleDateString()}</p>
                  <p><strong>Hora:</strong> {viewDetails.hora_inicio} - {viewDetails.hora_fin || 'En curso'}</p>
                  <p><strong>Lugar:</strong> {viewDetails.direccion || '-'}</p>
                  <p><strong>Teléfono:</strong> {viewDetails.telefono || '-'}</p>
                </div>
              </div>

              <h4>Evaluación Médica</h4>
              <div style={{background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', marginBottom: '10px'}}>
                <p><strong>Motivo:</strong> {viewDetails.motivo}</p>
                <p><strong>Enfermedad Actual:</strong> {viewDetails.enfermedad_actual || '-'}</p>
                <p><strong>Examen Físico:</strong> {viewDetails.examen_fisico || '-'}</p>
              </div>

              <div className="salud-grid-2">
                <div>
                  <h4>Diagnósticos</h4>
                  <ul style={{paddingLeft: '20px', margin: 0}}>
                    {viewDetails.diagnosticos.map((d, i) => <li key={i}>{d.descripcion}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Clasificación</h4>
                  <span className="badge status-active">{viewDetails.clasificacion}</span>
                </div>
              </div>

              <h4>Tratamiento</h4>
              <div style={{background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)'}}>
                {viewDetails.tratamientos.map((t, i) => <div key={i}>{t.descripcion}</div>)}
              </div>

              <h4>Personal Asignado</h4>
              <ul style={{display: 'flex', gap: '10px', padding: 0, listStyle: 'none', flexWrap: 'wrap'}}>
                {viewDetails.personal.map((p, i) => (
                  <li key={i} className="badge status-inactive">{p.nombre} ({p.rol})</li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="login-button" onClick={() => setViewDetails(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SaludModule;
