export type ThemeName =
  | 'Professionnel'
  | 'Sauge'
  | 'Ardoise bleu'
  | 'Minuit pro'
  | 'Forêt noire'
  | 'Bordeaux pro'

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
  'Professionnel': {
    fond:'#F5F7FA', surface1:'#FFFFFF', surface2:'#EFF2F7', surface3:'#E4E9F2',
    accent:'#0B6B73', accentClair:'#0E8A94', accentSombre:'#084F57',
    accentCoral:'#E8855A',
    texte:'#1A2540', texteSecondaire:'#4A5568', texteFaible:'#C8D0D8',
    border:'#E2E8F0', borderAccent:'rgba(11,107,115,0.30)',
    sidebarBg:'#0B3D42', sidebarActiveText:'#4DD9E8', isDark:false, sidebarIsDark:true,
  },
  'Sauge': {
    fond:'#F3F6F1', surface1:'#FFFFFF', surface2:'#ECF1EA', surface3:'#E0EAE0',
    accent:'#5A8562', accentClair:'#78A880', accentSombre:'#3E6445',
    accentCoral:'#E8855A',
    texte:'#1C2E1E', texteSecondaire:'#526D54', texteFaible:'#BDD0BF',
    border:'#D4E0D4', borderAccent:'rgba(90,133,98,0.28)',
    sidebarBg:'#2A4830', sidebarActiveText:'#90D49A', isDark:false, sidebarIsDark:true,
  },
  'Ardoise bleu': {
    fond:'#F0F4F8', surface1:'#FFFFFF', surface2:'#E8EFF6', surface3:'#DCE8F2',
    accent:'#3B6BA0', accentClair:'#5A8DC0', accentSombre:'#2A4E82',
    accentCoral:'#E8855A',
    texte:'#1A2A3C', texteSecondaire:'#44607A', texteFaible:'#C0D0DC',
    border:'#C8D8E8', borderAccent:'rgba(59,107,160,0.28)',
    sidebarBg:'#1A3252', sidebarActiveText:'#7FBFEF', isDark:false, sidebarIsDark:true,
  },
  'Minuit pro': {
    fond:'#0A1A1C', surface1:'#0F2224', surface2:'#152C2E', surface3:'#1C3638',
    accent:'#2DC4D0', accentClair:'#4DD9E4', accentSombre:'#1A9FAB',
    accentCoral:'#E8855A',
    texte:'#E2F4F6', texteSecondaire:'rgba(226,244,246,0.58)', texteFaible:'rgba(226,244,246,0.22)',
    border:'rgba(226,244,246,0.09)', borderAccent:'rgba(45,196,208,0.30)',
    sidebarBg:'#061010', sidebarActiveText:'#4DD9E8', isDark:true, sidebarIsDark:true,
  },
  'Forêt noire': {
    fond:'#0A1410', surface1:'#101E14', surface2:'#162618', surface3:'#1C3020',
    accent:'#3EB870', accentClair:'#5CD48A', accentSombre:'#2A9454',
    accentCoral:'#E8855A',
    texte:'#E0F0E4', texteSecondaire:'rgba(224,240,228,0.58)', texteFaible:'rgba(224,240,228,0.22)',
    border:'rgba(224,240,228,0.09)', borderAccent:'rgba(62,184,112,0.30)',
    sidebarBg:'#060E08', sidebarActiveText:'#5CD48A', isDark:true, sidebarIsDark:true,
  },
  'Bordeaux pro': {
    fond:'#14080E', surface1:'#1E1016', surface2:'#261420', surface3:'#301828',
    accent:'#C2395D', accentClair:'#E05578', accentSombre:'#9B2345',
    accentCoral:'#E8855A',
    texte:'#F2E4EA', texteSecondaire:'rgba(242,228,234,0.58)', texteFaible:'rgba(242,228,234,0.22)',
    border:'rgba(242,228,234,0.09)', borderAccent:'rgba(194,57,93,0.32)',
    sidebarBg:'#0A050A', sidebarActiveText:'#E07898', isDark:true, sidebarIsDark:true,
  },
}

export const LIGHT_THEMES: ThemeName[] = ['Professionnel', 'Sauge', 'Ardoise bleu']
export const DARK_THEMES: ThemeName[]  = ['Minuit pro', 'Forêt noire', 'Bordeaux pro']
export const THEME_NAMES: ThemeName[] = [...LIGHT_THEMES, ...DARK_THEMES]

export function getTheme(name?: string | null): Theme {
  return THEMES[(name as ThemeName)] ?? THEMES['Professionnel']
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

  root.style.setProperty('--bg',               t.fond)
  root.style.setProperty('--surface1',         t.surface1)
  root.style.setProperty('--surface2',         t.surface2)
  root.style.setProperty('--surface3',         t.surface3)
  root.style.setProperty('--accent',           t.accent)
  root.style.setProperty('--accent-hover',     t.accentSombre)
  root.style.setProperty('--accent-subtle',    t.accentClair + '22')
  root.style.setProperty('--accent-text',      '#ffffff')
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
  root.style.setProperty('--sidebar-indicator', t.sidebarActiveText)

  root.style.setProperty('--success',          '#10B981')
  root.style.setProperty('--success-subtle',   '#10B98118')
  root.style.setProperty('--danger',           '#EF4444')
  root.style.setProperty('--danger-subtle',    '#EF444418')
  root.style.setProperty('--warning',          '#F59E0B')
  root.style.setProperty('--warning-subtle',   '#F59E0B18')
  root.style.setProperty('--info',             '#3B82F6')
  root.style.setProperty('--info-subtle',      '#3B82F618')

  root.style.setProperty('--shadow-card',
    t.isDark
      ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)'
      : '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)')
  root.style.setProperty('--shadow-menu',
    t.isDark
      ? '0 8px 24px rgba(0,0,0,0.6)'
      : '0 8px 24px rgba(0,0,0,0.12)')

  root.style.setProperty('--z-modal', '1000')
  root.style.setProperty('--z-menu',  '900')
  root.style.setProperty('--z-topbar','800')

  root.style.setProperty('--space-1', '4px')
  root.style.setProperty('--space-2', '8px')
  root.style.setProperty('--space-3', '12px')
  root.style.setProperty('--space-4', '16px')
  root.style.setProperty('--space-5', '20px')
  root.style.setProperty('--space-6', '24px')
  root.style.setProperty('--space-8', '32px')

  root.style.setProperty('--radius-sm',   '6px')
  root.style.setProperty('--radius-md',   '10px')
  root.style.setProperty('--radius-lg',   '14px')
  root.style.setProperty('--radius-full', '9999px')

  root.style.setProperty('--transition-fast', '0.15s ease')

  const px = FONT_SIZES[fontSize ?? 'md'] ?? '15px'
  root.style.setProperty('--font-size-base', px)
  root.style.setProperty('--fz-xs',  'calc(var(--font-size-base) * 0.85)')
  root.style.setProperty('--fz-sm',  'calc(var(--font-size-base) * 0.93)')
  root.style.setProperty('--fz-md',  'var(--font-size-base)')
  root.style.setProperty('--fz-lg',  'calc(var(--font-size-base) * 1.14)')
  root.style.setProperty('--fz-xl',  'calc(var(--font-size-base) * 1.28)')
  root.style.setProperty('--fz-2xl', 'calc(var(--font-size-base) * 1.57)')
  root.style.setProperty('--fz-3xl', 'calc(var(--font-size-base) * 2)')
  root.style.fontSize = px

  if (fontFamily) {
    root.style.setProperty('--font-body', fontFamily)
    root.style.fontFamily = fontFamily
  }

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
