import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => Promise<void>
  loadPreference: () => Promise<void>
}

const THEME_KEY = 'theme_preference'

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',

  setPreference: async (pref) => {
    await SecureStore.setItemAsync(THEME_KEY, pref)
    set({ preference: pref })
  },

  loadPreference: async () => {
    try {
      const saved = await SecureStore.getItemAsync(THEME_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        set({ preference: saved })
      }
    } catch {
      // ignore read errors, keep default
    }
  },
}))
