/** The staff workspace frame: which branch, and whether a task (a bill in progress) hides the tab bar. */
import { createContext, useContext } from 'react';

export const StaffChromeCtx = createContext<{ branchId: string; setFocusMode: (on: boolean) => void; go: (page: string) => void }>({ branchId: '', setFocusMode: () => undefined, go: () => undefined });
export const useStaffChrome = () => useContext(StaffChromeCtx);
