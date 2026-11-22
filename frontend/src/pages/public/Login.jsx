import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';
import AuthCard from './AuthCard';
import { Button, Field, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../services/api';
import { useDocumentTitle } from '../../hooks';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const PORTALS = {
  customer: { title: 'Welcome back', subtitle: 'Log in to view your workshop registrations.', home: '/account', accent: 'brand' },
  influencer: { title: 'Influencer Hub', subtitle: 'Log in to see your referrals, leads and earnings.', home: '/influencer/dashboard', accent: 'teal' },
  admin: { title: 'Admin console', subtitle: 'Authorised JenCorps staff only.', home: '/admin/dashboard', accent: 'navy' },
};
const homeFor = (role) => (role === 'admin' ? '/admin/dashboard' : role === 'influencer' ? '/influencer/dashboard' : '/account');

export default function Login({ portal = 'customer' }) {
  const cfg = PORTALS[portal];
  useDocumentTitle(cfg.title);
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (!loading && user) {
    const allowed = portal === 'customer' ? ['customer', 'admin'] : [portal];
    if (allowed.includes(user.role)) return <Navigate to={location.state?.from || homeFor(user.role)} replace />;
  }

  const onSubmit = async ({ email, password }) => {
    try {
      const data = await login(email, password, portal);
      toast.success(`Welcome, ${data.user.name.split(' ')[0]}!`);
      navigate(location.state?.from || homeFor(data.user.role), { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'));
    }
  };

  return (
    <AuthCard
      title={cfg.title}
      subtitle={cfg.subtitle}
      accent={cfg.accent}
      footer={
        portal === 'customer' ? (
          <>New here? <Link to="/register-account" className="font-semibold text-brand">Create an account</Link></>
        ) : portal === 'influencer' ? (
          <>Want to become a JenCorps influencer? <Link to="/become-influencer" className="font-semibold text-brand">Apply now</Link></>
        ) : null
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} error={errors.email} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} error={errors.password} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full py-3" loading={isSubmitting} icon={LogIn}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
