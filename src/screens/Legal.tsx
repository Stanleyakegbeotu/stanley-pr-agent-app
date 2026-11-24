/**
 * Privacy and legal screens (compliance, 2026-11-24): Privacy Notice for
 * clinicians, the Patient Privacy Notice (the page the patient's message
 * links to), Terms of Use, the Data Protection Officer contact and the
 * clinician's own consent records.
 *
 * The texts are PLACEHOLDERS written to the NDPA 2023 / GAID 2025 structure.
 * TODO(company): have them reviewed by Silhouette's DPO / lawyer and fill in
 * the DPO details in config/org COMPANY.dpo.
 */
import { ArrowLeft, FileText, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { COMPANY } from '@/config/org';
import { VERSIONS, useConsents } from '@/domain/consent';
import { useAccount } from '@/domain/account';
import { useApp } from '@/app/store';
import { Card, ScreenHeader, Subtitle } from '@/ui/kit';

type Kind = 'privacy' | 'patient' | 'terms';
const DOCS: Record<Kind, { title: string; version: string; sections: [string, string][] }> = {
  privacy: {
    title: 'Privacy Notice for clinicians',
    version: VERSIONS.privacy,
    sections: [
      ['Who we are', `${COMPANY.name} is the data controller for information processed in this app.`],
      ['What we collect about you', 'Your name, profession, regulator and licence number, workplace, phone and email, and a record of the requests you send and the results you view.'],
      ['Why', 'To verify that you are a licensed professional, to receive your test requests, to tell you when your patients attend, and to give you their results. We do not use your data for marketing without your consent.'],
      ['Lawful basis', 'Performance of our service to you and your patients, our legal obligations, and your consent where we ask for it.'],
      ['Who sees it', 'Silhouette staff who handle requests and results, and service providers bound by contract. We never sell your data.'],
      ['How long we keep it', 'Your account while it is active, and records we must keep by law afterwards. Patient lists in the app are removed 90 days after results.'],
      ['Your rights', 'You can ask to see, correct or delete your data, object to processing, or complain to Nigeria’s data protection regulator (NDPC). Contact our Data Protection Officer.'],
      ['Security', 'Data on your phone is encrypted and the app locks with your PIN or biometrics. Data is sent over encrypted connections.'],
    ],
  },
  patient: {
    title: 'Patient Privacy Notice',
    version: VERSIONS.patientNotice,
    sections: [
      ['Why you received this', `Your clinician sent a request for tests to ${COMPANY.name}. This explains how we use your information.`],
      ['What we hold', 'Your name, phone number, age and gender, the tests requested, the clinical reason, and later your results.'],
      ['Why', 'To prepare and carry out your tests, to contact you about your visit, and to send your results to the clinician who requested them.'],
      ['Who sees your results', 'Only the clinician who requested your tests, and Silhouette staff involved in your care. Results are released after a specialist signs them off.'],
      ['Lawful basis', 'Your health care (Nigeria Data Protection Act 2023, health data processed for medical purposes) and our legal duties. Your information is confidential (National Health Act 2014, section 26).'],
      ['How long we keep it', 'Medical records are kept for the period the law requires.'],
      ['Your rights', 'You can ask to see or correct your information, ask us to stop using it where the law allows, and complain to Nigeria’s data protection regulator (NDPC). Contact our Data Protection Officer.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    version: VERSIONS.terms,
    sections: [
      ['Who may use the app', 'Only licensed healthcare professionals verified by Silhouette. Your account is personal; don’t share your login or PIN.'],
      ['Requests', 'Request only tests that are clinically needed. Give a clinical reason for X-ray, CT, mammography and fluoroscopy. For an emergency, send the patient to emergency care first.'],
      ['No inducements', 'Silhouette gives no payment, gift or other benefit for requesting tests, and you must not ask for or accept one (MDCN Code of Medical Ethics; ICPC Act).'],
      ['Patients', 'Tell each patient that their details and tests are sent to Silhouette, and that you will be told when they attend and when results are ready.'],
      ['Results', 'Results are for the care of your own patient only. Don’t copy, screenshot or forward them outside the app.'],
      ['Prices', 'Prices shown are the branch’s published prices. The final price is confirmed at the branch (Patients’ Bill of Rights).'],
      ['Suspension', 'Silhouette may suspend an account that breaks these terms or loses its licence.'],
    ],
  },
};

/** One legal document (also opened from the agreement screen before sign-in completes). */
export function LegalDoc({ kind, onClose }: { kind: Kind; onClose?: () => void }) {
  const d = DOCS[kind];
  return (
    <div className={onClose ? 'h-dvh overflow-y-auto bg-page px-5 pb-10 pt-[max(20px,var(--safe-top))]' : ''}>
      <div className={onClose ? 'mx-auto max-w-lg' : ''}>
        {onClose ? (
          <button type="button" onClick={onClose} className="mb-4 inline-flex items-center gap-2 text-[15px] font-semibold text-brand-600">
            <ArrowLeft size={18} /> Back
          </button>
        ) : (
          <ScreenHeader title={d.title} />
        )}
        {onClose && <h1 className="mb-1 text-[24px] font-bold text-ink">{d.title}</h1>}
        <p className="mb-4 text-[12.5px] text-muted">Version {d.version}. Draft for Silhouette’s Data Protection Officer to finalise.</p>
        <Card className="divide-y divide-line">
          {d.sections.map(([h, t]) => (
            <div key={h} className="p-4">
              <h2 className="text-[15.5px] font-bold text-ink">{h}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t}</p>
            </div>
          ))}
        </Card>
        <DpoCard className="mt-4" />
      </div>
    </div>
  );
}

function DpoCard({ className = '' }: { className?: string }) {
  const rows: [React.ReactNode, string, string][] = [
    [<UserRound size={18} />, 'Name', COMPANY.dpo.name],
    [<Mail size={18} />, 'Email', COMPANY.dpo.email],
    [<Phone size={18} />, 'Phone', COMPANY.dpo.phone],
    [<MapPin size={18} />, 'Address', COMPANY.dpo.address],
  ];
  return (
    <Card className={`p-4 ${className}`}>
      <p className="mb-2 flex items-center gap-2 text-[15.5px] font-bold text-ink">
        <ShieldCheck size={19} className="text-brand-600" /> Data Protection Officer
      </p>
      {rows.map(([icon, l, v]) => (
        <p key={l} className="flex items-start gap-2.5 py-1 text-[14px] text-ink-2">
          <span className="mt-0.5 text-muted">{icon}</span>
          <span className="w-16 shrink-0 text-muted">{l}</span>
          <span className="min-w-0 break-words text-ink">{v}</span>
        </p>
      ))}
    </Card>
  );
}

/** Privacy & legal hub: the documents, the DPO and "my consent records". */
export function PrivacyHub() {
  const { navigate } = useApp();
  const { account } = useAccount();
  const consents = useConsents().filter((c) => c.by === account?.clinician.id);
  const LABEL = { agreement: 'User agreement', privacy: 'Privacy Notice', terms: 'Terms of Use', 'patient-notice': 'Patient told (request)' } as const;
  return (
    <>
      <ScreenHeader title="Privacy & Terms" />
      <Subtitle>How Silhouette handles your data and your patients’ data.</Subtitle>
      <Card className="mb-4 divide-y divide-line">
        {(
          [
            ['/legal/privacy', 'Privacy Notice for clinicians'],
            ['/legal/patient', 'Patient Privacy Notice'],
            ['/legal/terms', 'Terms of Use'],
          ] as const
        ).map(([to, label]) => (
          <button key={to} type="button" onClick={() => navigate(to)} className="press flex w-full items-center gap-3 p-4 text-left text-[15px] font-medium text-ink">
            <FileText size={19} className="text-brand-600" /> {label}
          </button>
        ))}
      </Card>
      <DpoCard className="mb-4" />
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">My consent records</h2>
      <Card className="divide-y divide-line">
        {consents.length === 0 ? (
          <p className="p-4 text-[14px] text-muted">No records on this phone yet.</p>
        ) : (
          [...consents]
            .reverse()
            .slice(0, 30)
            .map((c, i) => (
              <div key={`${c.kind}-${c.at}-${i}`} className="flex items-center justify-between gap-3 p-4 text-[14px]">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{LABEL[c.kind]}</span>
                  <span className="block text-[12.5px] text-muted">
                    Version {c.version}
                    {c.ref ? `, ${c.ref}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] text-muted">{new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))
        )}
      </Card>
    </>
  );
}

export function LegalPage({ kind }: { kind: string }) {
  return <LegalDoc kind={kind === 'patient' ? 'patient' : kind === 'terms' ? 'terms' : 'privacy'} />;
}
