export const Palette = {
  ink:        '#1A1218',
  inkMuted:   '#3D2E38',
  inkFaint:   '#7A6673',
  cream:      '#FAF6F0',
  creamDeep:  '#F2EBE1',
  creamBorder:'#E8DDD4',
  wine:       '#7B2D42',
  wineMid:    '#A64062',
  wineLight:  '#F5E8ED',
  wineText:   '#5C1F30',
  cognac:     '#B5663A',
  cognacMid:  '#C87E52',
  cognacLight:'#F7EDE5',
  cognacText: '#7A3A1A',
  darkBg:     '#120D10',
  darkSurface:'#1E1519',
  darkBorder: '#2E2028',
  darkMuted:  '#8C7A85',
  success:    '#3A7D5C',
  successBg:  '#EAF5EF',
  error:      '#C0392B',
  errorBg:    '#FDECEA',
  white:      '#FFFFFF',
  black:      '#000000',
} as const

export const Colors = {
  light: {
    background:        '#FAF6F0',
    backgroundCard:    '#FFFFFF',
    backgroundSubtle:  '#F2EBE1',
    backgroundAccent:  '#F2EBE1',
    textPrimary:       '#1A1218',
    textSecondary:     '#3D2E38',
    textTertiary:      '#7A6673',
    textOnAccent:      '#FFFFFF',
    textAccent:        '#7A6673',
    border:            '#E8DDD4',
    borderStrong:      '#7A6673',
    accent:            '#1A1218',
    accentMid:         '#3D2E38',
    accentLight:       '#F2EBE1',
    accentText:        '#7A6673',
    tabActive:         '#1A1218',
    tabInactive:       '#7A6673',
    tabBackground:     '#FAF6F0',
    tabBorder:         '#E8DDD4',
    success:           '#3A7D5C',
    successBg:         '#EAF5EF',
    error:             '#C0392B',
    errorBg:           '#FDECEA',
  },
  dark: {
    background:        '#120D10',
    backgroundCard:    '#1E1519',
    backgroundSubtle:  '#17101A',
    backgroundAccent:  '#231810',
    textPrimary:       '#F5EEF2',
    textSecondary:     '#C4B0BC',
    textTertiary:      '#8C7A85',
    textOnAccent:      '#1A1218',
    textAccent:        '#C4B0BC',
    border:            '#2E2028',
    borderStrong:      '#4A3545',
    accent:            '#E8DDD4',
    accentMid:         '#D4C8BC',
    accentLight:       '#231810',
    accentText:        '#C4B0BC',
    tabActive:         '#E8DDD4',
    tabInactive:       '#8C7A85',
    tabBackground:     '#120D10',
    tabBorder:         '#2E2028',
    success:           '#5DBF8A',
    successBg:         '#0F2A1C',
    error:             '#E57373',
    errorBg:           '#2A0F0F',
  },
} as const

export const Typography = {
  xs:      11,
  sm:      13,
  base:    15,
  md:      17,
  lg:      20,
  xl:      24,
  '2xl':   30,
  '3xl':   38,
  light:   '300' as const,
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  display:     'CormorantGaramond_400Regular',
  displayBold: 'CormorantGaramond_600SemiBold',
  body:        'JosefinSans_400Regular',
  bodyMedium:  'JosefinSans_600SemiBold',
  label:       'JosefinSans_300Light',
  // Legacy text styles — used by screens not yet migrated to the new token API
  styles: {
    screenTitle:  { fontSize: 22, fontWeight: '700' as const, lineHeight: 28,  fontFamily: 'CormorantGaramond_600SemiBold' },
    sectionLabel: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, fontFamily: 'JosefinSans_600SemiBold' },
    body:         { fontSize: 15, fontWeight: '500' as const, lineHeight: 24,  fontFamily: 'JosefinSans_600SemiBold' },
    bodySmall:    { fontSize: 13, fontWeight: '400' as const, lineHeight: 20,  fontFamily: 'JosefinSans_400Regular' },
    caption:      { fontSize: 11, fontWeight: '400' as const, lineHeight: 16,  fontFamily: 'JosefinSans_400Regular' },
    btnLabel:     { fontSize: 16, fontWeight: '600' as const,                  fontFamily: 'JosefinSans_600SemiBold' },
    btnLabelSm:   { fontSize: 14, fontWeight: '600' as const,                  fontFamily: 'JosefinSans_600SemiBold' },
    italic:       { fontSize: 13, fontWeight: '400' as const, fontStyle: 'italic' as const, lineHeight: 20, fontFamily: 'JosefinSans_400Regular' },
  },
} as const

export const Spacing = {
  '0':  0,  '1':  4,  '2':  8,  '3': 12,
  '4': 16,  '5': 20,  '6': 24,  '8': 32,
  '10': 40, '12': 48, '16': 64,
  // Legacy named keys — used by screens not yet migrated to the new numeric API
  xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, screen: 20,
} as const

export const Radius = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 999,
} as const

export const Shadow = {
  card: {
    shadowColor: '#1A1218',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lifted: {
    shadowColor: '#1A1218',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
} as const

// ─── LEGACY THEME API ─────────────────────────────────────────────────────────
// Kept for compatibility with utils/claude.ts (generateTheme) and
// contexts/ThemeContext.tsx. New screens should use Colors[scheme] directly.

export type Theme = {
  background: string
  surface: string
  surfaceTint: string
  textPrimary: string
  textSecondary: string
  textPlaceholder: string
  textOnAccent: string
  accent: string
  accentMuted: string
  accentDanger: string
  border: string
  borderSubtle: string
  tabActive: string
  tabInactive: string
  tabBar: string
  tabBarBorder: string
  sectionLabel: string
}

function makeTheme(C: typeof Colors.light | typeof Colors.dark): Theme {
  return {
    background:      C.background,
    surface:         C.backgroundCard,
    surfaceTint:     C.backgroundAccent,
    textPrimary:     C.textPrimary,
    textSecondary:   C.textSecondary,
    textPlaceholder: C.textTertiary,
    textOnAccent:    C.textOnAccent,
    accent:          C.accent,
    accentMuted:     C.accentMid,
    accentDanger:    C.error,
    border:          C.border,
    borderSubtle:    C.border,
    tabActive:       C.tabActive,
    tabInactive:     C.tabInactive,
    tabBar:          C.tabBackground,
    tabBarBorder:    C.tabBorder,
    sectionLabel:    C.textAccent,
  }
}

export const WearItTheme: Theme = makeTheme(Colors.light)
export const DarkAcademiaTheme: Theme = makeTheme(Colors.dark)
