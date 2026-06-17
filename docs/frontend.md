# WealthVault — Frontend Architecture

---

## 1. Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| UI Framework | React | 19.2.4 |
| Language | TypeScript | ~6.0.2 |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Routing | React Router DOM | 7.x |
| State Management | Zustand | 5.x |
| Server State / Cache | TanStack React Query | 5.x |
| HTTP Client | Axios | 1.x |
| Charts | Recharts | 3.x |
| Icons | Lucide React | 1.x + React Icons 5.x |
| Animation | Framer Motion | 12.x |
| Toast Notifications | React Hot Toast | 2.x |
| PDF Export | jsPDF + jspdf-autotable | 4.x / 5.x |
| Maps | MapLibre GL | 5.x |
| Markdown | React Markdown | 10.x |
| CAPTCHA | @marsidev/react-turnstile | 1.x |
| Smooth Scroll | Lenis | 1.x |
| Font | Geist Variable | 5.x |
| Component Utilities | clsx, tailwind-merge, class-variance-authority | latest |
| UI Primitives | Radix UI, shadcn | latest |

---

## 2. Project Structure

```
frontend/
├── public/
├── src/
│   ├── api.ts                  # Axios instances + all API method exports
│   ├── App.tsx                 # Root component: router, QueryClient, global providers
│   ├── main.tsx                # React DOM render entry
│   ├── index.css               # Global CSS variables, theme tokens, base styles
│   ├── store.ts                # Zustand stores (useAuthStore, useUIStore)
│   ├── assets/                 # Static assets (images, svgs)
│   ├── bones/                  # boneyard-js integration
│   ├── components/
│   │   ├── AlertBanner.tsx
│   │   ├── Chatbot.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── KYCGuard.tsx
│   │   ├── NavigationTour.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── PageInfoButton.tsx
│   │   ├── PublicFooter.tsx
│   │   ├── RoleProtectedRoute.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TurnstileWidget.tsx
│   │   ├── animation/
│   │   │   ├── Motion3D.tsx
│   │   │   └── PageLoader.tsx
│   │   ├── help/               # In-app help overlays
│   │   ├── layout/
│   │   │   ├── AppFooter.tsx
│   │   │   └── PreferenceApplier.tsx
│   │   └── ui/
│   │       ├── PageHeader.tsx
│   │       ├── SettingToggle.tsx
│   │       ├── button.tsx
│   │       └── map.tsx
│   ├── hooks/
│   │   ├── useBiometrics.ts
│   │   ├── useScreenReader.ts
│   │   ├── useTranslation.ts
│   │   └── useVoiceNavigation.ts
│   ├── lib/
│   │   └── translations.ts     # i18n strings for en / hi / pa
│   ├── pages/                  # 38 page components (see §4)
│   └── theme/
│       └── chartTheme.ts       # Recharts colour palette + axis tokens
```

---

## 3. Entry Point and Bootstrap

`main.tsx` renders `<App />` into `#root`.

`App.tsx`:
1. Creates a `QueryClient` with `retry: 1` and `staleTime: 5 minutes`.
2. Wraps the tree in `<QueryClientProvider>` and `<BrowserRouter>`.
3. Mounts a global `<Toaster>` (dark slate background, 4-second duration).
4. On mount, calls `authAPI.me()` with `skipAuthRefresh: true` to silently rehydrate session from the existing httpOnly access-token cookie. Sets `isRehydrating: false` when done.
5. Defines `ProtectedRoute` — renders `<PageLoader label="Checking session" />` while rehydrating, then redirects to `/login` if unauthenticated, otherwise renders `AppLayout`.
6. `AppLayout` renders `<Sidebar>`, `<Header>`, `<main>` (with `<Outlet>`), `<AppFooter>`, `<Chatbot>`, `<NavigationTour>`, and `<Footer>`. Calls `useVoiceNavigation()` when voice navigation is active.

---

## 4. Routing

### 4.1 Route Table

| Path | Component | Access |
|---|---|---|
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/forgot-password` | `ForgotPassword` | Public |
| `/security/alert` | `SecurityAlert` | Public |
| `/dashboard` | `Dashboard` | Authenticated |
| `/accounts` | `Accounts` | Authenticated |
| `/transactions` | `Transactions` | Authenticated |
| `/payments` | `Payments` | Authenticated |
| `/investments` | `Investments` | Authenticated |
| `/goals` | `Goals` | Authenticated |
| `/sips` | `SIPs` | Authenticated |
| `/loans` | `Loans` | Authenticated |
| `/recommendations` | `Recommendations` | Authenticated |
| `/faq` | `FAQ` | Authenticated |
| `/support` | `Support` | Authenticated |
| `/ai/scenarios` | `WhatIf` | Authenticated |
| `/ai/agents` | `AIAgents` | Authenticated |
| `/settings` | `Settings` | Authenticated |
| `/sessions` | `Sessions` | Authenticated |
| `/account-aggregator` | `AccountAggregator` | Authenticated |
| `/asset-vault` | `AssetVault` | Authenticated |
| `/budgets` | `Budgets` | Authenticated |
| `/family` | `Family` | Authenticated |
| `/data-privacy` | `DataPrivacy` | Authenticated |
| `/credit-score` | `CreditScore` | Authenticated |
| `/tax` | `TaxHelper` | Authenticated |
| `/learn` | `Learn` | Authenticated |
| `/kyc` | `KYCSubmission` | Authenticated |
| `/admin/notifications` | `AdminNotifications` | employee, relationship_manager, super_admin |
| `/admin/kyc` | `AdminKYCReview` | employee, relationship_manager, super_admin |
| `/admin/kyc/escalated` | `AdminKYCReview` | employee, relationship_manager, super_admin |
| `/admin/loans` | `AdminLoans` | employee, relationship_manager, super_admin |
| `/admin/fraud` | `AdminFraud` | employee, relationship_manager, super_admin |
| `/admin/users` | `AdminUsers` | relationship_manager, super_admin |
| `/admin/analytics` | `AdminAnalytics` | relationship_manager, super_admin |
| `/admin/risk` | `AdminRisk` | relationship_manager, super_admin |
| `/admin/audit` | `AdminAudit` | super_admin |
| `/admin/performance` | `AdminPerformance` | super_admin |
| `*` | Redirect to `/dashboard` | — |

### 4.2 Route Guards

**`ProtectedRoute`** — wraps all authenticated routes. Checks `useAuthStore().isAuthenticated`; redirects to `/login` if false. Shows `<PageLoader>` during rehydration.

**`RoleProtectedRoute`** — accepts `allowedRoles: string[]`. If the user's role is not in the list, redirects to `/dashboard`. Used as a nested `<Route element={...}>` wrapper around groups of admin routes.

**`KYCGuard`** — a component-level guard used inside individual pages (e.g., Payments, Accounts creation). Staff roles and customers with `kyc_status === 'verified'` pass through. Others see a centered card with KYC status message and a button to `/kyc`.

---

## 5. State Management (Zustand)

All stores are in `src/store.ts`. There is no `persist` middleware — state lives in memory only (session is recovered via `authAPI.me()` on mount).

### 5.1 `useAuthStore`

```typescript
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
```

**`User` shape** — `id`, `email`, `full_name`, `phone`, `role`, `kyc_status`, `is_active`, `recovery_email`, `recovery_phone`, `is_first_time_investor`, `is_new_user`, `language`, `theme_mode`, `accessibility`.

- `login(user)` — sets user, `isAuthenticated: true`, `isRehydrating: false`.
- `logout()` — clears user, sets `isAuthenticated: false`.
- `setLanguage(lang)` — updates `user.language` in place.
- `setRehydrating(val)` — used by App.tsx to signal session check completion.

### 5.2 `useUIStore`

```typescript
type ThemeMode = 'linen' | 'midnight' | 'sepia' | 'aurora' | 'graphite';

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

interface AccessibilityState {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  compactDensity: boolean;
  voiceNavigation: boolean;
  screenReader: boolean;
}
```

- `toggleThemeMode()` — cycles through `['linen', 'midnight', 'sepia', 'aurora', 'graphite']`.
- `initializeFromUser(user)` — called after successful `authAPI.me()`. Sets `themeMode` and `accessibility` from saved user profile.
- `resetPreferences()` — resets to defaults (linen, all accessibility off, sidebar open).

---

## 6. API Layer (`src/api.ts`)

Two Axios instances, both with `withCredentials: true` (sends httpOnly cookies automatically):

- **`api`** — `baseURL: '/api/v1'` — main backend
- **`complianceApi`** — `baseURL: '/compliance-api/api/v1'` — compliance RAG sidecar

### 6.1 401 Interceptor

Attached to `api` only. On a 401 response:
1. Skips retry if: `originalRequest._retry === true`, `_skipAuthRefresh === true`, or the URL is an auth route (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/me`, `/auth/behavior-anomaly`).
2. Sets `originalRequest._retry = true`.
3. Calls `POST /auth/refresh` — the refresh token cookie is sent automatically.
4. On success, retries the original request.
5. On failure, redirects to `/login` (unless already there).

### 6.2 Exported API Objects

#### `authAPI`

| Method | HTTP | Endpoint | Notes |
|---|---|---|---|
| `login(email, password, captchaToken?)` | POST | `/auth/login` | |
| `register(data)` | POST | `/auth/register` | Legacy single-step |
| `me(config?)` | GET | `/auth/me` | Accepts `AxiosRequestConfig` |
| `logout()` | POST | `/auth/logout` | |
| `sendOTP()` | POST | `/auth/send-otp` | |
| `verifyOTP(otp)` | POST | `/auth/verify-otp?otp=` | |
| `sendPhoneOtp(phone)` | POST | `/auth/send-phone-otp` | |
| `verifyPhoneOtp(phone, otp)` | POST | `/auth/verify-phone` | |
| `sendEmailOtpForRegistration(email)` | POST | `/auth/register/send-email-otp` | Step 1 of multi-step registration |
| `verifyEmailOtpForRegistration(email, otp)` | POST | `/auth/register/verify-email-otp` | Step 2 |
| `sendPhoneOtpForRegistration(phone)` | POST | `/auth/register/send-phone-otp` | Step 3 |
| `completeRegistration(data)` | POST | `/auth/register/complete` | Final step |
| `updateRecoveryInfo(data)` | PUT | `/auth/recovery-info` | |
| `sendRecoveryOtp(data)` | POST | `/auth/recovery-info/send-otp` | |
| `verifyAndUpdateRecoveryInfo(params)` | POST | `/auth/recovery-info/verify-and-update` | |
| `requestPasswordReset(email)` | POST | `/auth/request-password-reset` | |
| `resetPassword(data)` | POST | `/auth/reset-password` | |
| `updateProfile(data)` | PUT | `/auth/profile` | language, avatar_url, is_new_user, theme_mode, accessibility |

#### `accountsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll()` | GET | `/accounts/` |
| `get(id)` | GET | `/accounts/{id}` |
| `create(data)` | POST | `/accounts/` |
| `linkExternal(data)` | POST | `/accounts/link-external` |
| `freeze(id)` | PUT | `/accounts/{id}/freeze` |
| `unfreeze(id)` | PUT | `/accounts/{id}/unfreeze` |
| `delete(id)` | DELETE | `/accounts/{id}` |

#### `transactionsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll(params?)` | GET | `/transactions/` |
| `get(id)` | GET | `/transactions/{id}` |
| `create(data)` | POST | `/transactions/` |
| `spendingAnalysis(months?)` | GET | `/transactions/spending-analysis` |

#### `paymentsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `initiate(data)` | POST | `/payments/initiate` |
| `verify(paymentId, otp)` | POST | `/payments/verify` |
| `resendOTP(paymentId, otpChannel)` | POST | `/payments/{id}/resend?otp_channel=` |
| `getAll()` | GET | `/payments/` |
| `generateQR(amount, description?)` | GET | `/payments/qr/generate` |

#### `investmentsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll()` | GET | `/investments/` |
| `create(data)` | POST | `/investments/` |
| `delete(id)` | DELETE | `/investments/{id}` |
| `portfolio()` | GET | `/investments/portfolio` |
| `stocks()` | GET | `/investments/stocks` |
| `getGoals()` | GET | `/investments/goals` |
| `createGoal(data)` | POST | `/investments/goals` |
| `deleteGoal(id)` | DELETE | `/investments/goals/{id}` |
| `getSIPs()` | GET | `/investments/sips` |
| `createSIP(data)` | POST | `/investments/sips` |
| `updateSIP(id, data)` | PATCH | `/investments/sips/{id}` |
| `firstTimeTips()` | GET | `/investments/first-time-tips` |
| `markInvested()` | POST | `/investments/mark-invested` |
| `news()` | GET | `/investments/news` |
| `smartGoalInsights()` | GET | `/investments/goals/smart-insights` |

#### `loansAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `apply(data)` | POST | `/loans/apply` |
| `getAll()` | GET | `/loans/` |

#### `mlAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `recommendations()` | GET | `/ml/recommendations` |
| `fraudCheck(data)` | POST | `/ml/fraud-check` |
| `spendingInsights()` | GET | `/ml/spending-insights` |
| `accountInsights()` | GET | `/ml/account-insights` |
| `sipInsights()` | GET | `/ml/sip-insights` |
| `assetInsights()` | GET | `/ml/asset-insights` |
| `loanInsights()` | GET | `/ml/loan-insights` |
| `whatifScenario(scenarioType, customQuery?)` | POST | `/ml/whatif-scenario` |
| `chatbot(message)` | POST | `/ml/chatbot` |
| `classifyTransaction(text)` | POST | `/ml/classify-transaction` |
| `behavioralAnomaly(behaviorData, email?, options?)` | POST | `/ml/behavior-anomaly` |
| `voiceAgent(message)` | POST | `/ml/voice-agent` |
| `forecastCashflow(days?)` | POST | `/ml/forecast-cashflow` |

The `behavioralAnomaly` call passes `{ _skipAuthRefresh: true }` as `AxiosRequestConfig` when `options.skipAuthRefresh` is true, preventing the 401 interceptor from triggering a redirect during auth flows.

#### `complianceAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `query(text)` | POST | `/compliance/query` (sidecar) |

#### `kycAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `upload(aadhaarFront, aadhaarBack, pan, aadhaarNumber?, panNumber?)` | POST | `/kyc/upload` |
| `getStatus()` | GET | `/kyc/status` |

#### `adminAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getUsers(params?)` | GET | `/admin/users` |
| `updateRole(userId, role)` | PUT | `/admin/users/{id}/role?role=` |
| `deactivateUser(userId)` | PUT | `/admin/users/{id}/deactivate` |
| `activateUser(userId)` | PUT | `/admin/users/{id}/activate` |
| `getPendingKYC()` | GET | `/admin/kyc/pending` |
| `getEscalatedKYC()` | GET | `/admin/kyc/escalated` |
| `kycAction(userId, action, comments?)` | PUT | `/admin/kyc/{id}/action` |
| `getAllLoans(status?)` | GET | `/admin/loans` |
| `approveLoan(loanId)` | PUT | `/admin/loans/{id}/approve` |
| `rejectLoan(loanId)` | PUT | `/admin/loans/{id}/reject` |
| `getFraudAlerts()` | GET | `/admin/fraud-alerts` |
| `resolveFraudAlert(alertId, resolution)` | PUT | `/admin/fraud-alerts/{id}/resolve?resolution=` |
| `getAuditLogs()` | GET | `/admin/audit-logs` |
| `getAnalytics()` | GET | `/admin/analytics` |
| `getInsiderThreats()` | GET | `/admin/insider-threat-check` |
| `getNotificationSummary()` | GET | `/employee/notifications/summary` |
| `getRiskSummary()` | GET | `/risk/summary` |
| `getPerformance(params?)` | GET | `/admin/performance` |

#### `notificationsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll()` | GET | `/notifications/` |
| `markRead(id)` | PUT | `/notifications/{id}/read` |
| `markAllRead()` | PUT | `/notifications/read-all` |
| `getAlerts(isRead?)` | GET | `/notifications/alerts` |
| `markAlertRead(id)` | PUT | `/notifications/alerts/{id}/read` |
| `getUnreadAlertsCount()` | GET | `/notifications/alerts/unread-count` |

#### `securityAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `reportUnauthorizedLogin()` | POST | `/auth/security/report` |
| `getKnownDevices()` | GET | `/auth/devices` |

#### `sessionsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getActiveSessions()` | GET | `/sessions` |
| `revokeSession(sessionId)` | DELETE | `/sessions/{id}` |
| `revokeAllSessions()` | DELETE | `/sessions` |

#### `aaAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `requestConsent()` | POST | `/aa/consent/request` |
| `getConsentStatus(consentId)` | GET | `/aa/consent/{id}` |
| `getAccounts()` | GET | `/aa/accounts` |
| `getTransactions(accountId)` | GET | `/aa/transactions/{id}` |

#### `assetsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll()` | GET | `/assets/` |
| `create(data)` | POST | `/assets/` |
| `delete(id)` | DELETE | `/assets/{id}` |
| `getNetWorthSummary()` | GET | `/assets/net-worth-summary` |

#### `budgetsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAll()` | GET | `/budgets/` |
| `create(data)` | POST | `/budgets/` |
| `delete(id)` | DELETE | `/budgets/{id}` |

#### `familyAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `invite(inviteeEmail)` | POST | `/family/invite` |
| `respond(invitationId, action)` | POST | `/family/respond` |
| `setLimit(memberUserId, spendingLimit)` | POST | `/family/set-limit` |
| `getMyFamily()` | GET | `/family/my-family` |
| `getPendingInvitations()` | GET | `/family/invitations` |
| `removeMember(memberUserId)` | DELETE | `/family/member/{id}` |

#### `creditAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getScore()` | GET | `/credit/score` |

#### `agentsAPI`

| Method | HTTP | Endpoint |
|---|---|---|
| `getAdvisorAdvice(payload)` | POST | `/agents/advisor` |
| `getDailyLessons(payload)` | POST | `/agents/teacher` |

---

## 7. Pages

### 7.1 Customer Pages

| Page | Path | Primary APIs Used | Description |
|---|---|---|---|
| `Login` | `/login` | `authAPI.login`, `mlAPI.behavioralAnomaly` | Email/password login with Turnstile CAPTCHA. Collects biometric data via `useBiometrics` and sends to ML anomaly check. |
| `Register` | `/register` | `authAPI.sendEmailOtpForRegistration`, `authAPI.verifyEmailOtpForRegistration`, `authAPI.sendPhoneOtpForRegistration`, `authAPI.completeRegistration` | Multi-step: email OTP → phone OTP → details form with Turnstile. |
| `ForgotPassword` | `/forgot-password` | `authAPI.requestPasswordReset`, `authAPI.resetPassword` | Request OTP by email, then submit new password. |
| `SecurityAlert` | `/security/alert` | `securityAPI.reportUnauthorizedLogin` | Shown when a suspicious login is detected; lets user report it. |
| `Dashboard` | `/dashboard` | `accountsAPI.getAll`, `transactionsAPI.getAll`, `mlAPI.spendingInsights`, `mlAPI.forecastCashflow`, `adminAPI.getAnalytics`, `mlAPI.classifyTransaction` | Role-aware: customers see account balance cards, spending area chart, 30-day cashflow forecast chart, and a live ML transaction classifier demo. Admins see aggregate analytics. |
| `Accounts` | `/accounts` | `accountsAPI.*`, `transactionsAPI.getAll` | Lists all internal and linked external accounts. Create new account (savings/current/fixed deposit), link external by IFSC + account number, freeze/unfreeze, delete. |
| `Transactions` | `/transactions` | `transactionsAPI.*` | Full transaction list with filters (account, category). Create new debit/credit transaction. Spending analysis chart by category. |
| `Payments` | `/payments` | `paymentsAPI.*`, `accountsAPI.getAll` | UPI VPA or account number transfers. Two-step: initiate → OTP verify. QR code generator. OTP resend with channel selection. Payment history. |
| `Investments` | `/investments` | `investmentsAPI.getAll`, `investmentsAPI.portfolio`, `investmentsAPI.stocks`, `investmentsAPI.news`, `investmentsAPI.create`, `investmentsAPI.delete` | Portfolio overview with live NSE stock quotes (via Yahoo Finance). Add/remove positions. Market news from Economic Times RSS. |
| `Goals` | `/goals` | `investmentsAPI.getGoals`, `investmentsAPI.createGoal`, `investmentsAPI.deleteGoal`, `investmentsAPI.smartGoalInsights` | Financial goal tracker with progress bars. Groq-powered smart insights on achievability. |
| `SIPs` | `/sips` | `investmentsAPI.getSIPs`, `investmentsAPI.createSIP`, `investmentsAPI.updateSIP` | SIP management: create with fund name, category, amount, frequency, start date, step-up %, and optional goal linkage. Pause/resume/stop. |
| `Loans` | `/loans` | `loansAPI.*` | Apply for personal, home, vehicle, education, or business loans. Shows EMI calculation. Lists existing loans. Requires KYC. |
| `Recommendations` | `/recommendations` | `mlAPI.recommendations` | Groq LLM-generated financial recommendations based on account/transaction context. Cached 5 minutes in Redis. |
| `WhatIf` | `/ai/scenarios` | `mlAPI.whatifScenario` | AI scenario planning: predefined scenario types (e.g., "save more", "invest in equity") or custom free-text query. Groq returns structured projection. |
| `AIAgents` | `/ai/agents` | `agentsAPI.getAdvisorAdvice`, `agentsAPI.getDailyLessons` | Two AI agents: WealthAdvisor (financial advice from real account profile) and WealthTeacher (personalised financial literacy lessons based on transaction history). |
| `KYCSubmission` | `/kyc` | `kycAPI.upload`, `kycAPI.getStatus` | Upload Aadhaar front/back and PAN as base64 images. Shows current KYC status. |
| `Sessions` | `/sessions` | `sessionsAPI.*` | Lists active sessions by device/IP/time. Revoke individual session or all-except-current. |
| `AccountAggregator` | `/account-aggregator` | `aaAPI.*` | Request consent, check consent status, view linked accounts across PNB/SBI/HDFC/ICICI (mock AA service). |
| `AssetVault` | `/asset-vault` | `assetsAPI.*` | Track physical assets (property, gold, vehicle, jewellery, other). Net worth summary = liquid + investments + physical assets. |
| `Budgets` | `/budgets` | `budgetsAPI.*` | Set monthly spending limits per category. Status indicators: healthy (< 80%), warning (80–100%), exceeded (> 100%). |
| `Family` | `/family` | `familyAPI.*` | Create family group by inviting members by email. Accept/reject invitations. Set per-member spending limits. Family head can remove members. |
| `CreditScore` | `/credit-score` | `creditAPI.getScore` | Displays score 300–900 with rating (Good/Average/Poor) and contributing factors: loan burden, high-risk transactions, income vs. spend ratio, balance level. |
| `TaxHelper` | `/tax` | No direct API (derived from investment data) | 80C tax instrument overview (ELSS, PPF, NSC, tax-saver FD, ULIP, NPS). Shows ₹1,50,000 limit and potential savings at 30% bracket. |
| `Settings` | `/settings` | `authAPI.updateProfile`, `authAPI.sendRecoveryOtp`, `authAPI.verifyAndUpdateRecoveryInfo` | Theme selection, accessibility toggles, language picker, recovery email/phone update with OTP verification. |
| `FAQ` | `/faq` | None | Static FAQ content. |
| `Support` | `/support` | None | Contact / support request form. |
| `DataPrivacy` | `/data-privacy` | None | Data privacy policy and DPDP compliance statement. |
| `Learn` | `/learn` | `agentsAPI.getDailyLessons` | Financial Learning Hub powered by WealthTeacher agent. Daily personalised lessons. |

### 7.2 Admin Pages

| Page | Path | Roles | Primary APIs |
|---|---|---|---|
| `AdminNotifications` | `/admin/notifications` | employee+ | `adminAPI.getNotificationSummary` |
| `AdminKYCReview` | `/admin/kyc` + `/admin/kyc/escalated` | employee+ | `adminAPI.getPendingKYC`, `adminAPI.getEscalatedKYC`, `adminAPI.kycAction` |
| `AdminLoans` | `/admin/loans` | employee+ | `adminAPI.getAllLoans`, `adminAPI.approveLoan`, `adminAPI.rejectLoan` |
| `AdminFraud` | `/admin/fraud` | employee+ | `adminAPI.getFraudAlerts`, `adminAPI.resolveFraudAlert` |
| `AdminUsers` | `/admin/users` | relationship_manager+ | `adminAPI.getUsers`, `adminAPI.updateRole`, `adminAPI.deactivateUser`, `adminAPI.activateUser` |
| `AdminAnalytics` | `/admin/analytics` | relationship_manager+ | `adminAPI.getAnalytics` |
| `AdminRisk` | `/admin/risk` | relationship_manager+ | `adminAPI.getRiskSummary` |
| `AdminAudit` | `/admin/audit` | super_admin | `adminAPI.getAuditLogs` |
| `AdminPerformance` | `/admin/performance` | super_admin | `adminAPI.getPerformance` |
| `AdminKYC` | (internal) | — | KYC detail view sub-component |

---

## 8. Custom Hooks

### `useBiometrics` (`src/hooks/useBiometrics.ts`)

Collects 12 behavioural biometric signals in real time using DOM event listeners. Returns a `BiometricData` object sent to `mlAPI.behavioralAnomaly` during login.

| Signal | Collection Method |
|---|---|
| `tap_pressure` | `PointerEvent.pressure` (averaged); defaults to 0.5 on unsupported devices |
| `tap_duration_ms` | `pointerdown` to `pointerup` delta (averaged) |
| `finger_area_px` | `PointerEvent.width * height` (averaged); defaults to 20 |
| `scroll_velocity_px_s` | `scroll` event: `distance / timeDiff` (running average) |
| `scroll_acceleration` | `abs(velocity - previousVelocity) / timeDiff` |
| `keystroke_interval_ms` | `keydown` intervals, EWMA 80/20 |
| `error_rate` | `backspaceCount / keystrokeCount` |
| `nav_time_per_screen_s` | Updated every 1 second via `setInterval` |
| `session_entropy` | Increments +0.01 per keystroke, capped at 1.0 |
| `hesitation_events` | `keystroke_interval > 2000ms` counts as a hesitation |
| `copy_paste_detected` | `copy` or `paste` event sets to 1 |
| `tab_switch_count` | `document.hidden` on `visibilitychange` |

All event handlers are stable (created once with `useCallback`, use refs not state) to avoid repeated listener re-registration.

### `useTranslation` (`src/hooks/useTranslation.ts`)

Reads `user.language` from `useAuthStore`. Maps to a key in `translations` object. Returns:
- `t(path: string)` — dot-notation key lookup (e.g., `t('kyc.required')`). Falls back to English if key missing in current language; returns `path` as string if missing in English too.
- `lang` — resolved language code (`en`, `hi`, or `pa`).

### `useVoiceNavigation` (`src/hooks/useVoiceNavigation.ts`)

Activates the browser's `SpeechRecognition` / `webkitSpeechRecognition` API when `isActive: true`. Listens for continuous speech and routes commands:

| Voice Command | Action |
|---|---|
| "go to dashboard" / "home" | Navigate to `/dashboard` |
| "go to accounts" / "show accounts" | Navigate to `/accounts` |
| "go to transactions" / "show transactions" | Navigate to `/transactions` |
| "go to payments" / "make a payment" | Navigate to `/payments` |
| "go to investments" | Navigate to `/investments` |
| "go to settings" | Navigate to `/settings` |

Uses `react-hot-toast` for confirmation messages. Gracefully degrades if the browser does not support the API.

### `useScreenReader` (`src/hooks/useScreenReader.ts`)

Activates browser `SpeechSynthesis` when `accessibility.screenReader` is true. On `mouseover` (400ms debounce) and `focusin`, reads the element's `aria-label`, `alt`, or inner text aloud, prefixed by element type (e.g., "Submit. button"). Highlights the hovered element with a yellow `outline: 3px solid #facc15` via injected CSS class `.sr-highlight`. Injected style tag is removed when the hook is deactivated.

---

## 9. Localisation

**Supported languages**: `en` (English), `hi` (Hindi), `pa` (Punjabi)

**Implementation**:
- All strings live in `src/lib/translations.ts` as a nested object keyed by language code.
- `useTranslation` hook provides `t(path)` for dot-notation access.
- Language is stored in `user.language` (persisted to backend via `authAPI.updateProfile`).
- Changed via the language picker in `Settings.tsx` which calls `authAPI.updateProfile({ language })` and `setLanguage(lang)` in the auth store.
- Fallback chain: current language → English → raw path string.

Translation keys cover at minimum: `common`, `nav`, `profile`, `appearance`, `accessibility`, `dashboard`, `header`, `accounts`, `kyc`.

---

## 10. Theming

### 10.1 Theme Modes

Five themes are available, set via `useUIStore.setThemeMode()` or cycled with `toggleThemeMode()`:

| Key | Name | Description |
|---|---|---|
| `linen` | Linen | Bright editorial light surface (default) |
| `midnight` | Midnight | High-contrast dark mode |
| `sepia` | Sepia | Warm low-glare reading mode |
| `aurora` | Aurora | Color-rich gradient accents |
| `graphite` | Graphite | Neutral executive dark mode |

### 10.2 Application

`PreferenceApplier` (renders `null`, runs as a side-effect component inside `AppLayout`) applies data attributes on mount and on every change:

```
document.documentElement.dataset.theme = themeMode
document.documentElement.dataset.motion = 'reduce' | 'full'
document.documentElement.dataset.contrast = 'high' | 'normal'
document.documentElement.dataset.density = 'compact' | 'comfortable'
document.documentElement.style.setProperty('--font-scale', '1.18' | '1')
```

CSS in `index.css` uses `[data-theme="midnight"]`, `[data-contrast="high"]`, etc. selectors to swap CSS custom properties (`--bg-base`, `--text-primary`, `--border-color`, etc.).

### 10.3 Chart Theme

`src/theme/chartTheme.ts` exports:
- `CHART_COLORS` — named colour map (primary, secondary, accent, danger, success, violet, cyan, rose)
- `CHART_PALETTE` — 8-colour ordered array for multi-series charts
- `CHART_GRID` — `rgba(100, 116, 139, 0.18)` grid line colour
- `CHART_AXIS` — `#64748b` axis text colour

---

## 11. Accessibility Features

Configurable in `Settings.tsx`, all persisted to backend via `authAPI.updateProfile`:

| Feature | Store Key | Effect |
|---|---|---|
| Reduced Motion | `reducedMotion` | `data-motion="reduce"` on root; CSS disables transitions and animations |
| High Contrast | `highContrast` | `data-contrast="high"` on root; CSS boosts contrast ratios |
| Large Text | `largeText` | `--font-scale: 1.18` CSS variable on root |
| Compact Density | `compactDensity` | `data-density="compact"` on root; CSS reduces padding/margins |
| Voice Navigation | `voiceNavigation` | Activates `useVoiceNavigation` hook — speech-to-route |
| Screen Reader | `screenReader` | Activates `useScreenReader` hook — hover-to-speak with yellow highlight |

---

## 12. Component Library

### Shared Components

| Component | Location | Purpose |
|---|---|---|
| `Sidebar` | `components/Sidebar.tsx` | Navigation sidebar with role-aware menu items, collapsible |
| `Header` | `components/Header.tsx` | Top bar with page title, notification bell, user menu |
| `Chatbot` | `components/Chatbot.tsx` | Floating AI chatbot backed by `mlAPI.chatbot` |
| `NotificationBell` | `components/NotificationBell.tsx` | Real-time notification badge using `notificationsAPI` |
| `AlertBanner` | `components/AlertBanner.tsx` | Full-width dismissible alert strip |
| `NavigationTour` | `components/NavigationTour.tsx` | Guided first-time onboarding tour |
| `KYCGuard` | `components/KYCGuard.tsx` | Component-level KYC gate (see §4.2) |
| `RoleProtectedRoute` | `components/RoleProtectedRoute.tsx` | Route-level role check (see §4.2) |
| `TurnstileWidget` | `components/TurnstileWidget.tsx` | Cloudflare Turnstile CAPTCHA wrapper |
| `Footer` | `components/Footer.tsx` | Page footer (public pages) |
| `PublicFooter` | `components/PublicFooter.tsx` | Slimmer footer for public auth pages |

### UI Primitives (`components/ui/`)

| Component | Purpose |
|---|---|
| `PageHeader` | Standardised page title + subtitle block |
| `SettingToggle` | Accessible toggle switch for settings page |
| `button` | Base button component with CVA variants |
| `map` | MapLibre GL map wrapper |

### Animation (`components/animation/`)

| Component | Purpose |
|---|---|
| `Motion3D` | Framer Motion 3D tilt card effect |
| `PageLoader` | Full-screen spinner with optional label; shown during session rehydration |

### Layout (`components/layout/`)

| Component | Purpose |
|---|---|
| `PreferenceApplier` | Applies theme/accessibility data attributes on every change |
| `AppFooter` | In-app footer rendered inside the authenticated layout |

---

## 13. TanStack React Query Usage

`QueryClient` is configured with:
- `retry: 1` — one automatic retry on failure
- `staleTime: 5 * 60 * 1000` — data considered fresh for 5 minutes

Pages that use TanStack Query (as opposed to plain `useState + useEffect`) benefit from automatic background refetching and cache deduplication. The `QueryClientProvider` wraps the entire app in `App.tsx`.
