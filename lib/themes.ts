export type ThemeName =
  | 'Or noir' | 'Minuit' | 'Bordeaux' | 'Forêt' | 'Ardoise'
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
  isDark: boolean
}

export const THEMES: Record<ThemeName, Theme> = {
  'Or noir':   { fond:'#080808', surface1:'#111111', surface2:'#1A1A1A', accent:'#C9A84C', accentClair:'#E8C96A', texte:'#F0EBE3', texteSecondaire:'rgba(240,235,227,0.5)', texteFaible:'rgba(240,235,227,0.18)', border:'rgba(240,235,227,0.08)', borderAccent:'rgba(201,168,76,0.3)', isDark:true },
  'Minuit':    { fond:'#050A14', surface1:'#0D1520', surface2:'#141E2E', accent:'#7EB8F7', accentClair:'#A8D0FF', texte:'#E8F0FF', texteSecondaire:'rgba(232,240,255,0.5)', texteFaible:'rgba(232,240,255,0.18)', border:'rgba(232,240,255,0.08)', borderAccent:'rgba(126,184,247,0.3)', isDark:true },
  'Bordeaux':  { fond:'#0A0506', surface1:'#150A0E', surface2:'#1E1216', accent:'#C04B6E', accentClair:'#E06080', texte:'#F0E8EC', texteSecondaire:'rgba(240,232,236,0.5)', texteFaible:'rgba(240,232,236,0.18)', border:'rgba(240,232,236,0.08)', borderAccent:'rgba(192,75,110,0.3)', isDark:true },
  'Forêt':     { fond:'#050A06', surface1:'#0C1610', surface2:'#121E16', accent:'#72BA80', accentClair:'#96D4A4', texte:'#E8F2EA', texteSecondaire:'rgba(232,242,234,0.5)', texteFaible:'rgba(232,242,234,0.18)', border:'rgba(232,242,234,0.08)', borderAccent:'rgba(114,186,128,0.3)', isDark:true },
  'Ardoise':   { fond:'#080A0C', surface1:'#10151A', surface2:'#181F26', accent:'#9BAFC0', accentClair:'#BEDAE8', texte:'#E8EEF2', texteSecondaire:'rgba(232,238,242,0.5)', texteFaible:'rgba(232,238,242,0.18)', border:'rgba(232,238,242,0.08)', borderAccent:'rgba(155,175,192,0.3)', isDark:true },
  'Cuivre':    { fond:'#0A0806', surface1:'#151008', surface2:'#1E1810', accent:'#C87941', accentClair:'#E0A060', texte:'#F2EDE8', texteSecondaire:'rgba(242,237,232,0.5)', texteFaible:'rgba(242,237,232,0.18)', border:'rgba(242,237,232,0.08)', borderAccent:'rgba(200,121,65,0.3)', isDark:true },
  'Améthyste': { fond:'#08060A', surface1:'#100C18', surface2:'#181020', accent:'#A875C8', accentClair:'#C8A0E0', texte:'#F0ECFF', texteSecondaire:'rgba(240,236,255,0.5)', texteFaible:'rgba(240,236,255,0.18)', border:'rgba(240,236,255,0.08)', borderAccent:'rgba(168,117,200,0.3)', isDark:true },
  'Océan':     { fond:'#040C0C', surface1:'#081818', surface2:'#0E2020', accent:'#3BBBB0', accentClair:'#60D4CA', texte:'#E8F4F2', texteSecondaire:'rgba(232,244,242,0.5)', texteFaible:'rgba(232,244,242,0.18)', border:'rgba(232,244,242,0.08)', borderAccent:'rgba(59,187,176,0.3)', isDark:true },
  'Ivoire':    { fond:'#F8F4EE', surface1:'#EDE8E0', surface2:'#E2DDD4', accent:'#8B6914', accentClair:'#B08820', texte:'#2A2520', texteSecondaire:'rgba(42,37,32,0.5)', texteFaible:'rgba(42,37,32,0.18)', border:'rgba(42,37,32,0.08)', borderAccent:'rgba(139,105,20,0.3)', isDark:false },
  'Brume':     { fond:'#EEF2F5', surface1:'#E4E8EC', surface2:'#D8DDE2', accent:'#5E7A8C', accentClair:'#7A96A8', texte:'#1E2830', texteSecondaire:'rgba(30,40,48,0.5)', texteFaible:'rgba(30,40,48,0.18)', border:'rgba(30,40,48,0.08)', borderAccent:'rgba(94,122,140,0.3)', isDark:false },
  'Craie':     { fond:'#F5F2EE', surface1:'#ECEAE4', surface2:'#E0DDD6', accent:'#6B5C4A', accentClair:'#8C7860', texte:'#2A2520', texteSecondaire:'rgba(42,37,32,0.5)', texteFaible:'rgba(42,37,32,0.18)', border:'rgba(42,37,32,0.08)', borderAccent:'rgba(107,92,74,0.3)', isDark:false },
}

export const THEME_NAMES: ThemeName[] = [
  'Or noir','Minuit','Bordeaux','Forêt','Ardoise',
  'Cuivre','Améthyste','Océan','Ivoire','Brume','Craie',
]

export function getTheme(name?: string | null): Theme {
  return THEMES[(name as ThemeName)] ?? THEMES['Or noir']
}

export function applyThemeToDocument(themeName?: string | null, fontFamily?: string | null) {
  if (typeof document === 'undefined') return
  const t = getTheme(themeName)
  const name = (themeName ?? 'Or noir') as ThemeName
  document.documentElement.setAttribute('data-theme', name)
  document.documentElement.setAttribute('data-font', fontFamily ?? '')
  document.documentElement.style.background = t.fond
  document.documentElement.style.color      = t.texte
  if (fontFamily) document.documentElement.style.fontFamily = fontFamily
}

export const FONTS = [
  { label: 'Georgia',           value: 'Georgia, serif' },
  { label: 'Playfair Display',  value: "'Playfair Display', Georgia, serif",       google: 'Playfair+Display:ital,wght@0,300;0,400;1,300' },
  { label: 'Cormorant',         value: "'Cormorant Garamond', Georgia, serif",     google: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300' },
  { label: 'Lora',              value: "'Lora', Georgia, serif",                   google: 'Lora:ital,wght@0,400;0,500;1,400' },
  { label: 'Helvetica',         value: "'Helvetica Neue', Arial, sans-serif" },
  { label: 'Courier New',       value: "'Courier New', monospace" },
] as const
