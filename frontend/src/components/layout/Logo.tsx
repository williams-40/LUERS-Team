export function Logo({
  variant = 'primary',
  className,
}: {
  variant?: 'primary' | 'light';
  className?: string;
}) {
  const src = variant === 'light' ? '/brand/logo-light.png' : '/brand/logo-primary.png';
  return <img src={src} alt="Lira University" className={className} />;
}
