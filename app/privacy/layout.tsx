/**
 * Full-bleed layer so the parchment can tile down this long page only.
 * Other routes keep the single non-repeating body background.
 */
export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <div className="privacy-page-bg">{children}</div>;
}
