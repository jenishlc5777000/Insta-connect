import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Instagram, IndianRupee, Globe, LayoutDashboard, FolderDown, Wallet, Send, BadgeCheck, Share2, CheckCircle2,
  Loader2, XCircle, ArrowRight, Sparkles, PartyPopper, Eye, Youtube, Facebook,
} from 'lucide-react';
import { Button, Field, Input, Select, Textarea, cx } from '../../components/ui';
import { get, post, errorMessage, applyFieldErrors } from '../../services/api';
import { useSite } from '../../context/SiteContext';
import { useDebounce, useDocumentTitle } from '../../hooks';
import { CHANNELS, VIEW_RANGES } from '../../utils/audience';

const NICHES = ['Video Creation', 'Tech & AI', 'Education', 'Career & Jobs', 'Business & Finance', 'Lifestyle', 'Content Creation', 'Other'].map((v) => ({ value: v, label: v }));
const FOLLOWERS = [
  { value: '1000', label: 'Under 5K' },
  { value: '5000', label: '5K – 10K' },
  { value: '10000', label: '10K – 50K' },
  { value: '50000', label: '50K – 100K' },
  { value: '100000', label: '100K – 500K' },
  { value: '500000', label: '500K+' },
];

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,18}$/, 'Enter a valid phone number').refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid phone number'),
  instagramUsername: z.string().trim().min(1, 'Enter your Instagram username').regex(/^@?[A-Za-z0-9._]{1,30}$/, 'Enter a valid Instagram username'),
  followers: z.string().min(1, 'Select your follower range'),
  avgViews: z.object({
    instagram: z.string().min(1, 'Select your average Reel views'),
    youtube: z.string().optional(),
    facebook: z.string().optional(),
  }),
  youtubeChannel: z.union([z.literal(''), z.string().trim().url('Enter the full link, starting with https://')]).optional(),
  facebookPage: z.union([z.literal(''), z.string().trim().url('Enter the full link, starting with https://')]).optional(),
  niche: z.string().optional(),
  city: z.string().optional(),
  preferredSubdomain: z.string().trim().toLowerCase().regex(/^([a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9]))?$/, '3–32 lowercase letters, numbers or hyphens').optional(),
  message: z.string().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the partner terms' }) }),
});

const baseHost = () => {
  const h = window.location.hostname.replace(/^www\./, '');
  const parts = h.split('.');
  if (h.endsWith('localhost')) return `localhost${window.location.port ? `:${window.location.port}` : ''}`;
  return parts.length > 2 ? parts.slice(1).join('.') : h;
};

function SubdomainStatus({ value }) {
  const debounced = useDebounce(value, 400);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!debounced || debounced.length < 3) return setState(null);
    let alive = true;
    setState({ loading: true });
    get('/influencer-applications/subdomain-available', { subdomain: debounced.toLowerCase() })
      .then((r) => alive && setState(r.data))
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, [debounced]);
  if (!state) return null;
  if (state.loading) return <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="size-3 animate-spin" /> Checking…</span>;
  return state.available ? (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="size-3.5" /> Available</span>
  ) : (
    <span className="flex items-center gap-1 text-xs font-medium text-rose-600"><XCircle className="size-3.5" /> {state.reason}</span>
  );
}

export default function BecomeInfluencer() {
  useDocumentTitle('Join as an Instagram influencer');
  const site = useSite();
  const rate = site.defaultCommissionRate ?? 50;
  const [done, setDone] = useState(null);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { followers: '', avgViews: { instagram: '', youtube: '', facebook: '' } } });
  const views = watch('avgViews');
  const sub = watch('preferredSubdomain');

  const onSubmit = async (v) => {
    try {
      await post('/influencer-applications', {
        ...v,
        followers: Number(v.followers),
        avgViews: {
          instagram: Number(v.avgViews.instagram),
          youtube: v.avgViews.youtube ? Number(v.avgViews.youtube) : null,
          facebook: v.avgViews.facebook ? Number(v.avgViews.facebook) : null,
        },
        youtubeChannel: v.avgViews.youtube ? v.youtubeChannel || undefined : undefined,
        facebookPage: v.avgViews.facebook ? v.facebookPage || undefined : undefined,
        niche: v.niche || undefined,
        city: v.city || undefined,
        preferredSubdomain: v.preferredSubdomain || undefined,
        message: v.message || undefined,
      });
      setDone(v.name.split(' ')[0]);
      window.scrollTo({ top: document.getElementById('apply')?.offsetTop - 80, behavior: 'smooth' });
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  const perks = [
    { icon: IndianRupee, title: `${rate}% commission`, text: `Earn ${rate}% of every paid registration that comes through your link.`, tone: 'bg-emerald-50 text-emerald-600' },
    { icon: Globe, title: 'Your own link', text: `A personal site like yourname.${baseHost().replace(/:\d+$/, '')} — perfect for your bio.`, tone: 'bg-brand-50 text-brand' },
    { icon: LayoutDashboard, title: 'Live dashboard', text: 'See clicks, registrations and earnings in real time.', tone: 'bg-purple-50 text-purple' },
    { icon: FolderDown, title: 'Ready promo kit', text: 'Posters, story images, reel scripts, captions and hashtags.', tone: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#071630] px-4 pb-20 pt-32 text-white sm:px-6 sm:pt-40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 size-[460px] rounded-full bg-[#dd2a7b]/25 blur-[120px]" />
          <div className="absolute -right-20 top-10 size-[460px] rounded-full bg-brand/30 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 size-[380px] rounded-full bg-teal/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm">
              <Instagram className="size-4 text-pink-400" /> JenCorps Influencer Partner Program
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Turn your Instagram into{' '}
              <span className="bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] bg-clip-text text-transparent">income</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Share our hands-on AI video creation workshops with your followers and earn <b className="text-white">{rate}% commission</b> on every paid registration — tracked automatically through your own link.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="btn bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-7 py-3.5 text-base text-white shadow-xl shadow-pink-500/25 hover:brightness-110">
                <Instagram className="size-5" /> Join as Influencer
              </a>
              <Link to="/influencer/login" className="btn border border-white/20 px-7 py-3.5 text-base text-white hover:bg-white/10">Already a partner? Log in</Link>
            </div>
          </div>

          {/* earnings example card */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-[#dd2a7b]/40 via-purple/30 to-teal/30 blur-2xl" />
            <div className="relative rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <p className="text-sm text-slate-300">Example: one workshop ticket</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-300">Ticket price</span><b>₹2,000</b></div>
                <div className="flex justify-between"><span className="text-slate-300">Your commission</span><b>{rate}%</b></div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5"><span>You earn per registration</span><b className="text-xl text-emerald-300">₹{((2000 * rate) / 100).toLocaleString('en-IN')}</b></div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm text-slate-300">
                <p className="flex items-center gap-2"><Sparkles className="size-4 text-amber-300" /> 20 registrations = <b className="text-white">₹{((20 * 2000 * rate) / 100).toLocaleString('en-IN')}</b></p>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">Illustration only. Actual earnings depend on ticket price and paid registrations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-3xl font-extrabold">Why partner with JenCorps?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-200/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <span className={cx('mb-4 grid size-12 place-items-center rounded-2xl', tone)}><Icon className="size-6" /></span>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <h2 className="mb-8 mt-16 text-center text-3xl font-extrabold">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {[
              [Send, 'Apply', 'Fill in the form below — it takes 2 minutes.'],
              [BadgeCheck, 'Get approved', 'Our team reviews your profile within 2–3 working days.'],
              [Share2, 'Share your link', 'Post your personal link in your bio, stories and reels.'],
              [Wallet, 'Get paid', 'Earn on every paid registration, paid out to your UPI or bank.'],
            ].map(([Icon, title, text], i) => (
              <li key={title} className="relative rounded-2xl bg-slate-50 p-5">
                <span className="absolute right-4 top-4 font-display text-3xl font-extrabold text-slate-200">{i + 1}</span>
                <Icon className="size-7 text-brand" />
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="scroll-mt-20 bg-gradient-to-b from-white via-brand-50/60 to-white px-4 pb-20 pt-6 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-brand/10 sm:p-8">
          {done ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><PartyPopper className="size-8" /></span>
              <h2 className="mt-4 text-2xl font-extrabold">Thanks, {done}! Application received 🎉</h2>
              <p className="mx-auto mt-2 max-w-md text-slate-600">We've emailed you a confirmation. Our team will review your profile and get back to you within 2–3 working days with your login details and referral link.</p>
              <Link to="/" className="btn-secondary mt-6">Back to home</Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h2 className="flex items-center justify-center gap-2.5 text-2xl font-extrabold">
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"><Instagram className="size-5" /></span>
                  Apply as an Instagram Influencer
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">Tell us about you and your audience</p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" required error={errors.name?.message}><Input autoComplete="name" {...register('name')} error={errors.name} /></Field>
                  <Field label="Email address" required error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} error={errors.email} /></Field>
                  <Field label="Phone / WhatsApp" required error={errors.phone?.message}><Input type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('phone')} error={errors.phone} /></Field>
                  <Field label="Instagram username" required error={errors.instagramUsername?.message}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
                      <Input className="pl-8" autoCapitalize="off" placeholder="yourhandle" {...register('instagramUsername')} error={errors.instagramUsername} />
                    </div>
                  </Field>
                  <Field label="Followers" required error={errors.followers?.message}><Select {...register('followers')} placeholder="Select range" options={FOLLOWERS} error={errors.followers} /></Field>
                  <Field label="Content niche"><Select {...register('niche')} placeholder="Select niche" options={NICHES} /></Field>
                  <Field label="City"><Input autoComplete="address-level2" {...register('city')} /></Field>
                  <Field label="Preferred link name" error={errors.preferredSubdomain?.message}>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                      <input className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 py-2.5 text-sm outline-none" autoCapitalize="off" placeholder="yourname" {...register('preferredSubdomain')} />
                      <span className="whitespace-nowrap pr-3.5 text-sm text-slate-400">.{baseHost()}</span>
                    </div>
                    <div className="mt-1 min-h-4">{!errors.preferredSubdomain && <SubdomainStatus value={sub} />}</div>
                  </Field>
                </div>
                <fieldset className="rounded-2xl border border-slate-200 p-4">
                  <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-navy"><Eye className="size-4 text-brand" /> Average video views</legend>
                  <p className="mb-3 text-xs text-slate-500">Typical views on your recent videos, per channel. Choose "I don't post here" for channels you don't use.</p>
                  <div className="space-y-3">
                    {CHANNELS.map((c) => {
                      const Icon = c.key === 'instagram' ? Instagram : c.key === 'youtube' ? Youtube : Facebook;
                      const tone = c.key === 'instagram' ? 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white' : c.key === 'youtube' ? 'bg-[#FF0000] text-white' : 'bg-[#1877F2] text-white';
                      const err = errors.avgViews?.[c.key]?.message;
                      return (
                        <div key={c.key}>
                          <div className="grid items-center gap-2 sm:grid-cols-[200px_1fr]">
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <span className={cx('grid size-7 place-items-center rounded-lg', tone)}><Icon className="size-4" /></span>
                              {c.label} {c.required && <span className="text-rose-500">*</span>}
                            </span>
                            <Select {...register(`avgViews.${c.key}`)} placeholder={c.required ? 'Select average views' : "I don't post here"} options={VIEW_RANGES} error={err} />
                          </div>
                          {err && <p className="mt-1 text-xs text-rose-600 sm:pl-[208px]">{err}</p>}
                          {c.link && views?.[c.key] && (
                            <div className="mt-2 sm:pl-[208px]">
                              <Input placeholder={c.placeholder} aria-label={c.linkLabel} {...register(c.link)} error={errors[c.link]} />
                              {errors[c.link] && <p className="mt-1 text-xs text-rose-600">{errors[c.link].message}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                <Field label="Why do you want to partner with us?"><Textarea rows={3} maxLength={1000} placeholder="Tell us about your audience and how you'd promote the workshop" {...register('message')} /></Field>
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" {...register('consent')} />
                  <span>I agree to the <Link to="/policies/partner-terms" target="_blank" className="font-medium text-brand underline">partner terms</Link> and <Link to="/policies/privacy-policy" target="_blank" className="font-medium text-brand underline">privacy policy</Link>, and to being contacted about this application.</span>
                </label>
                {errors.consent && <p className="-mt-2 text-xs text-rose-600">{errors.consent.message}</p>}
                <Button type="submit" className="w-full !bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] py-3.5 text-base shadow-lg shadow-pink-500/20" loading={isSubmitting}>
                  Submit application {!isSubmitting && <ArrowRight className="size-5" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
