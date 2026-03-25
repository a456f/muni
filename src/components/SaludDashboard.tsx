import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface StatsData {
  total_atenciones: number;
  porTipoAtencion: { nombre: string; cantidad: number }[];
  porEstablecimiento: { nombre: string; cantidad: number }[];
  porFecha: { fecha_label: string; fecha: string; cantidad: number }[];
  porSexo: { nombre: string; cantidad: number }[];
  porClasificacion: { nombre: string; cantidad: number }[];
  mes_actual: number;
  mes_anterior: number;
}

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#22c55e', '#eab308'
];

const SaludDashboard = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [mes, setMes] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStats = async (mesFilter?: string) => {
    setLoading(true);
    try {
      const url = mesFilter ? `${API_URL}/salud/estadisticas?mes=${mesFilter}` : `${API_URL}/salud/estadisticas`;
      const res = await fetch(url);
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleMesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMes(val);
    fetchStats(val || undefined);
  };

  const mesLabel = () => {
    if (!mes) return 'General';
    const [y, m] = mes.split('-');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[parseInt(m) - 1]} ${y}`;
  };

  // SVG Pie Chart
  const PieChart = ({ data, title }: { data: { nombre: string; cantidad: number }[]; title: string }) => {
    const total = data.reduce((s, d) => s + d.cantidad, 0);
    if (total === 0) return <div className="stat-card" style={{ padding: '1rem 1.2rem' }}><h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>{title}</h3><p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</p></div>;

    let cumAngle = 0;
    const slices = data.map((d, i) => {
      const pct = d.cantidad / total;
      const startAngle = cumAngle;
      cumAngle += pct * 360;
      const endAngle = cumAngle;
      return { ...d, pct, startAngle, endAngle, color: PIE_COLORS[i % PIE_COLORS.length] };
    });

    const toRad = (deg: number) => (deg - 90) * Math.PI / 180;
    const cx = 100, cy = 100, r = 80;

    return (
      <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <svg viewBox="0 0 200 200" width="180" height="180" style={{ flexShrink: 0 }}>
            {slices.map((s, i) => {
              if (s.pct >= 0.9999) {
                return <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />;
              }
              const largeArc = s.pct > 0.5 ? 1 : 0;
              const x1 = cx + r * Math.cos(toRad(s.startAngle));
              const y1 = cy + r * Math.sin(toRad(s.startAngle));
              const x2 = cx + r * Math.cos(toRad(s.endAngle));
              const y2 = cy + r * Math.sin(toRad(s.endAngle));
              return (
                <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`} fill={s.color} stroke="#fff" strokeWidth="1">
                  <title>{s.nombre}: {s.cantidad} ({(s.pct * 100).toFixed(1)}%)</title>
                </path>
              );
            })}
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="bold" fill="var(--text-primary, #333)">{total}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="var(--text-muted, #666)">total</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', flex: 1, minWidth: '140px' }}>
            {slices.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }}></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nombre}>{s.nombre}</span>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>{(s.pct * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Bar chart
  const BarChart = ({ data, title, colorBase }: { data: { label: string; cantidad: number }[]; title: string; colorBase: string }) => {
    const max = Math.max(...data.map(d => d.cantidad), 1);
    return (
      <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>{title}</h3>
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', paddingTop: '8px' }}>
            {data.map((d, i) => {
              const h = Math.max((d.cantidad / max) * 100, 6);
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, marginBottom: 2, color: 'var(--text-primary)' }}>{d.cantidad}</span>
                  <div style={{ width: '100%', maxWidth: '28px', height: `${h}px`, background: colorBase, borderRadius: '3px 3px 0 0', opacity: 0.7 + (d.cantidad / max) * 0.3 }} title={`${d.label}: ${d.cantidad}`} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>{d.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading && !stats) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando estadísticas...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se pudieron cargar las estadísticas</div>;

  const tendencia = stats.mes_anterior > 0
    ? ((stats.mes_actual - stats.mes_anterior) / stats.mes_anterior * 100)
    : stats.mes_actual > 0 ? 100 : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Atenciones Paramédicos {mesLabel()}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>El Observatorio de Seguridad Ciudadana de Miraflores</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtrar mes:</label>
          <input type="month" value={mes} onChange={handleMesChange} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light, #ddd)', background: 'var(--bg-input, #fff)', color: 'var(--text-primary)' }} />
          {mes && <button onClick={() => { setMes(''); fetchStats(); }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--text-muted)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Limpiar</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3>N° DE ATENCIONES</h3>
          <p className="stat-number">{stats.total_atenciones}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>total</span>
        </div>
        <div className="stat-card">
          <h3>Este Mes</h3>
          <p className="stat-number" style={{ color: '#3b82f6' }}>{stats.mes_actual}</p>
          <span style={{ fontSize: '0.78rem', color: tendencia >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(0)}% vs mes anterior
          </span>
        </div>
        <div className="stat-card">
          <h3>Mes Anterior</h3>
          <p className="stat-number" style={{ color: '#f59e0b' }}>{stats.mes_anterior}</p>
        </div>
        <div className="stat-card">
          <h3>Clasificaciones</h3>
          <p className="stat-number" style={{ color: '#8b5cf6' }}>{stats.porClasificacion.length}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tipos</span>
        </div>
      </div>

      {/* Pie Charts Row */}
      <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
        <PieChart data={stats.porTipoAtencion} title="Atenciones por Tipo" />
        <PieChart data={stats.porEstablecimiento} title="Traslado Hospitales / Clínica" />
      </div>

      {/* Bar Charts Row */}
      <div className="dash-grid-2" style={{ marginBottom: '1rem' }}>
        <BarChart
          data={stats.porFecha.map(f => ({ label: f.fecha_label, cantidad: f.cantidad }))}
          title="N° de Atenciones por Fecha"
          colorBase="#ec4899"
        />
        <BarChart
          data={stats.porSexo.map(s => ({ label: s.nombre, cantidad: s.cantidad }))}
          title="N° de Atenciones por Sexo"
          colorBase="#3b82f6"
        />
      </div>

      {/* Classification breakdown */}
      <div className="stat-card" style={{ padding: '1rem 1.2rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Atenciones por Clasificación</h3>
        {stats.porClasificacion.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sin datos</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stats.porClasificacion.map((item, i) => {
              const maxVal = Math.max(...stats.porClasificacion.map(c => c.cantidad), 1);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.nombre}</span>
                  <div style={{ flex: 1, height: '18px', background: 'var(--bg-input, #f1f5f9)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(item.cantidad / maxVal) * 100}%`, height: '100%', background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: '4px', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 700 }}>{item.cantidad}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SaludDashboard;
