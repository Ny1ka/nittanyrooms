export function LogoMark({ size = 32, onNavy = false }: { size?: number; onNavy?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M32 3C18.2 3 7.5 13.6 7.5 27C7.5 44.5 32 61 32 61S56.5 44.5 56.5 27C56.5 13.6 45.8 3 32 3Z"
        fill={onNavy ? '#FFFFFF' : '#12284C'}
      />
      <rect x="22" y="15" width="20" height="26" rx="2" fill="#FFC845" />
      <path d="M42 15L33 18.5V41H42Z" fill="#000" fillOpacity="0.28" />
    </svg>
  );
}
