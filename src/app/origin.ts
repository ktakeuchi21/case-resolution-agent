export function configuredPublicOrigin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromRender = !env.PUBLIC_ORIGIN && env.RENDER === 'true';
  const raw = env.PUBLIC_ORIGIN || (fromRender ? env.RENDER_EXTERNAL_URL : undefined);
  if (!raw) {
    if (env.NODE_ENV === 'production') throw new Error('PUBLIC_ORIGIN_REQUIRED');
    return undefined;
  }
  let origin: URL;
  try { origin = new URL(raw); } catch { throw new Error('PUBLIC_ORIGIN_INVALID'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.origin !== raw || origin.username || origin.password ||
    (origin.protocol !== 'https:' && !(loopback && origin.protocol === 'http:')) ||
    (fromRender && (origin.protocol !== 'https:' || !origin.hostname.endsWith('.onrender.com')))) throw new Error('PUBLIC_ORIGIN_INVALID');
  return raw;
}

export function configuredFrontendOrigin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!env.FRONTEND_ORIGIN) return undefined;
  try { return configuredPublicOrigin({NODE_ENV:env.NODE_ENV, PUBLIC_ORIGIN:env.FRONTEND_ORIGIN}); }
  catch { throw new Error('FRONTEND_ORIGIN_INVALID'); }
}
