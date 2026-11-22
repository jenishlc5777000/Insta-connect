import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthCard from './AuthCard';
import { Button, Field, Input } from '../../components/ui';
import { post, errorMessage } from '../../services/api';
import { useDocumentTitle } from '../../hooks';

const schema = z.object({ email: z.string().trim().email('Enter a valid email') });

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await post('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure link to choose a new password." footer={<Link to="/login" className="font-semibold text-brand">Back to login</Link>}>
      {sent ? (
        <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} error={errors.email} /></Field>
          <Button type="submit" className="w-full py-3" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
