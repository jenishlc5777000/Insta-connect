import { Link } from 'react-router-dom';

export function LogoMark({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="jc-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82FF" />
          <stop offset="1" stopColor="#2F6BFF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#jc-mark)" />
      <path d="M24 10v13.5a6.5 6.5 0 0 1-13 0" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="29.5" cy="11.5" r="2.6" fill="#7CF5E6" />
    </svg>
  );
}

export default function Logo({ light = false, to = '/', className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="JenCorps home">
      <LogoMark />
      <span className={`font-display text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-navy'}`}>JenCorps</span>
    </Link>
  );
}
