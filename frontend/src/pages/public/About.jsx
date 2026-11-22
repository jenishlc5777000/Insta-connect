import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Boxes, Building2, Globe2, Lock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Smartphone, Sparkles, Clapperboard, Instagram,
} from 'lucide-react';
import { company } from '../../content/company';
import { useDocumentTitle } from '../../hooks';
import { cx } from '../../components/ui';

const EXPERTISE_ICONS = { digital: Smartphone, enterprise: Boxes, secure: ShieldCheck };
const PILLAR_ICONS = [Building2, Lock, Globe2];

function Eyebrow({ children, light }) {
  return <p className={cx('mb-3 text-xs font-bold uppercase tracking-[0.22em]', light ? 'text-teal' : 'text-brand')}>{children}</p>;
}

/** Company profile page, content from content/company.js (sourced from jencorps.com) */
export default function About() {
  useDocumentTitle(`About ${company.name}`);
  const c = company;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#071630] px-4 pb-24 pt-32 text-white sm:px-6 sm:pb-32 sm:pt-40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-brand/30 blur-[120px]" />
          <div className="absolute -right-24 top-20 size-[460px] rounded-full bg-purple/25 blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80">
            <Sparkles className="size-4 text-teal" /> {c.eyebrow}
          </p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            {c.headline.replace('.', '')}
            <span className="bg-gradient-to-r from-teal to-cyan-300 bg-clip-text text-transparent">.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">{c.intro}</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#portfolio" className="btn bg-gradient-to-r from-teal to-cyan-400 px-7 py-3.5 text-base text-navy shadow-xl shadow-teal/25">
              View Portfolio <ArrowRight className="size-5" />
            </a>
            <a href="#philosophy" className="btn border border-white/20 px-7 py-3.5 text-base text-white hover:bg-white/10">Our Philosophy</a>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {c.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur">
              <p className="font-display text-3xl font-extrabold text-white sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
        <svg className="absolute inset-x-0 bottom-0 h-14 w-full text-white sm:h-20" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0 80c160 30 320 40 520 18S900 20 1100 30s260 50 340 60v30H0z" />
        </svg>
      </section>

      {/* Philosophy */}
      <section id="philosophy" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Philosophy</Eyebrow>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{c.philosophy.title}</h2>
            {c.philosophy.paragraphs.map((p) => (
              <p key={p} className="mt-4 text-lg leading-relaxed text-slate-600">{p}</p>
            ))}
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand">
              <MapPin className="size-4" /> Headquarters · {c.contact.headquarters}
            </p>
          </div>
          <div className="space-y-3">
            {c.philosophy.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i % PILLAR_ICONS.length];
              return (
                <div key={p} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50 p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl gradient-brand text-white shadow-lg shadow-brand/20"><Icon className="size-6" /></span>
                  <p className="text-lg font-bold text-navy">{p}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Expertise */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <Eyebrow>Core Expertise</Eyebrow>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">What we build</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {c.expertise.map((e) => {
              const Icon = EXPERTISE_ICONS[e.key] || Boxes;
              return (
                <div key={e.title} className="group rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand transition group-hover:bg-brand group-hover:text-white"><Icon className="size-7" /></span>
                  <h3 className="mt-5 text-xl font-bold">{e.title}</h3>
                  <p className="mt-1.5 text-slate-500">{e.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <Eyebrow>Portfolio</Eyebrow>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Selected work</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">Enterprise platforms, mobile apps and secure systems delivered across three continents.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.portfolio.map((p) => {
              const card = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple">{p.type}</span>
                    {p.url ? (
                      <ArrowUpRight className="size-5 text-slate-300 transition group-hover:text-brand" />
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{p.status}</span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-navy group-hover:text-brand">{p.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.text}</p>
                  {p.url && <p className="mt-4 truncate text-xs font-medium text-brand">{p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').replace(/\?.*$/, '')}</p>}
                </>
              );
              return p.url ? (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg">
                  {card}
                </a>
              ) : (
                <div key={p.name} className="group rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6">{card}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workshops by JenCorps */}
      <section className="bg-white px-4 pb-16 sm:px-6">
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-[#071630] p-8 text-center text-white sm:flex-row sm:p-10 sm:text-left">
          <div className="pointer-events-none absolute -left-10 -top-10 size-60 rounded-full bg-brand/30 blur-3xl" />
          <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl gradient-brand"><Clapperboard className="size-8" /></span>
          <div className="relative flex-1">
            <h2 className="text-2xl font-extrabold text-white">Learn with JenCorps</h2>
            <p className="mt-1 text-slate-300">Join our hands-on AI Video Creation Workshop, or partner with us as an Instagram creator.</p>
          </div>
          <div className="relative flex flex-col gap-2 sm:flex-row">
            <Link to="/" className="btn whitespace-nowrap bg-white px-5 py-3 text-navy hover:bg-slate-100">View workshop <ArrowRight className="size-4" /></Link>
            <Link to="/become-influencer" className="btn whitespace-nowrap border border-white/20 px-5 py-3 text-white hover:bg-white/10"><Instagram className="size-4" /> Join as Influencer</Link>
          </div>
        </div>
      </section>

      {/* Leadership + contact */}
      <section id="contact" className="scroll-mt-20 bg-slate-50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/70">
            <Eyebrow>{c.leadershipHeading || 'Leadership'}</Eyebrow>
            {c.leadership.map((l) => (
              <div key={l.name} className="flex items-center gap-4">
                <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-purple font-display text-2xl font-bold text-white">{l.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                <div>
                  <p className="text-xl font-bold text-navy">{l.name}</p>
                  <p className="text-slate-500">{l.title}</p>
                </div>
              </div>
            ))}
            <p className="mt-6 text-sm text-slate-600">{c.name} partners with enterprises, startups and public institutions on software built to last.</p>
          </div>

          <div className="rounded-3xl bg-navy p-7 text-white">
            <Eyebrow light>Get in touch</Eyebrow>
            <h2 className="text-2xl font-extrabold text-white">Start a project with {c.name}</h2>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><MapPin className="size-5 text-teal" /></span><span><span className="block text-xs text-slate-400">Headquarters</span>{c.contact.headquarters}</span></li>
              <li className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><Phone className="size-5 text-teal" /></span><span><span className="block text-xs text-slate-400">Direct line</span><a href={c.contact.phoneHref} className="hover:underline">{c.contact.phone}</a></span></li>
              {c.contact.emails?.map((e) => (
                <li key={e.address} className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/10"><Mail className="size-5 text-teal" /></span>
                  <span className="min-w-0"><span className="block text-xs text-slate-400">{e.label}</span><a href={`mailto:${e.address}`} className="break-all hover:underline">{e.address}</a></span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={c.contact.phoneHref} className="btn bg-gradient-to-r from-teal to-cyan-400 text-navy"><Phone className="size-4" /> Call now</a>
              <a href={c.contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white"><MessageCircle className="size-4" /> WhatsApp</a>
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="btn border border-white/20 text-white hover:bg-white/10">jencorps.com <ArrowUpRight className="size-4" /></a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
