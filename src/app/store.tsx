/**
 * App state shared by every screen:
 *  • navigation (router),
 *  • referrals — the agent's own (saved on this phone, queued for the cloud)
 *    plus sample activity,
 *  • the referral being written (draft — survives leaving the screen or a
 *    refresh, so nothing typed is lost),
 *  • toasts.
 *
 * Offline-first: everything the agent creates is written to this phone first
 * (localStorage "stanley.pr.v1"). The cloud database isn't connected yet, so
 * new referrals stay "waiting to send".
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sampleReferrals } from '@/data/referrals';
import { serviceById } from '@/data/services';
import { nextReferralNumber, referralId, type Referral } from '@/domain/referrals';
import { useRouter } from './router';
import type { Route, RoutePath } from './routes';

export interface Draft {
  patient: Referral['patient'];
  serviceIds: string[];
}
export const EMPTY_DRAFT: Draft = { patient: { name: '', phone: '', gender: '', age: '' }, serviceIds: [] };

interface Saved {
  mine: Referral[];
  draft: Draft;
}

const KEY = 'stanley.pr.v1';
function load(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    const draft = s.draft && typeof s.draft === 'object' ? { ...EMPTY_DRAFT, ...s.draft, patient: { ...EMPTY_DRAFT.patient, ...s.draft.patient } } : EMPTY_DRAFT;
    // Keep only services still in the catalogue (the catalogue comes from the dashboard and can change).
    draft.serviceIds = (draft.serviceIds ?? []).filter((id) => serviceById(id));
    return { mine: Array.isArray(s.mine) ? s.mine : [], draft };
  } catch {
    return { mine: [], draft: EMPTY_DRAFT };
  }
}

interface Store {
  route: Route;
  navigate: (to: RoutePath | string, opts?: { replace?: boolean }) => void;
  back: () => void;
  referrals: Referral[];
  draft: Draft;
  setDraft: (d: Draft | ((d: Draft) => Draft)) => void;
  /** Save the draft as a referral (on this phone) and clear the draft. */
  sendReferral: () => Referral;
  toast: string | null;
  showToast: (t: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { route, navigate, back } = useRouter();
  const [saved, setSaved] = useState<Saved>(load);
  const [toast, setToast] = useState<string | null>(null);
  const samples = useMemo(() => sampleReferrals(), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* storage full or blocked — kept for this session */
    }
  }, [saved]);

  const referrals = useMemo(() => [...saved.mine, ...samples].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [saved.mine, samples]);

  const setDraft = useCallback((d: Draft | ((d: Draft) => Draft)) => setSaved((s) => ({ ...s, draft: typeof d === 'function' ? d(s.draft) : d })), []);

  const sendReferral = useCallback(() => {
    // Next number after everything already issued (samples included), so IDs never repeat.
    const created: Referral = { id: referralId(nextReferralNumber([...saved.mine, ...samples])), patient: saved.draft.patient, serviceIds: saved.draft.serviceIds, status: 'Pending', createdAt: new Date().toISOString(), queued: true };
    setSaved((s) => ({ mine: [created, ...s.mine], draft: EMPTY_DRAFT }));
    return created;
  }, [samples, saved]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }, []);

  const value = useMemo<Store>(() => ({ route, navigate, back, referrals, draft: saved.draft, setDraft, sendReferral, toast, showToast }), [route, navigate, back, referrals, saved.draft, setDraft, sendReferral, toast, showToast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp must be used inside AppStoreProvider');
  return s;
}
