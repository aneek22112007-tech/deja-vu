export const Logo = ({ className = 'h-9 w-9' }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <rect width="64" height="64" rx="14" fill="#10131a" />
    <circle cx="26" cy="32" r="13" fill="none" stroke="#a78bfa" strokeWidth="5" />
    <circle cx="38" cy="32" r="13" fill="none" stroke="#34d399" strokeWidth="5" opacity=".85" />
  </svg>
);
