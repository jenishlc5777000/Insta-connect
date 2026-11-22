import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import RegistrationForm from '../../components/landing/RegistrationForm';
import { ErrorState, Skeleton } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { formatLongDate, formatTime, titleCase } from '../../utils/format';

export default function Register() {
  const { workshopSlug } = useParams();
  const { data: w, loading, error } = useFetch(`/workshops/${workshopSlug}`);
  useDocumentTitle(w ? `Register – ${w.title}` : 'Register');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {loading && <Skeleton className="h-96 rounded-2xl" />}
      {error && <ErrorState message={error} />}
      {w && (
        <div className="grid gap-8 lg:grid-cols-5">
          <aside className="lg:col-span-2">
            <div className="rounded-2xl gradient-hero p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-teal">You're registering for</p>
              <h1 className="mt-2 text-2xl font-extrabold text-white">{w.title}</h1>
              <div className="mt-5 space-y-2 text-sm text-slate-200">
                <p className="flex items-center gap-2"><CalendarDays className="size-4" /> {formatLongDate(w.startDate)}</p>
                <p className="flex items-center gap-2"><Clock className="size-4" /> {formatTime(w.startDate)} – {formatTime(w.endDate)} IST</p>
                <p className="flex items-center gap-2"><MapPin className="size-4" /> {titleCase(w.mode)} · {w.location || 'Online'}</p>
              </div>
              <Link to={`/workshops/${w.slug}`} className="mt-5 inline-block text-sm font-medium text-teal underline">View full details</Link>
            </div>
          </aside>
          <div className="card p-5 sm:p-8 lg:col-span-3">
            <h2 className="mb-5 text-xl font-bold">Your details</h2>
            {w.status === 'published' ? <RegistrationForm workshops={[w]} defaultWorkshopId={w._id} compact /> : <p className="text-sm text-slate-500">Registration is closed for this workshop.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
