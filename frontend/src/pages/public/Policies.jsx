import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { FileText, ShieldCheck, ScrollText, RotateCcw, Truck, Cookie, Handshake, Mail, Phone, ChevronRight } from 'lucide-react';
import { policies, findPolicy, LAST_UPDATED, policyContact } from '../../content/policies';
import { useDocumentTitle } from '../../hooks';
import { cx } from '../../components/ui';

const ICONS = {
  'privacy-policy': ShieldCheck,
  'terms-and-conditions': ScrollText,
  'refund-policy': RotateCcw,
  'delivery-policy': Truck,
  'cookie-policy': Cookie,
  'partner-terms': Handshake,
};

function ContactBox() {
  return (
    <div className="rounded-2xl bg-navy p-5 text-sm text-slate-300">
      <p className="font-semibold text-white">Questions about our policies?</p>
      <a href={`mailto:${policyContact.support}`} className="mt-3 flex items-center gap-2 hover:text-white"><Mail className="size-4 text-teal" />{policyContact.support}</a>
      <a href={policyContact.phoneHref} className="mt-2 flex items-center gap-2 hover:text-white"><Phone className="size-4 text-teal" />{policyContact.phone}</a>
      <p className="mt-3 text-xs text-slate-400">{policyContact.address}</p>
    </div>
  );
}

/** /policies: index of all policy pages */
export function PoliciesIndex() {
  useDocumentTitle('Policies');
  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Legal</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Policies</h1>
        <p className="mt-2 max-w-2xl text-slate-600">How we handle your data, payments, refunds and partnerships. Last updated {LAST_UPDATED}.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {policies.map((p) => {
            const Icon = ICONS[p.slug] || FileText;
            return (
              <Link key={p.slug} to={`/policies/${p.slug}`} className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><Icon className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1 font-bold text-navy group-hover:text-brand">{p.title} <ChevronRight className="size-4 opacity-0 transition group-hover:opacity-100" /></h2>
                  <p className="mt-1 text-sm text-slate-500">{p.summary}</p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-8 max-w-md"><ContactBox /></div>
      </div>
    </div>
  );
}

/** /policies/:slug: a single policy with a side menu of all policies */
export default function PolicyPage() {
  const { slug } = useParams();
  const policy = findPolicy(slug);
  useDocumentTitle(policy?.title || 'Policies');
  if (!policy) return <Navigate to="/policies" replace />;
  const Icon = ICONS[policy.slug] || FileText;

  return (
    <div className="bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Link to="/policies" className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-brand">All policies</Link>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {policies.map((p) => (
              <NavLink
                key={p.slug}
                to={`/policies/${p.slug}`}
                className={({ isActive }) => cx('whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-slate-600 hover:bg-white hover:text-navy')}
              >
                {p.title}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 hidden lg:block"><ContactBox /></div>
        </aside>

        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand"><Icon className="size-6" /></span>
          <h1 className="mt-4 text-3xl font-extrabold">{policy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated {LAST_UPDATED}</p>
          <p className="mt-4 text-slate-600">{policy.summary}</p>
          <div className="mt-8 space-y-8">
            {policy.sections.map((s, i) => (
              <section key={s.heading}>
                <h2 className="text-lg font-bold text-navy">{i + 1}. {s.heading}</h2>
                {s.paragraphs?.map((t) => <p key={t} className="mt-2 leading-relaxed text-slate-600">{t}</p>)}
                {s.list && (
                  <ul className="mt-3 space-y-2">
                    {s.list.map((t) => (
                      <li key={t} className="flex gap-3 leading-relaxed text-slate-600"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />{t}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          <div className="mt-10 lg:hidden"><ContactBox /></div>
        </article>
      </div>
    </div>
  );
}
