/**
 * Server API (STUB). Nothing here talks to a server yet; every function is a
 * TODO for the backend team.
 *
 * ACCESS CONTROL MUST BE ENFORCED ON THE SERVER, NOT ONLY IN THIS APP.
 *  • "Own patients only": every request, status and result is returned ONLY
 *    to the clinician who made the request (row-level access by
 *    requesting_clinician_id = the signed-in clinician). The app's own
 *    filtering (ownOnly in domain/referrals) is a second line, not the control.
 *  • Results are released only after pathologist / radiologist sign-off, and
 *    access expires (RESULT_ACCESS_DAYS) on the server too.
 *  • Accounts that are not Active (pending / suspended) get no patient data.
 *  • Every result view / download is written to the audit log (domain/audit).
 *  • Patient messages go out through the company channel (domain/patientMessage).
 */
import type { Referral } from './referrals';

/** TODO(backend): POST /requests. On success, delete the local (encrypted) copy and keep only the server's. */
export async function submitRequest(_r: Referral): Promise<{ ok: boolean }> {
  return { ok: false };
}

/** TODO(backend): GET /me/requests?since=90d. Server returns only this clinician's own requests. */
export async function fetchMyRequests(): Promise<Referral[] | null> {
  return null;
}

/** TODO(backend): GET /requests/:id/result. Server checks owner, sign-off and expiry, and logs the view. */
export async function fetchResult(_requestId: string): Promise<null> {
  return null;
}

/** TODO(backend): sync queue. After a request is accepted by the server, remove it from the phone. */
export async function syncQueue(): Promise<void> {}
