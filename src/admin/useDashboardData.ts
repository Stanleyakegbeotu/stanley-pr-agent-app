/** Same as the desktop's features/dashboard/useDashboardData: figures for a set of branches and a period. */
import { useMemo } from 'react';
import type { PeriodSelection } from '@company/data/types';
import { priorRange, resolveRange, summarize } from '@company/services/analytics';

export function useDashboardData(branchIds: string[], period: PeriodSelection) {
  const key = branchIds.join(',');
  return useMemo(() => {
    const range = resolveRange(period);
    const prior = priorRange(range);
    return { range, priorRange: prior, summary: summarize(branchIds, range), prior: prior ? summarize(branchIds, prior) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, period.key, period.from, period.to]);
}
