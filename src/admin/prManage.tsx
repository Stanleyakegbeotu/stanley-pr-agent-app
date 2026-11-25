/**
 * PR Management actions (mobile, owner 2026-11-25), same rules as the desktop
 * PRCatalog / createForms / AdminLogs:
 *  • RateSheet: the company commission rate (0% to 50%; usual 10%, 15%, 20%).
 *    Agents with their own rate keep it.
 *  • AgentEditSheet: name, phone (blank = "N/A"), hospital transfer (pick a
 *    hospital or type a new code) and the agent's own commission rate. Edits
 *    are overrides; the legacy record is never modified and can be restored.
 *  • AddAgentSheet: a new PR agent for the legacy branch (BR001), optional
 *    phone and hospital.
 *  • TrashSheet: "Move to trash" with an optional reason; Trash keeps it 30 days.
 */
import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { TRASH_RETENTION_DAYS, useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID, buildHospitalDirectory, hasPhone, hospitalKey } from '@company/data/legacy';
import { nextUserId } from '@company/data/userRecords';
import { COMMON_RATES, agentRate, hasAgentRates, pct, rateSummary, setAgentRate, setCompanyRate, useCommission } from '@company/services/commission';
import { formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { LongText } from './fields';
import { RuleInput } from './fields';
import { nameProblem, phoneProblem } from '@/ui/fieldRules';

const NO_HOSPITAL = 'No hospital assigned';
export const inputCls = (err?: string | null) => `min-h-12 w-full rounded-2xl border-[1.5px] bg-white px-4 text-[15px] text-ink outline-none ring-4 ${err ? 'border-[#e5484d] ring-[#fde3e3]' : 'border-brand-500 ring-brand-100'}`;
/** Capitalise each word as it is typed (desktop nameCase rule). */
export const nameCase = (v: string) => v.replace(/(^|[\s'-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

export function FieldLabel({ label, optional, required }: { label: string; optional?: boolean; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[14px] font-semibold text-ink">
      {label} {required && <span className="text-[#d93036]">*</span>}
      {optional && <span className="text-[12.5px] font-normal text-muted">Optional</span>}
    </span>
  );
}
export const FieldErr = ({ msg }: { msg?: string | null }) => (msg ? <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{msg}</span> : null);

/* ─────────────── company commission rate ─────────────── */

export function RateSheet({ onClose }: { onClose: () => void }) {
  const { showToast } = useNav();
  const commission = useCommission();
  const [value, setValue] = useState(String(+(commission.rate * 100).toFixed(2)));
  const n = Number(value);
  const error = !value.trim() || !Number.isFinite(n) || n < 0 || n > 50 ? 'Enter a rate between 0% and 50%.' : null;
  const own = Object.keys(commission.overrides).length;
  const save = () => {
    if (error) return;
    setCompanyRate(n / 100);
    showToast(`Company commission rate set to ${pct(n / 100)}`);
    onClose();
  };
  return (
    <Sheet
      title="Commission rate"
      subtitle="Paid to PR agents on their referred patients' bills"
      onClose={onClose}
      footer={
        <button type="button" disabled={!!error} onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
          Save rate
        </button>
      }
    >
      <div className="px-1 pb-2">
        <FieldLabel label="Company rate" />
        <div className="relative">
          <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label="Company commission rate in percent" className={`${inputCls(error)} pr-10 text-[20px] font-bold`} />
          <b className="absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-muted">%</b>
        </div>
        <FieldErr msg={error} />
        <div className="mt-3 flex gap-2" role="group" aria-label="Usual rates">
          {COMMON_RATES.map((r) => {
            const on = Math.abs(n / 100 - r) < 1e-9;
            return (
              <button key={r} type="button" onClick={() => setValue(String(+(r * 100).toFixed(2)))} className={`press min-h-10 flex-1 rounded-xl text-[14px] font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                {pct(r)}
                {r === 0.2 && <span className={`ml-1 text-[11px] font-normal ${on ? 'text-white/80' : 'text-muted'}`}>rare</span>}
              </button>
            );
          })}
        </div>
        {!error && (
          <p className="mt-3 rounded-2xl bg-tint-purple p-3 text-[13px] text-violet">
            Example: a patient whose tests total ₦100,000 earns the agent <b>{formatMoney((100_000 * n) / 100, 'NGN')}</b>.
          </p>
        )}
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12.5px] leading-snug text-muted">
          <li>Applies to every PR agent without their own rate{own ? `. ${own} agent${own === 1 ? ' has' : 's have'} their own rate and keep it` : ''}.</li>
          <li>Updates commission on PR Management, Finance and Expenses, the dashboard and every report straight away.</li>
          <li>An agent's own rate is set on their profile, under Edit profile.</li>
          <li>Saved for this session until the database is connected.</li>
        </ul>
        {hasAgentRates() && <p className="mt-2 text-[12.5px] text-ink-2">Current: {rateSummary()}.</p>}
      </div>
    </Sheet>
  );
}

/* ─────────────── hospital picker (search or type a new code) ─────────────── */

function HospitalPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { agents } = useCompany();
  const directory = useMemo(() => buildHospitalDirectory(agents), [agents]);
  const [q, setQ] = useState('');
  const t = q.trim().toUpperCase();
  const list = directory.filter((h) => !t || h.key.includes(t) || h.rawVariants.some((r) => r.toUpperCase().includes(t))).slice(0, 40);
  const exact = directory.some((h) => h.key === t);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a new hospital code" aria-label="Search hospitals" className={inputCls()} />
      <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl bg-page p-1">
        {!t && <Opt on={!value} label={NO_HOSPITAL} sub="Kept separate, never guessed into a hospital" onClick={() => onChange('')} />}
        {t && !exact && <Opt on={false} label={`Use new hospital code “${t}”`} sub="Creates a new hospital code" onClick={() => (onChange(t), setQ(''))} plus />}
        {list.map((h) => (
          <Opt key={h.key} on={value === h.key} label={h.key} sub={`${h.agentCount} agent${h.agentCount === 1 ? '' : 's'}`} onClick={() => (onChange(h.key), setQ(''))} />
        ))}
      </div>
    </div>
  );
}

function Opt({ on, label, sub, onClick, plus }: { on: boolean; label: string; sub?: string; onClick: () => void; plus?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`press flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left ${on ? 'bg-white shadow-sm' : ''}`}>
      <span className="min-w-0">
        <span className={`flex items-center gap-1.5 text-[14px] ${on ? 'font-semibold text-brand-700' : plus ? 'font-semibold text-brand-600' : 'text-ink'}`}>
          {plus && <Plus size={15} />}
          {label}
        </span>
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </span>
      {on && <Check size={16} className="shrink-0 text-brand-600" />}
    </button>
  );
}

/* ─────────────── edit an agent ─────────────── */

export function AgentEditSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const { agents, editAgent } = useCompany();
  const { showToast } = useNav();
  const commission = useCommission();
  const agent = agents.find((a) => a.id === id)!;
  const key = hospitalKey(agent.hospital);
  const [name, setName] = useState(agent.name);
  const [phone, setPhone] = useState(hasPhone(agent.phone) ? agent.phone : '');
  const [hospital, setHospital] = useState(key);
  const own = agentRate(id);
  const [useOwn, setUseOwn] = useState(own !== undefined);
  const [ownPct, setOwnPct] = useState(String(+((own ?? commission.rate) * 100).toFixed(2)));
  const [tried, setTried] = useState(false);
  const pctNum = Number(ownPct);
  const errs = {
    name: nameProblem(name),
    phone: phoneProblem(phone),
    rate: useOwn && (!ownPct.trim() || !Number.isFinite(pctNum) || pctNum < 0 || pctNum > 50) ? 'Enter a rate between 0% and 50%.' : null,
  };
  const detailsChanged = name.trim() !== agent.name || (phone.trim() || 'N/A') !== agent.phone || hospital !== key;
  const rateChanged = useOwn ? own === undefined || Math.abs(own * 100 - pctNum) > 1e-9 : own !== undefined;
  const changed = detailsChanged || rateChanged;
  const save = () => {
    setTried(true);
    if (errs.name || errs.rate || errs.phone) return;
    if (detailsChanged) editAgent(id, { name, phone, hospital });
    if (rateChanged) setAgentRate(id, useOwn ? pctNum / 100 : null, name.trim());
    showToast(hospital !== key ? `${name.trim()} transferred to ${hospital || 'no hospital'}` : `${name.trim()} updated`);
    onClose();
  };
  return (
    <Sheet
      back
      title="Edit profile"
      subtitle={`${agent.name} · Agent #${id}`}
      onClose={onClose}
      tall
      footer={
        <button type="button" disabled={!changed} onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
          Save changes
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} showError={tried} />
        <RuleInput kind="phone" label="Phone number" optional value={phone} onChange={setPhone} showError={tried} placeholder="Leave blank if unknown" hint="Numbers only. A blank phone is saved as “N/A”, as in the legacy records." />
        <div>
          <FieldLabel label={`Assigned hospital · ${hospital || NO_HOSPITAL}`} optional />
          <HospitalPick value={hospital} onChange={setHospital} />
          {hospital !== key && (
            <p className="mt-2 rounded-2xl bg-brand-50 p-3 text-[13px] text-brand-800">
              Transfer: <b>{key || NO_HOSPITAL}</b> to <b>{hospital || NO_HOSPITAL}</b>. The agent moves to the new hospital's list straight away.
            </p>
          )}
        </div>
        <div>
          <FieldLabel label="Commission rate" />
          <div className="space-y-2">
            <RateOpt on={!useOwn} title={`Company rate · ${pct(commission.rate)}`} sub="Follows the rate set on PR Management." onClick={() => setUseOwn(false)} />
            <RateOpt on={useOwn} title="Own rate for this agent" sub="Replaces the company rate for this agent only." onClick={() => setUseOwn(true)} />
          </div>
          {useOwn && (
            <div className="drop-down mt-2 rounded-2xl bg-page p-3">
              <div className="flex gap-2">
                {COMMON_RATES.map((r) => (
                  <button key={r} type="button" onClick={() => setOwnPct(String(+(r * 100).toFixed(2)))} className={`press min-h-10 flex-1 rounded-xl text-[14px] font-semibold ${Math.abs(pctNum / 100 - r) < 1e-9 ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                    {pct(r)}
                  </button>
                ))}
              </div>
              <div className="relative mt-2">
                <input value={ownPct} onChange={(e) => setOwnPct(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label="Own commission rate in percent" className={`${inputCls(tried ? errs.rate : null)} pr-10`} />
                <b className="absolute right-4 top-1/2 -translate-y-1/2 text-muted">%</b>
              </div>
              <FieldErr msg={tried ? errs.rate : null} />
            </div>
          )}
        </div>
        <p className="text-[12px] text-muted">Account details are changed from the Account details card on the profile. Changes last for this session until the database is connected.</p>
      </div>
    </Sheet>
  );
}

function RateOpt({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`press flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 ${on ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-line'}`}>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand-600' : 'border-[#c4cedd]'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
      <span>
        <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[12.5px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

/* ─────────────── add an agent ─────────────── */

export function AddAgentSheet({ hospital: initial = '', onClose, onAdded }: { hospital?: string; onClose: () => void; onAdded?: (id: number) => void }) {
  const { addAgent, userAgents } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hospital, setHospital] = useState(initial);
  const [tried, setTried] = useState(false);
  const branch = getBranch(LEGACY_BRANCH_ID);
  const err = nameProblem(name) ?? phoneProblem(phone);
  const save = () => {
    setTried(true);
    if (err) return;
    const rec = addAgent({ name, phone, hospital: hospital ? hospitalKey(hospital) : '' });
    showToast(`${rec.name} added${rec.hospital ? ` to ${rec.hospital}` : ''}`);
    onAdded?.(rec.id);
    onClose();
  };
  return (
    <Sheet
      title={name.trim() ? `Add ${name.trim()}` : 'Add a PR agent'}
      subtitle="Doctors and representatives who refer patients"
      onClose={onClose}
      tall
      footer={
        <button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          Add PR agent
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <div className="flex items-center gap-3 rounded-[20px] bg-linear-to-br from-[#f3eeff] to-[#e4dbff] p-3.5">
          <Sticker name="stethoscope" size={48} />
          <div className="min-w-0 text-[13px] text-ink-2">
            <p>
              Agent ID <b className="text-ink">#{nextUserId(userAgents)}</b> · {branch?.name} · {branch?.code}
            </p>
            <p>Hospital: {hospital ? hospitalKey(hospital) : 'Unassigned'}</p>
            <p>Phone: {phone.trim() || 'N/A'}</p>
          </div>
        </div>
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} placeholder="For example Dr Amaka Obi" showError={tried} />
        <RuleInput kind="phone" label="Phone number" optional value={phone} onChange={setPhone} showError={tried} hint="Numbers only. Leave blank if unknown; it is saved as “N/A”." />
        <div>
          <FieldLabel label={`Assigned hospital · ${hospital || NO_HOSPITAL}`} optional />
          <HospitalPick value={hospital} onChange={setHospital} />
          <span className="mt-1 block text-[12px] text-muted">Hospitals are listed from existing agent assignments. Typing a code that isn't listed creates a new one.</span>
        </div>
        <p className="text-[12px] text-muted">New agents are stored separately from the legacy records, which are never modified.</p>
      </div>
    </Sheet>
  );
}

/* ─────────────── move to trash ─────────────── */

export function TrashSheet({ name, what, onConfirm, onClose }: { name: string; what: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      back
      title={`Move ${name} to trash?`}
      subtitle={`Kept in Trash for ${TRASH_RETENTION_DAYS} days`}
      onClose={onClose}
      footer={
        <button type="button" onClick={() => onConfirm(reason)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white">
          <Trash2 size={18} /> Move to trash
        </button>
      }
    >
      <div className="px-1 pb-2">
        <p className="mb-3 text-[14px] text-ink-2">{`The ${what} is kept in Trash for ${TRASH_RETENTION_DAYS} days and can be restored until then.`}</p>
        <LongText label="Reason" optional value={reason} onChange={setReason} max={300} placeholder="For example: added by mistake, the same agent is already on the list." hint="Recorded in Trash and the Audit Log." />
      </div>
    </Sheet>
  );
}
