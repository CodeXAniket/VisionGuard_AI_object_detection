// Scalloped paper sticker, stuck on the corner of a note.
// `className` positions it (e.g. "absolute -top-3 right-2"); it defaults to relative.
export default function Seal({ children, color = '#9dbfe6', className = 'relative' }) {
  const points = 14;
  const outer = 30;
  const inner = 26;
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const angle = (Math.PI * i) / points;
    const radius = i % 2 === 0 ? outer : inner;
    return `${32 + radius * Math.cos(angle)},${32 + radius * Math.sin(angle)}`;
  }).join(' ');

  return (
    <div className={`pop-in pointer-events-none h-16 w-16 rotate-12 ${className}`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full drop-shadow-sm" aria-hidden="true">
        <polygon points={path} fill={color} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-center font-mono text-[10px] leading-tight font-bold text-ink/80">
        {children}
      </span>
    </div>
  );
}
