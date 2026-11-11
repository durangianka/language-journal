export function UnitedKingdomFlag({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 60 40" width="24" height="16" role="img" aria-label={title}>
      <title>{title}</title>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="m0 0 30 20m30 20L30 20m30-20L30 20M0 40l30-20" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="8" />
    </svg>
  );
}
