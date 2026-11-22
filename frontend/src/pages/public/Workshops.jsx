import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, GraduationCap } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { effectivePrice, formatDate, formatINR, formatTime, titleCase } from '../../utils/format';

export default function Workshops() {
  useDocumentTitle('Workshops');
  const { data, loading, error, reload } = useFetch('/workshops', { limit: 50 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold">Upcoming workshops</h1>
      <p className="mt-2 text-slate-600">Hands-on AI workshops — online and in person.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        {!loading &&
          data?.map((w) => (
            <Link key={w._id} to={`/workshops/${w.slug}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
              <div className="relative h-40 gradient-hero">
                {w.bannerImage && <img src={w.bannerImage} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy">{titleCase(w.mode)}</span>
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold group-hover:text-brand">{w.title}</h2>
                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><CalendarDays className="size-4 text-teal" /> {formatDate(w.startDate)} · {formatTime(w.startDate)}</p>
                  <p className="flex items-center gap-2"><MapPin className="size-4 text-teal" /> {w.location || 'Online'}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xl font-bold text-navy">{effectivePrice(w) > 0 ? formatINR(effectivePrice(w)) : 'Free'}</span>
                  {w.seatsLeft !== null && <span className="text-xs font-medium text-amber-600">{w.seatsLeft} seats left</span>}
                </div>
              </div>
            </Link>
          ))}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !data?.length && (
        <div className="card mt-6">
          <EmptyState icon={GraduationCap} title="No upcoming workshops" description="New workshops are announced regularly. Follow us on Instagram to be the first to know." />
        </div>
      )}
    </div>
  );
}
