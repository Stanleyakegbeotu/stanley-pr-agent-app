// GENERATED from the STANLEY desktop app (src/shell/BrandLogo.tsx). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Company brand, as set in Settings → Logo & branding: the uploaded logo (or
 * the built-in STANLEY mark when none is uploaded) and the company name.
 * Used by the sidebar, receipts, price quotes, report headers and dialogs.
 */
import { useCompanyProfile } from "@company/services/settingsStore";
import { COMPANY } from "@company/data/company";
import { initials } from "@company/shared/format";
import { LogoMark } from "./Logo";

/** `receipt`: receipts and quotes use the receipt logo when one is set (Settings → Company → Branding). */
export function BrandLogo({ receipt = false }: { receipt?: boolean }) {
  const { logo: main, receiptLogo, name } = useCompanyProfile();
  const logo = receipt && receiptLogo ? receiptLogo : main;
  if (logo) return <img className="brand-logo-img" src={logo} alt={`${name} logo`} />;
  return <LogoMark />;
}

export const useCompanyName = () => useCompanyProfile().name.trim() || COMPANY.name;
export const useCompanyShortName = () => {
  const c = useCompanyProfile();
  return c.shortName.trim() || c.name.trim() || COMPANY.shortName;
};

/** A person's photo, or their initials when no photo is set. */
export function UserAvatar({ name, photo, className = "avatar" }: { name: string; photo?: string; className?: string }) {
  return (
    <span className={`${className} ${photo ? "has-photo" : ""}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  );
}
