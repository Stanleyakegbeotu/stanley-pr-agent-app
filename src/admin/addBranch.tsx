/**
 * Add a branch (mobile slide-up, owner 2026-11-25). Same rules and saving as
 * the desktop's Add a branch (features/settings/admin/Branches NewBranchDialog,
 * with the location and phone fields of features/shared/createForms
 * AddBranchDialog):
 *   • Branch identity: name, and the 3-letter branch code used in every
 *     Patient ID, suggested from the name (Abuja → ABJ) and checked for
 *     uniqueness (idCodeProblem). It can't change once patients have IDs.
 *   • Location: country (all countries), state / region (the country's list),
 *     city (Nigerian cities for the chosen state, or type one), full address.
 *   • Contact: one or more phone numbers (main line plus front desk, lab or
 *     after-hours lines), email, contact person until a manager is appointed.
 *     A phone number or an email is required.
 *   • Configuration: currency NGN (one currency per branch), opening date and
 *     hours, payment methods (company settings or this branch's own).
 * Saved with addBranch + updateBranchContact + updateBranchProfile +
 * setBranchPayments; starts as "Pending setup" and is recorded in the Audit Log.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Lock, MapPin, Phone, Plus, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { GEO_COUNTRIES } from '@company/data/geo/countries';
import { PAYMENT_METHODS, type PaymentMethod } from '@company/data/types';
import { useConfig } from '@company/services/config';
import { addBranch, idCodeProblem, normCode, setBranchPayments } from '@company/services/org';
import { updateBranchContact } from '@company/services/receiptProfile';
import { updateBranchProfile } from '@company/services/settingsStore';
import { Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { LongText } from './fields';
import { emailProblem, onlyEmail, onlyName, onlyPhone } from '@/ui/fieldRules';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

/* Branch code suggestion: the desktop's branchPrefix rule (createForms.tsx). */
const KNOWN_PREFIXES: Record<string, string> = {
  ABUJA: 'ABJ', LAGOS: 'LAG', 'PORT HARCOURT': 'PHC', IBADAN: 'IBD', KANO: 'KAN', KADUNA: 'KAD', ENUGU: 'ENU',
  BENIN: 'BEN', 'BENIN CITY': 'BEN', IKEJA: 'IKJ', LEKKI: 'LEK', 'VICTORIA ISLAND': 'VIL', OWERRI: 'OWR', JOS: 'JOS',
  ILORIN: 'ILR', ABEOKUTA: 'ABK', CALABAR: 'CAL', UYO: 'UYO', WARRI: 'WAR', ASABA: 'ASB', AKURE: 'AKR', ONITSHA: 'ONT',
  MAIDUGURI: 'MDG', SOKOTO: 'SOK', ZARIA: 'ZAR', YOLA: 'YOL', MINNA: 'MIN', LOKOJA: 'LOK', MAKURDI: 'MKD', BAUCHI: 'BAU',
  ACCRA: 'ACC', KUMASI: 'KUM', TAKORADI: 'TKD', NAIROBI: 'NBO', LONDON: 'LDN',
};
const GENERIC_WORDS = new Set(['BRANCH', 'OFFICE', 'CENTRE', 'CENTER', 'CLINIC', 'DIAGNOSTICS', 'DIAGNOSTIC', 'LAB', 'LABORATORY', 'THE', 'AND', 'OF']);
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
export function branchPrefix(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !GENERIC_WORDS.has(w));
  if (!words.length) return '';
  const known = KNOWN_PREFIXES[words.join(' ')] ?? KNOWN_PREFIXES[words[0]!];
  if (known) return known;
  let code: string;
  if (words.length >= 3) code = words.slice(0, 3).map((w) => w[0]).join('');
  else if (words.length === 2) code = words[0]![0]! + words[1]![0]! + (words[1]![1] ?? words[0]![1] ?? '');
  else {
    const w = words[0]!;
    const consonants = [...w.slice(1)].filter((ch) => !VOWELS.has(ch));
    code = w[0]! + consonants.slice(0, 2).join('');
    if (code.length < 3) code = (code + w.slice(1).replace(new RegExp(`[${code}]`, 'g'), '')).slice(0, 3);
  }
  return code.padEnd(3, 'X').slice(0, 3);
}

/** Main towns of each Nigerian state (for the city list); any other city can be typed. */
const NG_CITIES: Record<string, string[]> = {
  Abia: ['Umuahia', 'Aba', 'Ohafia', 'Arochukwu'],
  'Abuja Federal Capital Territory': ['Abuja', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Jabi', 'Utako', 'Gwarinpa', 'Kubwa', 'Lugbe', 'Lokogoma', 'Gwagwalada', 'Kuje', 'Bwari'],
  Adamawa: ['Yola', 'Jimeta', 'Mubi', 'Numan'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron'],
  Anambra: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia'],
  Bauchi: ['Bauchi', 'Azare', 'Misau'],
  Bayelsa: ['Yenagoa', 'Brass', 'Ogbia'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo'],
  Borno: ['Maiduguri', 'Biu', 'Bama'],
  'Cross River': ['Calabar', 'Ikom', 'Ogoja'],
  Delta: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'],
  Ebonyi: ['Abakaliki', 'Afikpo'],
  Edo: ['Benin City', 'Auchi', 'Ekpoma'],
  Ekiti: ['Ado Ekiti', 'Ikere Ekiti', 'Ikole'],
  Enugu: ['Enugu', 'Nsukka', 'Agbani'],
  Gombe: ['Gombe', 'Kumo'],
  Imo: ['Owerri', 'Orlu', 'Okigwe'],
  Jigawa: ['Dutse', 'Hadejia', 'Kazaure'],
  Kaduna: ['Kaduna', 'Zaria', 'Kafanchan'],
  Kano: ['Kano', 'Wudil'],
  Katsina: ['Katsina', 'Funtua', 'Daura'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri'],
  Kogi: ['Lokoja', 'Okene', 'Idah', 'Kabba'],
  Kwara: ['Ilorin', 'Offa'],
  Lagos: ['Ikeja', 'Lagos Island', 'Victoria Island', 'Lekki', 'Ajah', 'Surulere', 'Yaba', 'Gbagada', 'Maryland', 'Ogba', 'Apapa', 'Festac', 'Ikorodu', 'Epe', 'Badagry'],
  Nasarawa: ['Lafia', 'Keffi', 'Karu', 'Akwanga'],
  Niger: ['Minna', 'Bida', 'Suleja', 'Kontagora'],
  Ogun: ['Abeokuta', 'Ijebu Ode', 'Sagamu', 'Ota'],
  Ondo: ['Akure', 'Ondo', 'Owo'],
  Osun: ['Osogbo', 'Ile Ife', 'Ilesa', 'Ede'],
  Oyo: ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin'],
  Plateau: ['Jos', 'Bukuru', 'Pankshin'],
  Rivers: ['Port Harcourt', 'Obio Akpor', 'Bonny', 'Eleme'],
  Sokoto: ['Sokoto', 'Tambuwal'],
  Taraba: ['Jalingo', 'Wukari'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua'],
  Zamfara: ['Gusau', 'Kaura Namoda'],
};

const inputCls = 'min-h-12 w-full rounded-2xl border-[1.5px] px-4 text-[15px] text-ink outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-faint border-[#dfe6f1] bg-[#f8fafd] hover:border-[#c9d5e6] focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100';

export function AddBranchSheet({ onClose }: { onClose: () => void }) {
  const { user, showToast, navigate } = useCompany();
  const cfg = useConfig();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [country, setCountry] = useState('NG');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [openedOn, setOpenedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [payMode, setPayMode] = useState<'inherit' | 'custom'>('inherit');
  const [methods, setMethods] = useState<Record<PaymentMethod, boolean>>({ ...cfg.payments.enabled });
  const [pick, setPick] = useState<'country' | 'region' | 'city' | null>(null);
  const [tried, setTried] = useState(false);

  const c = GEO_COUNTRIES.find((x) => x.code === country) ?? GEO_COUNTRIES[0]!;
  const suggested = branchPrefix(name);
  const idCode = codeTouched ? code : suggested;
  const norm = normCode(idCode);
  const codeErr = idCode ? idCodeProblem(idCode) : 'Enter a three-letter code, e.g. LAG.';
  const filled = (s: string) => s.trim().length > 0;
  const validPhones = phones.map((p) => p.trim()).filter(Boolean);
  const badPhone = validPhones.some((p) => !PHONE_RE.test(p));
  const emailBad = emailProblem(email);
  const cities = country === 'NG' ? (NG_CITIES[region] ?? []) : [];
  const errs = {
    name: filled(name) ? '' : 'Enter the branch name, e.g. Lagos.',
    code: codeErr ?? '',
    region: filled(region) ? '' : 'Choose or type the state / region.',
    city: filled(city) ? '' : 'Choose or type the city.',
    address: filled(address) ? '' : 'Enter the branch address. It prints on receipts.',
    phone: badPhone ? 'Enter valid phone numbers, e.g. 0803 123 4567.' : !validPhones.length && !filled(email) ? 'Enter a phone number or an email.' : '',
    email: emailBad ?? '',
    pay: payMode === 'custom' && !Object.values(methods).some(Boolean) ? 'Turn on at least one payment method.' : '',
  };
  const firstErr = Object.values(errs).find(Boolean);
  const steps = [
    { label: 'Identity', done: !errs.name && !errs.code },
    { label: 'Location', done: !errs.region && !errs.city && !errs.address },
    { label: 'Contact', done: !errs.phone && !errs.email },
    { label: 'Setup', done: !errs.pay },
  ];
  const show = (k: keyof typeof errs) => (tried && errs[k] ? <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{errs[k]}</span> : null);

  const save = () => {
    setTried(true);
    if (firstErr) return;
    const phone = validPhones.map((p) => (p.startsWith('+') || p.startsWith('0') ? p : `${c.dial} ${p}`)).join(', ');
    const b = addBranch({ name: name.trim(), idCode: norm, city: city.trim(), state: region.trim(), country: c.name, address: address.trim(), phone, email: email.trim(), contactPerson: contact.trim(), openedOn, timezone: 'Africa/Lagos' }, user.name);
    updateBranchContact(b.id, { address: address.trim(), phone });
    updateBranchProfile(b.id, { email: email.trim(), hours: hours.trim() });
    if (payMode === 'custom') setBranchPayments(b.id, methods, user.name);
    showToast(`${b.name} branch created. Pending setup until you activate it`);
    onClose();
    navigate(`/branches/${b.id}`);
  };

  return (
    <Sheet
      title={name.trim() ? `Add ${name.trim()}` : 'Add a branch'}
      subtitle="Saved as Pending setup until you activate it"
      onClose={onClose}
      tall
      footer={
        <button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15.5px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]">
          Save branch
        </button>
      }
    >
      <div className="px-1 pb-3">
        {/* Progress */}
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {steps.map((s) => (
            <span key={s.label} className="min-w-0">
              <span className={`block h-1.5 rounded-full ${s.done ? 'bg-good' : 'bg-line'}`} />
              <span className={`mt-1 block truncate text-center text-[11px] font-semibold ${s.done ? 'text-good-ink' : 'text-muted'}`}>{s.label}</span>
            </span>
          ))}
        </div>

        {/* Preview */}
        <div className="relative mb-4 overflow-hidden rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#d3e4ff] p-4">
          <p className="text-[12px] font-semibold text-brand-700">New branch</p>
          <p className="mt-0.5 max-w-[70%] truncate text-[20px] font-bold text-ink">{name.trim() ? `${name.trim()} branch` : 'Your new branch'}</p>
          <p className="mt-0.5 max-w-[70%] text-[12.5px] text-ink-2">{[city, region, c.name].filter(Boolean).join(', ')}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-ink">Code {norm || '...'}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-ink">{norm.length === 3 ? `${norm}-R000001 · ${norm}-W000001` : 'Patient IDs'}</span>
            <span className="rounded-full bg-[#fff1e0] px-2 py-0.5 text-[#b45309]">Pending setup</span>
          </div>
          <Sticker name="hospital" size={76} className="absolute right-2 top-3" />
        </div>

        <Section title="Branch identity" sticker="hospital">
          <Label text="Branch name" required>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="e.g. Lagos or Wuse II" className={inputCls} />
            {show('name')}
          </Label>
          <Label text="Branch code (3 letters)" required>
            <div className="relative">
              <input
                value={idCode}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(normCode(e.target.value).slice(0, 3));
                }}
                placeholder="LAG"
                maxLength={3}
                className={`${inputCls} font-mono uppercase tracking-[0.2em]`}
              />
              {!codeTouched && suggested && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Suggested</span>}
            </div>
            {tried && errs.code ? show('code') : <span className="mt-1 block text-[12px] text-muted">{norm.length === 3 && !codeErr ? `Patient IDs: ${norm}-R000001 (referred) · ${norm}-W000001 (walk in). Unique, and can’t change once patients have IDs.` : codeErr && idCode.length === 3 ? codeErr : 'Suggested from the name, e.g. Abuja = ABJ, Lagos = LAG.'}</span>}
          </Label>
        </Section>

        <Section title="Location" sticker="calendar" icon={<MapPin size={16} />}>
          <Label text="Country" required>
            <Picker onClick={() => setPick('country')} lead={<b className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[12px] text-brand-700">{c.code}</b>} value={c.name} />
          </Label>
          <Label text="State / region / province" required>
            {c.regions.length ? <Picker onClick={() => setPick('region')} value={region} placeholder={`Choose from ${c.regions.length} in ${c.name}`} /> : <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="State, region or province" className={inputCls} />}
            {show('region')}
          </Label>
          <Label text="City" required>
            <Picker onClick={() => setPick('city')} value={city} placeholder={cities.length ? `Choose a city in ${region}` : region ? 'Type the city' : 'Choose the state first, or type the city'} />
            {show('city')}
          </Label>
          <Label text="Full address" required>
            <LongText value={address} onChange={setAddress} max={240} placeholder={"For example:\n12 Admiralty Way, Lekki Phase 1\nOpposite the filling station"} hint="Street, building, area and a landmark. Press Enter for a new line. Printed on receipts." />
            {show('address')}
          </Label>
        </Section>

        <Section title="Contact" sticker="speech" icon={<Phone size={16} />}>
          <Label text="Branch phone numbers">
            <div className="space-y-2">
              {phones.map((ph, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid min-h-12 shrink-0 place-items-center rounded-2xl bg-page px-3 text-[14px] font-semibold text-ink-2">{c.dial || '+'}</span>
                  <input value={ph} onChange={(e) => setPhones((l) => l.map((x, j) => (j === i ? onlyPhone(e.target.value) : x)))} type="tel" inputMode="tel" placeholder={i === 0 ? 'Main line' : ['Front desk line', 'Lab line', 'After-hours line', 'Another line'][i - 1]} aria-label={`Phone number ${i + 1}`} className={inputCls} />
                  {phones.length > 1 && (
                    <button type="button" onClick={() => setPhones((l) => l.filter((_, j) => j !== i))} aria-label={`Remove phone number ${i + 1}`} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-page text-muted">
                      <X size={17} />
                    </button>
                  )}
                </div>
              ))}
              {phones.length < 5 && (
                <button type="button" onClick={() => setPhones((l) => [...l, ''])} className="press flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-brand-300 text-[14px] font-semibold text-brand-600">
                  <Plus size={17} /> Add another phone number
                </button>
              )}
            </div>
            {tried && errs.phone ? show('phone') : <span className="mt-1 block text-[12px] text-muted">Add more for the front desk, lab or after-hours line.</span>}
          </Label>
          <Label text="Email address">
            <input value={email} onChange={(e) => setEmail(onlyEmail(e.target.value))} type="email" inputMode="email" autoCapitalize="off" spellCheck={false} placeholder="lagos@gmail.com" className={inputCls} />
            {show('email')}
          </Label>
          <Label text="Branch contact person">
            <input value={contact} onChange={(e) => setContact(onlyName(e.target.value))} placeholder="Until a manager is appointed" autoCapitalize="words" className={inputCls} />
          </Label>
        </Section>

        <Section title="Configuration" sticker="sparkles">
          <Label text="Currency">
            <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-page px-4 text-[15px] text-ink">
              <Lock size={15} className="text-muted" /> NGN · Nigerian naira
            </div>
            <span className="mt-1 block text-[12px] text-muted">A branch records every amount in one currency. Company totals keep currencies apart.</span>
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Label text="Opening date">
              <input type="date" value={openedOn} onChange={(e) => setOpenedOn(e.target.value)} className={inputCls} />
            </Label>
            <Label text="Opening hours">
              <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon to Sat, 7:30am to 8pm" className={inputCls} />
            </Label>
          </div>
          <Label text="Payment methods">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['inherit', 'Use company settings', `${PAYMENT_METHODS.filter((m) => cfg.payments.enabled[m]).join(', ')}. Follows company changes.`],
                  ['custom', 'Customise', 'Choose this branch’s own methods.'],
                ] as const
              ).map(([k, t, s]) => (
                <button key={k} type="button" onClick={() => setPayMode(k)} aria-pressed={payMode === k} className={`press rounded-2xl border p-3 text-left ${payMode === k ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-line bg-white'}`}>
                  <span className={`block text-[14px] font-semibold ${payMode === k ? 'text-brand-700' : 'text-ink'}`}>{t}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{s}</span>
                </button>
              ))}
            </div>
            {payMode === 'custom' && (
              <div className="mt-2 divide-y divide-line rounded-2xl bg-page">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMethods((x) => ({ ...x, [m]: !x[m] }))} aria-pressed={methods[m]} className="press flex w-full items-center justify-between px-4 py-3 text-left text-[14.5px] text-ink">
                    {m === 'Transfer' ? 'Bank transfer' : m}
                    <span className={`relative h-7 w-12 rounded-full transition-colors ${methods[m] ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${methods[m] ? 'left-[22px]' : 'left-0.5'}`} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {show('pay')}
          </Label>
        </Section>

        {tried && firstErr && <p className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[13px] font-medium text-[#b42318]">Check the highlighted fields: {firstErr}</p>}
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">Nothing is invented for a new branch. Its figures start at zero, and the service catalogue and prices are company-wide.</p>
      </div>

      {pick === 'country' && (
        <PickSheet
          title="Country"
          value={c.code}
          options={GEO_COUNTRIES.map((x) => ({ value: x.code, label: x.name, sub: `${x.code} · ${x.dial}` }))}
          onPick={(v) => {
            setCountry(v);
            setRegion('');
            setCity('');
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      )}
      {pick === 'region' && (
        <PickSheet
          title={`State / region in ${c.name}`}
          value={region}
          options={c.regions.map((r) => ({ value: r, label: r, sub: country === 'NG' && NG_CITIES[r] ? NG_CITIES[r]!.slice(0, 3).join(', ') : undefined }))}
          onPick={(v) => {
            setRegion(v);
            setCity('');
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      )}
      {pick === 'city' && <PickSheet title={region ? `City in ${region}` : 'City'} value={city} options={cities.map((x) => ({ value: x, label: x }))} custom onPick={(v) => (setCity(v), setPick(null))} onClose={() => setPick(null)} />}
    </Sheet>
  );
}

function Section({ title, sticker, children }: { title: string; sticker: 'hospital' | 'calendar' | 'speech' | 'sparkles'; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
      <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-ink">
        <Sticker name={sticker} size={26} /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Label({ text, required, children }: { text: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">
        {text} {required && <span className="text-[#d93036]">*</span>}
      </span>
      {children}
    </div>
  );
}

function Picker({ value, placeholder, lead, onClick }: { value: string; placeholder?: string; lead?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex min-h-12 w-full items-center gap-2 rounded-2xl border-[1.5px] border-brand-500 bg-white px-4 text-left ring-4 ring-brand-100">
      {lead}
      <span className={`min-w-0 flex-1 truncate text-[15px] ${value ? 'text-ink' : 'text-faint'}`}>{value || placeholder}</span>
      <ChevronDown size={18} className="shrink-0 text-muted" />
    </button>
  );
}

/** A searchable list in a slide-up (country, state, city). `custom` lets the person use what they typed. */
function PickSheet({ title, value, options, custom, onPick, onClose }: { title: string; value: string; options: { value: string; label: string; sub?: string }[]; custom?: boolean; onPick: (v: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const list = useMemo(() => options.filter((o) => !t || `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(t)), [options, t]);
  const typed = q.trim().replace(/\s+/g, ' ').replace(/(^|\s)\S/g, (s) => s.toUpperCase());
  return (
    <Sheet back title={title} subtitle={`${options.length ? `${options.length} to choose from` : 'Type it in'}${custom ? ', or type your own' : ''}`} onClose={onClose} tall={options.length > 8} search={custom ? undefined : { value: q, onChange: setQ, placeholder: 'Search' }}>
      {custom && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={options.length ? 'Search or type the city' : 'Type the city'} aria-label="City" className={`${inputCls} mb-2`} />}
      {custom && typed && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase()) && (
        <button type="button" onClick={() => onPick(typed)} className="press mb-2 flex w-full items-center gap-3 rounded-2xl bg-brand-50 px-3 py-3 text-left">
          <Plus size={18} className="text-brand-600" />
          <span className="text-[14.5px] font-semibold text-brand-700">Use “{typed}”</span>
        </button>
      )}
      <ul>
        {list.map((o) => (
          <li key={o.value}>
            <button type="button" onClick={() => onPick(o.value)} className={`press flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left ${o.value === value ? 'bg-brand-50' : 'hover:bg-page'}`}>
              <span className="min-w-0">
                <span className={`block truncate text-[15px] ${o.value === value ? 'font-bold text-brand-700' : 'font-medium text-ink'}`}>{o.label}</span>
                {o.sub && <span className="block truncate text-[12px] text-muted">{o.sub}</span>}
              </span>
              {o.value === value && <Check size={18} className="shrink-0 text-brand-600" />}
            </button>
          </li>
        ))}
      </ul>
      {!list.length && options.length > 0 && !custom && <p className="py-8 text-center text-[14px] text-muted">Nothing matches “{q}”.</p>}
    </Sheet>
  );
}
