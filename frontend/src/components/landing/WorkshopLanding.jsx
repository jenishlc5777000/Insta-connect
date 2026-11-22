import { useState } from 'react';
import {
  CalendarDays, MapPin, Clapperboard, ScrollText, Mic, Scissors, CheckCircle2, ChevronDown, Gift, ArrowRight,
  Users, BadgePercent, Clock, Sparkles, GraduationCap, Award, Check, Instagram,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx, Skeleton } from '../ui';
import RegistrationForm from './RegistrationForm';
import VideoHeroVisual from './VideoHeroVisual';
import { useReferral } from '../../context/ReferralContext';
import { effectivePrice, firstName, formatDateRange, formatINR, formatLongDate, formatTime, titleCase } from '../../utils/format';

const TOPICS = [
  { icon: Clapperboard, title: 'AI Video Generation', text: 'Turn text and images into cinematic clips with the latest text-to-video and image-to-video tools.', tone: 'text-brand bg-brand-50' },
  { icon: ScrollText, title: 'AI Scripts & Storyboards', text: 'Scroll-stopping hooks, scripts and shot lists for Reels and YouTube in minutes.', tone: 'text-teal bg-teal-50' },
  { icon: Mic, title: 'AI Avatars & Voiceovers', text: 'Talking-head avatars, natural voiceovers and dubbing into any language.', tone: 'text-purple bg-purple-50' },
  { icon: Scissors, title: 'Edit, Caption & Go Viral', text: 'Auto-editing, captions, thumbnails and a posting plan that grows your views.', tone: 'text-amber-600 bg-amber-50' },
];

const DEFAULT_REASONS = ['Hands-on video projects', 'Learn from working creators', 'Certificate of completion', 'Lifetime access to recordings & prompt packs'];

function SectionTitle({ eyebrow, title, subtitle, light }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
      {eyebrow && <p className={cx('mb-2 text-xs font-bold uppercase tracking-[0.2em]', light ? 'text-teal' : 'text-brand')}>{eyebrow}</p>}
      <h2 className={cx('text-3xl font-extrabold tracking-tight sm:text-4xl', light && 'text-white')}>{title}</h2>
      {subtitle && <p className={cx('mt-3 text-base sm:text-lg', light ? 'text-slate-300' : 'text-slate-600')}>{subtitle}</p>}
    </div>
  );
}

/* ---------------------------------- Hero ---------------------------------- */
function Hero({ workshop }) {
  const { attribution } = useReferral();
  const inf = attribution?.influencer;
  const price = effectivePrice(workshop);
  const saving = workshop && price < workshop.price ? workshop.price - price : 0;
  const isHybrid = workshop?.mode === 'hybrid';
  const place = workshop ? workshop.location || (workshop.mode === 'online' ? 'Online' : '') : '';

  let offer = null;
  if (inf?.name) offer = `Special offer for ${firstName(inf.name)}'s followers${saving ? ` — save ${formatINR(saving)}` : ''}`;
  else if (saving) offer = `Early-bird offer — save ${formatINR(saving)}`;

  return (
    <section className="relative overflow-hidden bg-[#071630] text-white">
      {/* background glow + grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-brand/30 blur-[120px]" />
        <div className="absolute -right-24 top-10 size-[480px] rounded-full bg-purple/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-teal/20 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-28 pt-28 sm:px-6 sm:pb-36 sm:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fade-up">
          {workshop && (
            <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur sm:text-sm">
              <Sparkles className="size-4 shrink-0 text-teal" /> <span className="truncate">{workshop.title}</span>
            </p>
          )}
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
            Create Viral Videos
            <br />
            with <span className="bg-gradient-to-r from-teal to-cyan-300 bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
            {workshop?.tagline || 'Join our hands-on AI Video Creation Workshop — script, generate, voice and edit scroll-stopping videos without a camera crew.'}
          </p>

          {workshop && (
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5"><CalendarDays className="size-5 text-cyan-300" /></span>
                <div className="leading-tight">
                  <p className="font-semibold text-white">{formatDateRange(workshop.startDate, workshop.endDate)}</p>
                  <p className="text-sm text-slate-400">{formatTime(workshop.startDate)} – {formatTime(workshop.endDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5"><MapPin className="size-5 text-cyan-300" /></span>
                <div className="leading-tight">
                  <p className="font-semibold text-white">{place || titleCase(workshop.mode)}</p>
                  <p className="text-sm text-slate-400">{isHybrid ? '+ Online' : `${titleCase(workshop.mode)} workshop`}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#register" className="btn bg-gradient-to-r from-teal to-cyan-400 px-8 py-3.5 text-base text-navy shadow-xl shadow-teal/30 hover:brightness-105">
              Register Now <ArrowRight className="size-5" />
            </a>
            {workshop && (
              <p className="text-sm text-slate-300">
                {saving > 0 && <span className="mr-2 text-slate-500 line-through">{formatINR(workshop.price)}</span>}
                <span className="text-2xl font-bold text-white">{price > 0 ? formatINR(price) : 'Free'}</span>
              </p>
            )}
          </div>

          {(offer || (workshop?.seatsLeft !== null && workshop?.seatsLeft !== undefined)) && (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {offer && <p className="flex items-center gap-2 font-medium text-amber-300"><Gift className="size-4" /> {offer}</p>}
              {workshop?.seatsLeft !== null && workshop?.seatsLeft !== undefined && (
                <p className="flex items-center gap-2 text-slate-300"><Users className="size-4 text-cyan-300" /> {workshop.seatsLeft} seats left</p>
              )}
            </div>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          {workshop?.bannerImage ? (
            <img src={workshop.bannerImage} alt={workshop.title} className="w-full rounded-3xl object-cover shadow-2xl shadow-brand/30" />
          ) : (
            <VideoHeroVisual />
          )}
        </div>
      </div>

      {/* wave into the white section */}
      <svg className="absolute inset-x-0 bottom-0 h-16 w-full text-white sm:h-24" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path fill="currentColor" d="M0 80c160 30 320 40 520 18S900 20 1100 30s260 50 340 60v30H0z" />
        <path fill="#2F6BFF" fillOpacity=".25" d="M0 70c200 30 380 30 560 8S920 10 1120 24s240 40 320 46v6c-80-6-160-34-320-48S740 82 560 96 200 100 0 76z" />
      </svg>
    </section>
  );
}

/* ------------------------------ Why join + form ----------------------------- */
function WhyJoin({ workshop, workshops }) {
  const reasons = workshop?.benefits?.length ? workshop.benefits : DEFAULT_REASONS;
  const photo = workshop?.trainer?.photo;
  return (
    <section id="benefits" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-white via-brand-50/70 to-white px-4 pb-20 pt-10 sm:px-6">
      <div className="pointer-events-none absolute -right-20 top-10 size-96 rounded-full bg-teal/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Why Join This Workshop?</h2>
          <ul className="mt-6 space-y-3.5">
            {reasons.map((r) => (
              <li key={r} className="flex items-center gap-3 text-base text-slate-700">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-4" strokeWidth={3} /></span>
                {r}
              </li>
            ))}
          </ul>
          {workshop?.learnings?.length > 0 && (
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {workshop.learnings.slice(0, 6).map((l) => (
                <p key={l} className="flex items-start gap-2 rounded-xl bg-white/80 p-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" /> {l}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-x-6 bottom-0 top-10 rounded-[2.5rem] bg-gradient-to-br from-brand via-purple to-teal opacity-90" />
          {photo ? (
            <img src={photo} alt={workshop.trainer.name} className="relative z-10 mx-auto max-h-[420px] w-auto object-contain drop-shadow-2xl" />
          ) : (
            <div className="relative z-10 flex aspect-[4/5] flex-col items-center justify-center gap-4 p-8 text-center text-white">
              <span className="grid size-24 place-items-center rounded-3xl bg-white/15 backdrop-blur"><Clapperboard className="size-12" /></span>
              <p className="font-display text-2xl font-bold text-white">Create while you learn</p>
              <p className="text-sm text-white/80">Walk out with finished AI videos for your channel — plus the prompts and workflow to keep creating every week.</p>
            </div>
          )}
          {workshop?.trainer?.name && (
            <div className="absolute -bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-white px-4 py-2.5 text-center shadow-xl">
              <p className="text-sm font-bold text-navy">{workshop.trainer.name}</p>
              {workshop.trainer.title && <p className="text-xs text-slate-500">{workshop.trainer.title}</p>}
            </div>
          )}
        </div>
      </div>

      <div id="register" className="relative mx-auto mt-16 max-w-3xl scroll-mt-24">
        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl shadow-brand/10 backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="flex items-center justify-center gap-2.5 text-2xl font-extrabold">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand"><Users className="size-5" /></span>
              Register for the AI Video Workshop
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">Fill in the details to secure your seat</p>
          </div>
          <RegistrationForm workshops={workshops} defaultWorkshopId={workshop?._id} />
        </div>
      </div>
    </section>
  );
}

function FAQ({ faqs }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {faqs.map((f, i) => (
        <div key={f.question} className={cx('rounded-2xl border bg-white transition', open === i ? 'border-brand/30 shadow-md shadow-brand/5' : 'border-slate-200')}>
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-navy" aria-expanded={open === i}>
            {f.question}
            <ChevronDown className={cx('size-5 shrink-0 text-slate-400 transition', open === i && 'rotate-180 text-brand')} />
          </button>
          {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.answer}</p>}
        </div>
      ))}
    </div>
  );
}

export default function WorkshopLanding({ workshop, workshops = [], loading }) {
  if (loading) {
    return (
      <div className="bg-[#071630] px-4 pb-24 pt-36">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-16 w-3/4 bg-white/10" />
            <Skeleton className="h-16 w-2/3 bg-white/10" />
            <Skeleton className="h-6 w-1/2 bg-white/10" />
            <Skeleton className="h-12 w-48 bg-white/10" />
          </div>
          <Skeleton className="hidden h-80 rounded-3xl bg-white/5 lg:block" />
        </div>
      </div>
    );
  }

  const price = effectivePrice(workshop);
  const formWorkshops = workshops.length ? workshops : workshop ? [workshop] : [];

  return (
    <>
      <Hero workshop={workshop} />

      {/* What you'll learn */}
      <section id="learn" className="scroll-mt-20 bg-white px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">What You'll Learn?</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {TOPICS.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg sm:p-6">
                <span className={cx('mx-auto mb-3 grid size-14 place-items-center rounded-2xl transition group-hover:scale-105', tone)}>
                  <Icon className="size-7" strokeWidth={1.8} />
                </span>
                <h3 className="text-sm font-bold sm:text-base">{title}</h3>
                <p className="mt-2 hidden text-sm leading-relaxed text-slate-500 sm:block">{text}</p>
              </div>
            ))}
          </div>
          {workshop?.description && <p className="mx-auto mt-10 max-w-3xl whitespace-pre-line text-center text-slate-600">{workshop.description}</p>}
        </div>
      </section>

      <WhyJoin workshop={workshop} workshops={formWorkshops} />

      {workshop?.trainer?.name && (
        <section id="about" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle eyebrow="About your trainer" title="Learn from a practitioner" />
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 rounded-3xl bg-gradient-to-br from-navy to-navy-700 p-6 text-center text-white sm:flex-row sm:p-10 sm:text-left">
            {workshop.trainer.photo ? (
              <img src={workshop.trainer.photo} alt={workshop.trainer.name} className="size-36 shrink-0 rounded-3xl object-cover ring-4 ring-white/10" />
            ) : (
              <span className="grid size-36 shrink-0 place-items-center rounded-3xl gradient-brand font-display text-5xl font-bold">{workshop.trainer.name[0]}</span>
            )}
            <div>
              <h3 className="text-2xl font-bold text-white">{workshop.trainer.name}</h3>
              {workshop.trainer.title && <p className="mt-1 font-medium text-teal">{workshop.trainer.title}</p>}
              {workshop.trainer.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">{workshop.trainer.bio}</p>}
            </div>
          </div>
        </section>
      )}

      {workshop?.curriculum?.length > 0 && (
        <section id="curriculum" className="scroll-mt-20 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle eyebrow="Curriculum" title="Workshop agenda" />
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {workshop.curriculum.map((m, i) => (
              <div key={m.title} className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl gradient-brand font-display font-bold text-white">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{m.title}</h3>
                    {m.duration && <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple"><Clock className="size-3" />{m.duration}</span>}
                  </div>
                  {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {workshop && (
        <section id="pricing" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle eyebrow="Pricing" title="One workshop. Skills for years." />
          <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl bg-[#071630] p-8 text-white shadow-2xl shadow-brand/20">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-brand/40 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-teal/30 blur-3xl" />
            <div className="relative">
              {price < workshop.price && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1 text-xs font-bold text-navy">
                  <BadgePercent className="size-3.5" /> Save {formatINR(workshop.price - price)}
                </span>
              )}
              <h3 className="mt-4 text-xl font-bold text-white">{workshop.title}</h3>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-5xl font-extrabold">{price > 0 ? formatINR(price) : 'Free'}</span>
                {price < workshop.price && <span className="pb-2 text-lg text-slate-500 line-through">{formatINR(workshop.price)}</span>}
              </div>
              {workshop.registrationDeadline && <p className="mt-2 text-sm text-amber-300">Offer valid until {formatLongDate(workshop.registrationDeadline)}</p>}
              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                {[...(workshop.benefits || []).slice(0, 5), `${titleCase(workshop.mode)} live session`].map((b) => (
                  <li key={b} className="flex gap-2"><Award className="size-5 shrink-0 text-teal" /> {b}</li>
                ))}
              </ul>
              <a href="#register" className="btn mt-8 w-full bg-gradient-to-r from-teal to-cyan-400 py-3.5 text-base text-navy">Reserve my seat</a>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white px-4 py-12 sm:px-6">
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-[#071630] p-8 text-center text-white sm:flex-row sm:p-10 sm:text-left">
          <div className="pointer-events-none absolute -left-10 -top-10 size-60 rounded-full bg-[#dd2a7b]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-10 size-60 rounded-full bg-brand/30 blur-3xl" />
          <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]"><Instagram className="size-8" /></span>
          <div className="relative flex-1">
            <h2 className="text-2xl font-extrabold text-white">Are you an Instagram creator?</h2>
            <p className="mt-1 text-slate-300">Partner with JenCorps, share our AI video workshops with your followers and earn commission on every paid registration.</p>
          </div>
          <Link to="/become-influencer" className="btn relative whitespace-nowrap bg-white px-6 py-3 text-navy hover:bg-slate-100">Join as Influencer <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      {workshop?.faqs?.length > 0 && (
        <section id="faq" className="scroll-mt-20 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle eyebrow="FAQs" title="Frequently asked questions" />
          <FAQ faqs={workshop.faqs} />
        </section>
      )}

      {workshop && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <a href="#register" className="btn w-full bg-gradient-to-r from-teal to-cyan-400 py-3 text-base text-navy">
            Register Now{price > 0 ? ` · ${formatINR(price)}` : ''}
          </a>
        </div>
      )}
    </>
  );
}
