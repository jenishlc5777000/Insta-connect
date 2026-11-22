import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { cx } from '../components/ui';
import ChangePasswordModal from '../components/ChangePasswordModal';

function Avatar({ src, name, className }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return src ? (
    <img src={src} alt="" className={cx('rounded-full object-cover', className)} />
  ) : (
    <span className={cx('grid place-items-center rounded-full bg-gradient-to-br from-brand to-purple font-bold text-white', className)}>{initials}</span>
  );
}

/**
 * Shared shell for the influencer & admin dashboards: navy sidebar on desktop,
 * drawer + bottom tab bar on mobile. nav: [{ to, label, icon, mobile?, short? }]
 */
export default function DashboardLayout({ nav, title, homePath, loginPath }) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const { user, influencer, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isInfluencer = Boolean(influencer);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (user?.mustChangePassword) setPwOpen(true);
  }, [user?.mustChangePassword]);

  const onLogout = async () => {
    await logout();
    navigate(loginPath, { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light to={homePath} />
        <button type="button" className="rounded-lg p-1 text-slate-400 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      {isInfluencer ? (
        <Link to="/influencer/profile" className="mx-4 mb-4 mt-2 flex flex-col items-center rounded-2xl px-3 py-4 text-center transition hover:bg-white/5">
          <Avatar src={influencer.profileImage} name={user?.name} className="size-16 text-lg ring-4 ring-white/10" />
          <p className="mt-3 font-semibold text-white">{user?.name}</p>
          <p className="text-xs text-slate-400">Influencer Partner</p>
          <span className="mt-2 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-400/30">
            {influencer.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </Link>
      ) : (
        <div className="mx-4 mb-3 mt-1 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand/20 text-brand"><ShieldCheck className="size-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <p className="truncate text-xs text-slate-400">{user?.name}</p>
          </div>
        </div>
      )}

      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-brand text-white shadow-lg shadow-brand/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-0.5 p-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4" /> View website
        </a>
        <button type="button" onClick={() => setPwOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
          <KeyRound className="size-4" /> Change password
        </button>
        <button type="button" onClick={onLogout} className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-white/10 px-3.5 pb-2 pt-4 text-sm text-slate-300 hover:text-white">
          <LogOut className="size-4" /> Logout
        </button>
      </div>
    </div>
  );

  const mobileNav = nav.filter((n) => n.mobile).slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-navy shadow-xl animate-fade-up">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button type="button" className="rounded-lg p-1.5 text-navy" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-6" />
          </button>
          <span className="text-sm font-semibold text-navy">{title}</span>
          <Avatar src={influencer?.profileImage} name={user?.name} className="size-8 text-xs" />
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {mobileNav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, 1fr)` }}>
          {mobileNav.map(({ to, label, icon: Icon, short }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand' : 'text-slate-500')}>
              <Icon className="size-5" />
              {short || label}
            </NavLink>
          ))}
        </nav>
      )}

      <ChangePasswordModal open={pwOpen} forced={Boolean(user?.mustChangePassword)} onClose={() => setPwOpen(false)} />
    </div>
  );
}
