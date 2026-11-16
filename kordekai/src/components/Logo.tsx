/** Geometric K: one vertical stem and one chevron that meets it at the optical centre. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="KordekAI"
    >
      <path d="M10 6.5v19" />
      <path d="M23 6.5 10.5 16 23 25.5" />
    </svg>
  );
}
