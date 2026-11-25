/** Shared bits of the admin frame (menu opener, unread notifications). */
import { createContext, useContext } from 'react';

export const AdminShellCtx = createContext<{ openMenu: () => void; unread: number }>({ openMenu: () => undefined, unread: 0 });
export const useAdminShell = () => useContext(AdminShellCtx);
