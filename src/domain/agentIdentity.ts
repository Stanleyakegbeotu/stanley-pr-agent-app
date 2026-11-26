/**
 * Which PR agent this phone belongs to, for the month log and the reports
 * (owner, 2026-11-26). Until sign-in is connected to the PR agents on record,
 * the sample clinician stands for the first agent on record (demo only); the
 * signed-in account will carry its own agent id.
 * TODO(backend): take the agent id from the signed-in account.
 */
import { BASELINE_AGENTS } from '@company/data/userRecords';

export const MY_AGENT_ID: number = BASELINE_AGENTS[0]?.id ?? 0;
