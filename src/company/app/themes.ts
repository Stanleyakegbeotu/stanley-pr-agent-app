// GENERATED from the STANLEY desktop app (src/app/themes.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
export type ThemeId =
  | "medical-teal"
  | "clinical-blue"
  | "slate-grey"
  | "amber"
  | "forest-green"
  | "professional-purple";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  /** Sidebar colour and brand accent, used to render the split swatch. */
  sidebar: string;
  accent: string;
}

/** Order matches the approved list; Medical Teal is the reference theme. */
export const THEMES: ThemeOption[] = [
  { id: "clinical-blue", name: "Clinical Blue", sidebar: "#133f68", accent: "#2f7bc0" },
  { id: "slate-grey", name: "Slate Grey", sidebar: "#2b3544", accent: "#56677f" },
  { id: "amber", name: "Amber / Orange", sidebar: "#5b3412", accent: "#c26914" },
  { id: "forest-green", name: "Forest Green", sidebar: "#18402e", accent: "#33825a" },
  { id: "professional-purple", name: "Professional Purple", sidebar: "#34255f", accent: "#6a4fcb" },
  { id: "medical-teal", name: "Medical Teal", sidebar: "#0f4c48", accent: "#378680" },
];

export const DEFAULT_THEME: ThemeId = "medical-teal";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
