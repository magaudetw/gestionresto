export type ThemeName =
  | 'Lumière' | 'Or noir' | 'Minuit' | 'Bordeaux' | 'Forêt' | 'Ardoise'
  | 'Cuivre' | 'Améthyste' | 'Océan' | 'Ivoire' | 'Brume' | 'Craie'

export interface Theme {
  fond: string
  surface1: string
  surface2: string
  accent: string
  accentClair: string
  texte: string
  texteSecondaire: string
  texteFaible: string
  border: string
  borderAccent: string
  sidebarBg: string
  isDark: boolean
}

export const THEMES: Record<ThemeName, Theme> = {
  // ── Light themes ───────────────────────────────────────────────────────────
  'Lumière':   {
    fond:'#F8F9FA', surface1:'#FFFFFF', surface2:'#F3F4F6',
    accent:'#3B82F6', accentClair:'#60A5FA',
    texte:'#111827', texteSecondaire:'#6B7280', texteFaible:'#D1D5DB',
    border:'#E5E7EB', borderAccent:'#BFDBFE',
    sidebarBg:'#1A1F36', isDark:false,
  },
  'Ivoire':    {
    fond:'#FFFBF4', surface1:'#FFFFFF', surface2:'#FDF6EC',
    accent:'#B45309', accentClair:'#D97706',
    texte:'#1C1917', texteSecondaire:'#78716C', texteFaible:'#D6D3D1',
    border:'#E7E5E4', borderAccent:'#FDE68A',
    sidebarBg:'#1C1917', isDark:false,
  },
  'Brume':     {
    fond:'#F0F4F8', surface1:'#FFFFFF', surface2:'#E8EEF4',
    accent:'#0369A1', accentClair:'#0EA5E9',
    texte:'#0F172A', texteSecondaire:'#475569', texteFaible:'#CBD5E1',
    border:'#E2E8F0', borderAccent:'#BAE6FD',
    sidebarBg:'#0F172A', isDark:false,
  },
  'Craie':     {
    fond:'#FAFAF9', surface1:'#FFFFFF', surface2:'#F5F5F4',
    accent:'#7C3AED', accentClair:'#A78BFA',
    texte:'#1C1917', texteSecondaire:'#78716C', texteFaible:'#D6D3D1',
    border:'#E7E5E4', borderAccent:'#DDD6FE',
    sidebarBg:'#1E1B4B', isDark:false,
  },

  // ── Dark themes ────────────────────────────────────────────────────────────
  'Or noir':   {
    fond:'#080808', surface1:'#111111', surface2:'#1A1A1A',
    accent:'#C9A84C', accentClair:'#E8C96A',
    texte:'#F0EBE3', texteSecondaire:'rgba(240,235,227,0.52)', texteFaible:'rgba(240,235,227,0.20)',
    border:'rgba(240,235,227,0.09)', borderAccent:'rgba(201,168,76,0.32)',
    sidebarBg:'#080808', isDark:true,
  },
  'Minuit':    {
    fond:'#050A14', surface1:'#0D1520', surface2:'#141E2E',
    accent:'#60A5FA', accentClair:'#93C5FD',
    texte:'#E8F0FF', texteSecondaire:'rgba(232,240,255,0.52)', texteFaible:'rgba(232,240,255,0.20)',
    border:'rgba(232,240,255,0.09)', borderAccent:'rgba(96,165,250,0.32)',
    sidebarBg:'#050A14', isDark:true,
  },
  'Bordeaux':  {
    fond:'#0A0506', surface1:'#150A0E', surface2:'#1E1216',
    accent:'#F06292', accentClair:'#F48FB1',
    texte:'#F0E8EC', texteSecondaire:'rgba(240,232,236,0.52)', texteFaible:'rgba(240,232,236,0.20)',
    border:'rgba(240,232,236,0.09)', borderAccent:'rgba(240,98,146,0.32)',
    sidebarBg:'#0A0506', isDark:true,
  },
  'Forêt':     {
    fond:'#050A06', surface1:'#0C1610', surface2:'#121E16',
    accent:'#4ADE80', accentClair:'#86EFAC',
    texte:'#E8F2EA', texteSecondaire:'rgba(232,242,234,0.52)', texteFaible:'rgba(232,242,234,0.20)',
    border:'rgba(232,242,234,0.09)', borderAccent:'rgba(74,222,128,0.32)',
    sidebarBg:'#050A06', isDark:true,
  },
  'Ardoise':   {
    fond:'#080A0C', surface1:'#10151A', surface2:'#181F26',
    accent:'#94A3B8', accentClair:'#CBD5E1',
    texte:'#E8EEF2', texteSecondaire:'rgba(232,238,242,0.52)', texteFaible:'rgba(232,238,242,0.20)',
    border:'rgba(232,238,242,0.09)', borderAccent:'rgba(148,163,184,0.32)',
    sidebarBg:'#080A0C', isDark:true,
  },
  'Cuivre':    {
    fond:'#0A0806', surface1:'#151008', surface2:'#1E1810',
    accent:'#FB923C', accentClair:'#FDBA74',
    texte:'#F2EDE8', texteSecondaire:'rgba(242,237,232,0.52)', texteFaible:'rgba(242,237,232,0.20)',
    border:'rgba(242,237,232,0.09)', borderAccent:'rgba(251,146,60,0.32)',
    sidebarBg:'#0A0806', isDark:true,
  },
  'Améthyste': {
    fond:'#08060A', surface1:'#100C18', surface2:'#181020',
    accent:'#C084FC', accentClair:'#D8B4FE',
    texte:'#F0ECFF', texteSecondaire:'rgba(240,236,255,0.52)', texteFaible:'rgba(240,236,255,0.20)',
    border:'rgba(240,236,255,0.09)', borderAccent:'rgba(192,132,252,0.32)',
    sidebarBg:'#08060A', isDark:true,
  },
  'Océan':     {
    fond:'#040C0C', surface1:'#081818', surface2:'#0E2020',
    accent:'#2DD4BF', accentClair:'#5EEAD4',
    texte:'#E8F4F2', texteSecondaire:'rgba(232,244,242,0.52)', texteFaible:'rgba(232,244,242,0.20)',
    border:'rgba(232,244,242,0.09)', borderAccent:'rgba(45,212,191,0.32)',
    sidebarBg:'#040C0C', isDark:true,
  },
}

export const THEME_NAMES: ThemeName[] = [
  'Lumière',
  'Or noir','Minuit','Bordeaux','Forêt','Ardoise',
  'Cuivre','Améthyste','Océan','Ivoire','Brume','Craie',
]

export function getTheme(name?: string | null): Theme {
  return THEMES[(name as ThemeName)] ?? THEMES['Lumière']
}

export function themeSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

const FONT_SIZES: Record<string, string> = { sm: '12px', md: '14px', lg: '16px', xl: '18px' }

export function applyThemeToDocument(
  themeName?: string | null,
  fontFamily?: string | null,
  fontSize?: string | null,
) {
  if (typeof document === 'undefined') return
  const t = getTheme(themeName)
  const name = (themeName ?? 'Lumière') as ThemeName
  const slug = themeSlug(name)
  document.documentElement.setAttribute('data-theme', slug)
  document.documentElement.setAttribute('data-font', fontFamily ?? '')
  document.documentElement.style.background = t.fond
  document.documentElement.style.color      = t.texte
  if (fontFamily) document.documentElement.style.fontFamily = fontFamily
  const fsz = fontSize || 'md'
  document.documentElement.style.fontSize = FONT_SIZES[fsz] ?? '14px'
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gr-theme-fond',  t.fond)
    localStorage.setItem('gr-theme-texte', t.texte)
    localStorage.setItem('gr-theme-slug',  slug)
    localStorage.setItem('gr-font-size',   fsz)
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
