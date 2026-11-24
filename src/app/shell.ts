/** Lets screens control the app frame (e.g. the dashboard's ☰ opens the menu). */
import { createContext, useContext } from 'react';

export const ShellCtx = createContext<{ openMenu: () => void }>({ openMenu: () => {} });
export const useShell = () => useContext(ShellCtx);
