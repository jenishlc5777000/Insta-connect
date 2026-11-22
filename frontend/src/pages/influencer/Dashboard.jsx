import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MousePointerClick, Users, BadgeCheck, IndianRupee, Link2, Download, Instagram, Trophy, ArrowRight } from 'lucide-react';
import { Card, CopyButton, EmptyState, ErrorState, Select, Skeleton, StatusBadge } from '../../components/ui';
import { MiniStat, PerformanceLegend, PerformanceOverview, TrendCard } from '../../dashboards/Widgets';
import { useAuth } from '../../context/AuthContext';
import { useCopy, useDocumentTitle, useFetch } from '../../hooks';
import { firstName, formatDate, formatINR, formatNumber } from '../../utils/format';

export default function InfluencerDashboard() {
  useDocumentTitle('Influencer dashboard');
  const { user } = useAuth();
  const [workshopId, setWorkshopId] = useState('');
  const { data, loading, error, reload } = useFetch('/influencers/me/summary', { days: 30, workshopId: workshopId || undefined });
  const links = useFetch('/influencers/me/referral-links');
  const workshops = useFetch('/influencers/me/workshops');
  const recent = useFetch('/influencers/me/leads', { limit: 5, sort: '-createdAt', workshopId: workshopId || undefined });
  const { copy } = useCopy();
  const s = data?.summary;
  const t = data?.trends;

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  const referralUrl = links.data?.referralUrl || '';
  const shareInstagram = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JenCorps AI Video Creation Workshop', text: 'Join me at the JenCorps AI Video Creation Workshop! 🎬', url: referralUrl });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy(referralUrl);
    toast.success('Link copied — paste it in your Instagram bio or story link sticker');
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-[1.7rem]">Welcome, {firstName(user?.name)}! 👋</h1>
          <p className="text-sm text-slate-500">Track your performance and earnings</p>
        </div>
        <Select
          className="sm:w-64"
          value={workshopId}
          onChange={(e) => setWorkshopId(e.target.value)}
          placeholder="All workshops"
          options={(workshops.data || []).map((w) => ({ value: w._id, label: w.title }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TrendCard label="Total Clicks" value={formatNumber(s?.clicks)} icon={MousePointerClick} tint="blue" trend={t?.clicks} loading={loading} />
        <TrendCard label="Registrations" value={formatNumber(s?.registrations)} icon={Users} tint="indigo" trend={t?.registrations} loading={loading} />
        <TrendCard label="Paid Registrations" value={formatNumber(s?.paidRegistrations)} icon={BadgeCheck} tint="green" trend={t?.paid} loading={loading} />
        <TrendCard label="Your Earnings" value={formatINR(s?.commission.total)} sub={data ? `(${data.commissionRate}% Share)` : undefined} icon={IndianRupee} tint="purple" trend={t?.earnings} loading={loading} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Total leads" value={formatNumber(s?.leads)} loading={loading} />
        <MiniStat label="Conversion rate" value={`${s?.conversionRate ?? 0}%`} loading={loading} />
        <MiniStat label="Revenue generated" value={formatINR(s?.revenue)} loading={loading} />
        <MiniStat label="Pending commission" value={formatINR(s?.commission.payable)} loading={loading} />
        <MiniStat label="Commission paid" value={formatINR(s?.commission.paid)} loading={loading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Performance Overview" className="lg:col-span-2" actions={<PerformanceLegend />}>
          <PerformanceOverview series={data?.series} loading={loading} />
        </Card>

        <Card title={<span className="flex items-center gap-2"><Link2 className="size-4 text-brand" /> Quick Links</span>}>
          <p className="mb-2 text-sm font-medium text-slate-700">Your Referral Link</p>
          {links.loading ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-600">{referralUrl}</span>
              <CopyButton text={referralUrl} label="Copy" variant="primary" />
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link to="/influencer/resources" className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-navy transition hover:border-brand/40 hover:bg-brand-50/40">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand"><Download className="size-4" /></span>
              Download Promo Kit
            </Link>
            <button type="button" onClick={shareInstagram} disabled={!referralUrl} className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 text-left text-sm font-medium text-navy transition hover:border-pink-300 hover:bg-pink-50/40">
              <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"><Instagram className="size-4" /></span>
              Share on Instagram
            </button>
          </div>
          <Link to="/influencer/referral-links" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">More links & QR code <ArrowRight className="size-4" /></Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Recent Leads" className="lg:col-span-2" bodyClassName="p-0" actions={<Link to="/influencer/leads" className="text-sm font-medium text-brand">View All</Link>}>
          {recent.loading && !recent.data ? (
            <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : !recent.data?.length ? (
            <EmptyState title="No leads yet" description="Share your referral link on stories, reels and WhatsApp to get your first registration." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.data.map((l) => (
                    <tr key={l._id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-navy">{l.name}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">{l.email}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(l.createdAt)}</td>
                      <td className="whitespace-nowrap px-5 py-3"><StatusBadge status={l.paymentStatus === 'paid' ? 'paid' : l.registrationStatus === 'cancelled' ? 'cancelled' : l.paymentStatus === 'pending' ? 'pending' : l.registrationStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Your Earnings Summary" actions={<Link to="/influencer/earnings" className="text-sm font-medium text-brand">View Details</Link>}>
          {loading ? (
            <Skeleton className="h-36 w-full" />
          ) : (
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-500"><Trophy className="size-7" /></span>
                <p className="mt-2 font-display text-2xl font-extrabold text-navy">{formatINR(s?.commission.total)}</p>
                <p className="text-xs text-slate-500">Total Earned</p>
              </div>
              <ul className="flex-1 space-y-3 border-l border-slate-100 pl-5 text-sm">
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full bg-emerald-500" />Paid</span><b className="text-navy">{formatINR(s?.commission.paid)}</b></li>
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full bg-amber-500" />Pending</span><b className="text-navy">{formatINR(s?.commission.payable)}</b></li>
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full bg-brand" />This Month</span><b className="text-navy">{formatINR(s?.commission.thisMonth)}</b></li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
