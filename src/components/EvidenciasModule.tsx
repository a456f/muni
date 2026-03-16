import React, { useState, useEffect } from 'react';
import './EvidenciasModule.css';

interface Evidencia {
  id_evidencia: number;
  ruta_archivo: string;
  descripcion: string;
  fecha_subida: string;
}

interface Props {
  idIncidencia: number;
  onClose: () => void;
}

const getFileIcon = (filePath: string) => {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;
  }
  if (extension === 'pdf') {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
  }
  if (['doc', 'docx'].includes(extension)) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
  }
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>;
};

const EvidenciasModule = ({ idIncidencia, onClose }: Props) => {
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [form, setForm] = useState({ ruta_archivo: '', descripcion: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchEvidencias = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/incidencias/${idIncidencia}/evidencias`);
      if (res.ok) setEvidencias(await res.json());
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchEvidencias(); }, [idIncidencia]);

  // Efecto para generar la vista previa cuando cambia el archivo seleccionado
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl); // Limpieza de memoria
  }, [selectedFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor, selecciona un archivo.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const uploadData = JSON.parse(xhr.responseText);
        try {
          // 2. Guardar la referencia de la evidencia en la base de datos
          const evidenceRes = await fetch('http://localhost:3001/api/evidencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descripcion: form.descripcion, ruta_archivo: uploadData.filePath, id_incidencia: idIncidencia })
          });

          if (!evidenceRes.ok) {
            const errorData = await evidenceRes.json();
            throw new Error(errorData.error || 'Error al guardar la evidencia en la base de datos.');
          }

          setForm({ ruta_archivo: '', descripcion: '' });
          setSelectedFile(null);
          (document.getElementById('file-input') as HTMLInputElement).value = '';
          fetchEvidencias();

        } catch (error: any) {
          alert(`Error al guardar la evidencia: ${error.message}`);
        }
      } else {
        const errorText = `Error al subir el archivo: ${xhr.status} ${xhr.statusText}.`;
        const extraHelp = xhr.status === 404
          ? '\nAsegúrate de que el servidor backend esté en ejecución y se haya reiniciado después de los últimos cambios.'
          : '';
        alert(errorText + extraHelp);
      }
      setIsUploading(false);
    };

    xhr.onerror = () => {
      alert('Error de red al subir el archivo.');
      setIsUploading(false);
    };

    xhr.open('POST', 'http://localhost:3001/api/upload', true);
    xhr.send(formData);
  };

  // Helper para construir la URL completa del archivo en el backend
  const getFullUrl = (path: string) => {
    if (!path) return '#';
    if (path.startsWith('http')) return path;
    // Aseguramos que apunte al puerto 3001 donde está el backend
    return `http://localhost:3001/${path}`;
  };

  // Helper para obtener solo el nombre del archivo
  const getFileName = (path: string) => {
    if (!path) return 'Archivo';
    return path.split('/').pop() || path;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Cierra el modal solo si se hace clic en el fondo (overlay) y no en el contenido
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Evidencias de Incidencia #{idIncidencia}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="crud-form evidence-form">
            <input 
              type="file"
              id="file-input"
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              required
            />
            
            {/* VISTA PREVIA */}
            {previewUrl && (
              <div className="preview-container">
                {selectedFile?.type.startsWith('image/') ? (
                  <img src={previewUrl} alt="Vista previa" className="preview-media" />
                ) : selectedFile?.type === 'application/pdf' ? (
                  <iframe src={previewUrl} title="Vista previa PDF" className="preview-media"></iframe>
                ) : (
                  <div className="preview-file">📄 {selectedFile?.name}</div>
                )}
              </div>
            )}

            <input 
              placeholder="Descripción de la evidencia" 
              value={form.descripcion} 
              onChange={e => setForm({...form, descripcion: e.target.value})} 
              required 
            />
            {isUploading && (
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${uploadProgress}%` }}
                >
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}
            <button type="submit" className="login-button" disabled={isUploading}>
              {isUploading ? 'Subiendo...' : 'Adjuntar Evidencia'}
            </button>
          </form>

          <div className="evidencias-list">
            {evidencias.length === 0 ? <p style={{textAlign:'center', color:'#64748b'}}>No hay evidencias adjuntas.</p> : null}
            {evidencias.map(ev => (
              <div key={ev.id_evidencia} className="evidencia-item">
                <div className="evidencia-icon">{getFileIcon(ev.ruta_archivo)}</div>
                <div className="evidencia-info">
                  <strong>{ev.descripcion}</strong>
                  <a href={getFullUrl(ev.ruta_archivo)} target="_blank" rel="noreferrer" className="file-link">
                    {getFileName(ev.ruta_archivo)}
                  </a>
                  <small>{new Date(ev.fecha_subida).toLocaleString()}</small>
                </div>
                <a 
                  href={getFullUrl(ev.ruta_archivo)} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="download-btn"
                  title="Descargar / Ver"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default EvidenciasModule;