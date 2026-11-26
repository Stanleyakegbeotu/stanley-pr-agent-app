/**
 * Audit log (compliance): every view of a result (and any download, sign-in,
 * lock-out or sign-out) is queued here for the server. Events carry IDs, never
 * patient names or results.
 * TODO(backend): flushAudit() posts the queue to the audit API and clears it.
 */
export type AuditEvent =
  | { type: 'result.view'; requestId: string }
  | { type: 'result.download'; requestId: string }
  | { type: 'auth.signin' }
  | { type: 'auth.signout' }
  | { type: 'auth.lockout' }
  | { type: 'request.sent'; requestId: string }
  | { type: 'patient.message'; requestId: string; channel?: 'whatsapp' | 'sms' };

const KEY = 'stanley.pr.audit.queue';

export function logAudit(e: AuditEvent & { by?: string }) {
  try {
    const q = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    q.push({ ...e, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(q.slice(-500)));
  } catch {
    /* storage blocked: the server log is the source of truth */
  }
}

export async function flushAudit() {
  // TODO(backend): POST the queue to the audit endpoint, then clear it on success.
}
