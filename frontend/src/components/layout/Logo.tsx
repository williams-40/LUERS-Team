/**
 * The LUERS logo: the shield-and-pin mark plus the "LUERS" wordmark, as one SVG
 * (the wordmark is outlined from Manrope, so it renders the same everywhere
 * without loading a font). `onDark` picks the white-wordmark version for the
 * sidebar/drawer's solid blue background.
 */
export function Logo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const src = onDark ? '/brand/luers-logo-on-dark.svg' : '/brand/luers-logo.svg';
  return <img src={src} alt="LUERS" className={className} />;
}
