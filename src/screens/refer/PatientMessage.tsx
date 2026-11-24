/**
 * "Send request to patient" (compliance, 2026-11-24): Silhouette sends the
 * patient their request through a company channel (SMS / WhatsApp Business),
 * never the clinician's personal WhatsApp. Until that channel is connected the
 * app shows the exact message as a preview and sends nothing from the phone.
 */
import { useState } from 'react';
import { MessageSquareText, ShieldCheck, X } from 'lucide-react';
import { patientMessageText, sendPatientMessage, type MessageState } from '@/domain/patientMessage';
import { displayPhone } from '@/domain/format';
import type { Referral } from '@/domain/referrals';
import { Button } from '@/ui/kit';

export function PatientMessageButton({ r }: { r: Referral }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button block onClick={() => setOpen(true)}>
        <MessageSquareText size={19} /> Send request to patient
      </Button>
      {open && <PatientMessageSheet r={r} onClose={() => setOpen(false)} />}
    </>
  );
}

function PatientMessageSheet({ r, onClose }: { r: Referral; onClose: () => void }) {
  const [state, setState] = useState<MessageState | null>(null);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-3 text-left shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[19px] font-bold text-ink">Message to the patient</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-page">
            <X size={19} />
          </button>
        </div>
        <p className="mb-3 text-[13.5px] text-muted">Silhouette sends this to {displayPhone(r.patient.phone)} by SMS or its WhatsApp Business line. It doesn’t go from your phone.</p>
        <pre className="mb-4 whitespace-pre-wrap rounded-2xl bg-page p-4 font-sans text-[13.5px] leading-relaxed text-ink">{patientMessageText(r)}</pre>
        {state === 'not-connected' ? (
          <p className="flex items-start gap-2.5 rounded-2xl bg-[#fff6e5] p-3.5 text-[13.5px] leading-snug text-[#8a5a12]">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" /> Silhouette’s messaging service isn’t connected yet, so nothing was sent. Give the patient the request ID ({r.id}) for now.
          </p>
        ) : (
          <Button block onClick={async () => setState(await sendPatientMessage(r))}>
            Send through Silhouette
          </Button>
        )}
      </div>
    </div>
  );
}
