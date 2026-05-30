'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import { getTheme, THEME_NAMES, LIGHT_THEMES, DARK_THEMES, FONT_SIZES, FONTS, applyThemeToDocument } from '@/lib/themes'
import type { ThemeName } from '@/lib/themes'
import type { ShiftType, Jour } from '@/types'
import { useAuth } from '@/lib/auth-context'

const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  admin:   { fr: 'Admin',            en: 'Admin' },
  gerant:  { fr: 'Gérant',           en: 'Manager' },
  bar:     { fr: 'Barman/Barmaid',   en: 'Bartender' },
  serveur: { fr: 'Serveur/Serveuse', en: 'Server' },
  busboy:  { fr: 'Busboy',           en: 'Busboy' },
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#E07070', gerant: '#C9A84C', bar: '#7EB8F7', serveur: '#82E0AA', busboy: '#C39BD3',
}

const SHIFT_COLORS = [
  '#F4A261', '#7EB8F7', '#82E0AA', '#C39BD3',
  '#C9A84C', '#E07070', '#72BA80', '#E0A850',
]

const ROLE_TYPE_COLORS = [
  '#E07070', '#C9A84C', '#7EB8F7', '#82E0AA',
  '#C39BD3', '#72BA80', '#E0A850', '#F4A261',
]

const JOURS_ORDRE: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const JOUR_LABELS: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lun', en: 'Mon' }, mar: { fr: 'Mar', en: 'Tue' },
  mer: { fr: 'Mer', en: 'Wed' }, jeu: { fr: 'Jeu', en: 'Thu' },
  ven: { fr: 'Ven', en: 'Fri' }, sam: { fr: 'Sam', en: 'Sat' },
}

interface ShiftModalData {
  id?: string
  nom: string
  debut: string
  fin: string
  couleur: string
}

interface RoleTypeModalData {
  id?: string
  nom: string
  slug: string
  coefficient_pourboire: string
  couleur: string
  icone: string
  actif: boolean
}

type CovEntry = { nb_personnes: number; bar_requis: boolean; id?: string }

function loadGoogleFont(font: typeof FONTS[number]) {
  if (!('google' in font)) return
  const id = `gf-${font.label.replace(/\s/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

export default function ReglagesPage() {
  const { profile, restaurantId, isGerant, isAdmin, loading, userId, refreshProfile } = useAuth()
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [activeTab, setActiveTab] = useState<'compte' | 'apparence' | 'shifts' | 'couverture' | 'cotes' | 'roles'>('compte')

  const [selectedTheme, setSelectedTheme] = useState<ThemeName>('Lumière')
  const [selectedLang, setSelectedLang] = useState<'fr' | 'en'>('fr')
  const [selectedFont, setSelectedFont] = useState<string>(FONTS[0].value)
  const [selectedFontSize, setSelectedFontSize] = useState<string>('md')

  // Shift types
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [shiftModal, setShiftModal] = useState<ShiftModalData | null>(null)
  const [savingShift, setSavingShift] = useState(false)
  const [confirmDeleteShift, setConfirmDeleteShift] = useState<string | null>(null)

  // Couverture minimale
  const [couverture, setCouverture] = useState<Record<string, CovEntry>>({})
  const [savingCouverture, setSavingCouverture] = useState(false)
  const [savedCouverture, setSavedCouverture] = useState(false)

  // Cotes
  const [cotesReg, setCotesReg] = useState<any[]>([])
  const [coteModal, setCoteModal] = useState<{ id?: string; nom: string; pourcentage: string; actif: boolean } | null>(null)
  const [savingCote, setSavingCote] = useState(false)
  const [confirmDeleteCote, setConfirmDeleteCote] = useState<string | null>(null)

  // Role types management
  const [roleTypes, setRoleTypes] = useState<any[]>([])
  const [roleTypeModal, setRoleTypeModal] = useState<RoleTypeModalData | null>(null)
  const [savingRoleType, setSavingRoleType] = useState(false)
  const [confirmArchiveRoleType, setConfirmArchiveRoleType] = useState<string | null>(null)

  // Sync form state from profile
  useEffect(() => {
    if (!profile) return
    if (profile.theme)       setSelectedTheme(profile.theme as ThemeName)
    if (profile.lang)        setSelectedLang(profile.lang as 'fr' | 'en')
    if (profile.font_family) setSelectedFont(profile.font_family)
    if (profile.font_size)   setSelectedFontSize(profile.font_size)
  }, [profile])

  // Load manager data when profile is ready
  useEffect(() => {
    if (!isGerant || !restaurantId) return
    async function loadManagerData() {
      const { data: shifts } = await supabase
        .from('shift_types').select('*').eq('restaurant_id', restaurantId).order('debut')
      setShiftTypes(shifts || [])

      const { data: cov } = await supabase
        .from('couverture_minimale').select('*').eq('restaurant_id', restaurantId)
      const covMap: Record<string, CovEntry> = {}
      for (const c of (cov || [])) {
        covMap[`${c.jour}_${c.service}`] = { nb_personnes: c.nb_personnes, bar_requis: c.bar_requis, id: c.id }
      }
      setCouverture(covMap)

      const { data: cotesD } = await supabase
        .from('cotes').select('*').eq('restaurant_id', restaurantId).order('nom')
      setCotesReg(cotesD || [])

      if (isAdmin) {
        const { data: rtData } = await supabase
          .from('role_types').select('*').order('nom')
        setRoleTypes(rtData || [])
      }
    }
    loadManagerData()
  }, [isGerant, isAdmin, restaurantId])

  useEffect(() => {
    const fontDef = FONTS.find(f => f.value === selectedFont)
    if (fontDef) loadGoogleFont(fontDef)
  }, [selectedFont])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setSaveError(false)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/save-prefs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ theme: selectedTheme, lang: selectedLang, font_family: selectedFont, font_size: selectedFontSize }),
    })

    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('handleSave:', json.error)
      setSaveError(true)
      setTimeout(() => setSaveError(false), 3000)
      return
    }

    applyThemeToDocument(selectedTheme, selectedFont, selectedFontSize)
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function loadShiftTypes() {
    if (!restaurantId) return
    const { data } = await supabase
      .from('shift_types').select('*').eq('restaurant_id', restaurantId).order('debut')
    setShiftTypes(data || [])
  }

  async function handleSaveShift() {
    if (!shiftModal || !restaurantId || !shiftModal.nom.trim()) return
    setSavingShift(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-shifts-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        action: 'upsert',
        payload: {
          id: shiftModal.id,
          restaurant_id: restaurantId,
          nom: shiftModal.nom.trim(),
          debut: shiftModal.debut,
          fin: shiftModal.fin,
          couleur: shiftModal.couleur,
        },
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('[shifts-config] save error:', json.error)
      setSavingShift(false)
      return
    }
    await loadShiftTypes()
    setShiftModal(null)
    setConfirmDeleteShift(null)
    setSavingShift(false)
  }

  async function handleDeleteShift() {
    if (!confirmDeleteShift) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-shifts-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'delete', payload: { id: confirmDeleteShift } }),
    })
    if (res.ok) {
      await loadShiftTypes()
      setShiftModal(null)
      setConfirmDeleteShift(null)
    }
  }

  function adjustCouverture(jour: Jour, service: 'midi' | 'soir', delta: number) {
    const key = `${jour}_${service}`
    setCouverture(prev => {
      const current = prev[key] || { nb_personnes: 0, bar_requis: false }
      return { ...prev, [key]: { ...current, nb_personnes: Math.max(0, current.nb_personnes + delta) } }
    })
  }

  function toggleBarRequis(jour: Jour) {
    const key = `${jour}_soir`
    setCouverture(prev => {
      const current = prev[key] || { nb_personnes: 0, bar_requis: false }
      return { ...prev, [key]: { ...current, bar_requis: !current.bar_requis } }
    })
  }

  async function loadCotesReg() {
    if (!restaurantId) return
    const { data } = await supabase.from('cotes').select('*').eq('restaurant_id', restaurantId).order('nom')
    setCotesReg(data || [])
  }

  async function handleSaveCote() {
    if (!coteModal || !restaurantId || !coteModal.nom.trim()) return
    setSavingCote(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-cotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        action: 'upsert',
        payload: {
          id: coteModal.id,
          restaurant_id: restaurantId,
          nom: coteModal.nom.trim(),
          pourcentage: parseFloat(coteModal.pourcentage) || 0,
          actif: coteModal.actif,
        },
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('[cotes] save error:', json.error)
      setSavingCote(false)
      return
    }
    await loadCotesReg()
    setCoteModal(null)
    setConfirmDeleteCote(null)
    setSavingCote(false)
  }

  async function handleArchiveCote() {
    if (!confirmDeleteCote) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-cotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'archive', payload: { id: confirmDeleteCote } }),
    })
    if (res.ok) {
      await loadCotesReg()
      setCoteModal(null)
      setConfirmDeleteCote(null)
    }
  }

  async function loadRoleTypes() {
    const { data } = await supabase.from('role_types').select('*').order('nom')
    setRoleTypes(data || [])
  }

  async function handleSaveRoleType() {
    if (!roleTypeModal || !roleTypeModal.nom.trim() || !roleTypeModal.slug.trim()) return
    setSavingRoleType(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-role-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        action: 'upsert',
        payload: {
          id: roleTypeModal.id,
          restaurant_id: restaurantId || null,
          nom: roleTypeModal.nom.trim(),
          slug: roleTypeModal.slug.trim(),
          coefficient_pourboire: parseFloat(roleTypeModal.coefficient_pourboire) || 1.0,
          couleur: roleTypeModal.couleur,
          icone: roleTypeModal.icone,
        },
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('[role-types] save error:', json.error)
      setSavingRoleType(false)
      return
    }
    await loadRoleTypes()
    setRoleTypeModal(null)
    setSavingRoleType(false)
  }

  async function handleArchiveRoleType() {
    if (!confirmArchiveRoleType) return
    const rt = roleTypes.find((r: any) => r.id === confirmArchiveRoleType)
    if (!rt) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-role-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'archive', payload: { id: rt.id, slug: rt.slug } }),
    })
    if (res.ok) {
      await loadRoleTypes()
      setRoleTypeModal(null)
      setConfirmArchiveRoleType(null)
    }
  }

  async function handleSaveCouverture() {
    if (!restaurantId) return
    setSavingCouverture(true)
    const rows = JOURS_ORDRE.flatMap(jour =>
      (['midi', 'soir'] as const).map(service => ({
        restaurant_id: restaurantId,
        jour,
        service,
        nb_personnes: couverture[`${jour}_${service}`]?.nb_personnes ?? 0,
        bar_requis: service === 'soir' ? (couverture[`${jour}_${service}`]?.bar_requis ?? false) : false,
      }))
    )
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-shifts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action: 'upsert_couverture', payload: { rows } }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error('[couverture] save error:', json.error)
      setSavingCouverture(false)
      return
    }
    const { data } = await supabase.from('couverture_minimale').select('*').eq('restaurant_id', restaurantId)
    const covMap: Record<string, CovEntry> = {}
    for (const c of (data || [])) {
      covMap[`${c.jour}_${c.service}`] = { nb_personnes: c.nb_personnes, bar_requis: c.bar_requis, id: c.id }
    }
    setCouverture(covMap)
    setSavedCouverture(true)
    setTimeout(() => setSavedCouverture(false), 2500)
    setSavingCouverture(false)
  }

  if (loading) return <div className="loading-screen"><div className="loading-dot">CHARGEMENT…</div></div>

  const t = getTheme(selectedTheme)
  const lang = selectedLang
  const font = selectedFont

  const T = {
    reglages:    lang === 'fr' ? 'Réglages'     : 'Settings',
    compte:      lang === 'fr' ? 'COMPTE'        : 'ACCOUNT',
    apparence:   lang === 'fr' ? 'APPARENCE'     : 'APPEARANCE',
    langue:      lang === 'fr' ? 'LANGUE'        : 'LANGUAGE',
    securite:    lang === 'fr' ? 'SÉCURITÉ'      : 'SECURITY',
    theme:       lang === 'fr' ? 'Thème'         : 'Theme',
    police:      lang === 'fr' ? 'Police'        : 'Font',
    nom:         lang === 'fr' ? 'Nom'           : 'Name',
    role:        lang === 'fr' ? 'Rôle'          : 'Role',
    taux:        lang === 'fr' ? 'Taux horaire'  : 'Hourly rate',
    sauvegarder:       lang === 'fr' ? 'Sauvegarder'              : 'Save',
    sauvegarde:        lang === 'fr' ? 'Sauvegardé ✓'            : 'Saved ✓',
    erreurSauvegarde:  lang === 'fr' ? 'Erreur lors de la sauvegarde' : 'Save failed',
    motDePasse:  lang === 'fr' ? 'Changer le mot de passe' : 'Change password',
    annuler:     lang === 'fr' ? 'Annuler'       : 'Cancel',
    enregistrer: lang === 'fr' ? 'Enregistrer'   : 'Save',
    // Gérant — types de shifts
    typesShifts:  lang === 'fr' ? 'TYPES DE SHIFTS'  : 'SHIFT TYPES',
    ajouterType:  lang === 'fr' ? '+ Ajouter'        : '+ Add',
    nomShift:     lang === 'fr' ? 'Nom du shift'      : 'Shift name',
    heureDebut:   lang === 'fr' ? 'Heure de début'    : 'Start time',
    heureFin:     lang === 'fr' ? 'Heure de fin'      : 'End time',
    couleur:      lang === 'fr' ? 'Couleur'           : 'Color',
    supprimer:    lang === 'fr' ? 'Supprimer'         : 'Delete',
    apercu:       lang === 'fr' ? 'Aperçu'            : 'Preview',
    aucunShift:   lang === 'fr' ? 'Aucun type de shift' : 'No shift types',
    confirmerSuppression: lang === 'fr' ? 'Confirmer la suppression ?' : 'Confirm delete?',
    modifierShift:  lang === 'fr' ? 'Modifier le shift'   : 'Edit shift',
    nouveauShift:   lang === 'fr' ? 'Nouveau type de shift' : 'New shift type',
    // Gérant — couverture
    couvertureMin:     lang === 'fr' ? 'COUVERTURE MINIMALE'      : 'MINIMUM COVERAGE',
    midiLabel:         lang === 'fr' ? 'Midi'                     : 'Lunch',
    soirLabel:         lang === 'fr' ? 'Soir'                     : 'Dinner',
    barRequis:         lang === 'fr' ? '🍸 Bar'                   : '🍸 Bar',
    sauvegarderCouv:   lang === 'fr' ? 'Sauvegarder la couverture' : 'Save coverage',
    savedCouv:         lang === 'fr' ? 'Couverture sauvegardée ✓' : 'Coverage saved ✓',
    // Gérant — cotes
    cotesSect:         lang === 'fr' ? 'COTES DE POURBOIRES'      : 'TIP DEDUCTIONS',
    ajouterCote:       lang === 'fr' ? '+ Ajouter'                : '+ Add',
    nouvelleCote:      lang === 'fr' ? 'Nouvelle cote'            : 'New deduction',
    modifierCote:      lang === 'fr' ? 'Modifier la cote'         : 'Edit deduction',
    nomCote:           lang === 'fr' ? 'Nom'                      : 'Name',
    pctCote:           lang === 'fr' ? 'Pourcentage (%)'          : 'Percentage (%)',
    actifCote:         lang === 'fr' ? 'Cote active'              : 'Active deduction',
    archiverCote:      lang === 'fr' ? 'Archiver'                 : 'Archive',
    confirmerArchive:  lang === 'fr' ? 'Archiver cette cote ?' : 'Archive this deduction?',
    aucuneCote:        lang === 'fr' ? 'Aucune cote configurée'   : 'No deductions configured',
    cotePlaceholder:   lang === 'fr' ? 'Ex: Cuisine, Plongeur...' : 'E.g.: Kitchen, Busser...',
    // Admin — types de rôles
    gestionRoles:         lang === 'fr' ? 'TYPES DE RÔLES'             : 'ROLE TYPES',
    adminSeulement:       lang === 'fr' ? 'Admin seulement'            : 'Admin only',
    inactif:              lang === 'fr' ? 'inactif'                    : 'inactive',
    nouveauRole:          lang === 'fr' ? 'Nouveau type de rôle'       : 'New role type',
    modifierRole:         lang === 'fr' ? 'Modifier le type de rôle'   : 'Edit role type',
    nomRole:              lang === 'fr' ? 'Nom du rôle'                : 'Role name',
    slugRole:             lang === 'fr' ? 'Identifiant (slug)'         : 'Identifier (slug)',
    coeffLabel:           lang === 'fr' ? 'Coefficient pourboires'     : 'Tip coefficient',
    iconeLabel:           lang === 'fr' ? 'Icône'                      : 'Icon',
    aucunTypeRole:        lang === 'fr' ? 'Aucun type de rôle'         : 'No role types',
    confirmerArchiveRole: lang === 'fr' ? 'Archiver ce type de rôle ?' : 'Archive this role type?',
  }

  const THEME_SWATCHES: Record<ThemeName, string> = {
    'Lumière': '#3B82F6', 'Ivoire': '#92724A', 'Brume': '#5B7FA6', 'Craie': '#4A4A4A',
    'Or noir': '#C9A84C', 'Minuit': '#58A6FF', 'Bordeaux': '#9B2335',
    'Forêt': '#4A9B5F', 'Ardoise': '#6B8CAE', 'Cuivre': '#B87333',
    'Améthyste': '#8B5CF6', 'Océan': '#0EA5E9', 'Professionnel': '#5B8DEF',
  }
  const THEME_BKGS: Record<ThemeName, string> = {
    'Lumière': '#F8F9FA', 'Ivoire': '#FAF7F2', 'Brume': '#F0F4F8', 'Craie': '#F5F5F0',
    'Or noir': '#080808', 'Minuit': '#0D1117', 'Bordeaux': '#0F0A0A',
    'Forêt': '#0A0F0A', 'Ardoise': '#0F1115', 'Cuivre': '#0F0C08',
    'Améthyste': '#0D0A12', 'Océan': '#080D12', 'Professionnel': '#F7F8FA',
  }

  const btnCounter = {
    width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`,
    background: t.surface2, color: t.texte, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  } as const

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main style={{ padding: '16px', paddingBottom: 100 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 16 }}>{T.reglages}</h1>

        {/* ── TABS ── */}
        <div className="tabs" style={{ marginBottom: 24, overflowX: 'auto' }}>
          <button className={`tab-btn${activeTab === 'compte' ? ' active' : ''}`} onClick={() => setActiveTab('compte')}>
            {lang === 'fr' ? 'Compte' : 'Account'}
          </button>
          <button className={`tab-btn${activeTab === 'apparence' ? ' active' : ''}`} onClick={() => setActiveTab('apparence')}>
            {lang === 'fr' ? 'Apparence' : 'Appearance'}
          </button>
          {isGerant && <>
            <button className={`tab-btn${activeTab === 'shifts' ? ' active' : ''}`} onClick={() => setActiveTab('shifts')}>Shifts</button>
            <button className={`tab-btn${activeTab === 'couverture' ? ' active' : ''}`} onClick={() => setActiveTab('couverture')}>
              {lang === 'fr' ? 'Couverture' : 'Coverage'}
            </button>
            <button className={`tab-btn${activeTab === 'cotes' ? ' active' : ''}`} onClick={() => setActiveTab('cotes')}>
              {lang === 'fr' ? 'Cotes' : 'Deductions'}
            </button>
          </>}
          {isAdmin && (
            <button className={`tab-btn${activeTab === 'roles' ? ' active' : ''}`} onClick={() => setActiveTab('roles')}>
              {lang === 'fr' ? 'Rôles' : 'Roles'}
            </button>
          )}
        </div>

        {/* ── COMPTE ── */}
        {activeTab === 'compte' && <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
            {T.compte}
          </div>
          <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {[
              { label: T.nom,  value: profile?.nom || '—' },
              { label: T.role, value: profile?.roles?.map((r: string) => ROLE_LABELS[r]?.[lang] || r).join(', ') || '—' },
              { label: T.taux, value: profile?.taux_horaire ? `$${profile.taux_horaire.toFixed(2)}/h` : '—' },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: t.texteSecondaire }}>{label}</span>
                <span style={{ fontSize: 13, color: t.texte }}>{value}</span>
              </div>
            ))}
            {(profile?.roles?.length ?? 0) > 0 && (
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {profile.roles.map((r: string) => (
                  <span key={r} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11,
                    background: `${ROLE_COLORS[r] || t.accent}22`,
                    border: `1px solid ${ROLE_COLORS[r] || t.accent}44`,
                    color: ROLE_COLORS[r] || t.accent,
                  }}>
                    {ROLE_LABELS[r]?.[lang] || r}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* ── LANGUE ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
              {T.langue}
            </div>
            <div style={{ display: 'flex', background: t.surface1, borderRadius: 12, padding: 4, border: `1px solid ${t.border}` }}>
              {(['fr', 'en'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setSelectedLang(l)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: selectedLang === l ? t.accent : 'transparent',
                    color: selectedLang === l ? (t.isDark ? '#080808' : '#fff') : t.texteSecondaire,
                    fontSize: 13, letterSpacing: '0.06em', fontFamily: font, fontWeight: selectedLang === l ? 600 : 400,
                  }}
                >
                  {l === 'fr' ? '🇫🇷  Français' : '🇬🇧  English'}
                </button>
              ))}
            </div>
          </div>

          {/* ── SÉCURITÉ ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
              {T.securite}
            </div>
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user?.email) return
                await supabase.auth.resetPasswordForEmail(user.email)
                alert(lang === 'fr' ? 'Email envoyé !' : 'Email sent!')
              }}
              style={{
                width: '100%', background: t.surface1, border: `1px solid ${t.border}`,
                color: t.texte, borderRadius: 12, padding: '13px 16px',
                cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: font,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>{T.motDePasse}</span>
              <span style={{ color: t.texteSecondaire, fontSize: 16 }}>›</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '14px',
              background: saveError ? 'var(--danger)' : saved ? 'var(--success)' : t.accent,
              border: 'none', borderRadius: 12, cursor: saving ? 'wait' : 'pointer',
              color: t.isDark ? '#080808' : '#fff',
              fontSize: 14, letterSpacing: '0.08em', fontFamily: font, fontWeight: 600,
              transition: 'background 0.3s', marginBottom: 36,
            }}
          >
            {saveError ? T.erreurSauvegarde : saved ? T.sauvegarde : saving ? '...' : T.sauvegarder}
          </button>
        </div>}

        {/* ── APPARENCE ── */}
        {activeTab === 'apparence' && <>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
              {T.apparence}
            </div>

            <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 10 }}>{T.theme}</div>

              {/* Thèmes clairs */}
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteFaible, marginBottom: 6 }}>
                {lang === 'fr' ? 'Clairs' : 'Light'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                {LIGHT_THEMES.map(name => {
                  const isSelected = selectedTheme === name
                  return (
                    <button key={name} onClick={() => setSelectedTheme(name)} title={name} style={{
                      background: THEME_BKGS[name],
                      border: `2px solid ${isSelected ? THEME_SWATCHES[name] : '#E0DDD8'}`,
                      borderRadius: 10, height: 48, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: THEME_SWATCHES[name] }} />
                      <span style={{ fontSize: 8, color: '#374151', letterSpacing: '0.04em', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {name}
                      </span>
                      {isSelected && <div style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: THEME_SWATCHES[name] }} />}
                    </button>
                  )
                })}
              </div>

              {/* Thèmes sombres */}
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteFaible, marginBottom: 6 }}>
                {lang === 'fr' ? 'Sombres' : 'Dark'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {DARK_THEMES.map(name => {
                  const isSelected = selectedTheme === name
                  return (
                    <button key={name} onClick={() => setSelectedTheme(name)} title={name} style={{
                      background: THEME_BKGS[name],
                      border: `2px solid ${isSelected ? THEME_SWATCHES[name] : 'transparent'}`,
                      borderRadius: 10, height: 48, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: THEME_SWATCHES[name] }} />
                      <span style={{ fontSize: 8, color: THEME_SWATCHES[name], letterSpacing: '0.04em', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {name}
                      </span>
                      {isSelected && <div style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: THEME_SWATCHES[name] }} />}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: t.accent, textAlign: 'center', letterSpacing: '0.06em' }}>
                {selectedTheme}
              </div>
            </div>

            <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 12 }}>{T.police}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FONTS.map(f => {
                  const isSelected = selectedFont === f.value
                  return (
                    <button
                      key={f.label}
                      onClick={() => setSelectedFont(f.value)}
                      style={{
                        background: isSelected ? `${t.accent}18` : t.surface2,
                        border: `1px solid ${isSelected ? t.borderAccent : t.border}`,
                        borderRadius: 10, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', fontFamily: font,
                      }}
                    >
                      <span style={{ fontSize: 14, color: t.texte, fontFamily: f.value }}>{f.label}</span>
                      <span style={{ fontSize: 12, color: t.texteSecondaire, fontFamily: f.value, fontStyle: 'italic' }}>Aa Bb Cc</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── TAILLE DE POLICE ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
              {lang === 'fr' ? 'TAILLE DU TEXTE' : 'TEXT SIZE'}
            </div>
            <div style={{ display: 'flex', background: t.surface1, borderRadius: 12, padding: 4, border: `1px solid ${t.border}`, gap: 4, marginBottom: 10 }}>
              {([
                { key: 'sm', fr: 'Petit',  en: 'Small',  px: '12px' },
                { key: 'md', fr: 'Normal', en: 'Normal', px: '14px' },
                { key: 'lg', fr: 'Grand',  en: 'Large',  px: '16px' },
                { key: 'xl', fr: 'XL',     en: 'XL',     px: '18px' },
              ] as const).map(sz => (
                <button
                  key={sz.key}
                  onClick={() => {
                    setSelectedFontSize(sz.key)
                    const px = FONT_SIZES[sz.key]
                    document.documentElement.style.setProperty('--font-size-base', px)
                    document.documentElement.style.fontSize = px
                  }}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: selectedFontSize === sz.key ? t.accent : 'transparent',
                    color: selectedFontSize === sz.key ? (t.isDark ? '#080808' : '#fff') : t.texteSecondaire,
                    fontSize: sz.px, fontFamily: font, fontWeight: selectedFontSize === sz.key ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {sz[lang]}
                </button>
              ))}
            </div>
            {/* Live preview */}
            <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: '1rem', color: t.texte, fontFamily: font, lineHeight: 1.5 }}>
                {lang === 'fr' ? 'L\'aperçu du texte change en temps réel.' : 'Text preview updates in real time.'}
              </div>
              <div style={{ fontSize: '0.85rem', color: t.texteSecondaire, fontFamily: font, marginTop: 4 }}>
                {lang === 'fr' ? 'Taille actuelle : ' : 'Current size: '}{FONT_SIZES[selectedFontSize]}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '14px',
              background: saveError ? 'var(--danger)' : saved ? 'var(--success)' : t.accent,
              border: 'none', borderRadius: 12, cursor: saving ? 'wait' : 'pointer',
              color: t.isDark ? '#080808' : '#fff',
              fontSize: 14, letterSpacing: '0.08em', fontFamily: font, fontWeight: 600,
              transition: 'background 0.3s', marginBottom: 36,
            }}
          >
            {saveError ? T.erreurSauvegarde : saved ? T.sauvegarde : saving ? '...' : T.sauvegarder}
          </button>
        </>}

        {/* ── SHIFTS TAB ── */}
        {isGerant && activeTab === 'shifts' && (
          <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire }}>
                  {T.typesShifts}
                </div>
                <button
                  onClick={() => setShiftModal({ nom: '', debut: '11:00', fin: '16:00', couleur: SHIFT_COLORS[0] })}
                  style={{
                    background: t.accent, border: 'none', borderRadius: 8, padding: '4px 12px',
                    cursor: 'pointer', color: t.isDark ? '#080808' : '#fff', fontSize: 11, fontFamily: font,
                  }}
                >
                  {T.ajouterType}
                </button>
              </div>

              <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
                {shiftTypes.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: t.texteFaible, fontSize: 12 }}>
                    {T.aucunShift}
                  </div>
                ) : (
                  shiftTypes.map((st, i) => (
                    <button
                      key={st.id}
                      onClick={() => setShiftModal({ id: st.id, nom: st.nom, debut: st.debut, fin: st.fin, couleur: st.couleur })}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font,
                        padding: '12px 16px',
                        borderBottom: i < shiftTypes.length - 1 ? `1px solid ${t.border}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: t.texte }}>{st.nom}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: t.texteSecondaire, fontFamily: "'Courier New', monospace" }}>
                          {st.debut}–{st.fin}
                        </span>
                        <span style={{ color: t.texteFaible, fontSize: 16 }}>›</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
          </div>
        )}

        {/* ── COUVERTURE TAB ── */}
        {isGerant && activeTab === 'couverture' && (
          <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
                {T.couvertureMin}
              </div>

              <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr', padding: '8px 14px', borderBottom: `1px solid ${t.border}` }}>
                  <div />
                  <div style={{ fontSize: 10, color: t.texteSecondaire, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {T.midiLabel}
                  </div>
                  <div style={{ fontSize: 10, color: t.texteSecondaire, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {T.soirLabel}
                  </div>
                </div>

                {JOURS_ORDRE.map((jour, idx) => {
                  const midiEntry = couverture[`${jour}_midi`] || { nb_personnes: 0, bar_requis: false }
                  const soirEntry = couverture[`${jour}_soir`] || { nb_personnes: 0, bar_requis: false }
                  return (
                    <div key={jour} style={{
                      display: 'grid', gridTemplateColumns: '52px 1fr 1fr',
                      padding: '10px 14px', alignItems: 'center',
                      borderBottom: idx < JOURS_ORDRE.length - 1 ? `1px solid ${t.border}` : 'none',
                      gap: 4,
                    }}>
                      <div style={{ fontSize: 12, color: t.texteSecondaire }}>
                        {JOUR_LABELS[jour][lang]}
                      </div>

                      {/* Midi counter */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button style={btnCounter} onClick={() => adjustCouverture(jour, 'midi', -1)}>−</button>
                        <span style={{ fontSize: 15, color: t.texte, minWidth: 18, textAlign: 'center', fontFamily: "'Courier New', monospace" }}>
                          {midiEntry.nb_personnes}
                        </span>
                        <button style={btnCounter} onClick={() => adjustCouverture(jour, 'midi', 1)}>+</button>
                      </div>

                      {/* Soir counter + bar requis */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button style={btnCounter} onClick={() => adjustCouverture(jour, 'soir', -1)}>−</button>
                          <span style={{ fontSize: 15, color: t.texte, minWidth: 18, textAlign: 'center', fontFamily: "'Courier New', monospace" }}>
                            {soirEntry.nb_personnes}
                          </span>
                          <button style={btnCounter} onClick={() => adjustCouverture(jour, 'soir', 1)}>+</button>
                        </div>
                        <button
                          onClick={() => toggleBarRequis(jour)}
                          style={{
                            padding: '2px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 10,
                            border: `1px solid ${soirEntry.bar_requis ? '#7EB8F7' : t.border}`,
                            background: soirEntry.bar_requis ? 'rgba(126,184,247,0.15)' : 'transparent',
                            color: soirEntry.bar_requis ? '#7EB8F7' : t.texteFaible,
                            fontFamily: font,
                          }}
                        >
                          {T.barRequis}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleSaveCouverture}
                disabled={savingCouverture}
                style={{
                  width: '100%', marginTop: 10, padding: '12px',
                  background: savedCouverture ? 'var(--success)' : t.surface1,
                  border: `1px solid ${savedCouverture ? 'var(--success)' : t.border}`,
                  borderRadius: 12, cursor: savingCouverture ? 'wait' : 'pointer',
                  color: savedCouverture ? '#fff' : t.texte,
                  fontSize: 13, letterSpacing: '0.06em', fontFamily: font, fontWeight: 500,
                  transition: 'all 0.3s',
                }}
              >
                {savedCouverture ? T.savedCouv : savingCouverture ? '...' : T.sauvegarderCouv}
              </button>
          </div>
        )}

        {/* ── COTES TAB ── */}
        {isGerant && activeTab === 'cotes' && (
          <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire }}>
                  {T.cotesSect}
                </div>
                <button
                  onClick={() => setCoteModal({ nom: '', pourcentage: '', actif: true })}
                  style={{
                    background: t.accent, border: 'none', borderRadius: 8, padding: '4px 12px',
                    cursor: 'pointer', color: t.isDark ? '#080808' : '#fff', fontSize: 11, fontFamily: font,
                  }}
                >
                  {T.ajouterCote}
                </button>
              </div>

              <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
                {cotesReg.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: t.texteFaible, fontSize: 12 }}>
                    {T.aucuneCote}
                  </div>
                ) : (
                  cotesReg.map((c: any, i: number) => (
                    <button
                      key={c.id}
                      onClick={() => setCoteModal({ id: c.id, nom: c.nom, pourcentage: String(c.pourcentage), actif: c.actif })}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font,
                        padding: '12px 16px',
                        borderBottom: i < cotesReg.length - 1 ? `1px solid ${t.border}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: c.actif ? t.accent : t.texteFaible,
                        }} />
                        <span style={{ fontSize: 13, color: c.actif ? t.texte : t.texteSecondaire }}>{c.nom}</span>
                        {!c.actif && (
                          <span style={{ fontSize: 9, color: t.texteFaible, border: `1px solid ${t.border}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em' }}>
                            {lang === 'fr' ? 'ARCHIVÉE' : 'ARCHIVED'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: t.accent, fontFamily: "'Courier New', monospace" }}>
                          {c.pourcentage}%
                        </span>
                        <span style={{ color: t.texteFaible, fontSize: 16 }}>›</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
          </div>
        )}

        {/* ── ROLES TAB ── */}
        {isAdmin && activeTab === 'roles' && (
          <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire }}>
                      {T.gestionRoles}
                    </div>
                    <span style={{
                      fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(224,112,112,0.12)', border: '1px solid rgba(224,112,112,0.3)',
                      color: '#E07070',
                    }}>
                      {T.adminSeulement}
                    </span>
                  </div>
                  <button
                    onClick={() => setRoleTypeModal({ nom: '', slug: '', coefficient_pourboire: '1.0', couleur: '#7EB8F7', icone: '👤', actif: true })}
                    style={{
                      background: t.accent, border: 'none', borderRadius: 8, padding: '4px 12px',
                      cursor: 'pointer', color: t.isDark ? '#080808' : '#fff', fontSize: 11, fontFamily: font,
                    }}
                  >
                    {T.ajouterType}
                  </button>
                </div>

                <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  {roleTypes.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: t.texteFaible, fontSize: 12 }}>
                      {T.aucunTypeRole}
                    </div>
                  ) : (
                    roleTypes.map((rt: any, i: number) => (
                      <button
                        key={rt.id}
                        onClick={() => setRoleTypeModal({
                          id: rt.id, nom: rt.nom, slug: rt.slug,
                          coefficient_pourboire: String(rt.coefficient_pourboire),
                          couleur: rt.couleur, icone: rt.icone, actif: rt.actif,
                        })}
                        style={{
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font,
                          padding: '12px 16px',
                          borderBottom: i < roleTypes.length - 1 ? `1px solid ${t.border}` : 'none',
                          display: 'flex', alignItems: 'center', gap: 12,
                          opacity: rt.actif ? 1 : 0.5,
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{rt.icone}</span>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, color: t.texte }}>{rt.nom}</span>
                            {!rt.actif && (
                              <span style={{ fontSize: 9, color: t.texteFaible, border: `1px solid ${t.border}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                {T.inactif}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: t.texteSecondaire, marginTop: 2 }}>
                            {lang === 'fr' ? 'Coeff.' : 'Coeff.'} {rt.coefficient_pourboire}
                            {' · '}
                            <span style={{ color: t.texteFaible, fontFamily: "'Courier New', monospace" }}>{rt.slug}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: rt.couleur, flexShrink: 0 }} />
                          <span style={{ color: t.texteFaible, fontSize: 16 }}>›</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
          </div>
        )}
      </main>

      {/* ── SHIFT TYPE MODAL ── */}
      {shiftModal && (
        <div
          onClick={() => { setShiftModal(null); setConfirmDeleteShift(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: t.surface1, borderRadius: '20px 20px 0 0',
              padding: '20px 18px 32px', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 20px' }} />

            <h2 style={{ fontSize: 18, fontWeight: 300, margin: '0 0 20px', color: t.texte }}>
              {shiftModal.id ? T.modifierShift : T.nouveauShift}
            </h2>

            {/* Nom */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.nomShift} *</div>
              <input
                value={shiftModal.nom}
                onChange={e => setShiftModal(m => m ? { ...m, nom: e.target.value } : m)}
                placeholder={lang === 'fr' ? 'Ex: Midi, Soir, Ouverture...' : 'E.g.: Lunch, Evening, Opening...'}
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Heures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.heureDebut}</div>
                <input
                  type="time"
                  value={shiftModal.debut}
                  onChange={e => setShiftModal(m => m ? { ...m, debut: e.target.value } : m)}
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.heureFin}</div>
                <input
                  type="time"
                  value={shiftModal.fin}
                  onChange={e => setShiftModal(m => m ? { ...m, fin: e.target.value } : m)}
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Couleur */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 10, letterSpacing: '0.08em' }}>{T.couleur}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {SHIFT_COLORS.map(col => (
                  <button
                    key={col}
                    onClick={() => setShiftModal(m => m ? { ...m, couleur: col } : m)}
                    style={{
                      width: 34, height: 34, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                      outline: shiftModal.couleur === col ? `3px solid ${col}` : '2px solid transparent',
                      outlineOffset: 2, transition: 'outline 0.15s',
                    }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: t.surface2, borderRadius: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: shiftModal.couleur }} />
                <span style={{ fontSize: 13, color: shiftModal.couleur, fontFamily: font }}>
                  {shiftModal.nom || T.apercu}
                </span>
                <span style={{ fontSize: 11, color: t.texteFaible, fontFamily: "'Courier New', monospace", marginLeft: 'auto' }}>
                  {shiftModal.debut || '--:--'}–{shiftModal.fin || '--:--'}
                </span>
              </div>
            </div>

            {/* Confirm delete */}
            {confirmDeleteShift && (
              <div style={{ background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#E07070', marginBottom: 10 }}>{T.confirmerSuppression}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDeleteShift(null)} style={{ flex: 1, padding: '8px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texteSecondaire, cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.annuler}
                  </button>
                  <button onClick={handleDeleteShift} style={{ flex: 1, padding: '8px', background: 'rgba(224,112,112,0.2)', border: '1px solid rgba(224,112,112,0.4)', borderRadius: 8, color: '#E07070', cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.supprimer}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {shiftModal.id && !confirmDeleteShift && (
                <button
                  onClick={() => setConfirmDeleteShift(shiftModal.id!)}
                  style={{ padding: '12px 14px', background: 'transparent', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 10, color: '#E07070', cursor: 'pointer', fontSize: 12, fontFamily: font, flexShrink: 0 }}
                >
                  {T.supprimer}
                </button>
              )}
              <button
                onClick={() => { setShiftModal(null); setConfirmDeleteShift(null) }}
                style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}
              >
                {T.annuler}
              </button>
              <button
                onClick={handleSaveShift}
                disabled={savingShift}
                style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: savingShift ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600 }}
              >
                {savingShift ? '...' : T.enregistrer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COTE MODAL ── */}
      {coteModal && (
        <div
          onClick={() => { setCoteModal(null); setConfirmDeleteCote(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: t.surface1, borderRadius: '20px 20px 0 0',
              padding: '20px 18px 32px', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 20px' }} />

            <h2 style={{ fontSize: 18, fontWeight: 300, margin: '0 0 20px', color: t.texte }}>
              {coteModal.id ? T.modifierCote : T.nouvelleCote}
            </h2>

            {/* Nom */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.nomCote} *</div>
              <input
                value={coteModal.nom}
                onChange={e => setCoteModal(m => m ? { ...m, nom: e.target.value } : m)}
                placeholder={T.cotePlaceholder}
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Pourcentage */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.pctCote} *</div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={coteModal.pourcentage}
                  onChange={e => setCoteModal(m => m ? { ...m, pourcentage: e.target.value } : m)}
                  placeholder="5"
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 32px 10px 12px', fontSize: 16, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: t.texteSecondaire, fontSize: 14 }}>%</span>
              </div>
            </div>

            {/* Actif toggle */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 13, color: t.texte }}>{T.actifCote}</span>
              <button
                onClick={() => setCoteModal(m => m ? { ...m, actif: !m.actif } : m)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: coteModal.actif ? t.accent : t.surface1,
                  border: `1px solid ${coteModal.actif ? t.accent : t.border}`,
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: coteModal.actif ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: coteModal.actif ? (t.isDark ? '#080808' : '#fff') : t.texteSecondaire,
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Confirm archive */}
            {confirmDeleteCote && (
              <div style={{ background: 'rgba(224,160,80,0.1)', border: '1px solid rgba(224,160,80,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#E0A850', marginBottom: 10 }}>{T.confirmerArchive}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDeleteCote(null)} style={{ flex: 1, padding: '8px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texteSecondaire, cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.annuler}
                  </button>
                  <button onClick={handleArchiveCote} style={{ flex: 1, padding: '8px', background: 'rgba(224,160,80,0.15)', border: '1px solid rgba(224,160,80,0.4)', borderRadius: 8, color: '#E0A850', cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.archiverCote}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {coteModal.id && coteModal.actif && !confirmDeleteCote && (
                <button
                  onClick={() => setConfirmDeleteCote(coteModal.id!)}
                  style={{ padding: '12px 14px', background: 'transparent', border: '1px solid rgba(224,160,80,0.3)', borderRadius: 10, color: '#E0A850', cursor: 'pointer', fontSize: 12, fontFamily: font, flexShrink: 0 }}
                >
                  {T.archiverCote}
                </button>
              )}
              <button
                onClick={() => { setCoteModal(null); setConfirmDeleteCote(null) }}
                style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}
              >
                {T.annuler}
              </button>
              <button
                onClick={handleSaveCote}
                disabled={savingCote}
                style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: savingCote ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600 }}
              >
                {savingCote ? '...' : T.enregistrer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROLE TYPE MODAL ── */}
      {roleTypeModal && (
        <div
          onClick={() => { setRoleTypeModal(null); setConfirmArchiveRoleType(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: t.surface1, borderRadius: '20px 20px 0 0',
              padding: '20px 18px 32px', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 20px' }} />

            <h2 style={{ fontSize: 18, fontWeight: 300, margin: '0 0 20px', color: t.texte }}>
              {roleTypeModal.id ? T.modifierRole : T.nouveauRole}
            </h2>

            {/* Icône + Couleur */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14, marginBottom: 14, alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.iconeLabel}</div>
                <input
                  value={roleTypeModal.icone}
                  onChange={e => setRoleTypeModal(m => m ? { ...m, icone: e.target.value } : m)}
                  placeholder="👤"
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 8px', fontSize: 22, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 8, letterSpacing: '0.08em' }}>{T.couleur}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLE_TYPE_COLORS.map(col => (
                    <button
                      key={col}
                      onClick={() => setRoleTypeModal(m => m ? { ...m, couleur: col } : m)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                        outline: roleTypeModal.couleur === col ? `3px solid ${col}` : '2px solid transparent',
                        outlineOffset: 2, transition: 'outline 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Nom */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.nomRole} *</div>
              <input
                value={roleTypeModal.nom}
                onChange={e => setRoleTypeModal(m => m ? { ...m, nom: e.target.value } : m)}
                placeholder={lang === 'fr' ? 'Ex: Serveur, Barman...' : 'E.g.: Server, Bartender...'}
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Slug */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.slugRole} *</div>
              <input
                value={roleTypeModal.slug}
                onChange={e => setRoleTypeModal(m => m ? { ...m, slug: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') } : m)}
                placeholder="serveur"
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 13, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Coefficient */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em' }}>{T.coeffLabel}</div>
              <input
                type="number" min="0" max="2" step="0.1"
                value={roleTypeModal.coefficient_pourboire}
                onChange={e => setRoleTypeModal(m => m ? { ...m, coefficient_pourboire: e.target.value } : m)}
                placeholder="1.0"
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px 12px', fontSize: 16, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Confirm archive */}
            {confirmArchiveRoleType && (
              <div style={{ background: 'rgba(224,160,80,0.1)', border: '1px solid rgba(224,160,80,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#E0A850', marginBottom: 10 }}>{T.confirmerArchiveRole}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmArchiveRoleType(null)} style={{ flex: 1, padding: '8px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texteSecondaire, cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.annuler}
                  </button>
                  <button onClick={handleArchiveRoleType} style={{ flex: 1, padding: '8px', background: 'rgba(224,160,80,0.15)', border: '1px solid rgba(224,160,80,0.4)', borderRadius: 8, color: '#E0A850', cursor: 'pointer', fontSize: 12, fontFamily: font }}>
                    {T.archiverCote}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {roleTypeModal.id && roleTypeModal.actif && !confirmArchiveRoleType
                && roleTypeModal.slug !== 'admin' && roleTypeModal.slug !== 'gerant' && (
                <button
                  onClick={() => setConfirmArchiveRoleType(roleTypeModal.id!)}
                  style={{ padding: '12px 14px', background: 'transparent', border: '1px solid rgba(224,160,80,0.3)', borderRadius: 10, color: '#E0A850', cursor: 'pointer', fontSize: 12, fontFamily: font, flexShrink: 0 }}
                >
                  {T.archiverCote}
                </button>
              )}
              <button
                onClick={() => { setRoleTypeModal(null); setConfirmArchiveRoleType(null) }}
                style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}
              >
                {T.annuler}
              </button>
              <button
                onClick={handleSaveRoleType}
                disabled={savingRoleType || !roleTypeModal.nom.trim() || !roleTypeModal.slug.trim()}
                style={{
                  flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10,
                  color: t.isDark ? '#080808' : '#fff',
                  cursor: savingRoleType || !roleTypeModal.nom.trim() || !roleTypeModal.slug.trim() ? 'not-allowed' : 'pointer',
                  opacity: !roleTypeModal.nom.trim() || !roleTypeModal.slug.trim() ? 0.4 : 1,
                  fontSize: 13, fontFamily: font, fontWeight: 600,
                }}
              >
                {savingRoleType ? '...' : T.enregistrer}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
