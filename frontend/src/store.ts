import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  kyc_status: string;
  is_active: boolean;
  recovery_email?: string;
  recovery_phone?: string;
  is_first_time_investor?: boolean;
  is_new_user?: boolean;
  language: string;
  theme_mode?: string;
  accessibility?: any;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isRehydrating: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  setLanguage: (lang: string) => void;
  setRehydrating: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isRehydrating: true,
      login: (user) => {
        set({ user, isAuthenticated: true, isRehydrating: false });
      },
      logout: () => {
        set({ user: null, isAuthenticated: false, isRehydrating: false });
      },
      updateUser: (user) => {
        set({ user });
      },
      setLanguage: (lang) => {
        set((state) => {
          if (state.user) {
            return { user: { ...state.user, language: lang } };
          }
          return state;
        });
      },
      setRehydrating: (val) => set({ isRehydrating: val }),
    }),
    {
      name: 'wv-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export type ThemeMode = 'linen' | 'midnight' | 'sepia' | 'aurora' | 'graphite';

export interface AccessibilityState {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  compactDensity: boolean;
  voiceNavigation: boolean;
  screenReader: boolean;
}

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleThemeMode: () => void;
  accessibility: AccessibilityState;
  updateAccessibility: (updates: Partial<AccessibilityState>) => void;
  resetPreferences: () => void;
  initializeFromUser: (user: User) => void;
}

const defaultAccessibility: AccessibilityState = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  compactDensity: false,
  voiceNavigation: false,
  screenReader: false,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      themeMode: 'linen',
      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () =>
        set((state) => {
          const order: ThemeMode[] = ['linen', 'midnight', 'sepia', 'aurora', 'graphite'];
          const currentIndex = order.indexOf(state.themeMode);
          const nextTheme = order[(currentIndex + 1) % order.length];
          return { themeMode: nextTheme };
        }),
      accessibility: defaultAccessibility,
      updateAccessibility: (updates) =>
        set((state) => ({
          accessibility: { ...state.accessibility, ...updates },
        })),
      resetPreferences: () =>
        set({
          themeMode: 'linen',
          accessibility: defaultAccessibility,
          sidebarOpen: true,
        }),
      initializeFromUser: (user) => {
        // If the user already has locally-persisted prefs (wv-ui in localStorage),
        // keep them — don't let the server profile overwrite what the user set.
        // On a new device with no local prefs, fall back to server values.
        const hasLocalPrefs = !!localStorage.getItem('wv-ui');
        if (!hasLocalPrefs) {
          set({
            themeMode: user.theme_mode as ThemeMode || 'linen',
            accessibility: { ...defaultAccessibility, ...(user.accessibility || {}) },
          });
        }
      },
    }),
    {
      name: 'wv-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        accessibility: state.accessibility,
      }),
    }
  )
);
