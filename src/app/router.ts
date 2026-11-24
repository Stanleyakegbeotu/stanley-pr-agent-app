/**
 * Tiny hash router — works from a file, a web server or inside a native
 * wrapper. navigate() pushes a screen; back() returns to the previous one
 * (or the screen's parent when there is no in-app history).
 */
import { useCallback, useEffect, useState } from 'react';
import { parentOf, type Route, type RoutePath } from './routes';

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = p!.startsWith('/') ? p! : `/${p}`;
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

/** How many screens deep we are inside the app this session (0 = first screen). */
let depth = 0;

export function useRouter() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    // The phone's / browser's back button (and our own back()) both arrive here.
    const pop = () => {
      depth = Math.max(0, depth - 1);
      setRoute(parse());
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', pop);
    };
  }, []);

  const navigate = useCallback((to: RoutePath | string, opts: { replace?: boolean } = {}) => {
    const hash = `#${to}`;
    if (hash === window.location.hash) return;
    if (opts.replace) window.history.replaceState(null, '', hash);
    else {
      depth += 1;
      window.history.pushState(null, '', hash);
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  const back = useCallback(() => {
    if (depth > 0) window.history.back();
    else navigate(parentOf(parse()), { replace: true });
  }, [navigate]);

  return { route, navigate, back };
}
