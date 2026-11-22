import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, ChevronDown, FolderDown, GraduationCap } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, cx } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { effectivePrice, formatINR, formatLongDate, formatTime, titleCase } from '../../utils/format';

export default function InfluencerWorkshops() {
  useDocumentTitle('Workshop details');
  const { data, loading, error, reload } = useFetch('/influencers/me/workshops');
  const [open, setOpen] = useState(0);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  return (
    <>
      <PageHeader title="Workshop details" description="Everything you need to talk confidently about each workshop." />
      {loading && <Skeleton className="h-64 rounded-2xl" />}
      {!loading && !data?.length && <div className="card"><EmptyState icon={GraduationCap} title="No workshops yet" /></div>}
      <div className="space-y-4">
        {data?.map((w, i) => (
          <Card key={w._id} bodyClassName="p-0">
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-start justify-between gap-4 p-5 text-left">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{w.title}</h2><StatusBadge status={w.status} /></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{formatLongDate(w.startDate)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-4" />{formatTime(w.startDate)} – {formatTime(w.endDate)}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="size-4" />{titleCase(w.mode)} · {w.location || 'Online'}</span>
                </div>
              </div>
              <ChevronDown className={cx('mt-1 size-5 shrink-0 text-slate-400 transition', open === i && 'rotate-180')} />
            </button>
            {open === i && (
              <div className="space-y-5 border-t border-slate-100 p-5">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div><p className="text-xs text-slate-500">Ticket price</p><p className="font-bold text-navy">{formatINR(effectivePrice(w))} {effectivePrice(w) < w.price && <span className="font-normal text-slate-400 line-through">{formatINR(w.price)}</span>}</p></div>
                  {w.registrationDeadline && <div><p className="text-xs text-slate-500">Registration closes</p><p className="font-bold text-navy">{formatLongDate(w.registrationDeadline)}</p></div>}
                  {w.capacity > 0 && <div><p className="text-xs text-slate-500">Seats</p><p className="font-bold text-navy">{w.capacity}</p></div>}
                </div>
                {w.description && <p className="whitespace-pre-line text-sm text-slate-600">{w.description}</p>}
                {w.curriculum?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Curriculum</h3>
                    <ol className="space-y-2">
                      {w.curriculum.map((m, idx) => (
                        <li key={idx} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full gradient-brand text-xs font-bold text-white">{idx + 1}</span>
                          <div><p className="font-medium text-navy">{m.title} {m.duration && <span className="text-xs font-normal text-slate-400">· {m.duration}</span>}</p>{m.description && <p className="text-slate-500">{m.description}</p>}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a href={`/workshops/${w.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">View landing page</a>
                  <Link to={`/influencer/resources?workshopId=${w._id}`} className="btn-primary btn-sm"><FolderDown className="size-4" /> Promotional materials</Link>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
