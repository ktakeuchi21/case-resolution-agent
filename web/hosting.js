// Public deployment addresses are fixed, never supplied by query parameters or storage.
export const overviewOrigin = 'https://case-resolution-frontend.onrender.com';
export const workspaceOrigin = 'https://case-resolution-agent.onrender.com';
const routes = new Set(['knowledge','workspace','agent','studio','evidence','review','tour','settings','evaluation']);
const scenario = value => ['golden','exception','retirement'].includes(value) ? value : 'golden';

export function workspaceDestination(origin, intent) {
  if (origin !== overviewOrigin) return null;
  const destination = new URL(workspaceOrigin);
  destination.hash = routes.has(intent.target) ? intent.target : 'workspace';
  destination.searchParams.set('entryScenario', scenario(intent.scenario));
  destination.searchParams.set('entryStarted', String(intent.startedAt));
  return destination.href;
}

export function readWorkspaceEntry(href, now = Date.now()) {
  const url = new URL(href);
  if (url.origin !== workspaceOrigin || !url.searchParams.has('entryStarted')) return null;
  const started = Number(url.searchParams.get('entryStarted'));
  const intent = {scenario:scenario(url.searchParams.get('entryScenario')), startedAt:Number.isFinite(started) ? Math.max(now - 90000, Math.min(now, started)) : now};
  url.searchParams.delete('entryScenario');url.searchParams.delete('entryStarted');
  return {intent, cleanUrl:url.href};
}

export const overviewDestination = origin => origin === workspaceOrigin ? overviewOrigin + '/#home' : '#home';
