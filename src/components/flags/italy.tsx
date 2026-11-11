export function ItalyFlag({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 60 40" width="24" height="16" role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M0 0h20v40H0z" fill="#009246" />
      <path d="M20 0h20v40H20z" fill="#fff" />
      <path d="M40 0h20v40H40z" fill="#ce2b37" />
    </svg>
  );
}
