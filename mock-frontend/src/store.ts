import { create } from 'zustand';

export interface PhishingUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  employee_id: string;
  initials: string;
}

export interface PhishingContext {
  attempt_id: string;
  campaign_id: string;
  template_id: string;
  harvest_page_type: string;
  email_subject: string;
  sender_name: string;
  sender_email: string;
  task_title: string;
  task_description: string;
  task_cta: string;
  phishing_email_id: string;
}

interface PhishingSession {
  jwt: string | null;
  user: PhishingUser | null;
  context: PhishingContext | null;
  score: number;
  events: BehaviorEvent[];
  revealTriggered: boolean;
  sessionStart: number;
}

export interface BehaviorEvent {
  type: string;
  page: string;
  data: Record<string, unknown>;
  ts: number;
}

interface PhishingStore extends PhishingSession {
  setSession: (jwt: string, user: PhishingUser, context: PhishingContext) => void;
  addEvent: (event: BehaviorEvent) => void;
  adjustScore: (delta: number) => void;
  triggerReveal: () => void;
  closeReveal: () => void;
  logout: () => void;
}

export const usePhishingStore = create<PhishingStore>((set) => ({
  jwt: null,
  user: null,
  context: null,
  score: 100,
  events: [],
  revealTriggered: false,
  sessionStart: Date.now(),

  setSession: (jwt, user, context) =>
    set({ jwt, user, context, score: 100, events: [], revealTriggered: false, sessionStart: Date.now() }),

  addEvent: (event) =>
    set((s) => ({ events: [...s.events, event] })),

  adjustScore: (delta) =>
    set((s) => ({ score: Math.max(0, Math.min(100, s.score + delta)) })),

  triggerReveal: () => set({ revealTriggered: true }),

  closeReveal: () => set({ revealTriggered: false }),

  logout: () =>
    set({ jwt: null, user: null, context: null, score: 100, events: [], revealTriggered: false }),
}));

// ─── Simple UI store ───
const THEMES = ['linen', 'midnight', 'sepia', 'aurora', 'graphite'] as const;
type Theme = typeof THEMES[number];

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: Theme;
  cycleTheme: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: 'linen' as Theme,
  cycleTheme: () => {
    const current = get().theme;
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },
}));
