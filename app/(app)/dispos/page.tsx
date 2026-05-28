'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Navigation from '@/components/Navigation'
import { getTheme } from '@/lib/themes'
import type { Jour, DisposBase, CouvertureMinimale } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const JOURS: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

const JOUR_LONG: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lundi',    en: 'Monday'    },
  mar: { fr: 'Mardi',    en: 'Tuesday'   },
  mer: { fr: 'Mercredi', en: 'Wednesday' },
  jeu: { fr: 'Jeudi',    en: 'Thursday'  },
  ven: { fr: 'Vendredi', en: 'Friday'    },
  sam: { fr: 'Samedi',   en: 'Saturday'  },
}

const JOUR_SHORT: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lun', en: 'Mon' },
  mar: { fr: 'Mar', en: 'Tue' },
  mer: { fr: 'Mer', en: 'Wed' },
  jeu: { fr: 'Jeu', en: 'Thu' },
  ven: { fr: 'Ven', en: 'Fri' },
  sam: { fr: 'Sam', en: 'Sat' },
}

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Types ────────────────────────────────────────────────────────────────────

type Svcs = ('midi' | 'soir')[] | null
type DisposMap = Record<Jour, Svcs>

const EMPTY_DISPOS: DisposMap = { lun: null, mar: null, mer: null, jeu: null, ven: null, sam: null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function getMondayByOffset(offset: number): Date {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  monday.setHours(0,0,0,0)
  return monday
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function defaultFromBase(base: DisposBase | null | undefined): DisposMap {
  if (!base) return { ...EMPTY_DISPOS }
  const { jours, services } = base
  let svcs: ('midi'|'soir')[]
  if (services.includes('les_deux') || (services.includes('midi') && services.includes('soir'))) {
    svcs = ['midi', 'soir']
  } else if (services.includes('soir')) {
    svcs = ['soir']
  } else if (services.includes('midi')) {
    svcs = ['midi']
  } else {
    svcs = ['midi', 'soir']
  }
  const result = { ...EMPTY_DISPOS }
  for (const j of jours) result[j] = [...svcs]
  return result
}

function dispoColor(svcs: Svcs): string {
  if (!svcs || svcs.length === 0) return '#E07070'
  if (svcs.includes('midi') && svcs.includes('soir')) return '#82E0AA'
  if (svcs.includes('midi')) return '#F4A261'
  return '#7EB8F7'
}

function dispoLabel(svcs: Svcs, lang: 'fr'|'en'): string {
  if (!svcs || svcs.length === 0) return lang === 'fr' ? 'Indispo' : 'Unavail.'
  if (svcs.includes('midi') && svcs.includes('soir')) return lang === 'fr' ? 'Les deux' : 'Both'
  if (svcs.includes('midi')) return 'Midi'
  return 'Soir'
}

function dispoShort(svcs: Svcs): string {
  if (!svcs || svcs.length === 0) return '✗'
  if (svcs.includes('midi') && svcs.includes('soir')) return 'MS'
  if (svcs.includes('midi')) return 'M'
  return 'S'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DisposPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(1)

  // Employee state
  const [dispoId, setDispoId]   = useState<string | null>(null)
  const [dispos, setDispos]     = useState<DisposMap>({ ...EMPTY_DISPOS })
  const [statut, setStatut]     = useState<'brouillon' | 'soumis'>('brouillon')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Manager state
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [allDispos, setAllDispos]       = useState<any[]>([])
  const [couverture, setCouverture]     = useState<CouvertureMinimale[]>([])
  const [overrideModal, setOverrideModal] = useState<{
    empId: string; empNom: string; jour: Jour
  } | null>(null)
  const [overrideSvcs, setOverrideSvcs]   = useState<Svcs>(null)
  const [savingOverride, setSavingOverride] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderSent, setReminderSent]       = useState(false)

  const router = useRouter()

  const monday    = getMondayByOffset(weekOffset)
  const mondayISO = isoDate(monday)
  const days      = getWeekDays(monday)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setLoading(false)
    }
    init()
  }, [router])

  // ── Load data when week changes ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!profile) return
    const isManager = profile.roles?.includes('gerant') || profile.roles?.includes('admin')
    const restaurantId = profile.restaurant_ids?.[0]

    if (isManager) {
      const [empsRes, disposRes, covRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, nom, roles, dispos_base')
          .contains('restaurant_ids', restaurantId ? [restaurantId] : [])
          .eq('actif', true).order('nom'),
        supabase.from('dispos_hebdo')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('semaine_du', mondayISO),
        supabase.from('couverture_minimale')
          .select('*').eq('restaurant_id', restaurantId),
      ])
      setAllEmployees(empsRes.data || [])
      setAllDispos(disposRes.data || [])
      setCouverture(covRes.data || [])
    } else {
      const { data } = await supabase.from('dispos_hebdo')
        .select('*')
        .eq('user_id', profile.id)
        .eq('restaurant_id', restaurantId)
        .eq('semaine_du', mondayISO)
        .maybeSingle()

      if (data) {
        setDispoId(data.id)
        setDispos(data.dispos || { ...EMPTY_DISPOS })
        setStatut(data.statut)
      } else {
        setDispoId(null)
        setDispos(defaultFromBase(profile.dispos_base))
        setStatut('brouillon')
      }
    }
  }, [profile, mondayISO])

  useEffect(() => { loadData() }, [loadData])

  // ── Employee: toggle service choice ───────────────────────────────────────
  function setChoice(jour: Jour, choice: 'midi' | 'soir' | 'les_deux' | 'indispo') {
    if (statut === 'soumis') return
    setDispos(prev => ({
      ...prev,
      [jour]: choice === 'indispo'  ? null
            : choice === 'les_deux' ? ['midi', 'soir']
            : choice === 'midi'     ? ['midi']
            :                         ['soir'],
    }))
  }

  // ── Employee: save ─────────────────────────────────────────────────────────
  async function handleSave(submit: boolean) {
    if (!profile) return
    setSaving(true)
    const restaurantId = profile.restaurant_ids?.[0]
    const newStatut = submit ? 'soumis' : 'brouillon'
    const payload = { user_id: profile.id, restaurant_id: restaurantId, semaine_du: mondayISO, dispos, statut: newStatut }

    if (dispoId) {
      await supabase.from('dispos_hebdo').update(payload).eq('id', dispoId)
    } else {
      const { data } = await supabase.from('dispos_hebdo').insert(payload).select().single()
      if (data) setDispoId(data.id)
    }
    setStatut(newStatut)

    if (submit) {
      const lang = profile.lang || 'fr'
      const weekLabel = `${monday.getDate()}/${monday.getMonth() + 1}`
      const { data: managers } = await supabase.from('profiles')
        .select('id').contains('restaurant_ids', restaurantId ? [restaurantId] : [])
        .or('roles.cs.{gerant},roles.cs.{admin}')
      const notifs = (managers || []).map((m: any) => ({
        user_id: m.id, type: 'system', lu: false,
        message: lang === 'fr'
          ? `${profile.nom} a soumis ses disponibilités (sem. du ${weekLabel}).`
          : `${profile.nom} submitted availability for week of ${weekLabel}.`,
      }))
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handleReopen() {
    if (!dispoId) return
    await supabase.from('dispos_hebdo').update({ statut: 'brouillon' }).eq('id', dispoId)
    setStatut('brouillon')
  }

  // ── Manager: override ─────────────────────────────────────────────────────
  async function handleOverrideSave() {
    if (!overrideModal || !profile) return
    setSavingOverride(true)
    const restaurantId = profile.restaurant_ids?.[0]
    const existing = allDispos.find(d => d.user_id === overrideModal.empId)
    const updatedDispos = {
      ...(existing?.dispos || { ...EMPTY_DISPOS }),
      [overrideModal.jour]: overrideSvcs,
    }

    if (existing) {
      await supabase.from('dispos_hebdo')
        .update({ dispos: updatedDispos, statut: 'soumis' }).eq('id', existing.id)
    } else {
      await supabase.from('dispos_hebdo').insert({
        user_id: overrideModal.empId,
        restaurant_id: restaurantId,
        semaine_du: mondayISO,
        dispos: updatedDispos,
        statut: 'soumis',
      })
    }

    const lang = profile.lang || 'fr'
    const weekLabel = `${monday.getDate()}/${monday.getMonth() + 1}`
    await supabase.from('notifications').insert({
      user_id: overrideModal.empId, type: 'system', lu: false,
      message: lang === 'fr'
        ? `${profile.nom} a modifié vos disponibilités pour la sem. du ${weekLabel}.`
        : `${profile.nom} modified your availability for week of ${weekLabel}.`,
    })

    await loadData()
    setOverrideModal(null)
    setSavingOverride(false)
  }

  // ── Manager: send reminder to non-submitted employees ─────────────────────
  async function handleSendReminder() {
    if (!profile) return
    setSendingReminder(true)
    const restaurantId = profile.restaurant_ids?.[0]
    const submittedIds = new Set(allDispos.filter(d => d.statut === 'soumis').map((d: any) => d.user_id))
    const pending = allEmployees.filter(e =>
      !submittedIds.has(e.id) &&
      !e.roles?.includes('gerant') &&
      !e.roles?.includes('admin')
    )
    const lang = profile.lang || 'fr'
    const weekLabel = `${monday.getDate()}/${monday.getMonth() + 1}`
    const notifs = pending.map((e: any) => ({
      user_id: e.id, type: 'system', lu: false,
      message: lang === 'fr'
        ? `Rappel : soumettez vos disponibilités pour la semaine du ${weekLabel}.`
        : `Reminder: submit your availability for week of ${weekLabel}.`,
    }))
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    setReminderSent(true)
    setTimeout(() => setReminderSent(false), 3000)
    setSendingReminder(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t       = getTheme(profile?.theme)
  const lang    = (profile?.lang || 'fr') as 'fr' | 'en'
  const role    = profile?.roles?.[0] || 'employe'
  const font    = profile?.font_family || 'Georgia, serif'
  const isManager = role === 'gerant' || role === 'admin'
  const MOIS    = lang === 'fr' ? MOIS_FR : MOIS_EN

  const weekLabel = `${monday.getDate()} ${MOIS[monday.getMonth()]} – ${days[5].getDate()} ${MOIS[days[5].getMonth()]} ${days[5].getFullYear()}`

  // Manager helpers
  const submittedIds  = new Set(allDispos.filter(d => d.statut === 'soumis').map((d: any) => d.user_id))
  const empCount      = allEmployees.filter(e => !e.roles?.includes('gerant') && !e.roles?.includes('admin')).length
  const submittedCount = allDispos.filter(d => d.statut === 'soumis').length

  function getEmpDispos(empId: string): DisposMap {
    const d = allDispos.find(x => x.user_id === empId)
    return d?.dispos || { ...EMPTY_DISPOS }
  }

  function countAvail(jour: Jour, service: 'midi' | 'soir'): number {
    return allDispos.filter(d => {
      const s: Svcs = d.dispos?.[jour]
      return s && s.includes(service)
    }).length
  }

  function getCovReq(jour: Jour, service: 'midi' | 'soir') {
    return couverture.find(c => c.jour === jour && c.service === service) || null
  }

  // Employee: current choice per day
  function currentChoice(jour: Jour): 'midi' | 'soir' | 'les_deux' | 'indispo' {
    const s = dispos[jour]
    if (!s || s.length === 0) return 'indispo'
    if (s.includes('midi') && s.includes('soir')) return 'les_deux'
    if (s.includes('midi')) return 'midi'
    return 'soir'
  }

  const choices: Array<{ key: 'midi' | 'soir' | 'les_deux' | 'indispo'; label: string; color: string }> = [
    { key: 'midi',     label: 'Midi',                              color: '#F4A261' },
    { key: 'soir',     label: 'Soir',                              color: '#7EB8F7' },
    { key: 'les_deux', label: lang === 'fr' ? 'Les deux' : 'Both', color: '#82E0AA' },
    { key: 'indispo',  label: lang === 'fr' ? 'Indispo' : 'Off',   color: '#E07070' },
  ]

  return (
    <div style={{ background: t.fond, minHeight: '100vh', color: t.texte, fontFamily: font, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <Header nom={profile?.nom || ''} restaurant="Le Carré" lang={lang} />

      <main style={{ flex: 1, padding: '16px', paddingBottom: 96 }}>

        {/* Title + statut */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: 0 }}>
              {lang === 'fr' ? 'Disponibilités' : 'Availability'}
            </h1>
            {isManager && (
              <div style={{ fontSize: 12, color: t.texteSecondaire, marginTop: 2 }}>
                {submittedCount}/{empCount} {lang === 'fr' ? 'soumises' : 'submitted'}
              </div>
            )}
          </div>
          {!isManager && (
            <div style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, letterSpacing: '0.06em',
              background: statut === 'soumis' ? 'rgba(114,186,128,0.2)' : 'rgba(224,160,80,0.2)',
              border: `1px solid ${statut === 'soumis' ? 'rgba(114,186,128,0.5)' : 'rgba(224,160,80,0.5)'}`,
              color: statut === 'soumis' ? '#72BA80' : '#E0A850',
            }}>
              {statut === 'soumis' ? '✓ ' + (lang === 'fr' ? 'Soumis' : 'Submitted') : (lang === 'fr' ? 'Brouillon' : 'Draft')}
            </div>
          )}
        </div>

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: weekOffset <= 0 ? t.texteFaible : t.texte, borderRadius: 8, padding: '8px 14px', cursor: weekOffset <= 0 ? 'default' : 'pointer', fontSize: 16 }}
          >‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 2 }}>
              {weekOffset === 0 ? (lang === 'fr' ? 'Cette semaine' : 'This week')
               : weekOffset === 1 ? (lang === 'fr' ? 'Semaine prochaine' : 'Next week')
               : (lang === 'fr' ? `Dans ${weekOffset} semaines` : `In ${weekOffset} weeks`)}
            </div>
            <div style={{ fontSize: 13, color: t.texte }}>{weekLabel}</div>
          </div>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.texte, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 16 }}
          >›</button>
        </div>

        {/* ══════════════════ EMPLOYEE VIEW ══════════════════ */}
        {!isManager && (
          <>
            {/* Day rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {JOURS.map((jour, idx) => {
                const day = days[idx]
                const choice = currentChoice(jour)
                const isReadonly = statut === 'soumis'

                return (
                  <div key={jour} style={{
                    background: t.surface1, border: `1px solid ${t.border}`,
                    borderRadius: 12, padding: '12px 14px',
                    opacity: isReadonly ? 0.75 : 1,
                  }}>
                    <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 10 }}>
                      {JOUR_LONG[jour][lang]} <span style={{ color: t.texteFaible, fontFamily: "'Courier New', monospace" }}>{day.getDate()} {MOIS[day.getMonth()]}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {choices.map(c => {
                        const isSelected = choice === c.key
                        return (
                          <button
                            key={c.key}
                            onClick={() => setChoice(jour, c.key)}
                            disabled={isReadonly}
                            style={{
                              padding: '7px 4px', borderRadius: 8, cursor: isReadonly ? 'default' : 'pointer',
                              border: `1px solid ${isSelected ? c.color : t.border}`,
                              background: isSelected ? `${c.color}22` : 'transparent',
                              color: isSelected ? c.color : t.texteFaible,
                              fontSize: 11, fontFamily: font, transition: 'all 0.15s',
                            }}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            {statut === 'soumis' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: 'rgba(114,186,128,0.1)', border: '1px solid rgba(114,186,128,0.3)', borderRadius: 12, padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#72BA80' }}>
                  ✓ {lang === 'fr' ? 'Disponibilités soumises' : 'Availability submitted'}
                </div>
                <button onClick={handleReopen} style={{
                  width: '100%', padding: '12px', background: t.surface1,
                  border: `1px solid ${t.border}`, borderRadius: 12,
                  color: t.texteSecondaire, cursor: 'pointer', fontSize: 12, fontFamily: font,
                }}>
                  {lang === 'fr' ? 'Modifier mes dispos' : 'Edit my availability'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleSave(false)} disabled={saving} style={{
                  flex: 1, padding: '12px', background: t.surface1,
                  border: `1px solid ${t.border}`, borderRadius: 12,
                  color: saved ? '#72BA80' : t.texteSecondaire,
                  cursor: saving ? 'wait' : 'pointer', fontSize: 12, fontFamily: font,
                  transition: 'color 0.2s',
                }}>
                  {saved ? '✓ ' + (lang === 'fr' ? 'Sauvegardé' : 'Saved') : (lang === 'fr' ? 'Brouillon' : 'Save draft')}
                </button>
                <button onClick={() => handleSave(true)} disabled={saving} style={{
                  flex: 2, padding: '12px', background: t.accent, border: 'none',
                  borderRadius: 12, color: t.isDark ? '#080808' : '#fff',
                  cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600,
                }}>
                  {saving ? '...' : (lang === 'fr' ? 'Soumettre ✓' : 'Submit ✓')}
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ MANAGER VIEW ══════════════════ */}
        {isManager && (
          <>
            {/* Reminder + count */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={handleSendReminder} disabled={sendingReminder} style={{
                flex: 1, padding: '9px 12px', background: reminderSent ? 'rgba(114,186,128,0.15)' : t.surface1,
                border: `1px solid ${reminderSent ? 'rgba(114,186,128,0.4)' : t.border}`,
                borderRadius: 10, color: reminderSent ? '#72BA80' : t.texteSecondaire,
                cursor: sendingReminder ? 'wait' : 'pointer', fontSize: 11, fontFamily: font,
              }}>
                {reminderSent ? '✓ ' + (lang === 'fr' ? 'Rappels envoyés' : 'Reminders sent')
                              : '🔔 ' + (lang === 'fr' ? 'Envoyer rappels' : 'Send reminders')}
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'M = Midi',              color: '#F4A261' },
                { label: 'S = Soir',              color: '#7EB8F7' },
                { label: lang === 'fr' ? 'MS = Les deux' : 'MS = Both', color: '#82E0AA' },
                { label: lang === 'fr' ? '✗ = Indispo' : '✗ = Off',    color: '#E07070' },
                { label: lang === 'fr' ? '? = Non soumis' : '? = Pending', color: t.texteFaible },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 9, color: t.texteFaible, letterSpacing: '0.04em' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Grid — sticky name column + scrollable days */}
            <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(6, 1fr)', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ padding: '8px 10px', fontSize: 10, color: t.texteFaible }} />
                {JOURS.map(jour => (
                  <div key={jour} style={{ padding: '8px 4px', fontSize: 10, color: t.texteSecondaire, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {JOUR_SHORT[jour][lang]}
                  </div>
                ))}
              </div>

              {/* Employee rows */}
              {allEmployees.filter(e => !e.roles?.includes('gerant') && !e.roles?.includes('admin')).map((emp, ei, arr) => {
                const empDispos = getEmpDispos(emp.id)
                const hasSubmitted = submittedIds.has(emp.id)

                return (
                  <div key={emp.id} style={{
                    display: 'grid', gridTemplateColumns: '90px repeat(6, 1fr)',
                    borderBottom: ei < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                    alignItems: 'center',
                  }}>
                    {/* Name */}
                    <div style={{ padding: '10px 10px', fontSize: 12, color: t.texte, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.nom.split(' ')[0]}
                    </div>

                    {/* Day cells */}
                    {JOURS.map(jour => {
                      const svcs = empDispos[jour]
                      const col = hasSubmitted ? dispoColor(svcs) : t.texteFaible
                      const label = hasSubmitted ? dispoShort(svcs) : '?'

                      return (
                        <button
                          key={jour}
                          onClick={() => {
                            setOverrideModal({ empId: emp.id, empNom: emp.nom, jour })
                            setOverrideSvcs(hasSubmitted ? svcs : null)
                          }}
                          style={{
                            padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: col,
                            width: 22, height: 22, borderRadius: 6,
                            background: `${col}18`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}

              {allEmployees.filter(e => !e.roles?.includes('gerant') && !e.roles?.includes('admin')).length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: t.texteFaible, fontSize: 12 }}>
                  {lang === 'fr' ? 'Aucun employé' : 'No employees'}
                </div>
              )}
            </div>

            {/* Coverage check */}
            {couverture.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 10 }}>
                  {lang === 'fr' ? 'COUVERTURE MINIMALE' : 'MINIMUM COVERAGE'}
                </div>
                <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {(['midi', 'soir'] as const).map((service, si) => (
                    <div key={service} style={{
                      borderBottom: si === 0 ? `1px solid ${t.border}` : 'none',
                      padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: 10, color: service === 'midi' ? '#F4A261' : '#7EB8F7', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {service === 'midi' ? 'Midi' : 'Soir'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                        {JOURS.map(jour => {
                          const req = getCovReq(jour, service)
                          const avail = countAvail(jour, service)
                          const needed = req?.nb_personnes || 0
                          const ok = needed === 0 || avail >= needed
                          return (
                            <div key={jour} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 3, letterSpacing: '0.04em' }}>
                                {JOUR_SHORT[jour][lang]}
                              </div>
                              <div style={{
                                fontSize: 11, fontWeight: 600, fontFamily: "'Courier New', monospace",
                                color: needed === 0 ? t.texteFaible : ok ? '#72BA80' : '#E07070',
                              }}>
                                {avail}/{needed || '–'}
                              </div>
                              {req?.bar_requis && service === 'soir' && (
                                <div style={{ fontSize: 8, color: '#7EB8F7', marginTop: 2 }}>🍸</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Override modal ────────────────────────────────────────────────────── */}
      {overrideModal && (
        <div
          onClick={() => setOverrideModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: t.texte }}>
              {overrideModal.empNom.split(' ')[0]}
            </h3>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 20 }}>
              {JOUR_LONG[overrideModal.jour][lang]}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
              {choices.map(c => {
                const curChoice =
                  !overrideSvcs || overrideSvcs.length === 0 ? 'indispo'
                  : overrideSvcs.includes('midi') && overrideSvcs.includes('soir') ? 'les_deux'
                  : overrideSvcs.includes('midi') ? 'midi' : 'soir'
                const isSelected = curChoice === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setOverrideSvcs(
                      c.key === 'indispo'  ? null
                      : c.key === 'les_deux' ? ['midi', 'soir']
                      : c.key === 'midi'     ? ['midi']
                      :                        ['soir']
                    )}
                    style={{
                      padding: '12px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${isSelected ? c.color : t.border}`,
                      background: isSelected ? `${c.color}22` : t.surface2,
                      color: isSelected ? c.color : t.texteSecondaire,
                      fontSize: 13, fontFamily: font,
                    }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 10, color: t.texteFaible, marginBottom: 16, fontStyle: 'italic' }}>
              {lang === 'fr' ? '* L\'employé sera notifié de ce changement' : '* The employee will be notified of this change'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOverrideModal(null)} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button onClick={handleOverrideSave} disabled={savingOverride} style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: savingOverride ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600 }}>
                {savingOverride ? '...' : (lang === 'fr' ? 'Modifier' : 'Override')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation role={role} lang={lang} />
    </div>
  )
}
