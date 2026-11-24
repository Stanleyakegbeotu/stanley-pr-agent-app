/**
 * Unfinished referral (owner, 2026-11-24). If the phone was switched off, the
 * screen locked or the app closed while a referral was being filled in,
 * everything typed is still saved. When the app opens again the agent sees:
 *   • Continue the referral (back to the same step, details filled in)
 *   • Start a new referral (clears the old one)
 *   • Discard (clears it and stays where they are)
 * Inside the referral, a banner offers the same fresh start.
 */
import { useState } from 'react';
import { ClipboardList, RotateCcw, Trash2, X } from 'lucide-react';
import { draftAtLaunch, hasDraftContent, useApp } from '@/app/store';
import { displayPhone } from '@/domain/format';
import { servicesOf } from '@/domain/referrals';
import { Button } from '@/ui/kit';

const PATH = ['/refer', '/refer/services', '/refer/summary'] as const;
const STEP_NAME = ['Patient details', 'Select services', 'Summary'];
const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `today at ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${time}`;
};

// Shown once per app launch.
let promptDone = false;
let bannerDismissed = false;

/** On launch: "You have an unfinished referral". */
export function ResumeDraftPrompt() {
  const { draft, route, navigate, clearDraft } = useApp();
  const inRefer = route.parts[0] === 'refer';
  const [open, setOpen] = useState(() => draftAtLaunch && !promptDone && !inRefer);
  if (!open || !hasDraftContent(draft)) return null;
  const close = () => {
    promptDone = true;
    setOpen(false);
  };
  const services = servicesOf(draft);
  const step = draft.step ?? (services.length ? 1 : 0);
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[#0b1730]/45 md:items-center" onClick={close}>
      <div className="w-full max-w-md rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-3 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-3 flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
            <ClipboardList size={23} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-ink">You have an unfinished referral</p>
            <p className="text-[13.5px] text-muted">Saved {when(draft.savedAt)}. Nothing you typed was lost.</p>
          </div>
          <button type="button" onClick={close} aria-label="Not now" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-page">
            <X size={19} />
          </button>
        </div>
        <div className="mb-4 rounded-2xl bg-page p-3.5 text-[14px] text-ink-2">
          <p>
            <b className="text-ink">{draft.patient.name.trim() || 'Patient not named yet'}</b>
            {draft.patient.phone ? `, ${displayPhone(draft.patient.phone)}` : ''}
          </p>
          <p className="mt-0.5">{services.length ? `${services.length} test${services.length === 1 ? '' : 's'}: ${services.map((s) => s.name).slice(0, 3).join(', ')}${services.length > 3 ? '…' : ''}` : 'No tests chosen yet'}</p>
          <p className="mt-0.5 text-muted">You were on: {STEP_NAME[step]}</p>
        </div>
        <Button
          block
          onClick={() => {
            close();
            navigate(PATH[step]);
          }}
        >
          Continue referral
        </Button>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              close();
              clearDraft();
              navigate('/refer');
            }}
          >
            <RotateCcw size={17} /> Start new
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              close();
              clearDraft();
            }}
            className="text-[#d93036]"
          >
            <Trash2 size={17} /> Discard
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Inside the referral: "Continuing your unfinished referral" with a fresh start. */
export function ResumedBanner() {
  const { draft, clearDraft, navigate, showToast } = useApp();
  const [hidden, setHidden] = useState(bannerDismissed);
  if (!draftAtLaunch || hidden || !hasDraftContent(draft)) return null;
  const hide = () => {
    bannerDismissed = true;
    setHidden(true);
  };
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#cfe0fb] bg-brand-50 px-3.5 py-3">
      <RotateCcw size={18} className="shrink-0 text-brand-600" />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink-2">
        <b className="text-ink">Continuing your unfinished referral</b>, saved {when(draft.savedAt)}.
      </p>
      <button
        type="button"
        onClick={() => {
          hide();
          clearDraft();
          navigate('/refer', { replace: true });
          showToast('Started a new referral');
        }}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-700 ring-1 ring-line"
      >
        Start new
      </button>
      <button type="button" onClick={hide} aria-label="Hide" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted">
        <X size={16} />
      </button>
    </div>
  );
}
