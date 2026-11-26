/**
 * App frame: menu (drawer / tablet rail), the one scrolling content area,
 * bottom tabs, toasts, and which screen shows for the current path.
 * Patient screens (requests, patients, results) are wrapped in PatientsOnly:
 * a Pending or Suspended account sees "being verified" instead.
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Drawer } from '@/shell/Drawer';
import { BottomNav } from '@/shell/BottomNav';
import { Dashboard } from '@/screens/Dashboard';
import { ServiceCatalogue, ServiceDetails } from '@/screens/Services';
import { ReferPatient, ReferralSent } from '@/screens/refer/ReferPatient';
import { MyReferrals, ReferralDetails } from '@/screens/Referrals';
import { Announcements, Article, BranchInfo, Campaigns, HelpCentre, Notifications, Training } from '@/screens/More';
import { ResultView, ResultsList } from '@/screens/Results';
import { LegalPage, PrivacyHub } from '@/screens/Legal';
import { PatientsOnly } from './Gate';
import { ChatThread } from '@/screens/chat/ChatThread';
import { Inbox } from '@/screens/chat/Inbox';
import { MyReports } from '@/screens/MyReports';
import { useApp } from './store';
import { Profile } from '@/screens/Profile';
import { Settings } from '@/screens/Settings';
import { ResumeDraftPrompt } from '@/screens/refer/ResumeDraft';
import { ShellCtx } from './shell';
import { DetailHost } from '@/ui/detailSheet';


function Screen() {
  const { route } = useApp();
  const [a, b, c] = route.parts;
  switch (a) {
    case undefined:
      return <Dashboard />;
    case 'services':
      return b ? <ServiceDetails id={b} /> : <ServiceCatalogue />;
    case 'refer':
      return <PatientsOnly>{b === 'done' && c ? <ReferralSent id={c} /> : <ReferPatient step={b === 'services' ? 1 : b === 'clinical' ? 2 : b === 'summary' ? 3 : 0} />}</PatientsOnly>;
    case 'referrals':
      return <PatientsOnly>{b ? <ReferralDetails id={b} /> : <MyReferrals />}</PatientsOnly>;
    case 'results':
      return <PatientsOnly>{b ? <ResultView id={b} /> : <ResultsList />}</PatientsOnly>;
    case 'privacy':
      return <PrivacyHub />;
    case 'legal':
      return <LegalPage kind={b ?? 'privacy'} />;
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
      return <Profile />;
    case 'settings':
      return <Settings />;
    case 'reports':
      return <MyReports />;
    default:
      return <Dashboard />;
  }
}

export function App() {
  const { route, toast } = useApp();
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // The request flow and chat have their own bottom actions, so no tab bar there.
  const chat = route.parts[0] === 'messages' && !!route.parts[1];
  const tabs = !(route.parts[0] === 'refer' || chat);

  // New screen → start at the top, close the menu.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMenu(false);
  }, [route.path]);

  return (
    <ShellCtx.Provider value={{ openMenu: () => setMenu((m) => !m) }}>
      <DetailHost>
      <div className="h-dvh overflow-hidden bg-page">
        <Drawer open={menu} onClose={() => setMenu(false)} />
        <div ref={scroller} className="h-dvh overflow-y-auto md:ml-[264px]">
          <main className={`mx-auto w-full max-w-[760px] px-5 md:px-8 ${tabs ? 'pb-32 md:pb-12' : 'pb-10'}`}>
            <div key={route.path} className="page-pop">
              <Screen />
            </div>
          </main>
        </div>
        {tabs && <BottomNav onMore={() => setMenu((m) => !m)} moreOpen={menu} />}
        <ResumeDraftPrompt />
        {toast && (
          <div role="status" className="fixed left-1/2 z-60 flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: tabs || chat ? 'calc(96px + var(--safe-bottom))' : 'calc(24px + var(--safe-bottom))' }}>
            <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
            {toast}
          </div>
        )}
      </div>
      </DetailHost>
    </ShellCtx.Provider>
  );
}
