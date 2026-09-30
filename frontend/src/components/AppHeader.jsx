import { Link } from 'react-router-dom';

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 12c2.6-4.4 5.8-6.5 9.5-6.5s6.9 2.1 9.5 6.5c-2.6 4.4-5.8 6.5-9.5 6.5S5.1 16.4 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 2.5v1.5M12 20v1.5" />
    </svg>
  );
}

// Top bar: logo, one-line tagline, and whatever goes on the right (user slip).
export default function AppHeader({ right }) {
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-8">
      <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">
        <LogoMark />
        VisionGuard
      </Link>

      <p className="hidden text-[14px] tracking-tight text-ink-soft lg:block">
        <span className="font-semibold text-ink">Guard</span>
        <span className="mx-2 text-rule">|</span>
        A self watching workspace built for your space.
      </p>

      <div className="flex min-w-[120px] justify-end">{right}</div>
    </header>
  );
}
