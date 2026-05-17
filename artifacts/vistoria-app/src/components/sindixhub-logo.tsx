interface SindixHubLogoProps {
  className?: string;
}

export function SindixHubLogo({ className }: SindixHubLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SindixHub"
    >
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <circle cx="12" cy="4.5" r="1.9" fill="currentColor" />
      <circle cx="18.6" cy="16" r="1.9" fill="currentColor" />
      <circle cx="5.4" cy="16" r="1.9" fill="currentColor" />
      <line x1="12" y1="9.4" x2="12" y2="6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14.1" y1="13.3" x2="17" y2="14.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="9.9" y1="13.3" x2="7" y2="14.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
