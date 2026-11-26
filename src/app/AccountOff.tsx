/**
 * Shown to a referring clinician (PR agent) whose account the Branch Manager
 * or Company Admin has deactivated (owner, 2026-11-26). Nothing is deleted;
 * the branch can turn it back on. Until login exists, the developer role
 * switch stays here so the other workspaces can still be opened.
 */
import { PowerOff } from 'lucide-react';
import { ROLES, setRole, useRole } from '@/domain/role';

export function AccountOff() {
  const role = useRole();
  return (
    <div className="grid min-h-dvh place-items-center bg-page px-6 pb-[var(--safe-bottom)] pt-[var(--safe-top)]">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#ffe4e4] text-[#b42318]">
          <PowerOff size={28} />
        </span>
        <h1 className="mt-5 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Your account is turned off</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">The branch has deactivated this account, so you can't send referrals or see your patients for now. Your records are kept. Please contact the Branch Manager if you think this is a mistake.</p>
        <div className="mt-8 rounded-2xl bg-white p-2 text-left ring-1 ring-line">
          <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">VIEWING AS (UNTIL LOGIN)</p>
          <div className="grid grid-cols-2 gap-1">
            {ROLES.map((r) => (
              <button key={r.id} type="button" onClick={() => r.id !== role && setRole(r.id)} className={`press rounded-xl px-2 py-2 text-[12px] font-semibold ${r.id === role ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
