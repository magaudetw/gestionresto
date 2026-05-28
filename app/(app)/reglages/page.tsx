'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Navigation from '@/components/Navigation'
import { getTheme, THEME_NAMES, FONTS } from '@/lib/themes'
import type { ThemeName } from '@/lib/themes'
import type { ShiftType, Jour } from '@/types'

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
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [selectedTheme, setSelectedTheme] = useState<ThemeName>('Or noir')
  const [selectedLang, setSelectedLang] = useState<'fr' | 'en'>('fr')
  const [selectedFont, setSelectedFont] = useState<string>(FONTS[0].value)

  // Gérant features
  const [isGerant, setIsGerant] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

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

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      if (p?.theme)       setSelectedTheme(p.theme as ThemeName)
      if (p?.lang)        setSelectedLang(p.lang as 'fr' | 'en')
      if (p?.font_family) setSelectedFont(p.font_family)

      const gerant = p?.roles?.includes('gerant') || p?.roles?.includes('admin')
      setIsGerant(gerant)
      const rid = p?.restaurant_ids?.[0] || null
      setRestaurantId(rid)

      if (gerant && rid) {
        const { data: shifts } = await supabase
          .from('shift_types').select('*').eq('restaurant_id', rid).order('debut')
        setShiftTypes(shifts || [])

        const { data: cov } = await supabase
          .from('couverture_minimale').select('*').eq('restaurant_id', rid)
        const covMap: Record<string, CovEntry> = {}
        for (const c of (cov || [])) {
          covMap[`${c.jour}_${c.service}`] = { nb_personnes: c.nb_personnes, bar_requis: c.bar_requis, id: c.id }
        }
        setCouverture(covMap)

        const { data: cotesD } = await supabase
          .from('cotes').select('*').eq('restaurant_id', rid).order('nom')
        setCotesReg(cotesD || [])
      }

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const fontDef = FONTS.find(f => f.value === selectedFont)
    if (fontDef) loadGoogleFont(fontDef)
  }, [selectedFont])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      theme: selectedTheme,
      lang: selectedLang,
      font_family: selectedFont,
    }).eq('id', user.id)

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
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
    const payload = {
      nom: shiftModal.nom.trim(),
      debut: shiftModal.debut,
      fin: shiftModal.fin,
      couleur: shiftModal.couleur,
      restaurant_id: restaurantId,
    }
    if (shiftModal.id) {
      await supabase.from('shift_types').update(payload).eq('id', shiftModal.id)
    } else {
      await supabase.from('shift_types').insert(payload)
    }
    await loadShiftTypes()
    setShiftModal(null)
    setConfirmDeleteShift(null)
    setSavingShift(false)
  }

  async function handleDeleteShift() {
    if (!confirmDeleteShift) return
    await supabase.from('shift_types').delete().eq('id', confirmDeleteShift)
    await loadShiftTypes()
    setShiftModal(null)
    setConfirmDeleteShift(null)
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
    const pct = parseFloat(coteModal.pourcentage) || 0
    const payload = {
      restaurant_id: restaurantId,
      nom: coteModal.nom.trim(),
      pourcentage: pct,
      actif: coteModal.actif,
    }
    if (coteModal.id) {
      await supabase.from('cotes').update(payload).eq('id', coteModal.id)
    } else {
      await supabase.from('cotes').insert(payload)
    }
    await loadCotesReg()
    setCoteModal(null)
    setConfirmDeleteCote(null)
    setSavingCote(false)
  }

  async function handleArchiveCote() {
    if (!confirmDeleteCote) return
    await supabase.from('cotes').update({ actif: false }).eq('id', confirmDeleteCote)
    await loadCotesReg()
    setCoteModal(null)
    setConfirmDeleteCote(null)
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
    await supabase.from('couverture_minimale').upsert(rows, { onConflict: 'restaurant_id,jour,service' })
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(selectedTheme)
  const lang = selectedLang
  const role = profile?.roles?.[0] || 'employe'
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
    sauvegarder: lang === 'fr' ? 'Sauvegarder'  : 'Save',
    sauvegarde:  lang === 'fr' ? 'Sauvegardé ✓' : 'Saved ✓',
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
  }

  const THEME_SWATCHES: Record<ThemeName, string> = {
    'Or noir': '#C9A84C', 'Minuit': '#7EB8F7', 'Bordeaux': '#C04B6E',
    'Forêt': '#72BA80', 'Ardoise': '#9BAFC0', 'Cuivre': '#C87941',
    'Améthyste': '#A875C8', 'Océan': '#3BBBB0', 'Ivoire': '#8B6914',
    'Brume': '#5E7A8C', 'Craie': '#6B5C4A',
  }
  const THEME_BKGS: Record<ThemeName, string> = {
    'Or noir': '#080808', 'Minuit': '#050A14', 'Bordeaux': '#0A0506',
    'Forêt': '#050A06', 'Ardoise': '#080A0C', 'Cuivre': '#0A0806',
    'Améthyste': '#08060A', 'Océan': '#040C0C', 'Ivoire': '#F8F4EE',
    'Brume': '#EEF2F5', 'Craie': '#F5F2EE',
  }

  const btnCounter = {
    width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`,
    background: t.surface2, color: t.texte, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  } as const

  return (
    <div style={{ background: t.fond, minHeight: '100vh', color: t.texte, fontFamily: font, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <Header nom={profile?.nom || ''} restaurant="Le Carré" lang={lang} />

      <main style={{ flex: 1, padding: '16px', paddingBottom: 100 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 24 }}>{T.reglages}</h1>

        {/* ── COMPTE ── */}
        <div style={{ marginBottom: 28 }}>
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
        </div>

        {/* ── APPARENCE ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 12 }}>
            {T.apparence}
          </div>

          <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 12 }}>{T.theme}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {THEME_NAMES.map(name => {
                const isSelected = selectedTheme === name
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedTheme(name)}
                    title={name}
                    style={{
                      background: THEME_BKGS[name],
                      border: `2px solid ${isSelected ? THEME_SWATCHES[name] : 'transparent'}`,
                      borderRadius: 10, height: 44, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: THEME_SWATCHES[name] }} />
                    <span style={{ fontSize: 8, color: THEME_SWATCHES[name], letterSpacing: '0.04em', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {name}
                    </span>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: THEME_SWATCHES[name] }} />
                    )}
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

        {/* Save personal settings */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '14px',
            background: saved ? '#72BA80' : t.accent,
            border: 'none', borderRadius: 12, cursor: saving ? 'wait' : 'pointer',
            color: t.isDark ? '#080808' : '#fff',
            fontSize: 14, letterSpacing: '0.08em', fontFamily: font, fontWeight: 600,
            transition: 'background 0.3s', marginBottom: 36,
          }}
        >
          {saved ? T.sauvegarde : saving ? '...' : T.sauvegarder}
        </button>

        {/* ── GÉRANT SECTIONS ── */}
        {isGerant && (
          <>
            {/* ── TYPES DE SHIFTS ── */}
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

            {/* ── COUVERTURE MINIMALE ── */}
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
                  background: savedCouverture ? '#72BA80' : t.surface1,
                  border: `1px solid ${savedCouverture ? '#72BA80' : t.border}`,
                  borderRadius: 12, cursor: savingCouverture ? 'wait' : 'pointer',
                  color: savedCouverture ? '#fff' : t.texte,
                  fontSize: 13, letterSpacing: '0.06em', fontFamily: font, fontWeight: 500,
                  transition: 'all 0.3s',
                }}
              >
                {savedCouverture ? T.savedCouv : savingCouverture ? '...' : T.sauvegarderCouv}
              </button>
            </div>
            {/* ── COTES ── */}
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
          </>
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

      <Navigation role={role} lang={lang} />
    </div>
  )
}
