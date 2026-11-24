/**
 * Navigation: a slide-in drawer on phones (it opens BELOW the screen's top
 * bar so the iPhone notch can never cover it) and a permanent rail on
 * tablets / desktop.
 */
import { ChevronRight, MapPin, Settings, Stethoscope, X } from 'lucide-react';
import { BRANCH, COMPANY, ROLE_LABEL } from '@/config/org';
import { useApp } from '@/app/store';
import { useInbox } from '@/domain/chat';
import { useProfile } from '@/domain/profile';
import { NAV_GROUPS, isActive } from './nav';

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { unread } = useInbox();
  const me = useProfile();
  const { route, navigate } = useApp();
  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  return (
    <>
      {open && <button aria-label="Close menu" className="fixed inset-x-0 bottom-0 top-[calc(4rem+var(--safe-top))] z-40 bg-[#0b1730]/30 backdrop-blur-[2px] md:hidden" onClick={onClose} />}
      <aside
        aria-label="Main menu"
        className={`fixed bottom-0 left-0 top-[calc(4rem+var(--safe-top))] z-50 flex w-[286px] flex-col rounded-tr-3xl border-r border-line bg-white pb-[var(--safe-bottom)] transition-[transform,box-shadow] duration-300 md:top-0 md:w-[264px] md:translate-x-0 md:rounded-none md:shadow-none ${open ? 'translate-x-0 shadow-[10px_0_40px_rgba(11,23,48,0.12)]' : '-translate-x-full shadow-none'}`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <button type="button" onClick={() => go('/')} className="flex items-center gap-2.5 text-left" aria-label="Dashboard">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_6px_14px_rgba(31,111,232,0.3)]">
              <Stethoscope size={22} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block text-[21px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">{COMPANY.appName}</span>
              <span className="mt-1 block text-[9.5px] font-semibold tracking-[0.25em] text-muted">{COMPANY.appTagline}</span>
            </span>
          </button>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 md:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-faint">{g.label}</p>
              {g.items.map((it) => {
                const on = isActive(it.to, route.path);
                return (
                  <button
                    key={it.to}
                    type="button"
                    onClick={() => go(it.to)}
                    aria-current={on ? 'page' : undefined}
                    className={`press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-2 hover:bg-page'}`}
                  >
                    <it.icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                    <span className="flex-1">{it.label}</span>
                    {(it.to === '/messages' ? unread : it.badge) ? <span className="rounded-md bg-brand-100 px-1.5 text-[12px] font-semibold text-brand-700">{it.to === '/messages' ? unread : it.badge}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <button type="button" onClick={() => go('/branch')} className="press mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-3 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600">
            <MapPin size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted">
              <i className="h-1.5 w-1.5 rounded-full bg-good" /> YOUR BRANCH
            </span>
            <span className="block truncate text-[14px] font-semibold text-ink">{BRANCH.label}</span>
          </span>
          <ChevronRight size={18} className="text-muted" />
        </button>

        <button type="button" onClick={() => go('/profile')} className="flex items-center gap-3 border-t border-line px-5 py-3.5 text-left">
          <img src={me.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{me.name}</span>
            <span className="block text-[12.5px] text-muted">
              {ROLE_LABEL} · {me.clinician?.id}
            </span>
          </span>
          <Settings size={18} className="text-muted" />
        </button>
      </aside>
    </>
  );
}
