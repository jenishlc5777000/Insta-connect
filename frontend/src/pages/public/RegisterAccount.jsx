import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MailCheck } from 'lucide-react';
import AuthCard from './AuthCard';
import { Button, Field, Input, PasswordInput } from '../../components/ui';
import { post, errorMessage, applyFieldErrors } from '../../services/api';
import { useDocumentTitle } from '../../hooks';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().regex(/^(\+?[0-9\s-]{10,18})?$/, 'Enter a valid phone number').optional(),
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function RegisterAccount() {
  useDocumentTitle('Create account');
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confirm, phone, ...values }) => {
    try {
      await post('/auth/register', { ...values, phone: phone || undefined });
      setDone(true);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  if (done) {
    return (
      <AuthCard title="Check your inbox" subtitle="We sent a verification link to your email.">
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="size-14 text-teal" />
          <p className="text-sm text-slate-600">Verify your email to see all workshop registrations made with it, then log in.</p>
          <Link to="/login" className="btn-primary w-full">Go to login</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Track your workshop registrations and payments." footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}><Input autoComplete="name" {...register('name')} error={errors.name} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} error={errors.email} /></Field>
        <Field label="Phone (optional)" error={errors.phone?.message}><Input type="tel" autoComplete="tel" {...register('phone')} error={errors.phone} /></Field>
        <Field label="Password" error={errors.password?.message} hint="8+ characters with letters and numbers"><PasswordInput autoComplete="new-password" {...register('password')} error={errors.password} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...register('confirm')} error={errors.confirm} /></Field>
        <Button type="submit" className="w-full py-3" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthCard>
  );
}
