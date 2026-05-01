import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, BASE_URL } from '../config/api';
import { io as socketIO } from 'socket.io-client';

interface Recorrido {
  id: number;
  sereno_id: number;
  fecha_inicio: string;
  nombre_sereno: string;
  codigo_personal: string;
  total_puntos: number;
  ultima_lat: number | null;
  ultima_lng: number | null;
}

const MAP_CENTER = { lat: -12.0651, lng: -75.2049 };

const PatrullajeVivoModule: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: number]: any }>({});
  const polylinesRef = useRef<{ [key: number]: any }>({});
  const puntosRef = useRef<{ [key: number]: { lat: number, lng: number }[] }>({});

  const [activos, setActivos] = useState<Recorrido[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [serenoSel, setSerenoSel] = useState<number | null>(null);

  const fetchActivos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/serenos/recorridos/activos`);
      if (res.ok) {
        const data = await res.json();
        setActivos(data);
        // Cargar puntos de cada recorrido activo
        for (const r of data) {
          if (!puntosRef.current[r.id]) {
            const pres = await fetch(`${API_URL}/serenos/recorridos/${r.id}/puntos`);
            if (pres.ok) {
              const puntos = await pres.json();
              puntosRef.current[r.id] = puntos.map((p: any) => ({ lat: parseFloat(p.latitud), lng: parseFloat(p.longitud) }));
            }
          }
        }
      }
    } catch {}
  }, []);

  // Cargar Google Maps
  useEffect(() => {
    if ((window as any).google?.maps) { setMapLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener('load', () => setMapLoaded(true)); return; }
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

  // Cargar inicialmente
  useEffect(() => {
    fetchActivos();
    const intv = setInterval(fetchActivos, 30000);
    return () => clearInterval(intv);
  }, [fetchActivos]);

  // Socket.io para tiempo real
  useEffect(() => {
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });

    socket.on('gps_sereno', (data: any) => {
      const { recorrido_id, sereno_id, latitud, longitud } = data;
      const lat = parseFloat(latitud), lng = parseFloat(longitud);

      if (!puntosRef.current[recorrido_id]) puntosRef.current[recorrido_id] = [];
      puntosRef.current[recorrido_id].push({ lat, lng });

      // Actualizar marcador
      if (googleMapRef.current && (window as any).google) {
        const google = (window as any).google;
        if (markersRef.current[sereno_id]) {
          markersRef.current[sereno_id].setPosition({ lat, lng });
        } else {
          markersRef.current[sereno_id] = new google.maps.Marker({
            position: { lat, lng },
            map: googleMapRef.current,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1e40af" stroke="#fff" stroke-width="2"/><path d="M12 6a3 3 0 100 6 3 3 0 000-6zm0 8c-3 0-7 1.5-7 4.5V20h14v-1.5c0-3-4-4.5-7-4.5z" fill="#fff"/></svg>`
              ),
              scaledSize: new google.maps.Size(40, 40),
            }
          });
        }
        // Actualizar polyline
        if (polylinesRef.current[recorrido_id]) {
          polylinesRef.current[recorrido_id].setPath(puntosRef.current[recorrido_id]);
        } else {
          polylinesRef.current[recorrido_id] = new google.maps.Polyline({
            path: puntosRef.current[recorrido_id],
            geodesic: true, strokeColor: '#1e40af', strokeOpacity: 0.8, strokeWeight: 4,
            map: googleMapRef.current
          });
        }
      }
      fetchActivos();
    });

    socket.on('recorrido_iniciado', () => fetchActivos());

    socket.on('recorrido_finalizado', (data: any) => {
      // Quitar marcador y polyline
      const sereno_id = data.sereno_id;
      if (markersRef.current[sereno_id]) { markersRef.current[sereno_id].setMap(null); delete markersRef.current[sereno_id]; }
      if (polylinesRef.current[data.recorrido_id]) { polylinesRef.current[data.recorrido_id].setMap(null); delete polylinesRef.current[data.recorrido_id]; }
      delete puntosRef.current[data.recorrido_id];
      fetchActivos();
    });

    return () => { socket.disconnect(); };
  }, [fetchActivos]);

  // Render polylines y markers cuando llegan datos
  useEffect(() => {
    if (!googleMapRef.current || !(window as any).google) return;
    const google = (window as any).google;

    activos.forEach(r => {
      if (!r.ultima_lat || !r.ultima_lng) return;
      const lat = parseFloat(String(r.ultima_lat)), lng = parseFloat(String(r.ultima_lng));

      if (!markersRef.current[r.sereno_id]) {
        markersRef.current[r.sereno_id] = new google.maps.Marker({
          position: { lat, lng },
          map: googleMapRef.current,
          title: r.nombre_sereno,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1e40af" stroke="#fff" stroke-width="2"/><path d="M12 6a3 3 0 100 6 3 3 0 000-6zm0 8c-3 0-7 1.5-7 4.5V20h14v-1.5c0-3-4-4.5-7-4.5z" fill="#fff"/></svg>`
            ),
            scaledSize: new google.maps.Size(40, 40),
          }
        });
      }

      if (puntosRef.current[r.id]?.length > 0 && !polylinesRef.current[r.id]) {
        polylinesRef.current[r.id] = new google.maps.Polyline({
          path: puntosRef.current[r.id], geodesic: true,
          strokeColor: '#1e40af', strokeOpacity: 0.8, strokeWeight: 4,
          map: googleMapRef.current
        });
      }
    });
  }, [activos, mapLoaded]);

  const centrarEnSereno = (r: Recorrido) => {
    if (!googleMapRef.current || !r.ultima_lat || !r.ultima_lng) return;
    googleMapRef.current.panTo({ lat: parseFloat(String(r.ultima_lat)), lng: parseFloat(String(r.ultima_lng)) });
    googleMapRef.current.setZoom(17);
    setSerenoSel(r.sereno_id);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
      {/* Panel lateral */}
      <div style={{ width: 320, background: 'var(--bg-card, #fff)', borderRight: '1px solid var(--border-color, #e2e8f0)', overflowY: 'auto' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, background: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
            Patrullaje en vivo
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {activos.length} sereno{activos.length !== 1 ? 's' : ''} en patrullaje
          </p>
        </div>
        <div style={{ padding: 8 }}>
          {activos.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No hay serenos en patrullaje
            </div>
          ) : activos.map(r => (
            <div key={r.id} onClick={() => centrarEnSereno(r)} style={{
              padding: 12, marginBottom: 6, borderRadius: 8, cursor: 'pointer',
              background: serenoSel === r.sereno_id ? '#eff6ff' : 'var(--bg-input, #f8fafc)',
              border: serenoSel === r.sereno_id ? '2px solid #1e40af' : '1px solid transparent'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
                <strong style={{ fontSize: '0.9rem' }}>{r.nombre_sereno}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cód: {r.codigo_personal || '-'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Inicio: {new Date(r.fecha_inicio).toLocaleTimeString()} &middot; {r.total_puntos} pts
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!mapLoaded && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-card)', color: 'var(--text-muted)'
          }}>Cargando mapa...</div>
        )}
      </div>
    </div>
  );
};

export default PatrullajeVivoModule;
