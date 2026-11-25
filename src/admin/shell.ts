/** Shared bits of the admin frame (menu opener, unread notifications and messages). */
import { createContext, useContext, type ReactNode } from 'react';

export const AdminShellCtx = createContext<{ openMenu: () => void; unread: number; inboxUnread: number;
  /** Where the bell and the chat icon go (staff workspace: under its branch). Null hides the chat icon. */
  paths?: { notifications: string; inbox: string | null };
  /** Extra icons before the chat icon (staff workspace: the price calculator). */
  tools?: ReactNode; }>({ openMenu: () => undefined, unread: 0, inboxUnread: 0 });
export const useAdminShell = () => useContext(AdminShellCtx);
