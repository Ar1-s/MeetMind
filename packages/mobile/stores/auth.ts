import { create } from 'zustand'
import type { User } from '@meetmind/shared'
import { storage } from '@/libs/storage'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User, token: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, token) => {
    await storage.setToken(token)
    set({ user, token, isAuthenticated: true })
  },

  logout: async () => {
    await storage.deleteToken()
    set({ user: null, token: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}))
