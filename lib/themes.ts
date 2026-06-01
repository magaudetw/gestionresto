export type ThemeName =
  | 'Lumière' | 'Ivoire' | 'Brume' | 'Craie'
  | 'Or noir' | 'Minuit' | 'Bordeaux' | 'Forêt' | 'Ardoise'
  | 'Cuivre' | 'Améthyste' | 'Océan' | 'Professionnel'

export interface Theme {
  fond: string
  surface1: string
  surface2: string
  surface3: string
  accent: string
  accentClair: string
  accentSombre: string
  accentCoral?: string
  texte: string
  texteSecondaire: string
  texteFaible: string
  border: string
  borderAccent: string
  sidebarBg: string
  sidebarActiveText: string
  isDark: boolean
  sidebarIsDark?: boolean
}

export const THEMES: Record<ThemeName, Theme> = {
  // ── Light themes ────────────────────────────────────────────────────────────
  'Lumière': {
    fond:'#F8F9FA', surface1:'#FFFFFF', surface2:'#F3F4F6', surface3:'#E9EAEC',
    accent:'#3B82F6', accentClair:'#60A5FA', accentSombre:'#1D4ED8',
    texte:'#111827', texteSecondaire:'#6B7280', texteFaible:'#D1D5DB',
    border:'#E5E7EB', borderAccent:'#BFDBFE',
    sidebarBg:'#FFFFFF', sidebarActiveText:'#3B82F6', isDark:false,
  },
  'Ivoire': {
    fond:'#FAF7F2', surface1:'#FFFFFF', surface2:'#F5F0E8', surface3:'#EDE7D9',
    accent:'#92724A', accentClair:'#B89060', accentSombre:'#6B5234',
    texte:'#2C1810', texteSecondaire:'#78716C', texteFaible:'#D6D3D1',
    border:'#E5DDD0', borderAccent:'#D4B896',
    sidebarBg:'#F5F0E8', sidebarActiveText:'#92724A', isDark:false,
  },
  'Brume': {
    fond:'#F0F4F8', surface1:'#FFFFFF', surface2:'#E4EBF2', surface3:'#D6E0EC',
    accent:'#5B7FA6', accentClair:'#7B9DC4', accentSombre:'#3B5F86',
    texte:'#1A2B3C', texteSecondaire:'#4A6580', texteFaible:'#CBD5E1',
    border:'#D0DCE8', borderAccent:'#A8C0D8',
    sidebarBg:'#E4EBF2', sidebarActiveText:'#5B7FA6', isDark:false,
  },
  'Craie': {
    fond:'#F5F5F0', surface1:'#FFFFFF', surface2:'#EEEEEA', surface3:'#E4E4DE',
    accent:'#4A4A4A', accentClair:'#6A6A6A', accentSombre:'#2A2A2A',
    texte:'#2A2A2A', texteSecondaire:'#5A5A5A', texteFaible:'#C4C4C0',
    border:'#DDDDD8', borderAccent:'#AAAAA6',
    sidebarBg:'#EFEFE8', sidebarActiveText:'#4A4A4A', isDark:false,
  },

  // ── Dark themes ─────────────────────────────────────────────────────────────
  'Or noir': {
    fond:'#080808', surface1:'#111111', surface2:'#1A1A1A', surface3:'#222222',
    accent:'#C9A84C', accentClair:'#E8C96A', accentSombre:'#A08030',
    texte:'#F0EBE3', texteSecondaire:'rgba(240,235,227,0.55)', texteFaible:'rgba(240,235,227,0.20)',
    border:'rgba(240,235,227,0.09)', borderAccent:'rgba(201,168,76,0.32)',
    sidebarBg:'#111111', sidebarActiveText:'#C9A84C', isDark:true,
  },
  'Minuit': {
    fond:'#0D1117', surface1:'#161B22', surface2:'#1C2330', surface3:'#222C3C',
    accent:'#58A6FF', accentClair:'#79BBFF', accentSombre:'#388BFD',
    texte:'#E6EDF3', texteSecondaire:'rgba(230,237,243,0.55)', texteFaible:'rgba(230,237,243,0.20)',
    border:'rgba(230,237,243,0.09)', borderAccent:'rgba(88,166,255,0.32)',
    sidebarBg:'#161B22', sidebarActiveText:'#58A6FF', isDark:true,
  },
  'Bordeaux': {
    fond:'#0F0A0A', surface1:'#1A0F0F', surface2:'#241414', surface3:'#2E1919',
    accent:'#9B2335', accentClair:'#C2354D', accentSombre:'#741A28',
    texte:'#F0E8E8', texteSecondaire:'rgba(240,232,232,0.55)', texteFaible:'rgba(240,232,232,0.20)',
    border:'rgba(240,232,232,0.09)', borderAccent:'rgba(155,35,53,0.40)',
    sidebarBg:'#1A0F0F', sidebarActiveText:'#C2354D', isDark:true,
  },
  'Forêt': {
    fond:'#0A0F0A', surface1:'#0F1A0F', surface2:'#152215', surface3:'#1C2E1C',
    accent:'#4A9B5F', accentClair:'#6EC280', accentSombre:'#337344',
    texte:'#E8F2E8', texteSecondaire:'rgba(232,242,232,0.55)', texteFaible:'rgba(232,242,232,0.20)',
    border:'rgba(232,242,232,0.09)', borderAccent:'rgba(74,155,95,0.35)',
    sidebarBg:'#0F1A0F', sidebarActiveText:'#6EC280', isDark:true,
  },
  'Ardoise': {
    fond:'#0F1115', surface1:'#161A20', surface2:'#1C2230', surface3:'#232A38',
    accent:'#6B8CAE', accentClair:'#8BA8C8', accentSombre:'#4E6C8E',
    texte:'#E2E8F0', texteSecondaire:'rgba(226,232,240,0.55)', texteFaible:'rgba(226,232,240,0.20)',
    border:'rgba(226,232,240,0.09)', borderAccent:'rgba(107,140,174,0.35)',
    sidebarBg:'#161A20', sidebarActiveText:'#8BA8C8', isDark:true,
  },
  'Cuivre': {
    fond:'#0F0C08', surface1:'#1A1510', surface2:'#231D16', surface3:'#2E261C',
    accent:'#B87333', accentClair:'#D4924E', accentSombre:'#8C5520',
    texte:'#F2EDE8', texteSecondaire:'rgba(242,237,232,0.55)', texteFaible:'rgba(242,237,232,0.20)',
    border:'rgba(242,237,232,0.09)', borderAccent:'rgba(184,115,51,0.35)',
    sidebarBg:'#1A1510', sidebarActiveText:'#D4924E', isDark:true,
  },
  'Améthyste': {
    fond:'#0D0A12', surface1:'#150F1E', surface2:'#1E1628', surface3:'#271E34',
    accent:'#8B5CF6', accentClair:'#A78BFA', accentSombre:'#6D28D9',
    texte:'#F0ECFF', texteSecondaire:'rgba(240,236,255,0.55)', texteFaible:'rgba(240,236,255,0.20)',
    border:'rgba(240,236,255,0.09)', borderAccent:'rgba(139,92,246,0.35)',
    sidebarBg:'#150F1E', sidebarActiveText:'#A78BFA', isDark:true,
  },
  'Océan': {
    fond:'#080D12', surface1:'#0F1520', surface2:'#151E2A', surface3:'#1C2836',
    accent:'#0EA5E9', accentClair:'#38BDF8', accentSombre:'#0284C7',
    texte:'#E8F4F8', texteSecondaire:'rgba(232,244,248,0.55)', texteFaible:'rgba(232,244,248,0.20)',
    border:'rgba(232,244,248,0.09)', borderAccent:'rgba(14,165,233,0.35)',
    sidebarBg:'#0F1520', sidebarActiveText:'#38BDF8', isDark:true,
  },
  'Professionnel': {
    fond:'#F5F7FA', surface1:'#FFFFFF', surface2:'#EFF2F7', surface3:'#E4E9F2',
    accent:'#0B6B73', accentClair:'#0E8A94', accentSombre:'#084F57',
    accentCoral:'#E8855A',
    texte:'#1A2540', texteSecondaire:'#4A5568', texteFaible:'#C8D0D8',
    border:'#E2E8F0', borderAccent:'rgba(11,107,115,0.30)',
    sidebarBg:'#0B3D42', sidebarActiveText:'#4DD9E8', isDark:false, sidebarIsDark:true,
  },
}

export const LIGHT_THEMES: ThemeName[] = ['Lumière', 'Ivoire', 'Brume', 'Craie']
export const DARK_THEMES: ThemeName[]  = ['Or noir', 'Minuit', 'Bordeaux', 'Forêt', 'Ardoise', 'Cuivre', 'Améthyste', 'Océan', 'Professionnel']
export const THEME_NAMES: ThemeName[] = [...LIGHT_THEMES, ...DARK_THEMES]

export function getTheme(name?: string | null): Theme {
  return THEMES[(name as ThemeName)] ?? THEMES['Lumière']
}

export function themeSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

export const FONT_SIZES: Record<string, string> = {
  sm: '13px', md: '15px', lg: '17px', xl: '19px',
  petit: '13px', normal: '14px', grand: '16px', 'tres-grand': '18px',
}

export function applyThemeToDocument(
  themeName?: string | null,
  fontFamily?: string | null,
  fontSize?: string | null,
) {
  if (typeof document === 'undefined') return
  const name = (themeName ?? 'Professionnel') as ThemeName
  const t = getTheme(name)
  const slug = themeSlug(name)
  const root = document.documentElement

  root.setAttribute('data-theme', slug)
  root.setAttribute('data-font', fontFamily ?? '')

  // Appliquer TOUTES les CSS variables utilisées dans globals.css
  root.style.setProperty('--bg',               t.fond)
  root.style.setProperty('--surface1',         t.surface1)
  root.style.setProperty('--surface2',         t.surface2)
  root.style.setProperty('--surface3',         t.surface3)
  root.style.setProperty('--accent',           t.accent)
  root.style.setProperty('--accent-hover',     t.accentSombre)
  root.style.setProperty('--accent-subtle',    t.accentClair + '22')
  root.style.setProperty('--accent-text',      t.isDark ? '#ffffff' : '#ffffff')
  root.style.setProperty('--text',             t.texte)
  root.style.setProperty('--text-secondary',   t.texteSecondaire)
  root.style.setProperty('--text-muted',       t.texteSecondaire)
  root.style.setProperty('--text-faint',       t.texteFaible)
  root.style.setProperty('--border',           t.border)
  root.style.setProperty('--border-accent',    t.borderAccent)
  root.style.setProperty('--sidebar-bg',       t.sidebarBg)
  root.style.setProperty('--sidebar-text',     (t.sidebarIsDark ?? t.isDark)
    ? 'rgba(255,255,255,0.70)'
    : 'rgba(0,0,0,0.60)')
  root.style.setProperty('--sidebar-text-active', t.sidebarActiveText)
  root.style.setProperty('--accent-coral',     t.accentCoral ?? '#E8855A')
  root.style.setProperty('--sidebar-active-bg','rgba(255,255,255,0.15)')
  root.style.setProperty('--sidebar-hover-bg', 'rgba(255,255,255,0.08)')
  root.style.setProperty('--sidebar-indicator','#4DD9E8')

  // États
  root.style.setProperty('--success',          '#10B981')
  root.style.setProperty('--success-subtle',   '#10B98118')
  root.style.setProperty('--danger',           '#EF4444')
  root.style.setProperty('--danger-subtle',    '#EF444418')
  root.style.setProperty('--warning',          '#F59E0B')
  root.style.setProperty('--warning-subtle',   '#F59E0B18')
  root.style.setProperty('--info',             '#3B82F6')
  root.style.setProperty('--info-subtle',      '#3B82F618')

  // Ombres
  const shadowColor = t.isDark ? '0,0,0' : '0,0,0'
  root.style.setProperty('--shadow-card',
    t.isDark
      ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)'
      : '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)')
  root.style.setProperty('--shadow-menu',
    t.isDark
      ? '0 8px 24px rgba(0,0,0,0.6)'
      : '0 8px 24px rgba(0,0,0,0.12)')

  // Z-index
  root.style.setProperty('--z-modal', '1000')
  root.style.setProperty('--z-menu',  '900')
  root.style.setProperty('--z-topbar','800')

  // Espacements (fixes, ne changent pas avec le thème)
  root.style.setProperty('--space-1', '4px')
  root.style.setProperty('--space-2', '8px')
  root.style.setProperty('--space-3', '12px')
  root.style.setProperty('--space-4', '16px')
  root.style.setProperty('--space-5', '20px')
  root.style.setProperty('--space-6', '24px')
  root.style.setProperty('--space-8', '32px')

  // Border radius
  root.style.setProperty('--radius-sm',   '6px')
  root.style.setProperty('--radius-md',   '10px')
  root.style.setProperty('--radius-lg',   '14px')
  root.style.setProperty('--radius-full', '9999px')

  // Transitions
  root.style.setProperty('--transition-fast', '0.15s ease')

  // Taille de police
  const px = FONT_SIZES[fontSize ?? 'md'] ?? '14px'
  root.style.setProperty('--font-size-base', px)
  root.style.setProperty('--fz-xs',  'calc(var(--font-size-base) * 0.85)')
  root.style.setProperty('--fz-sm',  'calc(var(--font-size-base) * 0.93)')
  root.style.setProperty('--fz-md',  'var(--font-size-base)')
  root.style.setProperty('--fz-lg',  'calc(var(--font-size-base) * 1.14)')
  root.style.setProperty('--fz-xl',  'calc(var(--font-size-base) * 1.28)')
  root.style.setProperty('--fz-2xl', 'calc(var(--font-size-base) * 1.57)')
  root.style.setProperty('--fz-3xl', 'calc(var(--font-size-base) * 2)')
  root.style.fontSize = px

  // Police
  if (fontFamily) {
    root.style.setProperty('--font-body', fontFamily)
    root.style.fontFamily = fontFamily
  }

  // Body background
  root.style.background = t.fond
  root.style.color = t.texte

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gr-theme-fond',  t.fond)
    localStorage.setItem('gr-theme-texte', t.texte)
    localStorage.setItem('gr-theme-slug',  slug)
    localStorage.setItem('gr-font-size',   fontSize ?? 'md')
  }
}

export const FONTS = [
  { label: 'DM Sans',            value: 'var(--font-dm-sans), DM Sans, sans-serif' },
  { label: 'Georgia',            value: 'Georgia, serif' },
  { label: 'Playfair Display',   value: "'Playfair Display', Georgia, serif",       google: 'Playfair+Display:ital,wght@0,300;0,400;1,300' },
  { label: 'Cormorant',          value: "'Cormorant Garamond', Georgia, serif",     google: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300' },
  { label: 'Lora',               value: "'Lora', Georgia, serif",                   google: 'Lora:ital,wght@0,400;0,500;1,400' },
  { label: 'Courier New',        value: "'Courier New', monospace" },
] as const
