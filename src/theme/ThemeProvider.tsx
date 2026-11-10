import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../store/prefs';
import { darkColors, lightColors, type ThemeColors } from './tokens';

type Theme = { colors: ThemeColors; dark: boolean };

const ThemeContext = createContext<Theme>({ colors: lightColors, dark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = usePrefs((s) => s.theme);
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: dark ? darkColors : lightColors, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Crea estilos dependientes del tema con memo. */
export function useThemedStyles<T>(factory: (c: ThemeColors, dark: boolean) => T): T {
  const { colors, dark } = useTheme();
  return useMemo(() => factory(colors, dark), [colors, dark, factory]);
}
