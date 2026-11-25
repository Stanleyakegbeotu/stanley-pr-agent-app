/**
 * PR agents' account details kept on this device (owner, 2026-11-25: the
 * admin must always see them on the agent's profile). The desktop logic
 * (setAgentBank) records every change in the Audit Log but keeps the details
 * for the session only, so the mobile admin also saves them here, queued for
 * the cloud. Never shown on the Referrer Portal.
 */
import { useEffect, useState } from 'react';
import type { BankDetails } from '@company/data/userRecords';

const KEY = 'stanley.admin.agentBanks.v1';
const EVENT = 'stanley-agent-banks-changed';

const read = (): Record<number, BankDetails> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<number, BankDetails>;
  } catch {
    return {};
  }
};

export function saveAgentBank(id: number, bank: Omit<BankDetails, 'at'> | null) {
  const all = read();
  if (bank) all[id] = { ...bank, at: new Date().toISOString() };
  else delete all[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAgentBanks(): Record<number, BankDetails> {
  const [all, setAll] = useState(read);
  useEffect(() => {
    const load = () => setAll(read());
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, []);
  return all;
}
