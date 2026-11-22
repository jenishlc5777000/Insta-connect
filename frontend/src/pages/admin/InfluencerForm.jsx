import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { Button, CopyButton, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { post, patch, errorMessage, applyFieldErrors } from '../../services/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^(\+?[0-9\s-]{10,18})?$/, 'Enter a valid phone number').optional(),
  subdomain: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, '3–32 lowercase letters, numbers or hyphens'),
  commissionRate: z.union([z.literal(''), z.coerce.number().min(0, '0–100').max(100, '0–100')]).optional(),
  instagramUsername: z.string().trim().regex(/^@?[A-Za-z0-9._]{0,30}$/, 'Invalid username').optional(),
  bio: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

const baseHost = () => {
  const h = window.location.hostname.replace(/^www\./, '');
  return h.split('.').length > 2 && !h.endsWith('localhost') ? h.split('.').slice(1).join('.') : h;
};

/** Create / edit influencer. Shows the generated temporary password once after creation. */
export default function InfluencerForm({ open, onClose, influencer, onSaved }) {
  const editing = Boolean(influencer);
  const [created, setCreated] = useState(null);
  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    reset(
      editing
        ? {
            name: influencer.user?.name || '',
            email: influencer.user?.email || '',
            phone: influencer.user?.phone || '',
            subdomain: influencer.subdomain,
            commissionRate: influencer.commissionRate ?? '',
            instagramUsername: influencer.instagramUsername || '',
            bio: influencer.bio || '',
            status: influencer.status,
          }
        : { name: '', email: '', phone: '', subdomain: '', commissionRate: '', instagramUsername: '', bio: '', sendWelcomeEmail: true }
    );
  }, [open, influencer, editing, reset]);

  const subdomain = watch('subdomain');

  const onSubmit = async (values) => {
    const body = {
      ...values,
      phone: values.phone || undefined,
      instagramUsername: values.instagramUsername || undefined,
      bio: values.bio || undefined,
      commissionRate: values.commissionRate === '' || values.commissionRate === undefined ? null : Number(values.commissionRate),
    };
    try {
      if (editing) {
        delete body.sendWelcomeEmail;
        const res = await patch(`/influencers/${influencer._id}`, body);
        toast.success('Influencer updated');
        onSaved?.(res.data);
        onClose();
      } else {
        delete body.status;
        const res = await post('/influencers', body);
        toast.success('Influencer created');
        setCreated(res.data);
        onSaved?.(res.data.influencer);
      }
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  if (created) {
    return (
      <Modal open={open} onClose={onClose} title="Influencer created" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="space-y-4 text-sm">
          <p>Share these login details with <b>{created.influencer.user?.name}</b>{created.tempPassword ? ' (also emailed if the welcome email was enabled)' : ''}.</p>
          <dl className="space-y-2 rounded-xl bg-slate-50 p-4">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Referral ID</dt><dd className="font-semibold">{created.influencer.influencerCode}</dd></div>
            <div className="flex items-center justify-between gap-2"><dt className="text-slate-500">Referral URL</dt><dd className="flex items-center gap-2 truncate font-semibold">{created.influencer.referralUrl}<CopyButton text={created.influencer.referralUrl} label="" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Login email</dt><dd className="font-semibold">{created.influencer.user?.email}</dd></div>
            {created.tempPassword && (
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1 text-slate-500"><KeyRound className="size-4" /> Temporary password</dt><dd className="flex items-center gap-2 font-mono font-semibold">{created.tempPassword}<CopyButton text={created.tempPassword} label="" /></dd></div>
            )}
          </dl>
          <p className="text-xs text-amber-700">The temporary password is shown only once. The influencer must change it on first login.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${influencer.user?.name}` : 'Add influencer'}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Save changes' : 'Create influencer'}</Button></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" required error={errors.name?.message}><Input {...register('name')} error={errors.name} /></Field>
        <Field label="Email (login)" required error={errors.email?.message}><Input type="email" {...register('email')} error={errors.email} /></Field>
        <Field label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} error={errors.phone} /></Field>
        <Field label="Instagram username" error={errors.instagramUsername?.message}><Input placeholder="@handle" {...register('instagramUsername')} error={errors.instagramUsername} /></Field>
        <Field label="Subdomain" required error={errors.subdomain?.message} hint={subdomain ? `${subdomain}.${baseHost()}` : 'e.g. arun → arun.jencorps.com'}>
          <Input {...register('subdomain')} error={errors.subdomain} autoCapitalize="off" />
        </Field>
        <Field label="Commission %" error={errors.commissionRate?.message} hint="Leave blank to use the workshop / platform default">
          <Input type="number" step="0.5" min="0" max="100" {...register('commissionRate')} error={errors.commissionRate} />
        </Field>
        {editing && (
          <Field label="Account status"><Select {...register('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
        )}
        <Field label="Bio" className="sm:col-span-2"><Textarea rows={2} {...register('bio')} /></Field>
        {!editing && (
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-brand" {...register('sendWelcomeEmail')} /> Email login details to the influencer
          </label>
        )}
      </form>
    </Modal>
  );
}
