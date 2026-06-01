interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: string
  iconBg?: string
  iconColor?: string
  trend?: { value: string; up?: boolean }
}

export default function KpiCard({ label, value, sub, icon, iconBg, iconColor, trend }: KpiCardProps) {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 'var(--fz-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-muted)',
        }}>
          {label}
        </span>
        {icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: iconBg || 'var(--accent-subtle)',
            color: iconColor || 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span className="kpi-value">{value}</span>
        {trend && (
          <span style={{
            fontSize: 'var(--fz-xs)', fontWeight: 500, marginBottom: 3,
            color: trend.up === false ? 'var(--danger)' : trend.up === true ? 'var(--success)' : 'var(--text-muted)',
          }}>
            {trend.up === true ? '▲' : trend.up === false ? '▼' : ''} {trend.value}
          </span>
        )}
      </div>

      {sub && (
        <span className="kpi-sub">{sub}</span>
      )}
    </div>
  )
}
