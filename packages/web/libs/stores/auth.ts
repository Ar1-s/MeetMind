'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/interfaces'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => {
        set({ user, token, isAuthenticated: true })
        // Set token for API requests
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', token)
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('auth-storage')
        }
      },
      setUser: user => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
