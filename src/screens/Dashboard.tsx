/**
 * Dashboard (owner's reference): greeting + photo, search, announcement
 * carousel, Today's Activity, Monthly Target and Quick Actions. Every figure
 * is worked out from the referrals (domain/referrals.ts) — nothing typed in.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, Building2, Check, ChevronRight, Database, FlaskConical, Gift, Menu, MessageCircle, Sparkles, Star, Target, UserPlus, Users } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { AGENT, BRANCH, RULES, agentName } from '@/config/org';
import { naira, timeOfDay } from '@/domain/format';
import { inPeriod, statsFor } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { useShell } from '@/app/shell';
import { FilterButton, ProgressBar, SearchField, SectionTitle } from '@/ui/kit';
import { useInbox } from '@/domain/chat';
import { useProfile } from '@/domain/profile';
import { BankRequiredCard } from '@/screens/BankDetails';
import { BranchUpdates, TodayPatients } from '@/screens/home/HomeSections';
import { AnnouncementCarousel } from './AnnouncementCarousel';

export function Dashboard() {
  const { referrals, navigate, showToast } = useApp();
  const inbox = useInbox();
  const me = useProfile();
  const { openMenu } = useShell();
  const [q, setQ] = useState('');
  // The top bar is see-through at the top and frosts once content scrolls under it.
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const today = statsFor(referrals, 'today');
  const monthCount = referrals.filter((r) => inPeriod(r.createdAt, 'month') && r.status !== 'Cancelled').length;
  const pct = Math.round((monthCount / RULES.monthlyReferralTarget) * 100);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/services?q=${encodeURIComponent(q.trim())}` : '/services');
  };

  const invite = async () => {
    const text = `Join me as a ${AGENT.role} with ${BRANCH.label}. Refer patients for diagnostics and earn commission.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Become a Stanley PR Agent', text });
      else {
        await navigator.clipboard.writeText(text);
        showToast('Invitation copied, paste it into WhatsApp or SMS');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="relative">
      {/* Soft blue glow behind the top of the screen, as in the reference. */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-5 -top-0 -z-0 h-[460px] bg-[radial-gradient(120%_70%_at_75%_0%,#d6e6ff_0%,#e9f1ff_45%,rgba(244,248,254,0)_100%)] md:-inset-x-8" />

      <div ref={sentinel} className="absolute top-0 h-px w-px" aria-hidden="true" />
      <header className={`sticky top-0 z-30 -mx-5 flex min-h-16 items-center justify-between px-5 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-300 md:-mx-8 md:px-8 ${scrolled ? 'bg-[#eef4fe]/90 shadow-[0_6px_20px_rgba(30,74,160,0.08)] backdrop-blur-xl' : 'bg-transparent'}`}>
        <button type="button" onClick={openMenu} aria-label="Menu" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-ink md:invisible">
          <Menu size={26} strokeWidth={2} />
        </button>
        <span className="-mr-2 flex items-center gap-1">
          <button type="button" onClick={() => navigate('/messages')} aria-label={inbox.unread ? `Inbox, ${inbox.unread} unread` : 'Inbox'} className="press relative grid h-11 w-11 place-items-center rounded-full text-ink">
            <MessageCircle size={25} strokeWidth={1.9} />
            {inbox.unread > 0 && <span className="absolute right-0.5 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#e9f1ff]">{inbox.unread > 9 ? '9+' : inbox.unread}</span>}
          </button>
          <button type="button" onClick={() => navigate('/notifications')} aria-label="Notifications, 3 new" className="press relative grid h-11 w-11 place-items-center rounded-full text-ink">
            <Bell size={26} strokeWidth={1.9} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-[#e9f1ff]" />
          </button>
        </span>
      </header>

      <div className="relative">
        {/* Greeting */}
        <section className="mb-5 flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="text-[17px] text-ink-2">{timeOfDay()}</p>
            <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {me.name}&nbsp;<span aria-hidden="true">👋</span>
            </h1>
            <span className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-brand-100/80 py-1 pl-1.5 pr-3 text-[14px] font-medium text-ink-2">
              <span className="grid h-5.5 w-5.5 place-items-center rounded-full bg-linear-to-b from-[#ffd34d] to-[#f5a400] text-white">
                <Star size={12} fill="currentColor" strokeWidth={0} />
              </span>
              {AGENT.role}
            </span>
            <button type="button" onClick={() => navigate('/branch')} className="mt-2.5 flex items-center gap-2 text-left text-[15px] text-ink-2">
              <Building2 size={18} className="shrink-0 text-muted" />
              <span className="truncate">{BRANCH.label}</span>
              <ChevronRight size={17} className="shrink-0" />
            </button>
          </div>
          <button type="button" onClick={() => navigate('/profile')} aria-label="My profile" className="press h-[96px] w-[96px] shrink-0 overflow-hidden rounded-full bg-linear-to-b from-[#cfe2ff] to-[#9cc3ff] p-[3px] shadow-[0_14px_30px_rgba(31,111,232,0.22)]">
            <img src={me.photo} alt="" className="h-full w-full rounded-full object-cover" />
          </button>
        </section>

        {/* Required settings (owner): bank details until added */}
        <BankRequiredCard />
        <BranchUpdates />

        {/* Search */}
        <form onSubmit={search} className="mb-5 flex gap-3" role="search">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests, services, prices..." aria-label="Search tests, services and prices" className="[&_input]:text-[14.5px]" />
          <FilterButton onClick={() => navigate('/services')} label="Browse the service catalogue" />
        </form>

        <AnnouncementCarousel />

        {/* Today's Activity */}
        <section className="mb-5">
          <SectionTitle title="Today’s Activity" action="View Details" onAction={() => navigate('/referrals')} />
          <div className="grid grid-cols-3 gap-2.5">
            <Tile tint="bg-tint-blue border-[#d6e7ff]" icon={<Users size={27} className="text-brand-500" fill="currentColor" strokeWidth={1.4} />} label="Patients Referred" value={String(today.referred)} ink="text-brand-800" onClick={() => navigate('/referrals')} />
            <Tile
              tint="bg-tint-green border-[#cdeedb]"
              icon={
                <span className="grid h-7 w-7 place-items-center rounded-full bg-good text-white">
                  <Check size={17} strokeWidth={3.2} />
                </span>
              }
              label="Arrived at Branch"
              value={String(today.arrived)}
              ink="text-[#14633a]"
              onClick={() => navigate('/referrals')}
            />
            <Tile tint="bg-tint-purple border-[#e2d8ff]" icon={<Database size={26} className="text-violet" strokeWidth={2} />} label="Est. Commission" value={naira(today.estimated)} ink="text-violet" onClick={() => navigate('/earnings')} />
          </div>
        </section>

        {/* Monthly target */}
        <button type="button" onClick={() => navigate('/targets')} className="card press mb-6 flex w-full items-center gap-3 p-4 text-left">
          <Target size={36} className="shrink-0 text-brand-600" strokeWidth={2.2} />
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[16.5px] font-bold text-ink">Your Monthly Target</span>
            <span className="mt-0.5 block text-[14px] text-ink-2">
              You’ve referred {monthCount} of {RULES.monthlyReferralTarget} target patients.
            </span>
            <span className="mt-2.5 flex items-center gap-3">
              <ProgressBar value={monthCount} max={RULES.monthlyReferralTarget} label="Monthly referral target" />
              <span className="text-[14px] text-ink-2">{Math.min(100, pct)}%</span>
            </span>
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tint-pink">
            <Gift size={24} className="text-[#f0446f]" strokeWidth={2.2} />
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-2" />
        </button>

        {/* Quick actions */}
        <section>
          <SectionTitle title="Quick Actions" />
          <div className="grid grid-cols-4 gap-2.5">
            <Action tint="bg-tint-blue border-[#d6e7ff]" icon={<UserPlus size={30} className="text-brand-500" strokeWidth={2.2} />} label={'Refer a\nPatient'} onClick={() => navigate('/refer')} />
            <Action tint="bg-tint-green border-[#cdeedb]" icon={<FlaskConical size={30} className="text-good" strokeWidth={2.2} />} label={'Branch\nInventory'} onClick={() => navigate('/services')} />
            <Action tint="bg-tint-purple border-[#e2d8ff]" icon={<Sparkles size={30} className="text-violet" fill="currentColor" strokeWidth={1.4} />} label={'AI Test\nAssistant'} onClick={() => navigate('/assistant')} />
            <Action tint="bg-tint-orange border-[#ffe2c6]" icon={<Users size={30} className="text-orange" fill="currentColor" strokeWidth={1.4} />} label={'Invite a\nColleague'} onClick={invite} />
          </div>
        </section>

        {/* Today's referred patients (owner, 2026-11-24) */}
        <TodayPatients />
      </div>
    </div>
  );
}

function Tile({ tint, icon, label, value, ink, onClick }: { tint: string; icon: React.ReactNode; label: string; value: string; ink: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[124px] min-w-0 flex-col items-start rounded-[18px] border p-3.5 text-left ${tint}`}>
      {icon}
      <span className="mt-2.5 text-[13.5px] leading-tight text-ink-2">{label}</span>
      <span className={`mt-auto pt-1 font-bold leading-none tracking-[-0.03em] ${ink} ${value.length > 7 ? 'text-[18px]' : value.length > 5 ? 'text-[21px]' : 'text-[26px]'}`}>{value}</span>
    </button>
  );
}

function Action({ tint, icon, label, onClick }: { tint: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[118px] min-w-0 flex-col items-center justify-center gap-2.5 rounded-[18px] border px-1 ${tint}`}>
      {icon}
      <span className="whitespace-pre-line text-center text-[14px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}
