/**
 * Every screen in the app. A path is what shows after "#" in the address
 * (e.g. #/referrals/ABJ-R000842), so back/forward and refresh work like a
 * native app's navigation stack. In the React Native version each of these
 * becomes a stack screen with the same name.
 */
export type RoutePath =
  | '/'
  | '/services'
  | `/services/${string}`
  | '/refer'
  | '/refer/services'
  | '/refer/clinical'
  | '/refer/summary'
  | `/refer/done/${string}`
  | '/referrals'
  | `/referrals/${string}`
  | '/results'
  | `/results/${string}`
  | '/privacy'
  | `/legal/${string}`
  | '/campaigns'
  | '/branch'
  | '/messages'
  | `/messages/${string}`
  | '/announcements'
  | '/notifications'
  | '/help'
  | '/training'
  | `/training/${string}`
  | '/profile'
  | '/settings'
  | '/reports'
  | `/profile/${string}`;

export interface Route {
  path: string;
  /** Path parts: "/referrals/ABJ-R000842" → ["referrals", "ABJ-R000842"]. */
  parts: string[];
  query: URLSearchParams;
}

/** Bottom-tab a route belongs to (for the highlighted tab). */
export type Tab = 'home' | 'referrals' | 'refer' | 'results' | 'catalogue' | 'more';
export function tabOf(r: Route): Tab | null {
  const p = r.parts[0] ?? '';
  if (p === '') return 'home';
  if (p === 'referrals') return 'referrals';
  if (p === 'refer') return 'refer';
  if (p === 'results') return 'results';
  if (p === 'services') return 'catalogue';
  return null;
}

/** Where "back" goes when there is no earlier screen (opened from a link). */
export function parentOf(r: Route): RoutePath {
  const [a, b] = r.parts;
  if (!a) return '/';
  if (a === 'services' && b) return '/services';
  if (a === 'referrals' && b) return '/referrals';
  if (a === 'messages' && b) return '/messages';
  if (a === 'training' && b) return '/training';
  if (a === 'profile' && b) return '/profile';
  if (a === 'results' && b) return '/results';
  if (a === 'legal') return '/privacy';
  if (a === 'refer' && b === 'clinical') return '/refer/services';
  if (a === 'refer' && b === 'summary') return '/refer/clinical';
  if (a === 'refer' && b === 'services') return '/refer';
  return '/';
}
