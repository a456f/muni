import React, { useEffect, useRef, useState } from 'react';
import { API_URL, BASE_URL } from '../config/api';
import Notification from '../hooks/Notification';
import { useNotification } from './useNotification';
import './ApksModule.css';

interface ApkInfo {
  tipo: 'oisgo' | 'almacen' | 'sereno';
  label: string;
  filename: string;
  disponible: boolean;
  size_bytes?: number;
  fecha_subida?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  oisgo: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
  ),
  almacen: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
  ),
  sereno: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
  ),
};

const TIPO_ORDEN: Array<'oisgo' | 'almacen' | 'sereno'> = ['oisgo', 'almacen', 'sereno'];

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatFecha = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ApksModule: React.FC = () => {
  const [apks, setApks] = useState<ApkInfo[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const { notification, showNotification, hideNotification } = useNotification();

  const cargar = async () => {
    try {
      const res = await fetch(`${API_URL}/apks`);
      if (res.ok) {
        const data: ApkInfo[] = await res.json();
        data.sort((a, b) => TIPO_ORDEN.indexOf(a.tipo) - TIPO_ORDEN.indexOf(b.tipo));
        setApks(data);
      }
    } catch {
      showNotification('No se pudieron cargar los APKs', 'error');
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleUpload = async (tipo: string, file: File) => {
    if (!/\.apk$/i.test(file.name)) {
      showNotification('El archivo debe terminar en .apk', 'error');
      return;
    }
    setUploading(tipo);
    const formData = new FormData();
    formData.append('apk', file);
    try {
      const res = await fetch(`${API_URL}/apks/${tipo}`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Subida falló');
      showNotification(`${file.name} subido correctamente`, 'success');
      cargar();
    } catch (e: any) {
      showNotification(e.message || 'Error al subir', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (tipo: string, label: string) => {
    if (!window.confirm(`¿Eliminar el APK de ${label}?`)) return;
    try {
      const res = await fetch(`${API_URL}/apks/${tipo}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showNotification('APK eliminado', 'success');
      cargar();
    } catch {
      showNotification('No se pudo eliminar', 'error');
    }
  };

  const copiarLink = async (tipo: string) => {
    const link = `${BASE_URL}/api/apks/download/${tipo}`;
    try {
      await navigator.clipboard.writeText(link);
      showNotification('Enlace copiado al portapapeles', 'success');
    } catch {
      window.prompt('Copia el enlace manualmente:', link);
    }
  };

  return (
    <div className="apks-module">
      <Notification notification={notification} onClose={hideNotification} />

      <div className="apks-header">
        <div>
          <h2>Descargas de APKs</h2>
          <p>Sube la última versión de cada app y comparte el enlace público con tu equipo.</p>
        </div>
      </div>

      <div className="apks-grid">
        {apks.map((apk) => {
          const link = `${BASE_URL}/api/apks/download/${apk.tipo}`;
          const isUploading = uploading === apk.tipo;
          return (
            <div key={apk.tipo} className={`apk-card ${apk.disponible ? 'available' : 'empty'}`}>
              <div className="apk-card-top">
                <div className="apk-icon">{ICONS[apk.tipo]}</div>
                <div>
                  <h3>{apk.label}</h3>
                  <code>{apk.filename}</code>
                </div>
              </div>

              <div className="apk-meta">
                <div>
                  <span>Tamaño</span>
                  <strong>{apk.disponible ? formatBytes(apk.size_bytes) : 'Sin subir'}</strong>
                </div>
                <div>
                  <span>Actualizado</span>
                  <strong>{apk.disponible ? formatFecha(apk.fecha_subida) : '—'}</strong>
                </div>
              </div>

              <div className="apk-actions">
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  hidden
                  ref={(el) => { inputsRef.current[apk.tipo] = el; }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(apk.tipo, f);
                    e.target.value = '';
                  }}
                />
                <button
                  className="apk-btn apk-btn-primary"
                  disabled={isUploading}
                  onClick={() => inputsRef.current[apk.tipo]?.click()}
                >
                  {isUploading ? 'Subiendo…' : apk.disponible ? 'Reemplazar' : 'Subir APK'}
                </button>
                <a
                  className={`apk-btn apk-btn-secondary ${apk.disponible ? '' : 'disabled'}`}
                  href={apk.disponible ? link : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descargar
                </a>
                <button
                  className="apk-btn apk-btn-ghost"
                  disabled={!apk.disponible}
                  onClick={() => copiarLink(apk.tipo)}
                  title="Copiar enlace público"
                >
                  Copiar link
                </button>
                {apk.disponible && (
                  <button
                    className="apk-btn apk-btn-danger"
                    onClick={() => handleDelete(apk.tipo, apk.label)}
                    title="Eliminar APK"
                  >
                    ×
                  </button>
                )}
              </div>

              {apk.disponible && (
                <div className="apk-link-row" title={link}>
                  <span>🔗</span>
                  <code>{link}</code>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="apks-help">
        <strong>💡 Cómo instalar en Android:</strong> abre el enlace en el teléfono, descarga el APK, ábrelo y permite instalar desde fuentes desconocidas si lo pide.
      </div>
    </div>
  );
};

export default ApksModule;
