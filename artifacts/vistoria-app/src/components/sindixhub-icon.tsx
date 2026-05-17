import React from "react";

interface SindixHubIconProps {
  className?: string;
  size?: number;
}

export function SindixHubIcon({ className, size = 24 }: SindixHubIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2L4 5.8V11.6C4 16.52 7.52 21.08 12 22.4C16.48 21.08 20 16.52 20 11.6V5.8L12 2Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <line x1="12" y1="10.25" x2="12" y2="7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="10.5" y1="13" x2="8" y2="15.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="13.5" y1="13" x2="16" y2="15.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="12" cy="6" r="1.25" fill="currentColor" />
      <circle cx="7" cy="16" r="1.25" fill="currentColor" />
      <circle cx="17" cy="16" r="1.25" fill="currentColor" />
    </svg>
  );
}

