/**
 * WearIt ThemeContext
 *
 * Provides the active theme throughout the app.
 * Supports both preset themes (THEMES registry) and AI-generated custom themes.
 *
 * Usage:
 *   const { theme, themeKey, setThemeKey, applyCustomTheme, customThemeName } = useTheme()
 */

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WearItTheme, DarkAcademiaTheme, type Theme } from '@/constants/theme'

// ─────────────────────────────────────────────
// AVAILABLE THEMES — add new themes here as they ship
// ─────────────────────────────────────────────

export const THEMES: Record<string, Theme> = {
  default: WearItTheme,
  darkAcademia: DarkAcademiaTheme,
  // y2k: Y2KTheme,
  // cleanGirl: CleanGirlTheme,
  // disneyChannel: DisneyChannelTheme,
}

export type ThemeKey = keyof typeof THEMES | 'custom'

const STORAGE_KEY_THEME = 'wearit_theme_key'
const STORAGE_KEY_CUSTOM = 'wearit_custom_theme'
const STORAGE_KEY_CUSTOM_NAME = 'wearit_custom_theme_name'

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────

type ThemeContextValue = {
  theme: Theme
  themeKey: ThemeKey
  customThemeName: string | null
  setThemeKey: (key: ThemeKey) => void
  applyCustomTheme: (theme: Theme, name: string) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: WearItTheme,
  themeKey: 'default',
  customThemeName: null,
  setThemeKey: () => {},
  applyCustomTheme: async () => {},
})

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function WearItThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('default')
  const [customTheme, setCustomTheme] = useState<Theme | null>(null)
  const [customThemeName, setCustomThemeName] = useState<string | null>(null)

  // Rehydrate saved theme on mount
  useEffect(() => {
    ;(async () => {
      try {
        const savedKey = await AsyncStorage.getItem(STORAGE_KEY_THEME)
        const savedCustomRaw = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM)
        const savedCustomName = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_NAME)

        if (savedKey === 'custom' && savedCustomRaw) {
          const savedCustom = JSON.parse(savedCustomRaw) as Theme
          setCustomTheme(savedCustom)
          setCustomThemeName(savedCustomName)
          setThemeKeyState('custom')
        } else if (savedKey && THEMES[savedKey]) {
          setThemeKeyState(savedKey as ThemeKey)
        }
      } catch {
        // Fail silently — default theme is fine
      }
    })()
  }, [])

  const setThemeKey = async (key: ThemeKey) => {
    setThemeKeyState(key)
    try {
      await AsyncStorage.setItem(STORAGE_KEY_THEME, key)
    } catch {}
  }

  const applyCustomTheme = async (theme: Theme, name: string) => {
    setCustomTheme(theme)
    setCustomThemeName(name)
    setThemeKeyState('custom')
    try {
      await AsyncStorage.setItem(STORAGE_KEY_THEME, 'custom')
      await AsyncStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(theme))
      await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_NAME, name)
    } catch {}
  }

  const activeTheme = useMemo<Theme>(() => {
    if (themeKey === 'custom' && customTheme) return customTheme
    return THEMES[themeKey] ?? WearItTheme
  }, [themeKey, customTheme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme: activeTheme,
    themeKey,
    customThemeName,
    setThemeKey,
    applyCustomTheme,
  }), [activeTheme, themeKey, customThemeName])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext)
}
