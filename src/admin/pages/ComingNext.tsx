/** Placeholder while each admin page is being built for mobile (same logic as the desktop page). */
import { Hammer } from 'lucide-react';
import { AdminHeader, Card } from '../ui';

export function ComingNext({ title }: { title: string }) {
  return (
    <>
      <AdminHeader title={title} scope={false} />
      <Card className="mt-4 flex flex-col items-center p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Hammer size={26} />
        </span>
        <p className="mt-3 text-[17px] font-bold text-ink">{title} is being built for mobile</p>
        <p className="mt-1 max-w-sm text-[14px] leading-snug text-muted">It will show exactly what the desktop page shows, with the same rules and figures, in the mobile design.</p>
      </Card>
    </>
  );
}
