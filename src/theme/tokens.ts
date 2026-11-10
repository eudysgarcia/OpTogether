/**
 * OpTogether Design System — tokens.
 * Identidad v3: marca "OT" en degradado cian→azul→violeta con destello; ícono sobre azul noche #0B0A40.
 * Regla 60/30/10: superficies blancas (60), marino y azules de marca (30), violeta como acento (10).
 * Ningún componente debe usar valores literales de color, radio o espaciado: todo sale de aquí.
 */

export const palette = {
  navy950: '#0E1538',
  navy900: '#141D48',
  navy800: '#1F2C66', // marca
  navy700: '#2C3B80',
  navy600: '#3D4E99',
  navy400: '#7C88C2',
  navy200: '#C9CFEA',
  navy100: '#E6E9F6',
  navy50: '#F3F5FB',

  yellow600: '#D99A06',
  yellow500: '#FBBF24', // dorado (acento)
  yellow300: '#FDE08A',
  yellow100: '#FEF5D7',

  sky600: '#2563EB',
  sky500: '#3B82F6',
  sky400: '#60A5FA', // azul claro (marca)
  sky100: '#E3EEFE',

  purple700: '#6D28D9',
  purple600: '#7C3AED', // violeta (marca v3)
  purple500: '#8B5CF6',
  purple100: '#EFE9FE',

  rose700: '#BE185D',
  rose100: '#FCE7F1',

  green700: '#0F7A4D',
  green600: '#14935D',
  green500: '#1DB173',
  green100: '#E1F6EC',

  red700: '#B42318',
  red600: '#D92D20',
  red100: '#FDE8E7',

  orange600: '#C2570C',
  orange100: '#FDEEDC',

  teal600: '#0E7C86',
  teal100: '#DDF3F4',


  gray950: '#0B0D14',
  gray900: '#13161F',
  gray850: '#1A1E2A',
  gray800: '#232837',
  gray700: '#353B4D',
  gray600: '#5A6175',
  gray500: '#7A8194',
  gray400: '#A0A6B5',
  gray300: '#C9CDD6',
  gray200: '#E3E6EC',
  gray100: '#F1F3F7',
  gray50: '#F8F9FB',
  white: '#FFFFFF',
} as const;

/**
 * Colores semánticos financieros. Cada concepto tiene su propio color para que
 * nunca se confundan presupuesto, gasto, disponible, ahorro, deuda y fondos.
 */
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  brand: string;
  brandStrong: string;
  brandSoft: string;
  onBrand: string;
  accent: string;
  accentSoft: string;
  brandBlue: string;
  brandPurple: string;
  brandPurpleSoft: string;
  onAccent: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  // conceptos financieros
  budget: string; // presupuesto (planificado)
  spent: string; // gasto real
  available: string; // disponible
  excess: string; // exceso
  savings: string; // ahorro
  savingsSoft: string;
  debt: string; // deuda pendiente
  debtSoft: string;
  fund: string; // dinero en fondos
  fundSoft: string;
  contribution: string; // aportaciones
  contributionSoft: string;
  overlay: string;
  skeleton: string;
  tabBar: string;
  heroFrom: string;
  heroTo: string;
};

export const lightColors: ThemeColors = {
  background: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.navy50,
  surfaceRaised: palette.white,
  border: palette.gray200,
  borderStrong: palette.gray300,
  text: palette.navy950,
  textSecondary: palette.gray600,
  textTertiary: palette.gray500,
  textInverse: palette.white,
  brand: palette.navy800,
  brandStrong: palette.navy900,
  brandSoft: palette.navy100,
  onBrand: palette.white,
  accent: palette.purple600,
  accentSoft: palette.purple100,
  brandBlue: palette.sky600,
  brandPurple: palette.purple600,
  brandPurpleSoft: palette.purple100,
  onAccent: palette.white,
  positive: palette.green600,
  positiveSoft: palette.green100,
  negative: palette.red600,
  negativeSoft: palette.red100,
  warning: palette.orange600,
  warningSoft: palette.orange100,
  budget: palette.navy800,
  spent: palette.navy400,
  available: palette.green600,
  excess: palette.red600,
  savings: palette.teal600,
  savingsSoft: palette.teal100,
  debt: palette.rose700,
  debtSoft: palette.rose100,
  fund: palette.yellow600,
  fundSoft: palette.yellow100,
  contribution: palette.sky600,
  contributionSoft: palette.sky100,
  overlay: 'rgba(14,21,56,0.45)',
  skeleton: palette.gray100,
  tabBar: palette.white,
  heroFrom: palette.navy800,
  heroTo: palette.navy900,
};

export const darkColors: ThemeColors = {
  background: palette.gray950,
  surface: palette.gray900,
  surfaceAlt: palette.gray850,
  surfaceRaised: palette.gray800,
  border: palette.gray800,
  borderStrong: palette.gray700,
  text: '#F4F5F8',
  textSecondary: palette.gray400,
  textTertiary: palette.gray500,
  textInverse: palette.navy950,
  brand: '#5C6FD1',
  brandStrong: palette.navy200,
  brandSoft: '#1E2547',
  onBrand: palette.white,
  accent: '#A78BFA',
  accentSoft: '#2A2147',
  brandBlue: palette.sky400,
  brandPurple: '#A78BFA',
  brandPurpleSoft: '#2A2147',
  onAccent: palette.navy950,
  positive: palette.green500,
  positiveSoft: '#11301F',
  negative: '#F2564B',
  negativeSoft: '#3A1715',
  warning: '#F08A3E',
  warningSoft: '#3A2312',
  budget: '#8C9BE6',
  spent: palette.navy400,
  available: palette.green500,
  excess: '#F2564B',
  savings: '#2EB8C4',
  savingsSoft: '#0F2F33',
  debt: '#F472B6',
  debtSoft: '#3A1528',
  fund: palette.yellow500,
  fundSoft: '#3A3216',
  contribution: palette.sky400,
  contributionSoft: '#152A4A',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: palette.gray800,
  tabBar: palette.gray900,
  heroFrom: '#1B2558',
  heroTo: '#10173D',
};

/** Escala de espaciado (base 4). */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Márgenes de pantalla y grid. */
export const layout = {
  screenPadding: 20,
  gutter: 12,
  maxContentWidth: 560,
  minTouch: 48,
  tabBarHeight: 64,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  display: 'Manrope_800ExtraBold',
  heading: 'Manrope_700Bold',
  numeric: 'Manrope_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

/** Escala tipográfica (tamaño / interlineado). */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  amountXL: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -1 },
  amountL: { fontFamily: fonts.numeric, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  amountM: { fontFamily: fonts.numeric, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  amountS: { fontFamily: fonts.numeric, fontSize: 14, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof type;

/** Elevaciones sutiles: nunca sombras exageradas. */
export const elevation = {
  none: {},
  sm: {
    shadowColor: '#0E1538',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0E1538',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#0E1538',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const motion = {
  fast: 140,
  base: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
} as const;
