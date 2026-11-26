/**
 * Slide-up details in the Referrer Portal (owner, 2026-11-26): like the
 * branch and admin apps, tapping something in a list opens it in a slide-up
 * card (swipe down to close) instead of leaving the page: a referral, a
 * result, a test from the catalogue, or a guide. They stack (a result
 * opened from its referral sits on top). Direct links (#/referrals/ID ...)
 * still open the full screen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '@/app/store';
import { PatientsOnly } from '@/app/Gate';
import { serviceById } from '@/data/services';
import { RESOURCES } from '@/data/content';
import { Sheet } from '@/admin/ui';
import { ReferralDetails } from '@/screens/Referrals';
import { ResultView } from '@/screens/Results';
import { ServiceDetails } from '@/screens/Services';
import { Article } from '@/screens/More';
import { InSheetCtx } from './inSheet';

export type Detail = { kind: 'referral' | 'result' | 'service' | 'article'; id: string };

const Ctx = createContext<{ open: (d: Detail) => void; openPath: (path: string) => void }>({ open: () => undefined, openPath: () => undefined });
export const useDetail = () => useContext(Ctx);

/** A path a list item points to, as a slide-up when it is a detail. */
function detailOf(path: string): Detail | null {
  const [a, b] = path.replace(/^#?\/?/, '').split(/[/?]/);
  if (!b) return null;
  if (a === 'referrals') return { kind: 'referral', id: b };
  if (a === 'results') return { kind: 'result', id: b };
  if (a === 'services') return { kind: 'service', id: b };
  if (a === 'training') return { kind: 'article', id: b };
  return null;
}

const titleOf = (d: Detail) =>
  d.kind === 'referral' ? 'Referral' : d.kind === 'result' ? 'Result' : d.kind === 'service' ? (serviceById(d.id)?.name ?? 'Test') : (RESOURCES.find((x) => x.slug === d.id)?.title ?? 'Guide');
const subOf = (d: Detail) => (d.kind === 'referral' ? d.id : d.kind === 'result' ? `${d.id} · for this patient’s care only` : d.kind === 'service' ? 'Test catalogue' : 'Training and resources');

export function DetailHost({ children }: { children: ReactNode }) {
  const { route, navigate } = useApp();
  const [stack, setStack] = useState<Detail[]>([]);
  const open = useCallback((d: Detail) => setStack((s) => [...s, d]), []);
  const openPath = useCallback(
    (path: string) => {
      const d = detailOf(path);
      if (d) open(d);
      else navigate(path as never);
    },
    [open, navigate],
  );
  // Going to another screen (e.g. "Request these tests") closes the slide-ups.
  useEffect(() => setStack([]), [route.path]);
  const value = useMemo(() => ({ open, openPath }), [open, openPath]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {stack.map((d, i) => (
        <Sheet key={`${d.kind}-${d.id}-${i}`} title={titleOf(d)} subtitle={subOf(d)} back={i > 0} tall onClose={() => setStack((s) => s.slice(0, i))}>
          <InSheetCtx.Provider value>
            <div className="px-1 pb-4">
              {d.kind === 'referral' ? (
                <PatientsOnly>
                  <ReferralDetails id={d.id} />
                </PatientsOnly>
              ) : d.kind === 'result' ? (
                <PatientsOnly>
                  <ResultView id={d.id} />
                </PatientsOnly>
              ) : d.kind === 'service' ? (
                <ServiceDetails id={d.id} />
              ) : (
                <Article slug={d.id} />
              )}
            </div>
          </InSheetCtx.Provider>
        </Sheet>
      ))}
    </Ctx.Provider>
  );
}
