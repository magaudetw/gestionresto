'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'
import * as XLSX from 'xlsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date): string { return d.toISOString().split('T')[0] }

function parseXlDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null

  // Excel serial number (days since 1899-12-30)
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  if (!isNaN(n) && n > 10000 && n < 200000) {
    const d = new Date(Date.UTC(1899, 11, 30))
    d.setUTCDate(d.getUTCDate() + Math.floor(n))
    return isoDate(d)
  }

  const s = String(raw).trim()

  // DD/MM/YYYY or DD-MM-YYYY (French format)
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T12:00:00Z`)
    if (!isNaN(d.getTime())) return isoDate(d)
  }

  // MM/DD/YYYY (US format)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}T12:00:00Z`)
    if (!isNaN(d.getTime())) return isoDate(d)
  }

  // Standard JS parsing (YYYY-MM-DD, etc.)
  const d = new Date(s)
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) return isoDate(d)

  return null
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchEmployee(
  nomFichier: string,
  employees: any[],
  aliases: Record<string, string>
): { userId: string | null; nom: string | null } {
  if (!nomFichier.trim()) return { userId: null, nom: null }

  // 1. Check aliases (exact key)
  if (aliases[nomFichier]) {
    const emp = employees.find(e => e.id === aliases[nomFichier])
    if (emp) return { userId: emp.id, nom: emp.nom }
  }

  // 2. Check aliases (normalized)
  const nf = normalize(nomFichier)
  for (const [key, uid] of Object.entries(aliases)) {
    if (normalize(key) === nf) {
      const emp = employees.find(e => e.id === uid)
      if (emp) return { userId: emp.id, nom: emp.nom }
    }
  }

  // 3. Exact normalized match
  for (const emp of employees) {
    if (normalize(emp.nom) === nf) return { userId: emp.id, nom: emp.nom }
  }

  // 4. Partial word match — all words in file name appear in employee name
  const fWords = nf.split(' ').filter(w => w.length >= 2)
  for (const emp of employees) {
    const eWords = normalize(emp.nom).split(' ')
    if (fWords.length > 0 && fWords.every(fw => eWords.some(ew => ew.startsWith(fw) || fw.startsWith(ew)))) {
      return { userId: emp.id, nom: emp.nom }
    }
  }

  // 5. At least first word match (last name match)
  if (fWords.length > 0) {
    for (const emp of employees) {
      const eWords = normalize(emp.nom).split(' ')
      if (eWords.some(ew => ew === fWords[0] || fWords[0] === ew)) {
        return { userId: emp.id, nom: emp.nom }
      }
    }
  }

  return { userId: null, nom: null }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'validation' | 'done'

interface ColMapping { nom: string; date: string; heures: string; service: string }

interface MappedRow {
  rowIdx: number
  nomFichier: string
  matchedUserId: string | null
  matchedNom: string | null
  parsedDate: string | null
  rawDate: string
  heures: number | null
  service: string | null
  conflict: boolean
  conflictAction: 'replace' | 'ignore'
  isManual: boolean
  invalid: boolean  // bad date or heures
}

interface ImportResult {
  imported: number
  ignored: number
  replaced: number
  skipped: number
  notifiedNoms: string[]
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step, t, font }: { step: Step; t: any; font: string }) {
  const steps: Step[] = ['upload', 'mapping', 'validation', 'done']
  const labels = { upload: '1', mapping: '2', validation: '3', done: '4' }
  const current = steps.indexOf(step)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: i <= current ? t.accent : t.surface2,
            border: `1px solid ${i <= current ? t.accent : t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: i <= current ? (t.isDark ? '#080808' : '#fff') : t.texteFaible,
            fontFamily: font, fontWeight: i === current ? 700 : 400,
          }}>
            {i < current ? '✓' : labels[s]}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 20, height: 1, background: i < current ? t.accent : t.border }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [profile, setProfile]       = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [employees, setEmployees]   = useState<any[]>([])
  const router = useRouter()

  // Step state
  const [step, setStep]             = useState<Step>('upload')
  const [dragOver, setDragOver]     = useState(false)
  const [fileName, setFileName]     = useState('')
  const [columns, setColumns]       = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<any[][]>([])
  const [rawRows, setRawRows]       = useState<any[][]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Config (from Supabase)
  const [configId, setConfigId]     = useState<string | null>(null)
  const [mapping, setMapping]       = useState<ColMapping>({ nom: '', date: '', heures: '', service: '' })
  const [aliases, setAliases]       = useState<Record<string, string>>({})

  // Validation
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [validating, setValidating] = useState(false)

  // Import
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const user = session.user

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/login'); return }
      const isManager = p.roles?.includes('gerant') || p.roles?.includes('admin')
      if (!isManager) { router.push('/dashboard'); return }
      setProfile(p)

      const rid = p?.restaurant_ids?.[0] || null
      setRestaurantId(rid)

      // Load employees
      if (rid) {
        const { data: emps } = await supabase
          .from('profiles').select('id, nom, roles')
          .contains('restaurant_ids', [rid]).eq('actif', true).order('nom')
        setEmployees(emps || [])
      }

      // Load import config from Supabase
      if (rid) {
        const { data: cfg } = await supabase
          .from('import_config').select('*').eq('restaurant_id', rid).maybeSingle()
        if (cfg) {
          setConfigId(cfg.id)
          setMapping({ nom: cfg.col_nom || '', date: cfg.col_date || '', heures: cfg.col_heures || '', service: cfg.col_shift || '' })
          setAliases(cfg.alias_employes || {})
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  // ── File processing ────────────────────────────────────────────────────────

  function processFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) return
      const headers = rows[0].map((h: any) => String(h).trim())
      setColumns(headers)
      setPreviewRows(rows.slice(1, 6))
      setRawRows(rows.slice(1).filter(r => r.some((c: any) => c !== '')))
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) processFile(file)
  }, [])

  // ── Mapping → Validation ───────────────────────────────────────────────────

  async function goToValidation() {
    if (!mapping.nom || !mapping.date || !mapping.heures) return
    setValidating(true)
    setStep('validation')

    const nomIdx    = columns.indexOf(mapping.nom)
    const dateIdx   = columns.indexOf(mapping.date)
    const heuresIdx = columns.indexOf(mapping.heures)
    const serviceIdx = mapping.service ? columns.indexOf(mapping.service) : -1

    // Parse rows
    const rows: MappedRow[] = rawRows.map((row, i) => {
      const nomFichier = String(row[nomIdx] ?? '').trim()
      const rawDate    = String(row[dateIdx] ?? '').trim()
      const heuresRaw  = parseFloat(String(row[heuresIdx] ?? ''))
      const service    = serviceIdx >= 0 ? String(row[serviceIdx] ?? '').trim() || null : null

      const parsedDate = parseXlDate(row[dateIdx])
      const heures     = isNaN(heuresRaw) || heuresRaw <= 0 ? null : Math.round(heuresRaw * 4) / 4
      const invalid    = !nomFichier || !parsedDate || heures === null

      const { userId, nom } = invalid
        ? { userId: null, nom: null }
        : matchEmployee(nomFichier, employees, aliases)

      return {
        rowIdx: i + 2,
        nomFichier,
        matchedUserId: userId,
        matchedNom: nom,
        parsedDate,
        rawDate,
        heures,
        service,
        conflict: false,
        conflictAction: 'replace' as const,
        isManual: false,
        invalid,
      }
    }).filter(r => r.nomFichier || r.rawDate) // skip blank rows

    // Check conflicts
    const validRows = rows.filter(r => r.matchedUserId && r.parsedDate)
    if (validRows.length > 0) {
      const userIds = [...new Set(validRows.map(r => r.matchedUserId!))]
      const dates   = [...new Set(validRows.map(r => r.parsedDate!))]
      const { data: existing } = await supabase
        .from('heures_employes').select('user_id, date')
        .in('user_id', userIds).in('date', dates)
      const existSet = new Set((existing || []).map(e => `${e.user_id}::${e.date}`))
      for (const r of rows) {
        if (r.matchedUserId && r.parsedDate) {
          r.conflict = existSet.has(`${r.matchedUserId}::${r.parsedDate}`)
        }
      }
    }

    setMappedRows(rows)
    setValidating(false)
  }

  // ── Run import ─────────────────────────────────────────────────────────────

  async function runImport() {
    if (!restaurantId) return
    setImporting(true)

    const batchId = crypto.randomUUID()

    // Collect new aliases from manual matches
    const newAliases = { ...aliases }
    for (const r of mappedRows) {
      if (r.isManual && r.matchedUserId) newAliases[r.nomFichier] = r.matchedUserId
    }

    // Rows to import
    const toImport = mappedRows.filter(r =>
      !r.invalid &&
      r.matchedUserId &&
      r.parsedDate &&
      r.heures !== null &&
      !(r.conflict && r.conflictAction === 'ignore')
    )
    const toIgnore  = mappedRows.filter(r => r.conflict && r.conflictAction === 'ignore')
    const toReplace = toImport.filter(r => r.conflict)

    // Delete existing rows that will be replaced
    for (const r of toReplace) {
      await supabase.from('heures_employes')
        .delete().eq('user_id', r.matchedUserId!).eq('date', r.parsedDate!)
    }

    // Insert
    let imported = 0
    if (toImport.length > 0) {
      const insertPayload = toImport.map(r => ({
        user_id: r.matchedUserId!,
        date: r.parsedDate!,
        heures: r.heures!,
        source: 'maitre_d',
        import_batch_id: batchId,
      }))
      const { error } = await supabase.from('heures_employes').insert(insertPayload)
      if (!error) imported = insertPayload.length
    }

    // Save updated config + aliases
    const cfgPayload = {
      restaurant_id: restaurantId,
      col_nom: mapping.nom,
      col_date: mapping.date,
      col_heures: mapping.heures,
      col_shift: mapping.service,
      alias_employes: newAliases,
      updated_at: new Date().toISOString(),
    }
    if (configId) {
      await supabase.from('import_config').update(cfgPayload).eq('id', configId)
    } else {
      const { data: newCfg } = await supabase.from('import_config').insert(cfgPayload).select().single()
      if (newCfg) setConfigId(newCfg.id)
    }
    setAliases(newAliases)

    // Save import log
    const notifiedIds = new Set(toImport.map(r => r.matchedUserId!))
    if (imported > 0) {
      await supabase.from('import_logs').insert({
        restaurant_id: restaurantId,
        fichier_nom: fileName,
        nb_lignes: imported,
        nb_employes: notifiedIds.size,
        batch_id: batchId,
      })
    }

    // Notifications
    if (notifiedIds.size > 0) {
      const lang = profile?.lang || 'fr'
      await supabase.from('notifications').insert(
        [...notifiedIds].map(uid => ({
          user_id: uid, type: 'heures', lu: false,
          message: lang === 'en'
            ? 'Your hours have been imported and are now available.'
            : 'Vos heures ont été importées et sont maintenant disponibles.',
        }))
      )
    }

    const notifiedNoms = employees.filter(e => notifiedIds.has(e.id)).map(e => e.nom)
    setResult({
      imported,
      ignored: toIgnore.length,
      replaced: toReplace.length,
      skipped: mappedRows.filter(r => !r.invalid && !r.matchedUserId).length,
      notifiedNoms,
    })
    setStep('done')
    setImporting(false)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t    = getTheme(profile?.theme)
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'
  const role = profile?.roles?.[0] || 'gerant'

  const L = (fr: string, en: string) => lang === 'fr' ? fr : en

  // Validation summary counts
  const invalid   = mappedRows.filter(r => r.invalid)
  const unmatched = mappedRows.filter(r => !r.invalid && !r.matchedUserId)
  const conflicts = mappedRows.filter(r => !r.invalid && r.matchedUserId && r.conflict)
  const ready     = mappedRows.filter(r => !r.invalid && r.matchedUserId && !r.conflict)
  const toImportCount = ready.length + conflicts.filter(r => r.conflictAction === 'replace').length

  const canImport = toImportCount > 0

  // ── Render ─────────────────────────────────────────────────────────────────

  const card = {
    background: t.surface1, border: `1px solid ${t.border}`,
    borderRadius: 14, padding: '14px 16px', marginBottom: 14,
  } as const

  const sectionLabel = (txt: string, count?: number) => (
    <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
      {txt}
      {count !== undefined && (
        <span style={{ background: t.surface2, borderRadius: 10, padding: '1px 7px', fontSize: 10, color: t.texteFaible }}>{count}</span>
      )}
    </div>
  )

  const btnBack = (onClick: () => void) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px', background: t.surface1, border: `1px solid ${t.border}`,
      borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font,
    }}>
      {L('← Retour', '← Back')}
    </button>
  )

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main style={{ padding: '16px', paddingBottom: 100 }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 300, margin: 0 }}>{L('Import Maître-D', 'Import Maître-D')}</h1>
        </div>
        <p style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 20 }}>
          {L('Importez les heures depuis un fichier Excel', 'Import hours from an Excel file')}
        </p>

        <StepDots step={step} t={t} font={font} />

        {/* ═══════════════ STEP 1: UPLOAD ═══════════════ */}
        {step === 'upload' && (
          <>
            <div
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? t.accent : t.border}`,
                borderRadius: 16, padding: '52px 24px',
                textAlign: 'center', cursor: 'pointer',
                background: dragOver ? `${t.accent}12` : t.surface1,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 14 }}>📥</div>
              <div style={{ fontSize: 15, color: t.texte, marginBottom: 6 }}>
                {L('Déposez votre fichier ici', 'Drop your file here')}
              </div>
              <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 6 }}>
                {L('ou cliquez pour choisir', 'or click to browse')}
              </div>
              <div style={{ fontSize: 11, color: t.texteFaible }}>
                .xlsx · .xls · .csv
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />

            {configId && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: `${t.accent}0C`, border: `1px solid ${t.borderAccent}`, borderRadius: 10, fontSize: 12, color: t.texteSecondaire }}>
                ✓ {L('Mapping sauvegardé — sera appliqué automatiquement', 'Saved mapping — will be applied automatically')}
                {' '}<span style={{ color: t.accent }}>{mapping.nom} · {mapping.date} · {mapping.heures}</span>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ STEP 2: MAPPING ═══════════════ */}
        {step === 'mapping' && (
          <>
            {/* Mapping selectors */}
            <div style={card}>
              {sectionLabel(L('Mapping des colonnes', 'Column mapping'))}

              {[
                { label: L('Nom employé', 'Employee name'), key: 'nom' as const, required: true },
                { label: L('Date', 'Date'), key: 'date' as const, required: true },
                { label: L('Heures travaillées', 'Hours worked'), key: 'heures' as const, required: true },
                { label: L('Type de shift (optionnel)', 'Shift type (optional)'), key: 'service' as const, required: false },
              ].map(({ label, key, required }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 5, letterSpacing: '0.06em' }}>
                    {label}{required && <span style={{ color: '#E07070' }}> *</span>}
                  </div>
                  <select
                    value={mapping[key]}
                    onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      width: '100%', background: t.surface2, border: `1px solid ${mapping[key] ? t.borderAccent : t.border}`,
                      borderRadius: 8, color: t.texte, padding: '8px 10px',
                      fontSize: 13, fontFamily: font, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">{L('— Sélectionner —', '— Select —')}</option>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div style={{ ...card, overflowX: 'auto' }}>
              {sectionLabel(L('Aperçu (5 premières lignes)', 'Preview (first 5 rows)'))}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 300 }}>
                  <thead>
                    <tr>
                      {columns.map(col => {
                        const isMapped = Object.values(mapping).includes(col)
                        return (
                          <th key={col} style={{
                            padding: '5px 8px', textAlign: 'left', whiteSpace: 'nowrap',
                            color: isMapped ? t.accent : t.texteFaible,
                            fontWeight: isMapped ? 600 : 400,
                            borderBottom: `1px solid ${t.border}`,
                          }}>
                            {col}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {columns.map((_, ci) => (
                          <td key={ci} style={{ padding: '4px 8px', color: t.texteSecondaire, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
                            {String(row[ci] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {btnBack(() => { setStep('upload'); setColumns([]); setPreviewRows([]); setRawRows([]) })}
              <button
                onClick={goToValidation}
                disabled={!mapping.nom || !mapping.date || !mapping.heures}
                style={{
                  flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10,
                  color: t.isDark ? '#080808' : '#fff',
                  cursor: (!mapping.nom || !mapping.date || !mapping.heures) ? 'not-allowed' : 'pointer',
                  opacity: (!mapping.nom || !mapping.date || !mapping.heures) ? 0.4 : 1,
                  fontSize: 13, fontFamily: font, fontWeight: 600,
                }}
              >
                {L('Valider le mapping →', 'Validate mapping →')}
              </button>
            </div>
          </>
        )}

        {/* ═══════════════ STEP 3: VALIDATION ═══════════════ */}
        {step === 'validation' && (
          <>
            {validating ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: t.texteFaible, fontSize: 12, letterSpacing: '0.14em' }}>
                {L('ANALYSE EN COURS...', 'ANALYZING...')}
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ ...card, background: `${t.accent}0A`, border: `1px solid ${t.borderAccent}` }}>
                  {sectionLabel(L('Résumé', 'Summary'))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: L('Prêtes', 'Ready'),       val: ready.length,     color: '#72BA80' },
                      { label: L('Non reconnus', 'Unknown'), val: unmatched.length, color: '#E07070' },
                      { label: L('Conflits', 'Conflicts'),  val: conflicts.length, color: '#E0A850' },
                      { label: L('Invalides', 'Invalid'),   val: invalid.length,   color: t.texteFaible },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: t.surface1, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, color, fontFamily: "'Courier New', monospace" }}>{val}</div>
                        <div style={{ fontSize: 9, color: t.texteSecondaire, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unmatched names — need manual assignment */}
                {unmatched.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {sectionLabel(L('Noms non reconnus', 'Unrecognized names'), unmatched.length)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {unmatched.map(r => (
                        <div key={r.rowIdx} style={{
                          background: 'rgba(224,112,112,0.08)', border: '1px solid rgba(224,112,112,0.25)',
                          borderRadius: 12, padding: '10px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: '#E07070' }}>"{r.nomFichier}"</span>
                            <span style={{ fontSize: 10, color: t.texteFaible }}>
                              {r.parsedDate || r.rawDate} · {r.heures}h
                            </span>
                          </div>
                          <select
                            value={r.matchedUserId || ''}
                            onChange={e => {
                              const uid = e.target.value
                              const emp = employees.find(x => x.id === uid)
                              setMappedRows(prev => prev.map(row =>
                                row.rowIdx === r.rowIdx
                                  ? { ...row, matchedUserId: uid || null, matchedNom: emp?.nom || null, isManual: !!uid }
                                  : row
                              ))
                            }}
                            style={{
                              width: '100%', background: t.surface2, border: `1px solid ${t.border}`,
                              borderRadius: 8, color: t.texte, padding: '7px 10px',
                              fontSize: 12, fontFamily: font, outline: 'none',
                            }}
                          >
                            <option value="">{L('→ Associer à un employé...', '→ Assign to employee...')}</option>
                            <option value="__skip">{L('Ignorer cette ligne', 'Skip this row')}</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.nom}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {conflicts.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {sectionLabel(L('Conflits — données existantes', 'Conflicts — existing data'), conflicts.length)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conflicts.map(r => (
                        <div key={r.rowIdx} style={{
                          background: 'rgba(224,160,80,0.08)', border: '1px solid rgba(224,160,80,0.25)',
                          borderRadius: 12, padding: '10px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        }}>
                          <div>
                            <div style={{ fontSize: 12, color: t.texte }}>{r.matchedNom}</div>
                            <div style={{ fontSize: 10, color: t.texteSecondaire }}>
                              {r.parsedDate} · {r.heures}h
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {(['replace', 'ignore'] as const).map(action => (
                              <button
                                key={action}
                                onClick={() => setMappedRows(prev => prev.map(row =>
                                  row.rowIdx === r.rowIdx ? { ...row, conflictAction: action } : row
                                ))}
                                style={{
                                  padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontFamily: font,
                                  border: `1px solid ${r.conflictAction === action ? (action === 'replace' ? '#E0A850' : t.border) : t.border}`,
                                  background: r.conflictAction === action ? (action === 'replace' ? 'rgba(224,160,80,0.2)' : t.surface2) : 'transparent',
                                  color: r.conflictAction === action ? (action === 'replace' ? '#E0A850' : t.texteSecondaire) : t.texteFaible,
                                }}
                              >
                                {action === 'replace' ? L('Remplacer', 'Replace') : L('Ignorer', 'Skip')}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ready rows info */}
                {ready.length > 0 && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px',
                    background: 'rgba(114,186,128,0.08)', border: '1px solid rgba(114,186,128,0.25)',
                    borderRadius: 12,
                  }}>
                    <span style={{ fontSize: 12, color: '#72BA80' }}>
                      ✓ {ready.length} {L('lignes prêtes à importer', 'rows ready to import')}
                    </span>
                    <div style={{ fontSize: 10, color: t.texteSecondaire, marginTop: 3 }}>
                      {[...new Set(ready.map(r => r.matchedNom))].join(', ')}
                    </div>
                  </div>
                )}

                {/* Invalid rows info */}
                {invalid.length > 0 && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px',
                    background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 11, color: t.texteFaible }}>
                      {invalid.length} {L('ligne(s) ignorée(s) — date ou heures manquantes', 'row(s) skipped — missing date or hours')}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {btnBack(() => setStep('mapping'))}
                  <button
                    onClick={runImport}
                    disabled={!canImport || importing}
                    style={{
                      flex: 2, padding: '12px', background: canImport ? t.accent : t.surface2,
                      border: 'none', borderRadius: 10,
                      color: canImport ? (t.isDark ? '#080808' : '#fff') : t.texteFaible,
                      cursor: canImport ? 'pointer' : 'not-allowed',
                      opacity: canImport ? 1 : 0.5,
                      fontSize: 13, fontFamily: font, fontWeight: 600,
                    }}
                  >
                    {importing
                      ? L('Import en cours...', 'Importing...')
                      : L(`Importer ${toImportCount} ligne${toImportCount !== 1 ? 's' : ''}`, `Import ${toImportCount} row${toImportCount !== 1 ? 's' : ''}`)
                    }
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════════ STEP 4: DONE ═══════════════ */}
        {step === 'done' && result && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 8 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>
                {result.imported > 0 ? '✓' : '⚠'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 300, color: result.imported > 0 ? '#72BA80' : t.texteSecondaire }}>
                {L('Import terminé', 'Import complete')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: L('Importées', 'Imported'),   val: result.imported,       color: '#72BA80' },
                { label: L('Remplacées', 'Replaced'),  val: result.replaced,       color: '#E0A850' },
                { label: L('Ignorées', 'Skipped'),     val: result.ignored,        color: t.texteSecondaire },
                { label: L('Notifiés', 'Notified'),    val: result.notifiedNoms.length, color: '#7EB8F7' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, color, fontFamily: "'Courier New', monospace" }}>{val}</div>
                  <div style={{ fontSize: 9, color: t.texteSecondaire, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>

            {result.skipped > 0 && (
              <div style={{ background: 'rgba(224,112,112,0.08)', border: '1px solid rgba(224,112,112,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#E07070' }}>
                  {result.skipped} {L('nom(s) non associé(s) — non importé(s)', 'name(s) not matched — not imported')}
                </div>
              </div>
            )}

            {result.notifiedNoms.length > 0 && (
              <div style={{ background: 'rgba(126,184,247,0.08)', border: '1px solid rgba(126,184,247,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#7EB8F7', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {L('Employés notifiés', 'Employees notified')}
                </div>
                <div style={{ fontSize: 12, color: t.texteSecondaire }}>
                  {result.notifiedNoms.join(', ')}
                </div>
              </div>
            )}

            <button
              onClick={() => { setStep('upload'); setResult(null); setColumns([]); setPreviewRows([]); setRawRows([]); setMappedRows([]); setFileName('') }}
              style={{
                width: '100%', padding: '12px', background: t.accent, border: 'none',
                borderRadius: 10, color: t.isDark ? '#080808' : '#fff',
                cursor: 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600,
              }}
            >
              {L('Nouvel import', 'New import')}
            </button>
          </>
        )}
      </main>

    </AppShell>
  )
}
