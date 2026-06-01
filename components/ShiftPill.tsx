interface ShiftPillProps {
  debut: string
  fin: string
  poste?: string
  color?: string
  bg?: string
  compact?: boolean
}

export default function ShiftPill({ debut, fin, poste, color, bg, compact }: ShiftPillProps) {
  const background = bg    || 'var(--accent-subtle)'
  const textColor  = color || 'var(--accent)'

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: compact ? 4 : 6,
      background, color: textColor,
      borderRadius: 'var(--radius-sm)',
      padding: compact ? '2px 7px' : '4px 10px',
      fontSize: compact ? 'var(--fz-xs)' : 'var(--fz-sm)',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      border: '1px solid',
      borderColor: color ? `${color}33` : 'var(--border-accent)',
    }}>
      <span>{debut}–{fin}</span>
      {poste && !compact && (
        <span style={{ opacity: 0.7, fontSize: 'var(--fz-xs)' }}>· {poste}</span>
      )}
    </div>
  )
}
