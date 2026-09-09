// Readiness is shared by the landing page and workspace entry. No keep-alive loop.
export function waitFor(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once:true});
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function createReadiness() {
  let pending = null, controller = null, readyAt = 0;
  const check = (signal) => {
    if (!pending && readyAt && Date.now() - readyAt < 30000) return waitFor(Promise.resolve(), signal);
    if (!pending) {
      controller = new AbortController();
      const attempt = controller, deadline = setTimeout(() => attempt.abort(new Error('The demo is taking longer than expected. Retry the connection.')), 90000);
      pending = (async () => {
        let tries = 0;
        while (!attempt.signal.aborted) {
          try {
            const response = await fetch('/healthz', {cache:'no-store', credentials:'omit', signal:AbortSignal.any([attempt.signal, AbortSignal.timeout(15000)])});
            const body = response.ok && response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
            if (body?.status === 'ok' && body?.service === 'pathway-agent') { readyAt = Date.now(); return; }
          } catch { /* A sleeping service can return HTML, a network error or a timeout. */ }
          if (attempt.signal.aborted) break;
          const delay = [2000, 5000, 10000][Math.min(tries++, 2)];
          await new Promise((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(attempt.signal.reason); };
            const timer = setTimeout(() => { attempt.signal.removeEventListener('abort', abort); resolve(); }, delay);
            attempt.signal.addEventListener('abort', abort, {once:true});
          });
        }
        throw attempt.signal.reason;
      })().finally(() => { clearTimeout(deadline); pending = null; controller = null; });
    }
    return waitFor(pending, signal);
  };
  return {check, invalidate:() => { readyAt = 0; }, stop:() => controller?.abort(new DOMException('Page closed', 'AbortError'))};
}
