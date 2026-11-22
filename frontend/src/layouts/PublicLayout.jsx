import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Instagram, Youtube, Linkedin, Facebook, MessageCircle, Twitter, Mail, Phone, ChevronDown } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useReferral } from '../context/ReferralContext';
import { useSite } from '../context/SiteContext';
import { cx } from '../components/ui';
import { firstName } from '../utils/format';

function ReferralChip({ dark }) {
  const { attribution } = useReferral();
  const [open, setOpen] = useState(false);
  const inf = attribution?.influencer;
  if (!inf?.name) return null;
  const initials = inf.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx('flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition', dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-navy hover:bg-slate-200')}
        aria-expanded={open}
      >
        {inf.profileImage ? <img src={inf.profileImage} alt="" className="size-8 rounded-full object-cover ring-2 ring-white/30" /> : <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-teal to-brand text-xs font-bold text-white">{initials}</span>}
        by {firstName(inf.name)}
        <ChevronDown className={cx('size-4 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-xl animate-fade-up">
          <p className="font-semibold text-navy">You were invited by {inf.name}</p>
          {inf.instagramUsername && <p className="mt-0.5 text-xs">@{inf.instagramUsername}</p>}
          <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal">Referral ID {inf.influencerCode} is applied automatically when you register.</p>
        </div>
      )}
    </div>
  );
}

export function Navbar({ transparent }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const { attribution } = useReferral();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dark = transparent; // landing pages keep the navy look
  const links = [
    { to: '/#learn', label: 'AI Video Workshop' },
    { to: '/about', label: 'About' },
    { to: '/#benefits', label: 'Benefits' },
    { to: '/#faq', label: 'FAQs' },
    { to: '/become-influencer', label: 'Join as Influencer', highlight: true },
  ];
  const referred = Boolean(attribution?.influencer?.name);

  return (
    <header
      className={cx(
        'fixed inset-x-0 top-0 z-40 transition',
        dark ? (scrolled || open ? 'bg-navy/95 shadow-lg shadow-navy/20 backdrop-blur-lg' : 'bg-transparent') : 'border-b border-slate-200/70 bg-white/90 backdrop-blur-lg'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6">
        <Logo light={dark} />
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.to} href={l.to} className={cx('flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition', l.highlight ? (dark ? 'text-pink-300 hover:text-pink-200' : 'text-[#dd2a7b] hover:text-[#b81f63]') : dark ? 'text-white/85 hover:text-white' : 'text-slate-600 hover:text-navy')}>
              {l.highlight && <Instagram className="size-4" />}
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          {referred ? (
            <ReferralChip dark={dark} />
          ) : (
            <>
              {!user && (
                <Link to="/login" className={cx('text-sm font-medium', dark ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-navy')}>
                  Log in
                </Link>
              )}
              <a href="/#register" className="btn bg-gradient-to-r from-teal to-cyan-400 text-navy shadow-lg shadow-teal/25 hover:brightness-105">
                Register now
              </a>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          {referred && <ReferralChip dark={dark} />}
          <button type="button" className={cx('rounded-lg p-2', dark ? 'text-white' : 'text-navy')} onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className={cx('px-4 pb-5 pt-2 lg:hidden', dark ? 'bg-navy' : 'border-t border-slate-100 bg-white')}>
          {links.map((l) => (
            <a key={l.to} href={l.to} onClick={() => setOpen(false)} className={cx('block rounded-lg px-3 py-3 text-base font-medium', dark ? 'text-white/90 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50')}>
              {l.label}
            </a>
          ))}
          <div className={cx('mt-3 grid gap-2', user ? 'grid-cols-1' : 'grid-cols-2')}>
            {!user && (
              <Link to="/login" className="btn-secondary">
                Log in
              </Link>
            )}
            <a href="/#register" onClick={() => setOpen(false)} className="btn bg-gradient-to-r from-teal to-cyan-400 text-navy">
              Register now
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

const SOCIAL = [
  ['instagram', Instagram, 'Instagram'],
  ['youtube', Youtube, 'YouTube'],
  ['linkedin', Linkedin, 'LinkedIn'],
  ['facebook', Facebook, 'Facebook'],
  ['x', Twitter, 'X'],
  ['whatsapp', MessageCircle, 'WhatsApp'],
];

export function Footer() {
  const site = useSite();
  const socials = SOCIAL.filter(([k]) => site.socialLinks?.[k]);
  return (
    <footer className="bg-navy text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <Logo light />
        <p className="text-sm font-medium tracking-wide text-slate-300">Learn <span className="text-teal">•</span> Innovate <span className="text-teal">•</span> Grow</p>
        <div className="flex gap-2">
          {socials.length
            ? socials.map(([k, Icon, label]) => (
                <a key={k} href={site.socialLinks[k]} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-brand hover:text-white">
                  <Icon className="size-4" />
                </a>
              ))
            : site.supportEmail && (
                <a href={`mailto:${site.supportEmail}`} className="flex items-center gap-2 text-sm hover:text-white">
                  <Mail className="size-4" />
                  {site.supportEmail}
                </a>
              )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {site.siteName}. All rights reserved.</p>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/about" className="hover:text-white">About JenCorps</Link>
            <Link to="/workshops" className="hover:text-white">Workshops</Link>
            <Link to="/login" className="hover:text-white">My registrations</Link>
            <Link to="/become-influencer" className="hover:text-white">Join as Influencer</Link>
            <Link to="/influencer/login" className="hover:text-white">Influencer login</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            {site.supportPhone && (
              <a href={`tel:${site.supportPhone}`} className="flex items-center gap-1 hover:text-white">
                <Phone className="size-3" />
                {site.supportPhone}
              </a>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Shown on influencer subdomains so visitors know who invited them */
export function ReferralBanner() {
  const { attribution } = useReferral();
  const inf = attribution?.influencer;
  if (!inf?.name) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-brand px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      {inf.profileImage && <img src={inf.profileImage} alt="" className="size-5 rounded-full object-cover" />}
      <span>
        You were invited by <b>{inf.name}</b>
        {inf.instagramUsername ? ` (@${inf.instagramUsername})` : ''} 🎉
      </span>
    </div>
  );
}

export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  const isHome = pathname === '/' || pathname === '/become-influencer' || pathname === '/about' || /^\/workshops\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar transparent={isHome} />
      <main className={cx('flex-1', !isHome && 'pt-16')}>
        {!isHome && <ReferralBanner />}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
