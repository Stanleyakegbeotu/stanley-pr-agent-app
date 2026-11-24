/**
 * App frame: menu (drawer / tablet rail), the one scrolling content area,
 * bottom tabs, toasts — and which screen shows for the current path.
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Drawer } from '@/shell/Drawer';
import { BottomNav } from '@/shell/BottomNav';
import { Dashboard } from '@/screens/Dashboard';
import { ServiceCatalogue, ServiceDetails } from '@/screens/Services';
import { ReferPatient, ReferralSent } from '@/screens/refer/ReferPatient';
import { MyReferrals, ReferralDetails } from '@/screens/Referrals';
import { Earnings, Targets } from '@/screens/Earnings';
import { AiAssistant, Announcements, Article, BranchInfo, Campaigns, HelpCentre, Notifications, Training } from '@/screens/More';
import { ChatThread } from '@/screens/chat/ChatThread';
import { Inbox } from '@/screens/chat/Inbox';
import { useApp } from './store';
import { Profile, ProfilePatients } from '@/screens/Profile';
import { BankDetailsScreen } from '@/screens/BankDetails';
import { ShellCtx } from './shell';


function Screen() {
  const { route } = useApp();
  const [a, b, c] = route.parts;
  switch (a) {
    case undefined:
      return <Dashboard />;
    case 'services':
      return b ? <ServiceDetails id={b} /> : <ServiceCatalogue />;
    case 'refer':
      return b === 'done' && c ? <ReferralSent id={c} /> : <ReferPatient step={b === 'services' ? 1 : b === 'summary' ? 2 : 0} />;
    case 'referrals':
      return b ? <ReferralDetails id={b} /> : <MyReferrals />;
    case 'earnings':
      return <Earnings />;
    case 'targets':
      return <Targets />;
    case 'campaigns':
      return <Campaigns />;
    case 'branch':
      return <BranchInfo />;
    case 'messages':
      return b ? <ChatThread id={b} /> : <Inbox />;
    case 'announcements':
      return <Announcements />;
    case 'notifications':
      return <Notifications />;
    case 'help':
      return <HelpCentre />;
    case 'training':
      return b ? <Article slug={b} /> : <Training />;
    case 'profile':
      return b === 'patients' ? <ProfilePatients /> : b === 'bank' ? <BankDetailsScreen /> : <Profile />;
    case 'assistant':
      return <AiAssistant />;
    default:
      return <Dashboard />;
  }
}

export function App() {
  const { route, toast } = useApp();
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // The referral flow and chat have their own bottom actions — no tab bar there.
  const chat = route.parts[0] === 'messages' && !!route.parts[1];
  const tabs = !(route.parts[0] === 'refer' || chat);

  // New screen → start at the top, close the menu.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMenu(false);
  }, [route.path]);

  return (
    <ShellCtx.Provider value={{ openMenu: () => setMenu((m) => !m) }}>
      <div className="h-dvh overflow-hidden bg-page">
        <Drawer open={menu} onClose={() => setMenu(false)} />
        <div ref={scroller} className="h-dvh overflow-y-auto md:ml-[264px]">
          <main className={`mx-auto w-full max-w-[760px] px-5 md:px-8 ${tabs ? 'pb-32 md:pb-12' : 'pb-10'}`}>
            <Screen />
          </main>
        </div>
        {tabs && <BottomNav onMore={() => setMenu((m) => !m)} moreOpen={menu} />}
        {toast && (
          <div role="status" className="fixed left-1/2 z-60 flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: tabs || chat ? 'calc(96px + var(--safe-bottom))' : 'calc(24px + var(--safe-bottom))' }}>
            <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
            {toast}
          </div>
        )}
      </div>
    </ShellCtx.Provider>
  );
}
