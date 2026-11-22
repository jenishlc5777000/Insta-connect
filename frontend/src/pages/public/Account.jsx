import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, LogOut, Ticket, MailWarning } from 'lucide-react';
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle, useFetch } from '../../hooks';
import { formatDate, formatTime, titleCase } from '../../utils/format';

export default function Account() {
  useDocumentTitle('My registrations');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/users/me/registrations');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Hi, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500">Your workshop registrations</p>
        </div>
        <Button variant="secondary" icon={LogOut} onClick={async () => { await logout(); navigate('/'); }}>Log out</Button>
      </div>

      {!user?.emailVerified && user?.role === 'customer' && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <MailWarning className="size-4 shrink-0" /> Verify your email (check your inbox) to see registrations made before you created your account.
        </p>
      )}

      {loading && <Skeleton className="h-40 rounded-2xl" />}
      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {!loading && !error && !data?.length && (
        <div className="card">
          <EmptyState icon={Ticket} title="No registrations yet" description="Register for an upcoming workshop to see it here." action={<Link to="/workshops" className="btn-primary">Browse workshops</Link>} />
        </div>
      )}
      <div className="space-y-4">
        {data?.map((r) => (
          <div key={r._id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">{r.workshop?.title}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="size-4" /> {formatDate(r.workshop?.startDate)} · {formatTime(r.workshop?.startDate)} · {titleCase(r.mode || r.workshop?.mode)}
              </p>
              <div className="mt-2 flex gap-2"><StatusBadge status={r.registrationStatus} /><StatusBadge status={r.paymentStatus} /></div>
            </div>
            <p className="text-xs text-slate-400">Registered {formatDate(r.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
