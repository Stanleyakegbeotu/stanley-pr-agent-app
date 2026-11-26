/** True inside a detail slide-up: screens drop their own page header there (the slide-up has one). */
import { createContext, useContext } from 'react';

export const InSheetCtx = createContext(false);
export const useInSheet = () => useContext(InSheetCtx);
