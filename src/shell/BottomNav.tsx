/** Bottom tab bar (phones): Home · Referrals · New request (raised blue button) · Test catalogue · More (owner, 2026-11-26). */
import { ClipboardList, FlaskConical, Home, LayoutGrid, Plus } from 'lucide-react';
import { useApp } from '@/app/store';
import { tabOf, type Tab } from '@/app/routes';

/** Filled house with a door, like the reference's active Home tab. */
function SolidHome() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" className="text-brand-600">
      <path fill="currentColor" d="M11.2 2.6a1.3 1.3 0 0 1 1.6 0l8 6.4c.3.25.5.62.5 1.02V20a2 2 0 0 1-2 2h-4.2v-6.2a1 1 0 0 0-1-1h-4.2a1 1 0 0 0-1 1V22H4.7a2 2 0 0 1-2-2v-9.98c0-.4.18-.77.5-1.02z" />
    </svg>
  );
}

export function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { route, navigate } = useApp();
  const tab: Tab | null = moreOpen ? 'more' : tabOf(route);
  const item = (id: Tab, label: string, Icon: typeof Home, to: string) => {
    const on = tab === id;
    return (
      <button type="button" onClick={() => (id === 'more' ? onMore() : navigate(to))} aria-current={on ? 'page' : undefined} className="press flex min-h-15 flex-col items-center justify-center gap-1">
        {id === 'home' && on ? <SolidHome /> : <Icon size={25} strokeWidth={on ? 2.3 : 1.7} className={on ? 'text-brand-600' : 'text-[#6b778c]'} />}
        <span className={`text-[12.5px] ${on ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>{label}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(8px,var(--safe-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(30,74,160,0.08)] backdrop-blur-xl md:hidden">
      {item('home', 'Home', Home, '/')}
      {item('referrals', 'Referrals', ClipboardList, '/referrals')}
      <button type="button" onClick={() => navigate('/refer')} aria-label="New request" className="press flex flex-col items-center">
        <span className="-mt-7 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_10px_24px_rgba(31,111,232,0.45)]">
          <Plus size={32} strokeWidth={2.6} />
        </span>
        <span className={`mt-1 text-[12.5px] ${tab === 'refer' ? 'font-semibold' : 'font-medium'} text-brand-600`}>Request</span>
      </button>
      {item('catalogue', 'Catalogue', FlaskConical, '/services')}
      {item('more', 'More', LayoutGrid, '')}
    </nav>
  );
}
