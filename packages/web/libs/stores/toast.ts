'use client'

import { create } from 'zustand'

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  severity: ToastSeverity
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, severity?: ToastSeverity, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

export const useToastStore = create<ToastState>(set => ({
  toasts: [],
  addToast: (message, severity = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    set(state => ({
      toasts: [...state.toasts, { id, message, severity, duration }],
    }))
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set(state => ({
          toasts: state.toasts.filter(t => t.id !== id),
        }))
      }, duration)
    }
  },
  removeToast: id =>
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    })),
  success: message => {
    const id = Date.now().toString()
    set(state => ({
      toasts: [...state.toasts, { id, message, severity: 'success', duration: 3000 }],
    }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 3000)
  },
  error: message => {
    const id = Date.now().toString()
    set(state => ({
      toasts: [...state.toasts, { id, message, severity: 'error', duration: 5000 }],
    }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 5000)
  },
  warning: message => {
    const id = Date.now().toString()
    set(state => ({
      toasts: [...state.toasts, { id, message, severity: 'warning', duration: 4000 }],
    }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  info: message => {
    const id = Date.now().toString()
    set(state => ({
      toasts: [...state.toasts, { id, message, severity: 'info', duration: 4000 }],
    }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
}))
