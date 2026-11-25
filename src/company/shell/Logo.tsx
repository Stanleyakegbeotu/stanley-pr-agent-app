// GENERATED from the STANLEY desktop app (src/shell/Logo.tsx). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
import { useId } from "react";

/** Company logo mark (placeholder until the uploaded company PNG is wired in). */
export function LogoMark() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3aa0ff" />
          <stop offset="100%" stopColor="#0b4fb3" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="13" fill={`url(#${id}-bg)`} />
      <path
        d="M30.5 13.5c-2.6-2.2-11.8-3.6-15.2 1-3.6 4.9 3.2 7.6 7.8 8.6 5 1.1 9.1 3.5 6.2 8.1-3.1 4.9-12.6 3.9-15.8 1"
        fill="none"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path d="M3 13C9 5 25 2 41 9v-2a13 13 0 0 0-13-7H16A13 13 0 0 0 3 13Z" fill={`url(#${id}-hl)`} />
    </svg>
  );
}
