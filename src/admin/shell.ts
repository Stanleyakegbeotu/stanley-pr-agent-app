/** Shared bits of the admin frame (menu opener, unread notifications and messages). */
import { createContext, useContext } from 'react';

export const AdminShellCtx = createContext<{ openMenu: () => void; unread: number; inboxUnread: number }>({ openMenu: () => undefined, unread: 0, inboxUnread: 0 });
export const useAdminShell = () => useContext(AdminShellCtx);
