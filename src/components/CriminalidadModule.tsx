import React, { useState, useEffect, useRef, useCallback } from 'react';

// ====== DATOS SIMULADOS ======

// Tipos de delitos con colores
const TIPOS_DELITO = [
  { id: 1, nombre: 'Robo / Hurto', color: '#ef4444', icon: '🔴' },
  { id: 2, nombre: 'Asalto a mano armada', color: '#dc2626', icon: '🟥' },
  { id: 3, nombre: 'Violencia familiar', color: '#f97316', icon: '🟠' },
  { id: 4, nombre: 'Microcomercialización de drogas', color: '#a855f7', icon: '🟣' },
  { id: 5, nombre: 'Vandalismo', color: '#eab308', icon: '🟡' },
  { id: 6, nombre: 'Acoso / Hostigamiento', color: '#f472b6', icon: '🩷' },
  { id: 7, nombre: 'Accidente de tránsito', color: '#3b82f6', icon: '🔵' },
  { id: 8, nombre: 'Disturbios', color: '#6366f1', icon: '🟪' },
];

// Centro del mapa (Huancayo, Junín - Perú)
const MAP_CENTER = { lat: -12.0651, lng: -75.2049 };

// Zonas de alerta (polígonos)
const ZONAS_ALERTA = [
  {
    nombre: 'Zona Roja - Centro',
    nivel: 'CRITICO',
    color: '#ef4444',
    coords: [
      { lat: -12.0620, lng: -75.2080 },
      { lat: -12.0620, lng: -75.2010 },
      { lat: -12.0680, lng: -75.2010 },
      { lat: -12.0680, lng: -75.2080 },
    ]
  },
  {
    nombre: 'Zona Alta - Chilca',
    nivel: 'ALTO',
    color: '#f97316',
    coords: [
      { lat: -12.0750, lng: -75.2100 },
      { lat: -12.0750, lng: -75.2020 },
      { lat: -12.0820, lng: -75.2020 },
      { lat: -12.0820, lng: -75.2100 },
    ]
  },
  {
    nombre: 'Zona Media - El Tambo',
    nivel: 'MEDIO',
    color: '#eab308',
    coords: [
      { lat: -12.0520, lng: -75.2150 },
      { lat: -12.0520, lng: -75.2060 },
      { lat: -12.0590, lng: -75.2060 },
      { lat: -12.0590, lng: -75.2150 },
    ]
  },
  {
    nombre: 'Zona Baja - San Carlos',
    nivel: 'BAJO',
    color: '#22c55e',
    coords: [
      { lat: -12.0450, lng: -75.2200 },
      { lat: -12.0450, lng: -75.2120 },
      { lat: -12.0510, lng: -75.2120 },
      { lat: -12.0510, lng: -75.2200 },
    ]
  },
];

// Comisarías de Huancayo
const COMISARIAS = [
  { nombre: 'Comisaría PNP Huancayo', lat: -12.0655, lng: -75.2050, direccion: 'Jr. Ancash 300, Huancayo' },
  { nombre: 'Comisaría PNP El Tambo', lat: -12.0540, lng: -75.2120, direccion: 'Av. Huancavelica 1200, El Tambo' },
  { nombre: 'Comisaría PNP Chilca', lat: -12.0780, lng: -75.2070, direccion: 'Av. Jacinto Ibarra 450, Chilca' },
  { nombre: 'Comisaría PNP de Familia', lat: -12.0630, lng: -75.2005, direccion: 'Jr. Puno 580, Huancayo' },
  { nombre: 'Comisaría PNP Pilcomayo', lat: -12.0460, lng: -75.2350, direccion: 'Av. Pilcomayo s/n, Pilcomayo' },
];

// Hospitales y centros de salud
const HOSPITALES = [
  { nombre: 'Hospital Regional Docente Clínico Quirúrgico Daniel Alcides Carrión', lat: -12.0670, lng: -75.2030, direccion: 'Av. Daniel Alcides Carrión 1550' },
  { nombre: 'Hospital Regional El Carmen', lat: -12.0640, lng: -75.2090, direccion: 'Jr. Puno 911, Huancayo' },
  { nombre: 'EsSalud - Hospital Ramiro Prialé Prialé', lat: -12.0580, lng: -75.2140, direccion: 'Av. Independencia 296, El Tambo' },
  { nombre: 'Centro de Salud Chilca', lat: -12.0760, lng: -75.2050, direccion: 'Av. 9 de Diciembre 320, Chilca' },
  { nombre: 'Centro de Salud La Libertad', lat: -12.0510, lng: -75.2180, direccion: 'Jr. La Libertad 450, El Tambo' },
];

// Generar puntos de incidencias simulados
const generateIncidencias = () => {
  const incidencias: any[] = [];
  const zonas = [
    { lat: -12.065, lng: -75.205, density: 80 },  // Centro - alta densidad
    { lat: -12.078, lng: -75.206, density: 50 },  // Chilca
    { lat: -12.055, lng: -75.210, density: 35 },  // El Tambo
    { lat: -12.048, lng: -75.215, density: 15 },  // San Carlos
    { lat: -12.070, lng: -75.195, density: 25 },  // Este
    { lat: -12.060, lng: -75.218, density: 20 },  // Oeste
  ];

  zonas.forEach(zona => {
    for (let i = 0; i < zona.density; i++) {
      const tipo = TIPOS_DELITO[Math.floor(Math.random() * TIPOS_DELITO.length)];
      const diasAtras = Math.floor(Math.random() * 90);
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - diasAtras);
      const hora = Math.floor(Math.random() * 24);
      fecha.setHours(hora, Math.floor(Math.random() * 60));

      incidencias.push({
        id: incidencias.length + 1,
        lat: zona.lat + (Math.random() - 0.5) * 0.008,
        lng: zona.lng + (Math.random() - 0.5) * 0.008,
        tipo,
        fecha: fecha.toISOString(),
        hora: `${hora.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        direccion: `Calle ${Math.floor(Math.random() * 50) + 1}, ${['Centro', 'Chilca', 'El Tambo', 'San Carlos', 'Pilcomayo'][Math.floor(Math.random() * 5)]}`,
        estado: ['REPORTADO', 'EN INVESTIGACIÓN', 'RESUELTO', 'ARCHIVADO'][Math.floor(Math.random() * 4)],
      });
    }
  });
  return incidencias;
};

const INCIDENCIAS = generateIncidencias();

// Estadísticas por mes
const STATS_MENSUALES = [
  { mes: 'Oct', total: 42, resueltos: 18 },
  { mes: 'Nov', total: 38, resueltos: 22 },
  { mes: 'Dic', total: 55, resueltos: 25 },
  { mes: 'Ene', total: 48, resueltos: 30 },
  { mes: 'Feb', total: 35, resueltos: 20 },
  { mes: 'Mar', total: 27, resueltos: 15 },
];

// ====== COMPONENTE PRINCIPAL ======

const CriminalidadModule: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const heatmapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const comisariasRef = useRef<any[]>([]);
  const hospitalesRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeView, setActiveView] = useState<'mapa' | 'estadisticas' | 'tabla'>('mapa');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showZonas, setShowZonas] = useState(true);
  const [showMarkers, setShowMarkers] = useState(false);
  const [showComisarias, setShowComisarias] = useState(true);
  const [showHospitales, setShowHospitales] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<number | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('90');
  const [selectedIncidencia, setSelectedIncidencia] = useState<any>(null);

  // Filtrar incidencias
  const incidenciasFiltradas = INCIDENCIAS.filter(inc => {
    if (filtroTipo && inc.tipo.id !== filtroTipo) return false;
    const diasAtras = parseInt(filtroPeriodo);
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAtras);
    return new Date(inc.fecha) >= fechaLimite;
  });

  // Stats
  const totalIncidencias = incidenciasFiltradas.length;
  const porTipo = TIPOS_DELITO.map(t => ({
    ...t,
    cantidad: incidenciasFiltradas.filter(i => i.tipo.id === t.id).length
  })).sort((a, b) => b.cantidad - a.cantidad);

  // Cargar Google Maps
  useEffect(() => {
    if ((window as any).google?.maps) {
      setMapLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBd4wZax8uiotmZhTqNW9NW3vGX3LAET0Y&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Inicializar mapa
  const initMap = useCallback(() => {
    if (!mapRef.current || !mapLoaded || !(window as any).google) return;
    if (googleMapRef.current) return;

    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: MAP_CENTER,
      zoom: 14,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3250' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#394175' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#394175' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a40' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f2544' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d3250' }] },
      ],
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    googleMapRef.current = map;
  }, [mapLoaded]);

  useEffect(() => { initMap(); }, [initMap]);

  // Actualizar heatmap
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const google = (window as any).google;

    // Limpiar heatmap anterior
    if (heatmapRef.current) heatmapRef.current.setMap(null);

    if (showHeatmap) {
      const heatmapData = incidenciasFiltradas.map(inc =>
        new google.maps.LatLng(inc.lat, inc.lng)
      );
      heatmapRef.current = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: googleMapRef.current,
        radius: 30,
        opacity: 0.7,
        gradient: [
          'rgba(0, 255, 0, 0)',
          'rgba(0, 255, 0, 1)',
          'rgba(255, 255, 0, 1)',
          'rgba(255, 165, 0, 1)',
          'rgba(255, 0, 0, 1)',
          'rgba(180, 0, 0, 1)',
        ]
      });
    }
  }, [showHeatmap, incidenciasFiltradas, mapLoaded]);

  // Actualizar zonas
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const google = (window as any).google;

    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current = [];

    if (showZonas) {
      ZONAS_ALERTA.forEach(zona => {
        const polygon = new google.maps.Polygon({
          paths: zona.coords,
          strokeColor: zona.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: zona.color,
          fillOpacity: 0.2,
          map: googleMapRef.current,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding:8px;font-family:sans-serif">
            <strong>${zona.nombre}</strong><br>
            <span style="color:${zona.color};font-weight:700">Nivel: ${zona.nivel}</span>
          </div>`
        });

        polygon.addListener('click', (e: any) => {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(googleMapRef.current);
        });

        polygonsRef.current.push(polygon);
      });
    }
  }, [showZonas, mapLoaded]);

  // Actualizar markers
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const google = (window as any).google;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (showMarkers) {
      incidenciasFiltradas.forEach(inc => {
        const marker = new google.maps.Marker({
          position: { lat: inc.lat, lng: inc.lng },
          map: googleMapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: inc.tipo.color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 1.5,
          },
          title: inc.tipo.nombre,
        });

        marker.addListener('click', () => {
          setSelectedIncidencia(inc);
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding:8px;font-family:sans-serif;min-width:200px">
              <strong style="color:${inc.tipo.color}">${inc.tipo.nombre}</strong><br>
              <span style="font-size:12px;color:#666">${new Date(inc.fecha).toLocaleDateString()} - ${inc.hora}</span><br>
              <span style="font-size:12px">${inc.direccion}</span><br>
              <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${inc.estado === 'RESUELTO' ? '#dcfce7' : '#fef3c7'};color:${inc.estado === 'RESUELTO' ? '#166534' : '#92400e'}">${inc.estado}</span>
            </div>`
          });
          infoWindow.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
      });
    }
  }, [showMarkers, incidenciasFiltradas, mapLoaded]);

  // Comisarías
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const google = (window as any).google;

    comisariasRef.current.forEach(m => m.setMap(null));
    comisariasRef.current = [];

    if (showComisarias) {
      COMISARIAS.forEach(c => {
        const marker = new google.maps.Marker({
          position: { lat: c.lat, lng: c.lng },
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1e40af" stroke="#fff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">P</text></svg>`
            ),
            scaledSize: new google.maps.Size(32, 32),
          },
          title: c.nombre,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding:8px;font-family:sans-serif;min-width:200px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="background:#1e40af;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">COMISARÍA</span>
            </div>
            <strong style="font-size:13px">${c.nombre}</strong><br>
            <span style="font-size:12px;color:#666">${c.direccion}</span>
          </div>`
        });
        marker.addListener('click', () => infoWindow.open(googleMapRef.current, marker));
        comisariasRef.current.push(marker);
      });
    }
  }, [showComisarias, mapLoaded]);

  // Hospitales
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;
    const google = (window as any).google;

    hospitalesRef.current.forEach(m => m.setMap(null));
    hospitalesRef.current = [];

    if (showHospitales) {
      HOSPITALES.forEach(h => {
        const marker = new google.maps.Marker({
          position: { lat: h.lat, lng: h.lng },
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#dc2626" stroke="#fff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="14" fill="#fff" font-weight="bold">+</text></svg>`
            ),
            scaledSize: new google.maps.Size(32, 32),
          },
          title: h.nombre,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding:8px;font-family:sans-serif;min-width:200px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">HOSPITAL</span>
            </div>
            <strong style="font-size:13px">${h.nombre}</strong><br>
            <span style="font-size:12px;color:#666">${h.direccion}</span>
          </div>`
        });
        marker.addListener('click', () => infoWindow.open(googleMapRef.current, marker));
        hospitalesRef.current.push(marker);
      });
    }
  }, [showHospitales, mapLoaded]);

  // Barra de stats rápida
  const maxBar = Math.max(...STATS_MENSUALES.map(s => s.total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', background: 'var(--bg-main, #f1f5f9)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-card, #fff)', borderBottom: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Mapa de Criminalidad e Incidencias
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Datos simulados para demostración &middot; {totalIncidencias} incidencias en los últimos {filtroPeriodo} días
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['mapa', 'estadisticas', 'tabla'] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)} style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600,
              fontSize: '0.85rem', background: activeView === v ? '#1e40af' : 'var(--bg-input, #e2e8f0)',
              color: activeView === v ? '#fff' : 'var(--text-primary)'
            }}>{v === 'mapa' ? 'Mapa' : v === 'estadisticas' ? 'Estadísticas' : 'Tabla de Datos'}</button>
          ))}
        </div>
      </div>

      {/* Vista Mapa */}
      {activeView === 'mapa' && (
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* Panel lateral */}
          <div style={{
            width: 280, background: 'var(--bg-card, #fff)', borderRight: '1px solid var(--border-color, #e2e8f0)',
            overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            {/* Filtros */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Período</label>
              <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{
                width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4
              }}>
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Tipo de delito</label>
              <select value={filtroTipo || ''} onChange={e => setFiltroTipo(e.target.value ? parseInt(e.target.value) : null)} style={{
                width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4
              }}>
                <option value="">Todos los tipos</option>
                {TIPOS_DELITO.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>

            {/* Capas */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Capas del mapa</label>
              {[
                { label: 'Mapa de calor', checked: showHeatmap, onChange: () => setShowHeatmap(!showHeatmap), color: '#ef4444' },
                { label: 'Zonas de alerta', checked: showZonas, onChange: () => setShowZonas(!showZonas), color: '#f97316' },
                { label: 'Marcadores', checked: showMarkers, onChange: () => setShowMarkers(!showMarkers), color: '#3b82f6' },
                { label: 'Comisarías', checked: showComisarias, onChange: () => setShowComisarias(!showComisarias), color: '#1e40af' },
                { label: 'Hospitales', checked: showHospitales, onChange: () => setShowHospitales(!showHospitales), color: '#dc2626' },
              ].map((layer, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={layer.checked} onChange={layer.onChange} style={{ accentColor: layer.color }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: layer.color, flexShrink: 0 }}></span>
                  {layer.label}
                </label>
              ))}
            </div>

            {/* Resumen por tipo */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Incidencias por tipo</label>
              {porTipo.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.82rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }}></span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
                  <strong>{t.cantidad}</strong>
                </div>
              ))}
            </div>

            {/* Leyenda zonas */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Zonas de alerta</label>
              {ZONAS_ALERTA.map((z, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.82rem' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '3px', background: z.color, opacity: 0.4, border: `2px solid ${z.color}`, flexShrink: 0 }}></span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{z.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: z.color, fontWeight: 700 }}>{z.nivel}</div>
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
                background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '1rem'
              }}>Cargando mapa...</div>
            )}

            {/* Cards rápidos sobre el mapa */}
            <div style={{
              position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, zIndex: 1
            }}>
              {[
                { label: 'Total', value: totalIncidencias, color: '#1e40af', bg: 'rgba(30,64,175,0.9)' },
                { label: 'Zona Roja', value: incidenciasFiltradas.filter(i => i.lat > -12.068 && i.lat < -12.062).length, color: '#ef4444', bg: 'rgba(239,68,68,0.9)' },
                { label: 'Resueltos', value: incidenciasFiltradas.filter(i => i.estado === 'RESUELTO').length, color: '#22c55e', bg: 'rgba(34,197,94,0.9)' },
              ].map((card, i) => (
                <div key={i} style={{
                  padding: '10px 16px', borderRadius: '8px', background: card.bg, color: '#fff',
                  backdropFilter: 'blur(8px)', minWidth: 80, textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{card.value}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9, fontWeight: 600 }}>{card.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vista Estadísticas */}
      {activeView === 'estadisticas' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Cards principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Incidencias', value: totalIncidencias, color: '#1e40af', sub: `Últimos ${filtroPeriodo} días` },
              { label: 'Resueltos', value: incidenciasFiltradas.filter(i => i.estado === 'RESUELTO').length, color: '#22c55e', sub: `${Math.round((incidenciasFiltradas.filter(i => i.estado === 'RESUELTO').length / Math.max(totalIncidencias, 1)) * 100)}% del total` },
              { label: 'En investigación', value: incidenciasFiltradas.filter(i => i.estado === 'EN INVESTIGACIÓN').length, color: '#f97316', sub: 'Casos activos' },
              { label: 'Zona más crítica', value: 'Centro', color: '#ef4444', sub: `${incidenciasFiltradas.filter(i => i.lat > -12.068 && i.lat < -12.062).length} incidencias` },
            ].map((card, i) => (
              <div key={i} style={{
                padding: '20px', borderRadius: '12px', background: 'var(--bg-card, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)', borderLeft: `4px solid ${card.color}`
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color, margin: '4px 0' }}>{card.value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Gráfico de barras mensual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{
              padding: '20px', borderRadius: '12px', background: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Tendencia Mensual</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200 }}>
                {STATS_MENSUALES.map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.total}</span>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{
                        height: `${(s.total / maxBar) * 160}px`, background: '#ef4444', borderRadius: '4px 4px 0 0',
                        transition: 'height 0.5s ease'
                      }}></div>
                      <div style={{
                        height: `${(s.resueltos / maxBar) * 160}px`, background: '#22c55e', borderRadius: '0 0 4px 4px',
                        transition: 'height 0.5s ease'
                      }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.mes}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }}></span> Total
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }}></span> Resueltos
                </span>
              </div>
            </div>

            {/* Distribución por tipo */}
            <div style={{
              padding: '20px', borderRadius: '12px', background: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Distribución por Tipo de Delito</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {porTipo.map(t => {
                  const pct = totalIncidencias > 0 ? (t.cantidad / totalIncidencias) * 100 : 0;
                  return (
                    <div key={t.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                        <span>{t.nombre}</span>
                        <span style={{ fontWeight: 700 }}>{t.cantidad} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-input, #e2e8f0)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: t.color, borderRadius: 4, transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Horarios peligrosos */}
          <div style={{
            marginTop: 20, padding: '20px', borderRadius: '12px', background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color, #e2e8f0)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Horarios con Mayor Incidencia</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100 }}>
              {Array.from({ length: 24 }, (_, h) => {
                const count = incidenciasFiltradas.filter(i => parseInt(i.hora) === h).length;
                const maxH = Math.max(...Array.from({ length: 24 }, (_, hh) => incidenciasFiltradas.filter(i => parseInt(i.hora) === hh).length), 1);
                const pct = (count / maxH) * 100;
                const isHigh = pct > 70;
                return (
                  <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: '100%', height: `${Math.max(pct, 4)}%`,
                      background: isHigh ? '#ef4444' : pct > 40 ? '#f97316' : '#3b82f6',
                      borderRadius: '3px 3px 0 0', minHeight: 3, transition: 'height 0.5s ease'
                    }}></div>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{h.toString().padStart(2, '0')}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }}></span> Alto riesgo
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }}></span> Medio
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }}></span> Bajo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Vista Tabla */}
      {activeView === 'tabla' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input, #f1f5f9)' }}>
                  {['#', 'Tipo', 'Fecha', 'Hora', 'Dirección', 'Estado'].map(h => (
                    <th key={h} style={{
                      padding: '12px 14px', textAlign: 'left', fontWeight: 700,
                      fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)',
                      borderBottom: '2px solid var(--border-color, #e2e8f0)'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidenciasFiltradas.slice(0, 100).map((inc, i) => (
                  <tr key={inc.id} style={{
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-input, #fafafa)'
                  }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{inc.id}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: inc.tipo.color }}></span>
                        {inc.tipo.nombre}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{new Date(inc.fecha).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 14px' }}>{inc.hora}</td>
                    <td style={{ padding: '10px 14px' }}>{inc.direccion}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                        background: inc.estado === 'RESUELTO' ? '#dcfce7' : inc.estado === 'EN INVESTIGACIÓN' ? '#fef3c7' : inc.estado === 'ARCHIVADO' ? '#e2e8f0' : '#fee2e2',
                        color: inc.estado === 'RESUELTO' ? '#166534' : inc.estado === 'EN INVESTIGACIÓN' ? '#92400e' : inc.estado === 'ARCHIVADO' ? '#475569' : '#991b1b'
                      }}>{inc.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidenciasFiltradas.length > 100 && (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Mostrando 100 de {incidenciasFiltradas.length} registros
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CriminalidadModule;
