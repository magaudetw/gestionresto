'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'
import { useAuth } from '@/lib/auth-context'
import type { Role, Jour, Service, DisposBase } from '@/types'

const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  admin:   { fr: 'Admin',            en: 'Admin' },
  gerant:  { fr: 'Gérant',           en: 'Manager' },
  bar:     { fr: 'Barman/Barmaid',   en: 'Bartender' },
  serveur: { fr: 'Serveur/Serveuse', en: 'Server' },
  busboy:  { fr: 'Busboy',           en: 'Busboy' },
}

const ROLE_ICONS: Record<string, string> = {
  admin: '🔧', gerant: '👔', bar: '🍸', serveur: '🍽️', busboy: '✨',
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#E07070', gerant: '#C9A84C', bar: '#7EB8F7', serveur: '#82E0AA', busboy: '#C39BD3',
}

const COEFF: Record<string, number> = {
  admin: 1.0, gerant: 1.0, bar: 1.0, serveur: 1.0, busboy: 0.5,
}

const SELECTABLE_ROLES: Role[] = ['gerant', 'bar', 'serveur', 'busboy']

const JOURS: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const JOUR_LABELS: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lun', en: 'Mon' }, mar: { fr: 'Mar', en: 'Tue' },
  mer: { fr: 'Mer', en: 'Wed' }, jeu: { fr: 'Jeu', en: 'Thu' },
  ven: { fr: 'Ven', en: 'Fri' }, sam: { fr: 'Sam', en: 'Sat' },
}
const SERVICES: Service[] = ['midi', 'soir', 'les_deux']
const SERVICE_LABELS: Record<Service, { fr: string; en: string }> = {
  midi:     { fr: 'Midi',     en: 'Lunch' },
  soir:     { fr: 'Soir',     en: 'Dinner' },
  les_deux: { fr: 'Les deux', en: 'Both' },
}

const EMPTY_DISPOS: DisposBase = { jours: [], services: [], contraintes: '' }

interface ModalData {
  id?: string
  nom: string
  email: string
  roles: Role[]
  taux_horaire: string
  restaurant_ids: string[]
  actif: boolean
  dispos_base: DisposBase
}

const EMPTY_MODAL: ModalData = {
  nom: '', email: '', roles: [], taux_horaire: '', restaurant_ids: [], actif: true,
  dispos_base: { ...EMPTY_DISPOS },
}

const RESTAURANTS = [
  { id: '1', nom: 'Le Carré' },
  { id: '2', nom: 'Le Caméléon' },
]

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtImportDate(iso: string, lang: 'fr'|'en'): string {
  const d = new Date(iso)
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function EquipePage() {
  const { profile, restaurantId, isManager, loading } = useAuth()
  const [employes, setEmployes] = useState<any[]>([])
  const [filter, setFilter] = useState<string>('tous')
  const [modal, setModal] = useState<ModalData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [importLogs, setImportLogs] = useState<any[]>([])
  const [undoing, setUndoing] = useState<string | null>(null)
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null)
  const [showImportHistory, setShowImportHistory] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isManager) router.push('/dashboard')
  }, [loading, isManager, router])

  useEffect(() => {
    if (!profile) return
    async function loadData() {
      let q = supabase.from('profiles').select('*').order('nom')
      if (restaurantId) q = q.contains('restaurant_ids', [restaurantId])
      const { data } = await q
      setEmployes(data || [])
      if (restaurantId) {
        const { data: logs } = await supabase
          .from('import_logs').select('*').eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false }).limit(10)
        setImportLogs(logs || [])
      }
    }
    loadData()
  }, [profile, restaurantId])

  async function loadEmployes() {
    let q = supabase.from('profiles').select('*').order('nom')
    if (restaurantId) q = q.contains('restaurant_ids', [restaurantId])
    const { data } = await q
    setEmployes(data || [])
  }

  async function loadImportLogs() {
    if (!restaurantId) return
    const { data } = await supabase
      .from('import_logs').select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10)
    setImportLogs(data || [])
  }

  async function handleUndoImport(log: any) {
    setUndoing(log.id)
    await supabase.from('heures_employes').delete().eq('import_batch_id', log.batch_id)
    await supabase.from('import_logs').delete().eq('id', log.id)
    setImportLogs(prev => prev.filter(l => l.id !== log.id))
    setUndoing(null)
    setConfirmUndo(null)
  }

  function toggleJour(j: Jour) {
    setModal(m => {
      if (!m) return m
      const jours = m.dispos_base.jours.includes(j)
        ? m.dispos_base.jours.filter(x => x !== j)
        : [...m.dispos_base.jours, j]
      return { ...m, dispos_base: { ...m.dispos_base, jours } }
    })
  }

  function toggleService(s: Service) {
    setModal(m => {
      if (!m) return m
      const services = m.dispos_base.services.includes(s)
        ? m.dispos_base.services.filter(x => x !== s)
        : [...m.dispos_base.services, s]
      return { ...m, dispos_base: { ...m.dispos_base, services } }
    })
  }

  async function handleSave() {
    if (!modal) return
    if (!modal.nom.trim()) { setSaveError(lang === 'fr' ? 'Le nom est requis' : 'Name required'); return }
    setSaving(true)
    setSaveError('')
    const taux = parseFloat(modal.taux_horaire) || 0

    const base = {
      nom: modal.nom.trim(),
      roles: modal.roles,
      taux_horaire: taux,
      restaurant_ids: modal.restaurant_ids,
      actif: modal.actif,
      dispos_base: modal.dispos_base,
    }
    const payload = modal.id
      ? { id: modal.id, ...base }
      : { ...base, lang: 'fr', theme: 'Or noir' }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action: modal.id ? 'update' : 'create', payload }),
    })
    const result = await res.json()

    if (!res.ok || result.error) {
      const detail = [result.code, result.hint].filter(Boolean).join(' — ')
      setSaveError(`${result.error ?? 'Erreur serveur'}${detail ? ` [${detail}]` : ''}`)
      setSaving(false)
      return
    }

    await loadEmployes()
    setModal(null)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(profile?.theme)
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'

  const allRoles = ['tous', 'gerant', 'bar', 'serveur', 'busboy']
  const filteredEmployes = filter === 'tous'
    ? employes
    : employes.filter(e => e.roles?.includes(filter))

  const T = {
    equipe:  lang === 'fr' ? 'Équipe'       : 'Team',
    tous:    lang === 'fr' ? 'Tous'          : 'All',
    membres: lang === 'fr' ? 'membres'       : 'members',
    taux:    lang === 'fr' ? '/h'            : '/h',
    coeffs:  lang === 'fr' ? 'Coeff.'        : 'Coeff.',
    actif:   lang === 'fr' ? 'Actif'         : 'Active',
    inactif: lang === 'fr' ? 'Inactif'       : 'Inactive',
    nouvelEmploye:   lang === 'fr' ? 'Nouvel employé'  : 'New employee',
    modifierEmploye: lang === 'fr' ? 'Modifier'        : 'Edit',
    nomComplet:  lang === 'fr' ? 'Nom complet'     : 'Full name',
    email:       'Email',
    roles:       lang === 'fr' ? 'Rôles'           : 'Roles',
    tauxH:       lang === 'fr' ? 'Taux horaire ($)' : 'Hourly rate ($)',
    restaurants: lang === 'fr' ? 'Restaurants'     : 'Restaurants',
    statut:      lang === 'fr' ? 'Statut'          : 'Status',
    enregistrer: lang === 'fr' ? 'Enregistrer'     : 'Save',
    annuler:     lang === 'fr' ? 'Annuler'         : 'Cancel',
    dispos:      lang === 'fr' ? 'DISPONIBILITÉS'  : 'AVAILABILITY',
    jours:       lang === 'fr' ? 'Jours'           : 'Days',
    services:    lang === 'fr' ? 'Services'        : 'Services',
    contraintes: lang === 'fr' ? 'Contraintes spéciales' : 'Special constraints',
    contraintesHint: lang === 'fr'
      ? 'Ex: Double obligatoire lundi, Bar requis...'
      : 'E.g.: Double required Monday, Bar required...',
    noteAuth: lang === 'fr'
      ? '* Compte Supabase Auth à créer séparément dans le dashboard'
      : '* Supabase Auth account must be created separately in dashboard',
  }

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main style={{ padding: '16px', paddingBottom: 88 }}>

        {/* Title + add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: 0 }}>{T.equipe}</h1>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginTop: 2 }}>
              {filteredEmployes.length} {T.membres}
            </div>
          </div>
          <button
            onClick={() => { setModal({ ...EMPTY_MODAL, restaurant_ids: profile?.restaurant_ids || [] }); setSaveError('') }}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: t.accent, color: t.isDark ? '#080808' : '#fff',
              fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 300,
            }}
          >
            +
          </button>
        </div>

        {/* Role filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {allRoles.map(r => {
            const isActive = filter === r
            const col = r === 'tous' ? t.accent : (ROLE_COLORS[r] || t.accent)
            return (
              <button key={r} onClick={() => setFilter(r)} style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${isActive ? col : t.border}`,
                background: isActive ? `${col}22` : 'transparent',
                color: isActive ? col : t.texteSecondaire,
                fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', fontFamily: font,
              }}>
                {r === 'tous' ? T.tous : `${ROLE_ICONS[r] || ''} ${ROLE_LABELS[r]?.[lang] || r}`}
              </button>
            )
          })}
        </div>

        {/* Employee list */}
        {filteredEmployes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: t.texteFaible, fontSize: 13 }}>
            {lang === 'fr' ? 'Aucun employé' : 'No employees'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredEmployes.map(emp => {
              const primaryRole = emp.roles?.[0] || 'serveur'
              const primaryColor = ROLE_COLORS[primaryRole] || t.accent
              const coeff = Math.max(...(emp.roles || []).map((r: string) => COEFF[r] || 1.0))
              const dispos = emp.dispos_base as DisposBase | null

              return (
                <button
                  key={emp.id}
                  onClick={() => {
                    setModal({
                      id: emp.id,
                      nom: emp.nom || '',
                      email: emp.email || '',
                      roles: emp.roles || [],
                      taux_horaire: emp.taux_horaire?.toString() || '',
                      restaurant_ids: emp.restaurant_ids || [],
                      actif: emp.actif !== false,
                      dispos_base: emp.dispos_base || { ...EMPTY_DISPOS },
                    })
                    setSaveError('')
                  }}
                  style={{
                    background: t.surface1, border: `1px solid ${t.border}`,
                    borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    textAlign: 'left', width: '100%', fontFamily: font,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: `${primaryColor}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {ROLE_ICONS[primaryRole] || '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, color: t.texte, fontWeight: 400 }}>{emp.nom}</div>
                        <div style={{ fontSize: 10, color: emp.actif !== false ? '#72BA80' : '#E07070', marginTop: 2 }}>
                          ● {emp.actif !== false ? T.actif : T.inactif}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, color: t.accent, fontFamily: "'Courier New', monospace" }}>
                        ${emp.taux_horaire?.toFixed(2) || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: t.texteSecondaire }}>{T.taux}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {(emp.roles || []).map((r: string) => (
                        <span key={r} style={{
                          padding: '3px 9px', borderRadius: 20, fontSize: 10,
                          background: `${ROLE_COLORS[r] || t.accent}1A`,
                          border: `1px solid ${ROLE_COLORS[r] || t.accent}40`,
                          color: ROLE_COLORS[r] || t.accent,
                        }}>
                          {ROLE_ICONS[r] && `${ROLE_ICONS[r]} `}{ROLE_LABELS[r]?.[lang] || r}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: t.texteFaible, flexShrink: 0, marginLeft: 8 }}>
                      {T.coeffs} ×{coeff.toFixed(1)}
                    </div>
                  </div>
                  {/* Dispo summary */}
                  {dispos && (dispos.jours?.length > 0 || dispos.services?.length > 0) && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(dispos.jours || []).map(j => (
                        <span key={j} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${t.accent}15`, color: t.texteSecondaire, letterSpacing: '0.04em' }}>
                          {JOUR_LABELS[j]?.[lang] || j}
                        </span>
                      ))}
                      {(dispos.services || []).map(s => (
                        <span key={s} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: `${t.accent}15`, color: t.accent, letterSpacing: '0.04em' }}>
                          {SERVICE_LABELS[s]?.[lang] || s}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {/* ── IMPORT HISTORY ── */}
        <div style={{ marginTop: 28 }}>
          <button
            onClick={() => setShowImportHistory(v => !v)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '2px 0', marginBottom: showImportHistory ? 10 : 0, fontFamily: font,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire }}>
              {lang === 'fr' ? 'Historique des imports' : 'Import history'}
              {importLogs.length > 0 && (
                <span style={{ marginLeft: 8, background: t.surface2, borderRadius: 8, padding: '1px 7px', fontSize: 10, color: t.texteFaible }}>
                  {importLogs.length}
                </span>
              )}
            </div>
            <span style={{ color: t.texteFaible, fontSize: 14 }}>{showImportHistory ? '▲' : '▼'}</span>
          </button>

          {showImportHistory && (
            <>
              {importLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: t.texteFaible, fontSize: 13 }}>
                  {lang === 'fr' ? 'Aucun import effectué' : 'No imports yet'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {importLogs.map((log, i) => (
                    <div key={log.id} style={{
                      background: t.surface1, border: `1px solid ${t.border}`,
                      borderRadius: 12, padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: t.texte, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.fichier_nom || '—'}
                          </div>
                          <div style={{ fontSize: 10, color: t.texteSecondaire }}>
                            {fmtImportDate(log.created_at, lang)}
                          </div>
                          <div style={{ fontSize: 10, color: t.texteFaible, marginTop: 2 }}>
                            {log.nb_lignes} {lang === 'fr' ? 'lignes' : 'rows'} · {log.nb_employes} {lang === 'fr' ? 'employés' : 'employees'}
                          </div>
                        </div>

                        {/* Undo button — only on most recent */}
                        {i === 0 && (
                          confirmUndo === log.id ? (
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                              <button
                                onClick={() => setConfirmUndo(null)}
                                style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7, cursor: 'pointer', fontSize: 11, color: t.texteSecondaire, fontFamily: font }}
                              >
                                {lang === 'fr' ? 'Non' : 'No'}
                              </button>
                              <button
                                onClick={() => handleUndoImport(log)}
                                disabled={undoing === log.id}
                                style={{ padding: '4px 10px', background: 'rgba(224,112,112,0.15)', border: '1px solid rgba(224,112,112,0.4)', borderRadius: 7, cursor: undoing === log.id ? 'wait' : 'pointer', fontSize: 11, color: '#E07070', fontFamily: font }}
                              >
                                {undoing === log.id ? '...' : (lang === 'fr' ? 'Confirmer' : 'Confirm')}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmUndo(log.id)}
                              style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 11, color: t.texteSecondaire, fontFamily: font, flexShrink: 0 }}
                            >
                              {lang === 'fr' ? 'Annuler' : 'Undo'}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal overlay */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 100, display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: t.surface1, borderRadius: '20px 20px 0 0',
              padding: '20px 18px 32px', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 20px' }} />

            <h2 style={{ fontSize: 18, fontWeight: 300, margin: '0 0 20px', color: t.texte }}>
              {modal.id ? T.modifierEmploye : T.nouvelEmploye}
            </h2>

            {/* Nom */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.nomComplet} *</div>
              <input value={modal.nom} onChange={e => setModal(m => m ? { ...m, nom: e.target.value } : m)}
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Email */}
            {!modal.id && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.email}</div>
                <input value={modal.email} onChange={e => setModal(m => m ? { ...m, email: e.target.value } : m)}
                  type="email" placeholder="prenom@email.com"
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 10, color: t.texteFaible, marginTop: 4, fontStyle: 'italic' }}>{T.noteAuth}</div>
              </div>
            )}

            {/* Taux horaire */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.tauxH}</div>
              <input value={modal.taux_horaire} onChange={e => setModal(m => m ? { ...m, taux_horaire: e.target.value } : m)}
                type="number" min="0" step="0.25" placeholder="18.50"
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Rôles */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 8, letterSpacing: '0.08em' }}>{T.roles}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SELECTABLE_ROLES.map(r => {
                  const isSelected = modal.roles.includes(r)
                  const col = ROLE_COLORS[r]
                  return (
                    <button key={r} onClick={() => setModal(m => {
                      if (!m) return m
                      const next = isSelected ? m.roles.filter(x => x !== r) : [...m.roles, r]
                      return { ...m, roles: next }
                    })} style={{
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${isSelected ? col : t.border}`,
                      background: isSelected ? `${col}22` : 'transparent',
                      color: isSelected ? col : t.texteSecondaire,
                      fontSize: 12, fontFamily: font,
                    }}>
                      {ROLE_ICONS[r]} {ROLE_LABELS[r]?.[lang] || r}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Restaurants */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 8, letterSpacing: '0.08em' }}>{T.restaurants}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RESTAURANTS.map(r => {
                  const isSelected = modal.restaurant_ids.includes(r.id)
                  return (
                    <button key={r.id} onClick={() => setModal(m => {
                      if (!m) return m
                      const next = isSelected ? m.restaurant_ids.filter(x => x !== r.id) : [...m.restaurant_ids, r.id]
                      return { ...m, restaurant_ids: next }
                    })} style={{
                      flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${isSelected ? t.accent : t.border}`,
                      background: isSelected ? `${t.accent}18` : 'transparent',
                      color: isSelected ? t.accent : t.texteSecondaire,
                      fontSize: 12, fontFamily: font,
                    }}>
                      {r.nom}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── DISPONIBILITÉS ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: t.texteSecondaire, marginBottom: 10, letterSpacing: '0.12em', textTransform: 'uppercase', paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
                {T.dispos}
              </div>

              {/* Jours */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.texteFaible, marginBottom: 6 }}>{T.jours}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {JOURS.map(j => {
                    const isSelected = modal.dispos_base.jours.includes(j)
                    return (
                      <button key={j} onClick={() => toggleJour(j)} style={{
                        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${isSelected ? t.accent : t.border}`,
                        background: isSelected ? `${t.accent}22` : 'transparent',
                        color: isSelected ? t.accent : t.texteSecondaire,
                        fontSize: 12, fontFamily: font,
                      }}>
                        {JOUR_LABELS[j][lang]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Services */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.texteFaible, marginBottom: 6 }}>{T.services}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SERVICES.map(s => {
                    const isSelected = modal.dispos_base.services.includes(s)
                    return (
                      <button key={s} onClick={() => toggleService(s)} style={{
                        flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${isSelected ? t.accent : t.border}`,
                        background: isSelected ? `${t.accent}22` : 'transparent',
                        color: isSelected ? t.accent : t.texteSecondaire,
                        fontSize: 11, fontFamily: font,
                      }}>
                        {SERVICE_LABELS[s][lang]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contraintes */}
              <div>
                <div style={{ fontSize: 11, color: t.texteFaible, marginBottom: 6 }}>{T.contraintes}</div>
                <textarea
                  value={modal.dispos_base.contraintes}
                  onChange={e => setModal(m => m ? { ...m, dispos_base: { ...m.dispos_base, contraintes: e.target.value } } : m)}
                  placeholder={T.contraintesHint}
                  rows={2}
                  style={{
                    width: '100%', background: t.surface2, border: `1px solid ${t.border}`,
                    borderRadius: 8, color: t.texte, padding: '10px 12px',
                    fontSize: 13, fontFamily: font, outline: 'none',
                    boxSizing: 'border-box', resize: 'none',
                  }}
                />
              </div>
            </div>

            {/* Actif toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: t.texte }}>{T.statut}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: modal.actif ? '#72BA80' : '#E07070' }}>
                  {modal.actif ? T.actif : T.inactif}
                </span>
                <button onClick={() => setModal(m => m ? { ...m, actif: !m.actif } : m)} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: modal.actif ? '#72BA80' : t.surface2, position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: modal.actif ? 22 : 4,
                    width: 16, height: 16, borderRadius: '50%',
                    background: modal.actif ? '#fff' : t.texteSecondaire, transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>

            {saveError && (
              <div style={{ background: 'rgba(224,112,112,0.15)', border: '1px solid rgba(224,112,112,0.4)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#E07070' }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{
                flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`,
                borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font,
              }}>
                {T.annuler}
              </button>
              <button onClick={handleSave} disabled={saving} style={{
                flex: 2, padding: '12px', background: t.accent, border: 'none',
                borderRadius: 10, color: t.isDark ? '#080808' : '#fff',
                cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600,
              }}>
                {saving ? '...' : T.enregistrer}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
