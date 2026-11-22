import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Lock } from 'lucide-react';
import { Button, Field, Input, Select } from '../ui';
import { post, errorMessage, applyFieldErrors } from '../../services/api';
import { useReferral } from '../../context/ReferralContext';
import { formatDate, formatINR, effectivePrice, titleCase } from '../../utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,18}$/, 'Enter a valid phone number')
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid phone number'),
  city: z.string().trim().max(80).optional(),
  workshopId: z.string().min(1, 'Select a workshop'),
  referralSource: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms and privacy policy' }) }),
});

const SOURCES = ['Instagram', 'WhatsApp', 'YouTube', 'Facebook', 'LinkedIn', 'Friend or colleague', 'Other'].map((s) => ({ value: s, label: s }));

/**
 * The influencer is never selected by the visitor: attribution is resolved by the API from the
 * subdomain / first-party cookie. The referral ID is only displayed (read-only) for reassurance.
 */
export default function RegistrationForm({ workshops = [], defaultWorkshopId, compact }) {
  const navigate = useNavigate();
  const { attribution, utm } = useReferral();
  const referralCode = attribution?.influencer?.influencerCode;

  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { workshopId: defaultWorkshopId || workshops[0]?._id || '', referralSource: utm?.source ? titleCase(utm.source) : '' },
  });

  useEffect(() => {
    if (defaultWorkshopId) setValue('workshopId', defaultWorkshopId);
  }, [defaultWorkshopId, setValue]);

  const selected = workshops.find((w) => w._id === watch('workshopId'));
  const soldOut = selected && selected.seatsLeft === 0;

  const onSubmit = async (values) => {
    try {
      const res = await post('/leads/register', {
        ...values,
        city: values.city || undefined,
        mode: selected?.mode === 'hybrid' ? undefined : selected?.mode,
        referralSource: values.referralSource || undefined,
        referralCode,
        utm,
      });
      const { lead, accessToken, requiresPayment } = res.data;
      toast.success(requiresPayment ? 'Registered! Complete your payment to confirm your seat.' : 'You are registered! 🎉');
      navigate(`/registration/${lead._id}?token=${accessToken}`);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  if (!workshops.length) {
    return <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Registrations open soon. Check back shortly!</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <Field label="Full name" required error={errors.name?.message}>
          <Input autoComplete="name" placeholder="Your name" {...register('name')} error={errors.name} />
        </Field>
        <Field label="Email address" required error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...register('email')} error={errors.email} />
        </Field>
        <Field label="Phone number" required error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('phone')} error={errors.phone} />
        </Field>
        <Field label="City" error={errors.city?.message}>
          <Input autoComplete="address-level2" placeholder="Your city" {...register('city')} />
        </Field>
      </div>

      <Field label="Workshop" required error={errors.workshopId?.message}>
        <Select
          {...register('workshopId')}
          error={errors.workshopId}
          options={workshops.map((w) => ({ value: w._id, label: `${w.title} — ${formatDate(w.startDate)} — ${formatINR(effectivePrice(w))}` }))}
        />
      </Field>

      <Field label="How did you hear about us?">
        <Select {...register('referralSource')} options={SOURCES} placeholder="Select an option" />
      </Field>

      {referralCode && (
        <Field label="Influencer referral ID" hint="Applied automatically from your referral link">
          <div className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-50 px-3.5 py-2.5 text-sm font-medium text-teal">
            <BadgeCheck className="size-4" /> {referralCode}
            {attribution.influencer.name && <span className="font-normal text-slate-600">· {attribution.influencer.name}</span>}
          </div>
        </Field>
      )}

      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded accent-brand" {...register('consent')} />
        <span>
          I agree to the{' '}
          <Link to="/terms" target="_blank" className="font-medium text-brand underline">Terms</Link> and{' '}
          <Link to="/privacy" target="_blank" className="font-medium text-brand underline">Privacy Policy</Link>, and consent to being contacted about this workshop.
        </span>
      </label>
      {errors.consent && <p className="-mt-2 text-xs text-rose-600">{errors.consent.message}</p>}

      <Button type="submit" variant="teal" className="w-full !bg-gradient-to-r from-brand to-teal py-3.5 text-base shadow-lg shadow-brand/20" loading={isSubmitting} disabled={soldOut}>
        {soldOut ? 'Sold out' : selected && effectivePrice(selected) > 0 ? `Register Now · ${formatINR(effectivePrice(selected))}` : 'Register Now'}
        {!soldOut && !isSubmitting && <ArrowRight className="size-5" />}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Lock className="size-3.5" /> Your details are encrypted and never shared.
      </p>
    </form>
  );
}
