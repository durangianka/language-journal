export function SpainFlag({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 60 40" width="24" height="16" role="img" aria-label={title}>
      <title>{title}</title>
      <rect width="60" height="40" fill="#aa151b" />
      <path d="M0 10h60v20H0z" fill="#f1bf00" />
      <path d="M15 16h9v8c0 5-9 5-9 0z" fill="#aa151b" />
      <path d="M19 16h1v11h-1zM15 20h9v1h-9z" fill="#f1bf00" />
      <path d="M15 14h9l-1-3-2 2-2-2-2 2-2-2z" fill="#aa151b" />
      <path d="M12 17v10m15-10v10" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
