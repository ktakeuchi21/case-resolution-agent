import { overviewOrigin, workspaceOrigin } from './hosting.js';

export const analyticsPages = Object.freeze({
  home: 'Overview', approach: 'Approach', knowledge: 'Choose Knowledge',
  agent: 'Chat', workspace: 'Case Workspace', studio: 'Knowledge Studio',
  evidence: 'Evidence', review: 'Human Review', tour: 'Walkthrough',
  settings: 'Settings', evaluation: 'Evaluation',
});
const origins = new Set([overviewOrigin, workspaceOrigin]);
const websiteIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const isPage = route => Object.hasOwn(analyticsPages, route);

export function analyticsPermitted(scope) {
  try {
    if (!origins.has(scope.location.origin)) return false;
    const dnt = [scope.doNotTrack, scope.navigator.doNotTrack, scope.navigator.msDoNotTrack];
    if (dnt.some(value => ['1', 'yes'].includes(String(value))) || scope.navigator.globalPrivacyControl === true) return false;
    return !scope.localStorage.getItem('umami.disabled');
  } catch { return false; } // Unreadable privacy preferences fail closed.
}

// Construct rather than spread a browser/vendor payload. URLs, titles, referrers,
// app state and user content are never used as analytics fields.
export function pagePayload(route, websiteId, scope) {
  if (!isPage(route) || !websiteIdPattern.test(websiteId ?? '') || !analyticsPermitted(scope)) return null;
  const language = String(scope.navigator.language ?? '');
  const width = Number(scope.screen.width), height = Number(scope.screen.height);
  return {
    website: websiteId,
    hostname: new URL(scope.location.origin).hostname,
    url: route === 'home' ? '/' : '/' + route,
    title: analyticsPages[route],
    referrer: '',
    ...(/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i.test(language) ? { language } : {}),
    ...(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 16384 && height <= 16384 ? { screen: `${width}x${height}` } : {}),
  };
}

export function createPageAnalytics({ websiteId, scope = window } = {}) {
  const configured = websiteIdPattern.test(websiteId ?? '');
  let observedRoute = null, counted = false, paused = false, failed = false;
  let loading = null, tracker = null, pending = [];
  const allowed = () => configured && !paused && !failed && analyticsPermitted(scope);
  const send = payload => {
    if (!allowed()) return;
    try { void Promise.resolve(tracker.track(payload)).catch(() => {}); } catch { /* Analytics never interrupts the app. */ }
  };
  function load() {
    if (loading || !allowed()) return;
    loading = new Promise(resolve => {
      let script, timer, settled = false;
      const finish = value => {
        if (settled) return;
        settled = true; scope.clearTimeout(timer);
        if (!value) { failed = true; script?.remove(); }
        resolve(value);
      };
      // Allow the actual page to paint before loading the reviewed local tracker.
      scope.requestAnimationFrame(() => scope.setTimeout(() => {
        if (!allowed()) { finish(null); return; }
        script = scope.document.createElement('script');
        script.async = true;
        script.src = '/vendor/umami.js';
        script.dataset.websiteId = websiteId;
        script.dataset.hostUrl = 'https://gateway.umami.is';
        script.dataset.autoTrack = 'false';
        script.dataset.autoPageview = 'false';
        script.dataset.performance = 'false';
        script.dataset.doNotTrack = 'true';
        script.dataset.excludeSearch = 'true';
        script.dataset.excludeHash = 'true';
        script.dataset.fetchCredentials = 'omit';
        script.dataset.domains = [...origins].map(origin => new URL(origin).hostname).join(',');
        script.addEventListener('load', () => finish(typeof scope.umami?.track === 'function' ? scope.umami : null), { once: true });
        script.addEventListener('error', () => finish(null), { once: true });
        timer = scope.setTimeout(() => finish(null), 10000);
        scope.document.head.append(script);
      }, 0));
    }).then(value => {
      tracker = value;
      const buffered = pending; pending = [];
      if (tracker && allowed()) buffered.forEach(send);
    }).catch(() => { failed = true; pending = []; });
  }
  return {
    configured,
    view(route, ready = true) {
      try {
        if (route !== observedRoute) { observedRoute = route; counted = false; }
        if (!ready || counted || !allowed()) return;
        const payload = pagePayload(route, websiteId, scope);
        if (!payload) return;
        counted = true;
        if (tracker) send(payload);
        else {
          // Bounded, memory-only buffering; never persist or replay failed sends.
          if (pending.length < 20) pending.push(payload);
          load();
        }
      } catch { /* Optional analytics must never break rendering. */ }
    },
    pause() { paused = true; pending = []; },
    resume() { paused = false; observedRoute = null; counted = false; },
    excluded() {
      try { return !!scope.localStorage.getItem('umami.disabled'); } catch { return true; }
    },
    exclude() {
      pending = [];
      try { scope.localStorage.setItem('umami.disabled', '1'); return true; } catch { return false; }
    },
  };
}
