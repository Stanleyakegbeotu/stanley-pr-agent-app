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
import { DRAFT_VOICE, deleteVoice, moveVoice } from '@/domain/referralVoice';
import type { Route, RoutePath } from './routes';

export interface Draft {
  patient: Referral['patient'];
  serviceIds: string[];
  /** Optional note and voice note for the branch. */
  note?: string;
  voiceNote?: { duration: number };
  /** Last step the agent was on (0 patient, 1 services, 2 summary) and when it was last saved. */
  step?: 0 | 1 | 2;
  savedAt?: string;
}

/** Anything typed or chosen yet? (An empty form isn't an unfinished referral.) */
export const hasDraftContent = (d: Draft) => !!(d.patient.name.trim() || d.patient.phone.trim() || d.patient.age || d.patient.gender || d.serviceIds.length || d.note?.trim() || d.voiceNote);

/**
 * Unfinished referral when the app was opened (owner, 2026-11-24): the phone
 * may have been switched off or the app closed mid-form. Everything typed is
 * saved on every change, so on the next launch the agent can continue, start
 * a new referral, or discard it.
 */
export let draftAtLaunch = false;
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
    draftAtLaunch = hasDraftContent(draft);
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
  /** Throw away the unfinished referral (and its voice note). */
  clearDraft: () => void;
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

  const setDraft = useCallback((d: Draft | ((d: Draft) => Draft)) => setSaved((s) => ({ ...s, draft: { ...(typeof d === 'function' ? d(s.draft) : d), savedAt: new Date().toISOString() } })), []);
  const clearDraft = useCallback(() => {
    setSaved((s) => ({ ...s, draft: EMPTY_DRAFT }));
    void deleteVoice(DRAFT_VOICE).catch(() => undefined);
  }, []);

  const sendReferral = useCallback(() => {
    // Next number after everything already issued (samples included), so IDs never repeat.
    const created: Referral = { id: referralId(nextReferralNumber([...saved.mine, ...samples])), patient: saved.draft.patient, serviceIds: saved.draft.serviceIds, status: 'Pending', createdAt: new Date().toISOString(), queued: true, note: saved.draft.note?.trim() || undefined, voiceNote: saved.draft.voiceNote };
    // The voice note recorded for this referral moves from the draft to the referral.
    if (saved.draft.voiceNote) void moveVoice(DRAFT_VOICE, created.id).catch(() => undefined);
    setSaved((s) => ({ mine: [created, ...s.mine], draft: EMPTY_DRAFT }));
    return created;
  }, [samples, saved]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }, []);

  const value = useMemo<Store>(() => ({ route, navigate, back, referrals, draft: saved.draft, setDraft, clearDraft, sendReferral, toast, showToast }), [route, navigate, back, referrals, saved.draft, setDraft, clearDraft, sendReferral, toast, showToast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp must be used inside AppStoreProvider');
  return s;
}
