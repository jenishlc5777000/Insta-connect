import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthCard from './AuthCard';
import { Button, Field, Input } from '../../components/ui';
import { post, errorMessage } from '../../services/api';
import { useDocumentTitle } from '../../hooks';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    try {
      await post('/auth/reset-password', { token, password });
      toast.success('Password updated. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!token) {
    return (
      <AuthCard title="Invalid link" subtitle="This password reset link is missing its token.">
        <Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password?.message} hint="8+ characters with letters and numbers"><Input type="password" autoComplete="new-password" {...register('password')} error={errors.password} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register('confirm')} error={errors.confirm} /></Field>
        <Button type="submit" className="w-full py-3" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthCard>
  );
}
