import type { BehaviorEvent } from './store';
import { usePhishingStore } from './store';
import portalApi from './api';

let flushTimer: ReturnType<typeof setInterval> | null = null;
let pendingFlush: BehaviorEvent[] = [];

function getCurrentPage(): string {
  return window.location.pathname;
}

export function track(type: string, data: Record<string, unknown> = {}) {
  const event: BehaviorEvent = {
    type,
    page: getCurrentPage(),
    data,
    ts: Date.now(),
  };
  usePhishingStore.getState().addEvent(event);
  pendingFlush.push(event);
}

export function adjustScore(delta: number) {
  usePhishingStore.getState().adjustScore(delta);
}

async function flush() {
  const { context, jwt } = usePhishingStore.getState();
  if (!context || !jwt || pendingFlush.length === 0) return;

  const batch = [...pendingFlush];
  pendingFlush = [];

  try {
    await portalApi.post(`/api/sim/behavior/${context.attempt_id}`, { events: batch });
  } catch {
    // best-effort — put back on failure
    pendingFlush = [...batch, ...pendingFlush];
  }
}

export function startTracker() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, 5000);

  // flush on page navigation
  window.addEventListener('beforeunload', () => {
    flush();
  });

  // track scroll depth
  let maxScroll = 0;
  window.addEventListener('scroll', () => {
    const pct = Math.round(
      ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
    );
    if (pct > maxScroll + 10) {
      maxScroll = pct;
      track('scroll_depth', { percent: pct });
    }
  });
}

export function stopTracker() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush();
}

// Track page visits with timing
const pageEnterTimes: Record<string, number> = {};

export function trackPageEnter(page: string) {
  pageEnterTimes[page] = Date.now();
  track('page_visit', { page });
}

export function trackPageLeave(page: string) {
  const enter = pageEnterTimes[page];
  if (enter) {
    const duration = Math.round((Date.now() - enter) / 1000);
    track('page_leave', { page, duration_seconds: duration });
    delete pageEnterTimes[page];
  }
}

export function trackFormFocus(field: string) {
  track('form_field_focus', { field });
}

export function trackFormInput(field: string, isSensitive = false) {
  track('form_field_input', { field, is_sensitive: isSensitive });
  if (isSensitive) adjustScore(-5);
}

export function trackFormSubmit(formName: string, fields: string[]) {
  track('form_submit', { form: formName, fields });
}

export function trackClick(element: string, data?: Record<string, unknown>) {
  track('click', { element, ...data });
}

export function trackPhishingEmailOpened(emailId: string) {
  track('phishing_email_opened', { email_id: emailId });
  adjustScore(-10);
}

export function trackLinkClicked(url: string) {
  track('link_clicked', { url });
}

export function trackReportPhishing() {
  track('reported_phishing', { action: 'user_reported' });
  adjustScore(+40);
}

export function trackCredentialsSubmitted() {
  track('credentials_submitted', {});
  adjustScore(-40);
}

export function trackTaskCompleted(taskName: string) {
  track('task_completed', { task: taskName });
  adjustScore(-60);
}
