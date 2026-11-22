import { useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, CalendarDays, MapPin, Video, XCircle, Copy } from 'lucide-react';
import PaymentPanel from '../../components/landing/PaymentPanel';
import { Card, CopyButton, ErrorState, Skeleton, StatusBadge } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { formatINR, formatLongDate, formatTime, titleCase } from '../../utils/format';

export default function RegistrationStatus() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || undefined;
  const { data, loading, error, reload } = useFetch(`/leads/status/${id}`, { token });
  useDocumentTitle('Your registration');

  // After checkout the webhook may land a moment later: poll briefly while pending
  const polls = useRef(0);
  useEffect(() => {
    if (!data || data.paymentStatus !== 'pending' || polls.current === 0) return undefined;
    if (polls.current > 6) return undefined;
    const t = setTimeout(() => {
      polls.current += 1;
      reload();
    }, 2500);
    return () => clearTimeout(t);
  }, [data, reload]);

  const onPaid = () => {
    polls.current = 1;
    reload();
  };

  if (loading && !data) return <div className="mx-auto max-w-2xl px-4 py-12"><Skeleton className="h-96 rounded-2xl" /></div>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card"><ErrorState message="We couldn't find this registration. Please use the link from your confirmation email." /></div>
      </div>
    );
  }
  const w = data.workshop;
  const confirmed = ['paid', 'not_required', 'partially_refunded'].includes(data.paymentStatus) && data.registrationStatus !== 'cancelled';
  const cancelled = data.registrationStatus === 'cancelled';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="card overflow-hidden">
        <div className={`p-6 text-center text-white sm:p-8 ${confirmed ? 'bg-gradient-to-br from-teal to-brand' : cancelled ? 'bg-slate-600' : 'gradient-hero'}`}>
          {confirmed ? <CheckCircle2 className="mx-auto size-14" /> : cancelled ? <XCircle className="mx-auto size-14" /> : <Clock className="mx-auto size-14 text-amber-300" />}
          <h1 className="mt-3 text-2xl font-extrabold text-white">
            {confirmed ? "You're in! Seat confirmed 🎉" : cancelled ? 'Registration cancelled' : 'Almost there — complete your payment'}
          </h1>
          <p className="mt-2 text-sm text-white/80">Hi {data.name}, {confirmed ? 'we have sent the details to your email.' : cancelled ? 'contact support if this is unexpected.' : 'your seat is reserved once payment is complete.'}</p>
        </div>

        <div className="space-y-5 p-5 sm:p-8">
          <div>
            <h2 className="text-lg font-bold">{w.title}</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p className="flex items-center gap-2"><CalendarDays className="size-4 text-brand" /> {formatLongDate(w.startDate)}</p>
              <p className="flex items-center gap-2"><Clock className="size-4 text-brand" /> {formatTime(w.startDate)} – {formatTime(w.endDate)} IST</p>
              <p className="flex items-center gap-2 sm:col-span-2"><MapPin className="size-4 text-brand" /> {titleCase(data.mode || w.mode)} · {w.location || 'Online'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-slate-500">Registration:</span> <StatusBadge status={data.registrationStatus} />
            <span className="ml-3 text-slate-500">Payment:</span> <StatusBadge status={data.paymentStatus} />
          </div>

          {confirmed && w.meetingLink && (
            <Card title="Live session link">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <a href={w.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate text-sm font-medium text-brand underline">
                  <Video className="size-4 shrink-0" /> <span className="truncate">{w.meetingLink}</span>
                </a>
                <CopyButton text={w.meetingLink} />
              </div>
            </Card>
          )}

          {['pending', 'failed'].includes(data.paymentStatus) && !cancelled && (
            <>
              {data.paymentStatus === 'failed' && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Your last payment attempt failed. No money was taken — please try again.</p>}
              <PaymentPanel leadId={data._id} accessToken={token} amount={w.effectivePrice} workshopTitle={w.title} onPaid={onPaid} />
            </>
          )}

          {confirmed && w.effectivePrice > 0 && <p className="text-center text-xs text-slate-500">Amount paid: {formatINR(w.effectivePrice)}</p>}

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-5 text-center text-sm sm:flex-row sm:justify-center">
            <Link to="/" className="btn-secondary">Back to home</Link>
            <Link to="/register-account" className="btn-ghost">Create an account to track registrations</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
