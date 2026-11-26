/**
 * "Send to the patient" (owner, 2026-11-26): after a referral is made, the
 * PR agent sends it to the patient by WhatsApp or by SMS. WhatsApp opens
 * straight on a chat with the patient's number and the message typed in (no
 * need to save the contact first); SMS opens the phone's Messages app the
 * same way. The agent just taps Send there.
 *
 * First the agent asks the patient: smartphone or button phone? Button
 * phones cut long texts, so they get a short plain SMS (referral ID first),
 * and the agent writes the referral ID and the branch on paper for them.
 *
 * Whether a number has WhatsApp cannot be checked from the app (WhatsApp
 * offers no such check); if it hasn't, WhatsApp says so and SMS is one tap
 * away here.
 */
import { useState } from 'react';
import { MessageSquareText, NotebookPen, Phone, Send, Smartphone } from 'lucide-react';
import { logPatientMessage, paperNote, patientMessageText, shortSmsText, smsLink, smsParts, useBranchContact, whatsappLink } from '@/domain/patientMessage';
import { useAvailability } from '@/domain/availability';
import { displayPhone } from '@/domain/format';
import { servicesOf, type Referral } from '@/domain/referrals';
import { useProfile } from '@/domain/profile';
import { Sheet } from '@/admin/ui';
import { Button } from '@/ui/kit';

export function PatientMessageButton({ r }: { r: Referral }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button block onClick={() => setOpen(true)}>
        <MessageSquareText size={19} /> Send to the patient
      </Button>
      {open && <PatientMessageSheet r={r} onClose={() => setOpen(false)} />}
    </>
  );
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
  </svg>
);

type PhoneKind = 'smart' | 'button';

function PatientMessageSheet({ r, onClose }: { r: Referral; onClose: () => void }) {
  const me = useProfile();
  const contact = useBranchContact();
  const avail = useAvailability();
  const hasPrep = servicesOf(r).some((s) => s.preparation);
  const [prep, setPrep] = useState(hasPrep);
  const [kind, setKind] = useState<PhoneKind>('smart');
  const agent = [me.title, me.firstName, me.lastName].filter(Boolean).join(' ') || 'Your clinician';
  const opts = { prep, contact, agent, avail };
  const full = patientMessageText(r, opts);
  const short = shortSmsText(r, opts);
  const parts = smsParts(short);
  const paper = paperNote(r, opts);
  const go = (channel: 'whatsapp' | 'sms' | 'sms-short') => {
    logPatientMessage(r, channel);
    window.location.href = channel === 'whatsapp' ? whatsappLink(r.patient.phone, full) : smsLink(r.patient.phone, channel === 'sms-short' ? short : full);
  };
  return (
    <Sheet
      title="Send to the patient"
      subtitle={`${r.patient.name} · ${displayPhone(r.patient.phone)}`}
      onClose={onClose}
      tall
      footer={
        kind === 'smart' ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => go('whatsapp')} className="press flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#25d366] text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(37,211,102,0.35)]">
              <WhatsAppIcon /> WhatsApp
            </button>
            <button type="button" onClick={() => go('sms')} className="press flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]">
              <Smartphone size={20} /> SMS
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => go('sms-short')} className="press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]">
            <Phone size={19} /> Send the short SMS
          </button>
        )
      }
    >
      <div className="px-1 pb-4">
        {/* Ask first: button phones cut long messages. */}
        <div className="mb-3 rounded-[20px] bg-[#fff8eb] p-3.5 ring-1 ring-[#f6e1b3]">
          <b className="block text-[14.5px] text-[#4a3208]">First, ask the patient</b>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#6b4a12]">Do you use a smartphone (Android or iPhone) or a button phone? Button phones cut long messages, so they get a short SMS, and you write the referral ID on paper for them to take along.</p>
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-2xl bg-white/80 p-1" role="radiogroup" aria-label="The patient's phone">
            {(
              [
                ['smart', 'Smartphone'],
                ['button', 'Button phone'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${kind === k ? 'bg-[#b45309] text-white' : 'text-[#6b4a12]'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {kind === 'smart' ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 text-[12.5px] leading-snug">
              <p className="rounded-2xl bg-[#e9fbf0] p-3 text-[#146c3c]">
                <b className="block text-[13.5px]">WhatsApp</b>
                Opens a chat with this number and the message ready. You don’t need to save the contact.
              </p>
              <p className="rounded-2xl bg-[#eef4ff] p-3 text-brand-800">
                <b className="block text-[13.5px]">SMS</b>
                For a smartphone without WhatsApp. The whole message arrives.
              </p>
            </div>
            {hasPrep && (
              <button type="button" role="switch" aria-checked={prep} onClick={() => setPrep((p) => !p)} className="press mb-3 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
                <span className="min-w-0 flex-1">
                  <b className="block text-[14.5px] text-ink">Include how to prepare</b>
                  <span className="block text-[12.5px] text-muted">Fasting, full bladder and other steps. Who to call about preparation is always included.</span>
                </span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prep ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prep ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
              </button>
            )}
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-bold text-ink-2">
              <Send size={14} /> The message
            </p>
            <pre className="whitespace-pre-wrap rounded-[20px] bg-[#f3f6fb] p-4 font-sans text-[13.5px] leading-relaxed text-ink ring-1 ring-line/60">{full}</pre>
            <p className="mt-3 text-[12px] leading-snug text-muted">The app cannot check whether a number has WhatsApp before opening it. If WhatsApp says the number isn’t on WhatsApp, come back and tap SMS.</p>
          </>
        ) : (
          <>
            <p className="mb-1.5 flex items-center justify-between gap-2 px-1 text-[13px] font-bold text-ink-2">
              <span className="flex items-center gap-1.5">
                <Send size={14} /> The short SMS
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${parts <= 2 ? 'bg-[#e9f9ef] text-good-ink' : 'bg-[#fff1e0] text-[#9a5b00]'}`}>
                {short.length} characters · {parts === 1 ? '1 SMS' : `${parts} SMS parts`}
              </span>
            </p>
            <pre className="whitespace-pre-wrap rounded-[20px] bg-[#f3f6fb] p-4 font-sans text-[13.5px] leading-relaxed text-ink ring-1 ring-line/60">{short}</pre>
            <p className="mt-2 px-1 text-[12px] leading-snug text-muted">Plain letters only (₦ becomes N) so it fits button phones. The referral ID comes first, in case the end is cut.</p>

            <div className="mt-4 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                <NotebookPen size={17} className="text-brand-600" /> Write this on paper for the patient
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">The referral ID is what matters most: with it, the front desk finds the patient and the tests.</p>
              <div className="mt-3 rounded-2xl border-2 border-dashed border-[#d3dce9] bg-[#fbfcfe] p-3.5">
                <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-muted">Referral ID</span>
                <b className="block font-mono text-[24px] tracking-wider text-ink">{paper.id}</b>
                <dl className="mt-2 space-y-1 text-[13px] leading-snug">
                  <div>
                    <dt className="inline text-muted">Go to: </dt>
                    <dd className="inline text-ink">
                      {paper.branch}
                      {paper.address ? `, ${paper.address}` : ''}
                    </dd>
                  </div>
                  {paper.phone && (
                    <div>
                      <dt className="inline text-muted">Phone: </dt>
                      <dd className="inline text-ink">{paper.phone}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline text-muted">Open: </dt>
                    <dd className="inline text-ink">{paper.hours}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </>
        )}
        {!contact.address && <p className="mt-2 rounded-2xl bg-[#fff6e5] px-3 py-2 text-[12.5px] text-[#8a5a12]">The branch address isn’t on record yet. The branch adds it in Settings, Branch details.</p>}
        {!contact.mapLink && <p className="mt-2 rounded-2xl bg-[#fff6e5] px-3 py-2 text-[12.5px] text-[#8a5a12]">The branch’s Google Maps link isn’t set yet, so the message has no map. The Branch Manager or the Company Admin adds it in the branch settings.</p>}
      </div>
    </Sheet>
  );
}
