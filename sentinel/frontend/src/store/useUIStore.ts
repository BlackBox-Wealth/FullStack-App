import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'midnight' | 'linen' | 'sepia' | 'aurora' | 'graphite'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  highContrast: boolean
  reducedMotion: boolean
  largeText: boolean
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  setHighContrast: (v: boolean) => void
  setReducedMotion: (v: boolean) => void
  setLargeText: (v: boolean) => void
  applyTheme: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'midnight',
      sidebarCollapsed: false,
      highContrast: false,
      reducedMotion: false,
      largeText: false,
      setTheme: (t) => {
        set({ theme: t })
        document.documentElement.setAttribute('data-theme', t)
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setHighContrast: (v) => {
        set({ highContrast: v })
        document.documentElement.setAttribute('data-hc', String(v))
      },
      setReducedMotion: (v) => set({ reducedMotion: v }),
      setLargeText: (v) => {
        set({ largeText: v })
        document.documentElement.style.setProperty('--font-scale', v ? '1.15' : '1')
      },
      applyTheme: () => {
        const { theme, highContrast, largeText } = get()
        document.documentElement.setAttribute('data-theme', theme)
        document.documentElement.setAttribute('data-hc', String(highContrast))
        document.documentElement.style.setProperty('--font-scale', largeText ? '1.15' : '1')
      },
    }),
    { name: 'sentinel-ui' }
  )
)
