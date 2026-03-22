import React, { useState, useEffect } from 'react';
import './IncidenciasModule.css';
import EvidenciasModule from './EvidenciasModule';
import Notification from '../hooks/Notification';
import type { User } from '../services/authService';
import { useNotification } from './useNotification';
import { createPortal } from 'react-dom';
import { API_URL } from '../config/api';
// jsPDF se carga dinámicamente al exportar PDF

// Interfaz actualizada según la nueva tabla 'incidencias'
interface Incidencia {
  id_incidencia: number;
  numero_parte: string | null;
  servicio: string | null;
  zona: string | null;
  dia: string | null;
  fecha: string | null;
  hora_hecho: string | null;
  hora_denuncia: string | null;
  hora_intervencion: string | null;
  modalidad_intervencion: string | null;
  unidad_serenazgo: string | null;
  lugar_hecho: string | null;
  tipo_hecho: string | null;
  arma_usada: string | null;
  monto_afectado: number | null;
  nombres_agraviado: string | null;
  senas_autor: string | null;
  supervisor_nombre: string | null;
  descripcion_relato: string | null;
  firma_ruta: string | null;
  id_sereno: number | null;
  fecha_registro: string;
  nombre_sereno?: string; // Campo extra del JOIN
}

interface Props {
  user?: User;
}

const IncidenciasModule = ({ user }: Props) => {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  // Catálogos para facilitar la entrada de datos (aunque la tabla ahora usa texto)
  const [tiposCat, setTiposCat] = useState<any[]>([]);
  const [zonasCat, setZonasCat] = useState<any[]>([]);
  const [serenos, setSerenos] = useState<any[]>([]);
  
  const initialFormState = {
    numero_parte: '',
    servicio: '',
    zona: '',
    dia: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_hecho: '',
    hora_denuncia: '',
    hora_intervencion: '',
    modalidad_intervencion: '',
    unidad_serenazgo: '',
    lugar_hecho: '',
    tipo_hecho: '',
    arma_usada: '',
    monto_afectado: '',
    nombres_agraviado: '',
    senas_autor: '',
    supervisor_nombre: '',
    descripcion_relato: '',
    firma_ruta: '',
    id_sereno: ''
  };

  const [form, setForm] = useState(initialFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evidenceModalId, setEvidenceModalId] = useState<number | null>(null);
  const [signatureModalUrl, setSignatureModalUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const { notification, showNotification, hideNotification } = useNotification();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const exportarPartePDF = async (inc: Incidencia) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const ml = 12;
    const mr = 198;
    const contentW = mr - ml;
    const colRight = 115;

    // Fondo verde claro tipo formulario original
    doc.setFillColor(218, 225, 195);
    doc.rect(0, 0, pageW, 297, 'F');

    // Borde exterior
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.8);
    doc.rect(ml, 8, contentW, 280, 'S');
    doc.setLineWidth(0.3);
    doc.rect(ml + 2, 10, contentW - 4, 276, 'S');

    const L = ml + 5;      // inner left
    const R = mr - 5;      // inner right
    const W = R - L;        // inner width

    // ============ HEADER ============
    // Logo Miraflores (circulo)
    doc.setDrawColor(60, 70, 40);
    doc.setLineWidth(0.5);
    doc.circle(L + 12, 22, 8, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(60, 70, 40);
    doc.text('MIRAFLORES', L + 12, 20, { align: 'center' });
    doc.setFontSize(3.5);
    doc.setFont('helvetica', 'italic');
    doc.text('se vive mejor', L + 12, 23, { align: 'center' });

    // Titulo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 35, 20);
    doc.text('PATRULLAJE MUNICIPAL', L + 30, 17);

    doc.setFontSize(8);
    doc.text('SEGURIDAD CIUDADANA', R, 14, { align: 'right' });

    // PARTE + Numero
    doc.setFontSize(11);
    doc.text('PARTE', R - 55, 25);
    doc.setFontSize(15);
    doc.setTextColor(0);
    doc.text(inc.numero_parte || 'S/N', R - 38, 25);

    // Linea separadora
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.4);
    doc.line(L, 30, R, 30);

    // ============ HELPERS ============
    let y = 36;
    const lh = 6.2;

    const field = (label: string, val: string, x: number, yy: number, endX: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 35, 20);
      doc.text(label, x, yy);
      const labelEnd = x + doc.getTextWidth(label) + 1;
      // Valor
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0);
      if (val) doc.text(`: ${val}`, labelEnd, yy);
      else doc.text(':', labelEnd, yy);
      // Underline
      doc.setDrawColor(80, 90, 60);
      doc.setLineWidth(0.15);
      doc.line(labelEnd + 2, yy + 1, endX, yy + 1);
    };

    const check = (label: string, checked: boolean, x: number, yy: number): number => {
      doc.setDrawColor(50);
      doc.setLineWidth(0.3);
      const boxSize = 3.5;
      doc.rect(x, yy - 3.2, boxSize, boxSize, 'S');
      if (checked) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(0);
        doc.text('X', x + 0.6, yy - 0.5);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 35, 20);
      doc.text(label, x + boxSize + 1.5, yy);
      return x + boxSize + 2 + doc.getTextWidth(label) + 3;
    };

    // ============ COLUMNA IZQ: Zona, Dia, Fecha, Horas ============
    // ============ COLUMNA DER: Servicio, Tipo Intervencion ============

    // Fila 1: ZONA | SERVICIO (A)(B)(C)
    field('ZONA', inc.zona || '', L, y, L + 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 35, 20);
    doc.text('SERVICIO', colRight, y);
    let cx = colRight + 22;
    ['A', 'B', 'C'].forEach(s => { cx = check(s, inc.servicio === s, cx, y); });
    y += lh;

    // Fila 2: DIA | TIPO INTERVENCION (titulo)
    field('DIA', inc.dia || '', L, y, L + 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 35, 20);
    doc.text('TIPO INTERVENCIÓN', colRight, y);
    y += lh;

    // Fila 3: FECHA | LLAMADA DE BASE ( )
    field('FECHA', inc.fecha ? new Date(inc.fecha).toLocaleDateString('es-PE') : '', L, y, L + 60);
    check('LLAMADA DE BASE', inc.modalidad_intervencion === 'Llamada de Base', colRight, y);
    y += lh;

    // Fila 4: HORA DE HECHO | INTERVENC. DIRECTA ( )
    field('HORA DE HECHO', inc.hora_hecho || '', L, y, L + 60);
    check('INTERVENC. DIRECTA', inc.modalidad_intervencion === 'Directa', colRight, y);
    y += lh;

    // Fila 5: HORA DE LA DENUNCIA | VIDEO CAMARA ( )
    field('HORA DE LA DENUNCIA', inc.hora_denuncia || '', L, y, L + 60);
    check('VIDEO CAMARA', inc.modalidad_intervencion === 'Cámara', colRight, y);
    y += lh;

    // Fila 6: HORA DE LA INTERVENC.
    field('HORA DE LA INTERVENC.', inc.hora_intervencion || '', L, y, L + 60);
    y += lh + 1;

    // Separador
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
    y += 5;

    // ============ DATOS DE INTERVENCIÓN ============
    field('UNIDAD QUE INTERVIENE', inc.unidad_serenazgo || '', L, y, L + 60);
    field('NOMBRES DEL AGRAVIADO', inc.nombres_agraviado || '', colRight, y, R);
    y += lh;

    field('LUGAR DEL HECHO', inc.lugar_hecho || '', L, y, R);
    y += lh;

    field('TIPO DE HECHO', inc.tipo_hecho || '', L, y, L + 80);
    y += lh;

    field('TIPO DE ARMA USADA', inc.arma_usada || '', L, y, L + 60);
    field('SEÑAS DEL AUTOR', inc.senas_autor || '', colRight, y, R);
    y += lh;

    field('MONTO AFECTADO', inc.monto_afectado ? `S/. ${Number(inc.monto_afectado).toFixed(2)}` : '', L, y, L + 60);
    y += lh;

    // SEGUIMIENTO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 35, 20);
    doc.text('SEGUIMIENTO  1 - 2 - 3 - 4 - 5 - 6', L, y);
    y += lh + 1;

    // Separador
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
    y += 6;

    // ============ RELATO ============
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 35, 20);

    const supName = inc.supervisor_nombre?.toUpperCase() || '________';
    doc.text('Sr.', L, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(supName, L + 7, y);
    const afterSup = L + 7 + doc.getTextWidth(supName) + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(', Doy cuenta a Ud. que en la hora y lugar', afterSup, y);
    y += 5;
    doc.text('indicado se produjo:', L, y);
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.15);
    doc.line(L + doc.getTextWidth('indicado se produjo:') + 2, y + 0.5, R, y + 0.5);
    y += 6;

    // Texto del relato sobre líneas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const relato = inc.descripcion_relato || '';
    const relatoLines = doc.splitTextToSize(relato, W - 4);
    const numLines = Math.max(relatoLines.length + 1, 7);

    // Líneas horizontales
    doc.setDrawColor(100, 110, 80);
    doc.setLineWidth(0.15);
    for (let i = 0; i < numLines; i++) {
      doc.line(L, y + (i * 6) + 4, R, y + (i * 6) + 4);
    }
    // Texto
    doc.setTextColor(10, 10, 40);
    relatoLines.forEach((line: string, idx: number) => {
      doc.text(line, L + 1, y + (idx * 6) + 3);
    });
    y += numLines * 6 + 6;

    // ============ SEPARADOR + FLECHA ============
    doc.setDrawColor(80, 90, 60);
    doc.setLineWidth(0.4);
    doc.line(L, y, R, y);
    // Flecha
    doc.line(R - 6, y, R, y);
    doc.line(R - 2, y - 1.5, R, y);
    doc.line(R - 2, y + 1.5, R, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 40);
    doc.text('(DE PREFERENCIA SE DEBERA UTILIZAR LETRA DE IMPRENTA)', pageW / 2, y, { align: 'center' });
    y += 5;

    // ============ FIRMAS ============
    const leftC = L + W / 4;        // centro firma izquierda
    const rightC = L + (W * 3) / 4; // centro firma derecha
    const firmaLineW = 35;          // ancho linea firma

    // Cargar firma digital ENCIMA de la linea
    if (inc.firma_ruta) {
      try {
        const firmaUrl = `${API_URL.replace(/\/api\/?$/, '')}/${inc.firma_ruta}`;
        const response = await fetch(firmaUrl);
        const blob = await response.blob();
        const imgData: string = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        // Firma encima de la linea izquierda
        doc.addImage(imgData, 'PNG', leftC - 17, y, 34, 17);
      } catch {
        // sin firma
      }
    }
    y += 19;

    // Líneas de firma
    doc.setDrawColor(30, 35, 20);
    doc.setLineWidth(0.4);
    doc.line(leftC - firmaLineW / 2, y, leftC + firmaLineW / 2, y);
    doc.line(rightC - firmaLineW / 2, y, rightC + firmaLineW / 2, y);
    y += 3;

    // FIRMA labels
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 35, 20);
    doc.text('FIRMA', leftC, y, { align: 'center' });
    doc.text('FIRMA', rightC, y, { align: 'center' });
    y += 4;

    // NOMBRE
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('NOMBRE', leftC - firmaLineW / 2, y);
    doc.setFont('helvetica', 'bold');
    const serenoName = inc.nombre_sereno?.toUpperCase() || '';
    doc.text(serenoName, leftC - firmaLineW / 2 + 16, y);
    doc.setFont('helvetica', 'normal');
    doc.text('NOMBRE', rightC - firmaLineW / 2, y);
    doc.line(leftC - firmaLineW / 2 + 16, y + 0.5, leftC + firmaLineW / 2, y + 0.5);
    doc.line(rightC - firmaLineW / 2 + 16, y + 0.5, rightC + firmaLineW / 2, y + 0.5);
    y += 4;

    // CODIGO
    doc.text('CODIGO', leftC - firmaLineW / 2, y);
    doc.text('CODIGO', rightC - firmaLineW / 2, y);
    doc.line(leftC - firmaLineW / 2 + 14, y + 0.5, leftC + firmaLineW / 2, y + 0.5);
    doc.line(rightC - firmaLineW / 2 + 14, y + 0.5, rightC + firmaLineW / 2, y + 0.5);
    y += 5;

    // Labels institucionales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('SEGURIDAD CIUDADANA', leftC, y, { align: 'center' });
    doc.text('POLICIA NACIONAL', rightC, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7.5);
    doc.text('SERENO', rightC, y, { align: 'center' });

    // Footer
    doc.setFontSize(5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 80);
    doc.text(`Documento generado digitalmente - ${new Date().toLocaleString('es-PE')}`, pageW / 2, 289, { align: 'center' });

    // Vista previa en nueva pestaña en vez de descargar
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  };

  const fetchData = async (page = currentPage, search = searchTerm) => {
    setLoading(true);
    try {
      const [resInc, resTip, resZon, resSer] = await Promise.all([
        fetch(`${API_URL}/incidencias?page=${page}&limit=20&search=${encodeURIComponent(search)}`),
        fetch(`${API_URL}/tipos-incidencia`),
        fetch(`${API_URL}/zonas`),
        fetch(`${API_URL}/serenos`)
      ]);

      if (resInc.ok) {
        const json = await resInc.json();
        setIncidencias(json.data || json);
        if (json.pagination) setPagination(json.pagination);
      }
      if(resTip.ok) setTiposCat(await resTip.json());
      if(resZon.ok) setZonasCat(await resZon.json());
      if(resSer.ok) setSerenos(await resSer.json());
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const idToHighlight = sessionStorage.getItem('highlightIncidencia');
    if (idToHighlight) {
      setHighlightedId(parseInt(idToHighlight, 10));
      sessionStorage.removeItem('highlightIncidencia');
      setTimeout(() => setHighlightedId(null), 3000);
    }
  }, []);

  // Refetch cuando cambia página
  useEffect(() => { fetchData(currentPage, searchTerm); }, [currentPage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setCurrentPage(1); fetchData(1, searchTerm); }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filtered = incidencias;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/incidencias/${editingId}` : `${API_URL}/incidencias`;
    const method = editingId ? 'PUT' : 'POST';
    
    // Preparar el cuerpo, manejando campos numéricos/nulos
    const body = { 
      ...form,
      monto_afectado: form.monto_afectado === '' ? null : parseFloat(form.monto_afectado),
      id_sereno: form.id_sereno === '' ? null : parseInt(form.id_sereno)
    }; 

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocurrió un error al guardar.');
      }
      
      setForm(initialFormState);
      setEditingId(null);
      setIsModalOpen(false);
      fetchData();
      showNotification(`Incidencia ${editingId ? 'actualizada' : 'creada'} correctamente.`, 'success');
    } catch (error: any) {
      showNotification(error.message, 'error');
    }
  };

  const openModal = (i?: Incidencia) => {
    if (i) {
      setForm({
        numero_parte: i.numero_parte || '',
        servicio: i.servicio || '',
        zona: i.zona || '',
        dia: i.dia || '',
        fecha: i.fecha ? i.fecha.split('T')[0] : '',
        hora_hecho: i.hora_hecho || '',
        hora_denuncia: i.hora_denuncia || '',
        hora_intervencion: i.hora_intervencion || '',
        modalidad_intervencion: i.modalidad_intervencion || '',
        unidad_serenazgo: i.unidad_serenazgo || '',
        lugar_hecho: i.lugar_hecho || '',
        tipo_hecho: i.tipo_hecho || '',
        arma_usada: i.arma_usada || '',
        monto_afectado: i.monto_afectado?.toString() || '',
        nombres_agraviado: i.nombres_agraviado || '',
        senas_autor: i.senas_autor || '',
        supervisor_nombre: i.supervisor_nombre || '',
        descripcion_relato: i.descripcion_relato || '',
        firma_ruta: i.firma_ruta || '',
        id_sereno: i.id_sereno?.toString() || ''
      });
      setEditingId(i.id_incidencia);
    } else {
      setForm(initialFormState);
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar incidencia?')) {
      try {
        const response = await fetch(`${API_URL}/incidencias/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al eliminar.');
        }
        fetchData();
        showNotification('Incidencia eliminada correctamente.', 'success');
      } catch (error: any) {
        showNotification(error.message, 'error');
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="crud-module incidencias-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="crud-header">
        <h2>Gestión de Incidencias</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar por parte, tipo, descripción..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button className="login-button" onClick={() => openModal()}>+ Nueva Incidencia</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="crud-table">
          <thead><tr><th>Parte N°</th><th>Tipo Hecho</th><th>Zona</th><th>Lugar</th><th>Sereno</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id_incidencia} className={i.id_incidencia === highlightedId ? 'highlight' : ''}>
                <td>{i.numero_parte || '-'}</td>
                <td>{i.tipo_hecho}</td>
                <td>{i.zona}</td>
                <td>{i.lugar_hecho}</td>
                <td>{i.nombre_sereno || 'N/A'}</td>
                <td>{i.fecha_registro ? new Date(i.fecha_registro).toLocaleDateString() : '-'}</td>
                <td>
                  <button className="action-btn" onClick={() => exportarPartePDF(i)} title="Exportar PDF">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>
                  <button className="action-btn" onClick={() => setEvidenceModalId(i.id_incidencia)} title="Ver Evidencias">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </button>
                  <button className="action-btn edit" onClick={() => openModal(i)} title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(i.id_incidencia)} title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Cargando...</div>}

      {pagination.totalPages > 1 && (
        <div className="table-pagination">
          <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>Anterior</button>
          <span className="pagination-info">Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)</span>
          <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={currentPage >= pagination.totalPages}>Siguiente</button>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content" style={{maxWidth: "900px"}} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar' : 'Registrar'} Parte de Intervención</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="crud-form grid-form-3-cols">
                  {/* Datos Generales */}
                  <input placeholder="Número de Parte (ej: 1356040 -B)" value={form.numero_parte} onChange={e => setForm({...form, numero_parte: e.target.value})} />
                  <select value={form.servicio} onChange={e => setForm({...form, servicio: e.target.value})}><option value="">Servicio</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                  <select value={form.id_sereno} onChange={e => setForm({...form, id_sereno: e.target.value})} required className="full-width-mobile">
                    <option value="">Seleccione Sereno (Reportero)</option>
                    {serenos.map(s => <option key={s.id_sereno} value={s.id_sereno}>{s.apellidos}, {s.nombres}</option>)}
                  </select>

                  {/* Ubicación y Tiempo */}
                  <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                  <select value={form.dia} onChange={e => setForm({...form, dia: e.target.value})}><option value="">Día</option><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option></select>
                  <select value={form.zona} onChange={e => setForm({...form, zona: e.target.value})}>
                    <option value="">Seleccione Zona</option>
                    {zonasCat.map(z => <option key={z.id_zona} value={z.nombre}>{z.nombre}</option>)}
                  </select>

                  <div className="time-group">
                    <label>Hora Hecho:</label>
                    <input type="time" value={form.hora_hecho} onChange={e => setForm({...form, hora_hecho: e.target.value})} />
                  </div>
                  <div className="time-group">
                    <label>Hora Denuncia:</label>
                    <input type="time" value={form.hora_denuncia} onChange={e => setForm({...form, hora_denuncia: e.target.value})} />
                  </div>
                  <div className="time-group">
                    <label>Hora Intervención:</label>
                    <input type="time" value={form.hora_intervencion} onChange={e => setForm({...form, hora_intervencion: e.target.value})} />
                  </div>

                  {/* Detalles del Hecho */}
                  <select value={form.modalidad_intervencion} onChange={e => setForm({...form, modalidad_intervencion: e.target.value})}><option value="">Modalidad</option><option>Llamada de Base</option><option>Directa</option><option>Cámara</option></select>
                  <select value={form.tipo_hecho} onChange={e => setForm({...form, tipo_hecho: e.target.value})} required className="full-width-mobile">
                    <option value="">Tipo de Hecho</option>
                    {tiposCat.map(t => <option key={t.id_tipo} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <input placeholder="Lugar del Hecho" value={form.lugar_hecho} onChange={e => setForm({...form, lugar_hecho: e.target.value})} className="full-width-mobile" required />

                  <input placeholder="Unidad (Placa)" value={form.unidad_serenazgo} onChange={e => setForm({...form, unidad_serenazgo: e.target.value})} />
                  <input placeholder="Supervisor" value={form.supervisor_nombre} onChange={e => setForm({...form, supervisor_nombre: e.target.value})} />
                  <input placeholder="Arma usada" value={form.arma_usada} onChange={e => setForm({...form, arma_usada: e.target.value})} />

                  {/* Involucrados */}
                  <input placeholder="Nombres Agraviado" value={form.nombres_agraviado} onChange={e => setForm({...form, nombres_agraviado: e.target.value})} />
                  <input placeholder="Monto Afectado (S/.)" type="number" step="0.01" value={form.monto_afectado} onChange={e => setForm({...form, monto_afectado: e.target.value})} />
                  <input placeholder="Señas del Autor" value={form.senas_autor} onChange={e => setForm({...form, senas_autor: e.target.value})} />

                  {/* Relato */}
                  <textarea placeholder="Descripción / Relato de los hechos" value={form.descripcion_relato} onChange={e => setForm({...form, descripcion_relato: e.target.value})} required className="full-width" style={{minHeight: "100px"}} />
          
                  {form.firma_ruta && (
                    <div className="full-width" style={{ marginTop: '10px', gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Firma Registrada:</label>
                      <button
                        type="button"
                        onClick={() => setSignatureModalUrl(`${API_URL.replace(/\/api\/?$/, '')}/${form.firma_ruta}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          color: '#334155',
                          fontWeight: 500
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Ver Firma
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="login-button">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {evidenceModalId && createPortal(
        <EvidenciasModule idIncidencia={evidenceModalId} onClose={() => setEvidenceModalId(null)} />
      , document.body)}

      {signatureModalUrl && createPortal(
        <div className="modal-overlay" onClick={() => setSignatureModalUrl(null)}>
          <div className="modal-content" style={{maxWidth: '600px', width: '90%', textAlign: 'center'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Firma del Involucrado</h3>
              <button className="modal-close" onClick={() => setSignatureModalUrl(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', background: 'var(--bg-card)' }}>
              <img src={signatureModalUrl} alt="Firma" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
            </div>
            <div className="modal-footer">
              <button className="login-button" onClick={() => setSignatureModalUrl(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default IncidenciasModule;
