/**
 * App state shared by every screen:
 *  • navigation (router),
 *  • requests: the signed-in clinician's OWN requests only (saved on this
 *    phone ENCRYPTED, queued for the server) plus sample activity for the
 *    sample account,
 *  • the request being written (draft: survives leaving the screen, a
 *    refresh or the phone switching off; also encrypted),
 *  • toasts.
 *
 * Compliance (2026-11-24): patient data is only ever written through
 * domain/secureStore (AES-GCM). Requests drop out of view 90 days after
 * results / non-attendance (isVisible). The server must enforce own-patients
 * -only access too (domain/api).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SAMPLE_CLINICIAN, sampleReferrals } from '@/data/referrals';
import { serviceById } from '@/data/services';
import { isVisible, nextReferralNumber, ownOnly, referralId, type Referral, type Urgency } from '@/domain/referrals';
import { secureGet, secureSet } from '@/domain/secureStore';
import { useAccount } from '@/domain/account';
import { recordConsent, VERSIONS } from '@/domain/consent';
import { logAudit } from '@/domain/audit';
import { submitRequest } from '@/domain/api';
import { useRouter } from './router';
import { DRAFT_VOICE, deleteVoice, moveVoice } from '@/domain/referralVoice';
import type { Route, RoutePath } from './routes';

export interface Draft {
  patient: Referral['patient'];
  serviceIds: string[];
  urgency: Urgency;
  /** Clinical indication (required for X-ray, CT, mammogram, fluoroscopy). */
  indication?: string;
  /** Optional note and voice note for the branch. */
  note?: string;
  voiceNote?: { duration: number };
  /** The clinician has told the patient (required before sending). */
  patientInformed?: boolean;
  /** Last step (0 patient, 1 tests, 2 clinical details, 3 review) and when it was last saved. */
  step?: 0 | 1 | 2 | 3;
  savedAt?: string;
}

/** Anything typed or chosen yet? (An empty form isn't an unfinished request.) */
export const hasDraftContent = (d: Draft) => !!(d.patient.name.trim() || d.patient.phone.trim() || d.patient.age || d.patient.gender || d.serviceIds.length || d.note?.trim() || d.indication?.trim() || d.voiceNote);

export const EMPTY_DRAFT: Draft = { patient: { name: '', phone: '', gender: '', age: '' }, serviceIds: [], urgency: 'Routine' };

interface Saved {
  mine: Referral[];
  draft: Draft;
}
const KEY = 'referrals';

/**
 * Unfinished request when the app was opened: everything typed is saved (encrypted) on every
 * change, so on the next launch the clinician can continue, start a new request or discard it.
 */
export let draftAtLaunch = false;
function load(): Saved {
  const s = secureGet<Partial<Saved>>(KEY) ?? {};
  const raw = (s.draft && typeof s.draft === 'object' ? s.draft : EMPTY_DRAFT) as Partial<Draft>;
  const draft: Draft = { ...EMPTY_DRAFT, ...raw, patient: { ...EMPTY_DRAFT.patient, ...raw.patient }, urgency: raw.urgency === 'Urgent' ? 'Urgent' : 'Routine' };
  // Keep only tests still in the catalogue (the catalogue comes from the dashboard and can change).
  draft.serviceIds = (draft.serviceIds ?? []).filter((id) => serviceById(id));
  draftAtLaunch = hasDraftContent(draft);
  // Requests saved by earlier versions (without the new fields) are dropped.
  const mine = Array.isArray(s.mine) ? s.mine.filter((r) => r && typeof r === 'object' && 'clinicianId' in r) : [];
  return { mine, draft };
}

interface Store {
  route: Route;
  navigate: (to: RoutePath | string, opts?: { replace?: boolean }) => void;
  back: () => void;
  /** The signed-in clinician's own requests that are still within the 90-day window. */
  referrals: Referral[];
  draft: Draft;
  setDraft: (d: Draft | ((d: Draft) => Draft)) => void;
  /** Throw away the unfinished request (and its voice note). */
  clearDraft: () => void;
  /** Save the draft as a request (on this phone, encrypted) and clear the draft. */
  sendReferral: () => Referral;
  toast: string | null;
  showToast: (t: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { route, navigate, back } = useRouter();
  const { account } = useAccount();
  const me = account?.clinician.id;
  const [saved, setSavedState] = useState<Saved>(load);
  const [toast, setToast] = useState<string | null>(null);
  const samples = useMemo(() => sampleReferrals(), []);

  const setSaved = useCallback((f: (s: Saved) => Saved) => {
    setSavedState((s) => {
      const next = f(s);
      secureSet(KEY, next);
      return next;
    });
  }, []);

  const referrals = useMemo(() => {
    const all = [...saved.mine, ...(me === SAMPLE_CLINICIAN ? samples : [])];
    return ownOnly(all, me)
      .filter((r) => isVisible(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [saved.mine, samples, me]);

  const setDraft = useCallback((d: Draft | ((d: Draft) => Draft)) => setSaved((s) => ({ ...s, draft: { ...(typeof d === 'function' ? d(s.draft) : d), savedAt: new Date().toISOString() } })), [setSaved]);
  const clearDraft = useCallback(() => {
    setSaved((s) => ({ ...s, draft: EMPTY_DRAFT }));
    void deleteVoice(DRAFT_VOICE).catch(() => undefined);
  }, [setSaved]);

  const sendReferral = useCallback(() => {
    const d = saved.draft;
    const at = new Date().toISOString();
    // Next number after everything already issued (samples included), so IDs never repeat.
    const created: Referral = {
      id: referralId(nextReferralNumber([...saved.mine, ...samples])),
      clinicianId: me ?? '',
      patient: d.patient,
      serviceIds: d.serviceIds,
      createdAt: at,
      urgency: d.urgency,
      indication: d.indication?.trim() || undefined,
      note: d.note?.trim() || undefined,
      voiceNote: d.voiceNote,
      patientNotice: { version: VERSIONS.patientNotice, at },
      queued: true,
    };
    recordConsent({ kind: 'patient-notice', version: VERSIONS.patientNotice, by: created.clinicianId, ref: created.id, at });
    logAudit({ type: 'request.sent', requestId: created.id });
    // The voice note recorded for this request moves from the draft to the request.
    if (d.voiceNote) void moveVoice(DRAFT_VOICE, created.id).catch(() => undefined);
    // TODO(backend): when submitRequest succeeds, remove the local copy (patient data leaves the phone).
    void submitRequest(created);
    setSaved((s) => ({ mine: [created, ...s.mine], draft: EMPTY_DRAFT }));
    return created;
  }, [samples, saved, me, setSaved]);

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
