import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import AuthCard from './AuthCard';
import { Spinner } from '../../components/ui';
import { post, errorMessage } from '../../services/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'loading' });
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = params.get('token');
    if (!token) return setState({ status: 'error', message: 'Verification token missing.' });
    post('/auth/verify-email', { token })
      .then(() => setState({ status: 'ok' }))
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }));
  }, [params]);

  return (
    <AuthCard title="Email verification">
      <div className="flex flex-col items-center gap-4 text-center">
        {state.status === 'loading' && <Spinner className="size-10" />}
        {state.status === 'ok' && (
          <>
            <CheckCircle2 className="size-14 text-teal" />
            <p className="text-sm text-slate-600">Your email is verified. Your registrations are now linked to your account.</p>
            <Link to="/login" className="btn-primary w-full">Log in</Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <XCircle className="size-14 text-rose-500" />
            <p className="text-sm text-slate-600">{state.message}</p>
          </>
        )}
      </div>
    </AuthCard>
  );
}
