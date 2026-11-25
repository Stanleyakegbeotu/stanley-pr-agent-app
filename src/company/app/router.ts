/**
 * MOBILE adapter for the desktop's hash router (NOT generated: the sync
 * script keeps this file). The desktop company logic (AppState) reads the
 * route to know which branch workspace is open. In the mobile app the admin
 * pages live under "#/admin/...", so "#/admin/branch/br001-abuja/billing" is
 * the desktop's "/branch/br001-abuja/billing".
 */
import { useCallback, useEffect, useState } from 'react';

export interface Route {
  /** Desktop-style path without query, e.g. "/dashboard" or "/branch/br001-abuja/billing". */
  path: string;
  segments: string[];
  query: URLSearchParams;
}

const PREFIX = '/admin';
const DEFAULT_PATH = '/dashboard';

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  const [pathPart = '', queryPart = ''] = raw.split('?');
  const inner = pathPart.startsWith(PREFIX) ? pathPart.slice(PREFIX.length) : '';
  const path = inner && inner !== '/' ? inner : DEFAULT_PATH;
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(queryPart) };
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((to: string) => {
    const target = `#${PREFIX}${to.startsWith('/') ? to : `/${to}`}`;
    if (target !== window.location.hash) window.location.hash = target;
  }, []);
  return { route, navigate };
}

/** "/branch/:id/..." → { branchId, page } */
export function branchRoute(route: Route): { branchId: string; page: string } | null {
  if (route.segments[0] !== 'branch' || !route.segments[1]) return null;
  return { branchId: route.segments[1], page: route.segments[2] ?? 'dashboard' };
}
