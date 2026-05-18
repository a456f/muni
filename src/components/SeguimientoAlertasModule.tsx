import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, BASE_URL } from '../config/api';
import { io as socketIO } from 'socket.io-client';

interface AlertaSeguimiento {
  id: number;
  ciudadano_id: number | null;
  nombre_ciudadano: string | null;
  telefono: string | null;
  dni: string | null;
  latitud: number;
  longitud: number;
  estado: string;
  sereno_id: number | null;
  fecha: string;
  fecha_atencion: string | null;
  observacion: string | null;
}

const MAP_CENTER = { lat: -12.0651, lng: -75.2049 };

const SeguimientoAlertasModule: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const ciudadanoMarkerRef = useRef<any>(null);
  const serenoMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const puntosSerenoRef = useRef<{ lat: number, lng: number }[]>([]);

  const [alertas, setAlertas] = useState<AlertaSeguimiento[]>([]);
  const [seleccionada, setSeleccionada] = useState<AlertaSeguimiento | null>(null);
  const [serenoNombre, setSerenoNombre] = useState<string>('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filtro, setFiltro] = useState<'ACTIVAS' | 'TODAS' | 'EN_CAMINO' | 'ASIGNADO' | 'CERRADO'>('ACTIVAS');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const fetchAlertas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/ciudadano/alertas-panico`);
      if (res.ok) {
        const data = await res.json();
        // Solo alertas con sereno asignado
        const conSereno = (Array.isArray(data) ? data : []).filter((a: AlertaSeguimiento) => a.sereno_id != null);
        setAlertas(conSereno);
      }
    } catch {}
  }, []);

  // Cargar Google Maps
  useEffect(() => {
    if ((window as any).google?.maps) { setMapLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => setMapLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBd4wZax8uiotmZhTqNW9NW3vGX3LAET0Y&libraries=visualization`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !(window as any).google) return;
    if (googleMapRef.current) return;
    const google = (window as any).google;
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: MAP_CENTER, zoom: 14,
      mapTypeControl: false, streetViewControl: false, clickableIcons: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
      ]
    });
  }, [mapLoaded]);

  // Cargar inicial + auto-refresh cada 10s
  useEffect(() => {
    fetchAlertas();
    const intv = setInterval(fetchAlertas, 10000);
    return () => clearInterval(intv);
  }, [fetchAlertas]);

  // Socket.io para tiempo real
  useEffect(() => {
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });

    socket.on('gps_sereno', (data: any) => {
      if (!seleccionada || data.sereno_id !== seleccionada.sereno_id) return;
      const lat = parseFloat(data.latitud), lng = parseFloat(data.longitud);
      puntosSerenoRef.current.push({ lat, lng });
      actualizarSereno(lat, lng);
      setUltimaActualizacion(new Date());
    });

    socket.on('alerta_panico', () => fetchAlertas());
    socket.on('panico_aceptado', () => fetchAlertas());
    socket.on('recorrido_finalizado', () => fetchAlertas());

    return () => { socket.disconnect(); };
  }, [seleccionada, fetchAlertas]);

  const actualizarSereno = (lat: number, lng: number) => {
    if (!googleMapRef.current || !(window as any).google) return;
    const google = (window as any).google;

    if (serenoMarkerRef.current) {
      serenoMarkerRef.current.setPosition({ lat, lng });
    } else {
      serenoMarkerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map: googleMapRef.current,
        title: serenoNombre,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1e40af" stroke="#fff" stroke-width="2"/><path d="M12 6a3 3 0 100 6 3 3 0 000-6zm0 8c-3 0-7 1.5-7 4.5V20h14v-1.5c0-3-4-4.5-7-4.5z" fill="#fff"/></svg>`
          ),
          scaledSize: new google.maps.Size(42, 42),
        }
      });
    }

    if (polylineRef.current) {
      polylineRef.current.setPath(puntosSerenoRef.current);
    } else if (puntosSerenoRef.current.length > 1) {
      polylineRef.current = new google.maps.Polyline({
        path: puntosSerenoRef.current,
        geodesic: true,
        strokeColor: '#1e40af',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        map: googleMapRef.current
      });
    }
  };

  const seleccionarAlerta = async (a: AlertaSeguimiento) => {
    setSeleccionada(a);
    puntosSerenoRef.current = [];

    // Limpiar marcadores anteriores
    if (serenoMarkerRef.current) { serenoMarkerRef.current.setMap(null); serenoMarkerRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (ciudadanoMarkerRef.current) { ciudadanoMarkerRef.current.setMap(null); ciudadanoMarkerRef.current = null; }

    if (!googleMapRef.current || !(window as any).google) return;
    const google = (window as any).google;

    // Pin del ciudadano
    ciudadanoMarkerRef.current = new google.maps.Marker({
      position: { lat: parseFloat(String(a.latitud)), lng: parseFloat(String(a.longitud)) },
      map: googleMapRef.current,
      title: a.nombre_ciudadano || 'Ciudadano',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#dc2626" stroke="#fff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">!</text></svg>`
        ),
        scaledSize: new google.maps.Size(42, 42),
      }
    });

    // Cargar nombre del sereno y puntos del recorrido
    if (a.sereno_id) {
      try {
        const r = await fetch(`${API_URL}/serenos/recorrido-activo/${a.sereno_id}`);
        if (r.ok) {
          const data = await r.json();
          if (data.activo && data.puntos?.length > 0) {
            puntosSerenoRef.current = data.puntos.map((p: any) => ({
              lat: parseFloat(p.latitud), lng: parseFloat(p.longitud)
            }));
            const ult = puntosSerenoRef.current[puntosSerenoRef.current.length - 1];
            actualizarSereno(ult.lat, ult.lng);
            setUltimaActualizacion(new Date(data.puntos[data.puntos.length - 1].fecha));
          }
        }
      } catch {}
    }

    // Centrar mapa
    googleMapRef.current.panTo({ lat: parseFloat(String(a.latitud)), lng: parseFloat(String(a.longitud)) });
    googleMapRef.current.setZoom(16);
  };

  const filtradas = alertas.filter(a => {
    if (filtro === 'TODAS') return true;
    if (filtro === 'ACTIVAS') return a.estado === 'EN_CAMINO' || a.estado === 'ASIGNADO';
    return a.estado === filtro;
  });

  const colorEstado = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return '#dc2626';
      case 'ASIGNADO': return '#2563eb';
      case 'EN_CAMINO': return '#16a34a';
      case 'CERRADO': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const distanciaMin = (() => {
    if (!seleccionada || puntosSerenoRef.current.length === 0) return null;
    const ult = puntosSerenoRef.current[puntosSerenoRef.current.length - 1];
    const R = 6371;
    const dLat = (seleccionada.latitud - ult.lat) * Math.PI / 180;
    const dLng = (seleccionada.longitud - ult.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(ult.lat * Math.PI/180) * Math.cos(seleccionada.latitud * Math.PI/180) * Math.sin(dLng/2) ** 2;
    const km = 2 * R * Math.asin(Math.sqrt(a));
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
  })();

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
      {/* Panel lateral */}
      <div style={{ width: 340, background: 'var(--bg-card, #fff)', borderRight: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, background: '#dc2626', borderRadius: '50%', boxShadow: '0 0 8px #dc2626' }}></span>
            Seguimiento de alertas
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {alertas.length} alertas con sereno asignado
          </p>

          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {(['ACTIVAS', 'EN_CAMINO', 'ASIGNADO', 'CERRADO', 'TODAS'] as const).map(f => {
              const tint = f === 'ACTIVAS' ? '#dc2626' : f === 'TODAS' ? '#475569' : colorEstado(f);
              return (
                <button key={f} onClick={() => setFiltro(f)} style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.75rem',
                  background: filtro === f ? tint : 'var(--bg-input)',
                  color: filtro === f ? '#fff' : 'var(--text-primary)'
                }}>{f === 'TODAS' ? 'Todas' : f === 'ACTIVAS' ? 'Activas' : f}</button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No hay alertas con este filtro
            </div>
          ) : filtradas.map(a => (
            <div key={a.id} onClick={() => seleccionarAlerta(a)} style={{
              padding: 12, marginBottom: 6, borderRadius: 10, cursor: 'pointer',
              background: seleccionada?.id === a.id ? '#eff6ff' : 'var(--bg-input, #f8fafc)',
              border: seleccionada?.id === a.id ? '2px solid #1e40af' : '1px solid transparent',
              transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <strong style={{ fontSize: '0.9rem' }}>{a.nombre_ciudadano || 'Anónimo'}</strong>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
                  background: colorEstado(a.estado), color: '#fff'
                }}>{a.estado}</span>
              </div>
              {a.telefono && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: 2 }}>
                  📞 {a.telefono}
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {new Date(a.fecha).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Detalle de selección */}
        {seleccionada && (
          <div style={{ padding: 14, borderTop: '2px solid var(--border-color)', background: 'var(--bg-input, #f8fafc)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>SEGUIMIENTO ACTIVO</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{seleccionada.nombre_ciudadano}</div>
            {seleccionada.telefono && (
              <a href={`tel:${seleccionada.telefono}`} style={{ fontSize: '0.78rem', color: '#1e40af', textDecoration: 'none' }}>
                📞 {seleccionada.telefono}
              </a>
            )}
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              {puntosSerenoRef.current.length > 0 ? (
                <>
                  <div><strong>Distancia:</strong> {distanciaMin || 'Calculando...'}</div>
                  <div><strong>Puntos GPS:</strong> {puntosSerenoRef.current.length}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Última: {ultimaActualizacion ? `${Math.floor((Date.now() - ultimaActualizacion.getTime()) / 1000)}s` : 'N/A'}
                  </div>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Esperando ubicación del sereno...</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            Cargando mapa...
          </div>
        )}
        {!seleccionada && mapLoaded && (
          <div style={{
            position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '10px 20px', borderRadius: 8,
            fontSize: '0.85rem'
          }}>
            ← Selecciona una alerta para ver el seguimiento
          </div>
        )}
      </div>
    </div>
  );
};

export default SeguimientoAlertasModule;
