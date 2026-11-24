/**
 * The remaining screens, in the same design language: Branch, Campaigns,
 * Announcements, Notifications, Messages, Help Centre, Training, Profile and
 * the AI Test Assistant.
 */
import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Hash, Layers, MapPin, Phone, Send, Sparkles, UserRound } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { AGENT, BRANCH, COMPANY, RULES, agentName } from '@/config/org';
import { ANNOUNCEMENTS, CAMPAIGNS, FAQS, NOTIFICATIONS, RESOURCES } from '@/data/content';
import { CATEGORIES, SERVICES, serviceByName, type Service } from '@/data/services';
import { priceText } from '@/screens/Services';
import { naira, shortDate } from '@/domain/format';
import { useApp } from '@/app/store';
import { monthName, monthStatements } from '@/domain/payouts';
import { Button, Card, EmptyState, InitialsAvatar, ScreenHeader, ServiceThumb, Sticker, Subtitle } from '@/ui/kit';

/* ─────────────── Branch ─────────────── */

export function BranchInfo() {
  const { navigate } = useApp();
  const missing = 'Not on record yet';
  const rows: [React.ReactNode, string, string][] = [
    [<Building2 size={19} />, 'Company', COMPANY.name],
    [<Hash size={19} />, 'Branch code', `${BRANCH.code} · referral IDs start with ${BRANCH.idCode}-R`],
    [<MapPin size={19} />, 'Address', BRANCH.address ?? missing],
    [<Phone size={19} />, 'Phone', BRANCH.phone ?? missing],
    [<UserRound size={19} />, 'Branch manager', BRANCH.manager ?? missing],
    [<Layers size={19} />, 'Services', `${SERVICES.length} services in ${CATEGORIES.length} categories`],
  ];
  return (
    <>
      <ScreenHeader title="Branch Information" />
      <Card className="mb-3.5 overflow-hidden">
        <div className="flex items-center gap-4 bg-linear-to-br from-brand-50 to-brand-100 p-5">
          <Sticker name="hospital" size={72} />
          <div>
            <p className="text-[19px] font-bold text-ink">{BRANCH.label}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-tint-green px-2.5 py-0.5 text-[13px] font-semibold text-good-ink">
              <i className="h-1.5 w-1.5 rounded-full bg-good" /> Your assigned branch
            </p>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {rows.map(([icon, l, v]) => (
            <li key={l} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 text-brand-600">{icon}</span>
              <span>
                <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-muted">{l}</span>
                <span className="block text-[15px] text-ink">{v}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {(!BRANCH.address || !BRANCH.phone) && <p className="mb-3.5 text-[12.5px] leading-relaxed text-muted">Details marked “Not on record yet” are added by the branch in the STANLEY dashboard and appear here automatically once the cloud connection is on.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => navigate('/messages/frontdesk')}>
          Message
        </Button>
        <Button onClick={() => navigate('/services')}>Services</Button>
      </div>
    </>
  );
}

/* ─────────────── Campaigns & announcements ─────────────── */

export function Campaigns() {
  return (
    <>
      <ScreenHeader title="Campaigns" />
      <Subtitle>Health campaigns you can share with your patients.</Subtitle>
      <ul className="space-y-3">
        {CAMPAIGNS.map((c) => (
          <li key={c.id}>
            <Card className="flex items-start gap-4 p-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-tint-blue">
                <Sticker name={c.sticker} size={48} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[16.5px] font-bold text-ink">{c.title}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-[12px] font-semibold ${c.status === 'Active' ? 'bg-tint-green text-good-ink' : c.status === 'Upcoming' ? 'bg-brand-50 text-brand-700' : 'bg-[#eef1f5] text-muted'}`}>{c.status}</span>
                </span>
                <span className="mt-1 block text-[14px] leading-snug text-ink-2">{c.text}</span>
                <span className="mt-1.5 block text-[13px] text-muted">{c.period}</span>
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Announcements() {
  const { navigate } = useApp();
  return (
    <>
      <ScreenHeader title="Announcements" />
      <Subtitle>News and updates from Stanley Diagnostics.</Subtitle>
      <ul className="space-y-3">
        {ANNOUNCEMENTS.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => navigate(a.to)} className="card press flex w-full items-center gap-4 p-4 text-left">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-tint-blue">
                <Sticker name={a.sticker} size={50} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-brand-600">
                  {a.kicker} · {a.date}
                </span>
                <span className="block text-[16px] font-bold text-ink">{a.title.replace('\n', ' ')}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{a.text}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Notifications() {
  const { navigate, referrals } = useApp();
  // A notification for every monthly payout (owner, 2026-11-24), newest first, before the others.
  const payouts = monthStatements(referrals)
    .filter((m) => m.state === 'paid')
    .map((m) => ({ id: `paid-${m.month}`, title: 'Commission paid', text: `Your commission for ${monthName(m.month)} (${naira(m.amount)}) has been paid into your bank account. Check My Earnings for details.`, when: shortDate(m.paidAt!), sticker: 'moneyBag' as const, to: '/earnings' as const }));
  return (
    <>
      <ScreenHeader title="Notifications" />
      <ul className="space-y-3">
        {[...payouts, ...NOTIFICATIONS].map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => n.to && navigate(n.to)} className="card press flex w-full items-start gap-3.5 p-4 text-left">
              <Sticker name={n.sticker} size={42} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold text-ink">{n.title}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{n.text}</span>
                <span className="mt-1 block text-[12.5px] text-muted">{n.when}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ─────────────── Help & training ─────────────── */

export function HelpCentre() {
  const { navigate } = useApp();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <ScreenHeader title="Help Centre" />
      <Card className="mb-4 flex items-center gap-4 bg-linear-to-br from-brand-50 to-brand-100 p-5">
        <Sticker name="speech" size={60} />
        <div>
          <p className="text-[17px] font-bold text-ink">A little help goes a long way.</p>
          <p className="mt-0.5 text-[14px] text-ink-2">Answers to common questions, or message our partner team.</p>
        </div>
      </Card>
      <Card className="mb-4 divide-y divide-line">
        {FAQS.map((f, i) => (
          <div key={f.q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-3 p-4 text-left text-[15.5px] font-semibold text-ink">
              {f.q}
              <ChevronDown size={19} className={`shrink-0 text-muted transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="-mt-1 px-4 pb-4 text-[14.5px] leading-relaxed text-ink-2">{f.a}</p>}
          </div>
        ))}
      </Card>
      <Button block onClick={() => navigate('/messages/admin')}>
        Message the Admin
      </Button>
    </>
  );
}

export function Training() {
  const { navigate } = useApp();
  return (
    <>
      <ScreenHeader title="Training & Resources" />
      <Subtitle>Short guides to help you refer with confidence.</Subtitle>
      <ul className="space-y-3">
        {RESOURCES.map((r) => (
          <li key={r.slug}>
            <button type="button" onClick={() => navigate(`/training/${r.slug}`)} className="card press flex w-full items-center gap-4 p-4 text-left">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-tint-purple">
                <Sticker name={r.sticker} size={48} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-ink">{r.title}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{r.text}</span>
                <span className="mt-1 block text-[12.5px] text-muted">{r.minutes} min read</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Article({ slug }: { slug: string }) {
  const r = RESOURCES.find((x) => x.slug === slug);
  if (!r)
    return (
      <>
        <ScreenHeader title="Training" />
        <EmptyState sticker="books" title="Guide not found" text="It may have been moved." />
      </>
    );
  return (
    <>
      <ScreenHeader title="Guide" />
      <div className="mb-5 grid place-items-center rounded-[22px] bg-linear-to-br from-tint-purple to-tint-blue py-8">
        <Sticker name={r.sticker} size={110} />
      </div>
      <h2 className="text-[23px] font-bold leading-tight tracking-[-0.02em] text-ink">{r.title}</h2>
      <p className="mt-1 text-[13.5px] text-muted">{r.minutes} min read · Stanley Partner Care</p>
      <ol className="mt-5 space-y-3">
        {r.body.map((b, i) => (
          <li key={i} className="card flex gap-3.5 p-4 text-[15px] leading-relaxed text-ink-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-[13px] font-bold text-white">{i + 1}</span>
            {b}
          </li>
        ))}
      </ol>
    </>
  );
}

/* ─────────────── Profile ─────────────── */

/* ─────────────── AI Test Assistant ─────────────── */

/** Symptom/need → services, from the catalogue's own guide (no AI model is connected yet). */
const GUIDE: { label: string; names: string[]; why: string }[] = [
  { label: 'Knee pain or injury', names: ['KNEE X-RAY', 'KNEE MRI'], why: 'X-ray first for bones; MRI shows ligaments and cartilage.' },
  { label: 'Fever', names: ['MP', 'WIDAL', 'FULL BLOOD COUNT'], why: 'Malaria parasite, typhoid (Widal) and a blood count are the usual first checks.' },
  { label: 'Stomach / abdominal pain', names: ['ABDOMINOPELVIC SCAN', 'CT ABDOMEN WITH CONTRAST'], why: 'Ultrasound is the usual first scan; CT gives more detail when needed.' },
  { label: 'General check-up', names: ['FULL BLOOD COUNT', 'FASTING LIPID PROFILE', 'E/U/C', 'LIVER FUNCTION TEST (LFT)', 'FBS'], why: 'Blood count, cholesterol, kidney and liver function and blood sugar.' },
  { label: 'Tiredness / weight change', names: ['THYROID MARKERS (T3,T4,TSH)', 'FULL BLOOD COUNT'], why: 'Thyroid function and blood count are common first checks.' },
  { label: 'Chest pain / palpitations', names: ['ECG', 'CHEST (AP)', 'ECHOCARDIOGRAPHY (ADULT)'], why: 'Heart rhythm, chest imaging and an ultrasound of the heart.' },
  { label: 'Headache / head injury', names: ['CT BRAIN/HEAD', 'MRI BRAIN'], why: 'CT is quick after an injury; MRI shows more detail of the brain.' },
  { label: 'Pregnancy', names: ['PREGNANCY TEST', 'OBSTETRICS SCAN'], why: 'Confirm the pregnancy, then an obstetric scan to check the baby.' },
];

export function AiAssistant() {
  const { navigate, setDraft } = useApp();
  const [pick, setPick] = useState<number | null>(null);
  const g = pick === null ? null : GUIDE[pick]!;
  const services = g ? (g.names.map(serviceByName).filter((x) => x && x.price != null) as Service[]) : [];
  return (
    <>
      <ScreenHeader title="AI Test Assistant" />
      <Card className="mb-4 flex items-center gap-4 bg-linear-to-br from-tint-purple to-brand-50 p-5">
        <Sticker name="sparkles" size={58} />
        <div>
          <p className="text-[17px] font-bold text-ink">Which test does the patient need?</p>
          <p className="mt-0.5 text-[13.5px] text-ink-2">Pick what the doctor is checking for. Suggestions come from Stanley’s service guide. The AI assistant isn’t connected yet. The doctor always decides.</p>
        </div>
      </Card>
      <div className="mb-5 flex flex-wrap gap-2.5">
        {GUIDE.map((x, i) => (
          <button key={x.label} type="button" onClick={() => setPick(i)} aria-pressed={pick === i} className={`press rounded-full px-4 py-2.5 text-[14px] font-medium ${pick === i ? 'bg-violet text-white' : 'border border-line bg-white text-ink-2'}`}>
            {x.label}
          </button>
        ))}
      </div>
      {g && (
        <>
          <p className="mb-3 flex items-start gap-2 text-[14.5px] text-ink-2">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-violet" /> {g.why}
          </p>
          <ul className="mb-4 space-y-3">
            {services.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => navigate(`/services/${s.id}`)} className="card press flex w-full items-center gap-3.5 p-3 text-left">
                  <ServiceThumb service={s} className="h-[64px] w-[70px] shrink-0 rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-ink">{s.name}</span>
                    <span className="block text-[16px] font-bold text-brand-600">{priceText(s.price)}</span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            block
            onClick={() => {
              setDraft((d) => ({ ...d, serviceIds: Array.from(new Set([...d.serviceIds, ...services.map((x) => x.id)])) }));
              navigate('/refer');
            }}
          >
            Refer with these tests
          </Button>
        </>
      )}
    </>
  );
}
