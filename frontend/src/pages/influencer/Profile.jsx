import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Camera, ShieldCheck } from 'lucide-react';
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle, useFetch } from '../../hooks';
import { patch, put, upload, errorMessage, applyFieldErrors } from '../../services/api';
import { formatDate } from '../../utils/format';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().trim().regex(/^(\+?[0-9\s-]{10,18})?$/, 'Enter a valid phone number').optional(),
  instagramUsername: z.string().trim().regex(/^@?[A-Za-z0-9._]{0,30}$/, 'Invalid username').optional(),
  bio: z.string().max(500).optional(),
});

const payoutSchema = z
  .object({
    method: z.enum(['upi', 'bank']),
    accountHolderName: z.string().trim().min(2, 'Enter the account holder name'),
    upiId: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    ifsc: z.string().trim().toUpperCase().optional(),
    accountNumber: z.string().trim().optional(),
    pan: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === 'upi' && !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(v.upiId || '')) ctx.addIssue({ code: 'custom', path: ['upiId'], message: 'Enter a valid UPI ID (name@bank)' });
    if (v.method === 'bank') {
      if (!/^[0-9]{6,18}$/.test(v.accountNumber || '')) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'Enter a valid account number' });
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc || '')) ctx.addIssue({ code: 'custom', path: ['ifsc'], message: 'Enter a valid IFSC code' });
    }
    if (v.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.pan)) ctx.addIssue({ code: 'custom', path: ['pan'], message: 'Invalid PAN' });
  });

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));

export default function Profile() {
  useDocumentTitle('Profile');
  const { setUser, setInfluencer } = useAuth();
  const { data, loading, error, reload, setData } = useFetch('/influencers/me');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pf = useForm({ resolver: zodResolver(profileSchema) });
  const po = useForm({ resolver: zodResolver(payoutSchema), defaultValues: { method: 'upi' } });
  const method = po.watch('method');

  useEffect(() => {
    if (!data) return;
    pf.reset({ name: data.user?.name || '', phone: data.user?.phone || '', instagramUsername: data.instagramUsername || '', bio: data.bio || '' });
    po.reset({ method: data.payoutDetails?.method || 'upi', accountHolderName: data.payoutDetails?.accountHolderName || '', bankName: data.payoutDetails?.bankName || '', ifsc: data.payoutDetails?.ifsc || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;

  const saveProfile = async (values) => {
    try {
      const res = await patch('/influencers/me', clean(values));
      setUser({ name: res.data.user?.name, phone: res.data.user?.phone });
      toast.success('Profile saved');
    } catch (err) {
      if (!applyFieldErrors(err, pf.setError)) toast.error(errorMessage(err));
    }
  };

  const savePayout = async (values) => {
    try {
      const body = clean(values);
      if (values.method === 'upi') ['bankName', 'ifsc', 'accountNumber'].forEach((k) => delete body[k]);
      else delete body.upiId;
      const res = await put('/influencers/me/payout-details', body);
      setData((d) => ({ ...d, payoutDetails: res.data }));
      po.reset({ ...values, accountNumber: '', upiId: '', pan: '' });
      toast.success('Payout details saved securely');
    } catch (err) {
      if (!applyFieldErrors(err, po.setError)) toast.error(errorMessage(err));
    }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB');
    setUploading(true);
    try {
      const res = await upload('/influencers/me/avatar', file);
      setData((d) => ({ ...d, profileImage: res.data.profileImage }));
      setInfluencer({ profileImage: res.data.profileImage });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const pd = data.payoutDetails || {};

  return (
    <>
      <PageHeader title="Profile" description="Manage your public details and how you get paid." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {data.profileImage ? <img src={data.profileImage} alt="" className="size-28 rounded-full object-cover ring-4 ring-brand/10" /> : <span className="grid size-28 place-items-center rounded-full gradient-brand font-display text-4xl font-bold text-white">{data.user?.name?.[0]}</span>}
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full bg-navy text-white shadow-lg" aria-label="Change photo" disabled={uploading}>
                <Camera className="size-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatar} />
            </div>
            <h2 className="mt-4 text-lg font-bold">{data.user?.name}</h2>
            <p className="text-sm text-slate-500">{data.user?.email}</p>
            <dl className="mt-5 w-full space-y-2 text-left text-sm">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">Referral ID</dt><dd className="font-semibold">{data.influencerCode}</dd></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">Subdomain</dt><dd className="font-semibold">{data.subdomain}</dd></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">Commission rate</dt><dd className="font-semibold">{data.commissionRate ?? 'Standard'}{data.commissionRate !== null && data.commissionRate !== undefined ? '%' : ''}</dd></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">Member since</dt><dd className="font-semibold">{formatDate(data.createdAt)}</dd></div>
            </dl>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Personal details">
            <form onSubmit={pf.handleSubmit(saveProfile)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Full name" error={pf.formState.errors.name?.message}><Input {...pf.register('name')} error={pf.formState.errors.name} /></Field>
              <Field label="Phone number" error={pf.formState.errors.phone?.message}><Input type="tel" {...pf.register('phone')} error={pf.formState.errors.phone} /></Field>
              <Field label="Instagram username" error={pf.formState.errors.instagramUsername?.message} className="sm:col-span-2"><Input placeholder="@yourhandle" {...pf.register('instagramUsername')} error={pf.formState.errors.instagramUsername} /></Field>
              <Field label="Short bio" className="sm:col-span-2"><Textarea rows={3} maxLength={500} {...pf.register('bio')} /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={pf.formState.isSubmitting}>Save profile</Button></div>
            </form>
          </Card>

          <Card title="Payout details">
            {pd.isComplete && (
              <p className="mb-4 flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal">
                <ShieldCheck className="size-4 shrink-0" /> Saved: {pd.method === 'upi' ? `UPI ${pd.upiId}` : `${pd.bankName || 'Bank'} ${pd.accountNumber} (${pd.ifsc})`} · {pd.accountHolderName}
              </p>
            )}
            <form onSubmit={po.handleSubmit(savePayout)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Payout method"><Select {...po.register('method')} options={[{ value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank transfer' }]} /></Field>
              <Field label="Account holder name" error={po.formState.errors.accountHolderName?.message}><Input {...po.register('accountHolderName')} error={po.formState.errors.accountHolderName} /></Field>
              {method === 'upi' ? (
                <Field label="UPI ID" error={po.formState.errors.upiId?.message} className="sm:col-span-2" hint={pd.upiId ? `Current: ${pd.upiId}. Enter it again to update.` : undefined}><Input placeholder="name@okbank" {...po.register('upiId')} error={po.formState.errors.upiId} /></Field>
              ) : (
                <>
                  <Field label="Bank name"><Input {...po.register('bankName')} /></Field>
                  <Field label="IFSC code" error={po.formState.errors.ifsc?.message}><Input className="uppercase" {...po.register('ifsc')} error={po.formState.errors.ifsc} /></Field>
                  <Field label="Account number" error={po.formState.errors.accountNumber?.message} className="sm:col-span-2" hint={pd.accountNumber ? `Current: ${pd.accountNumber}. Enter it again to update.` : undefined}><Input inputMode="numeric" autoComplete="off" {...po.register('accountNumber')} error={po.formState.errors.accountNumber} /></Field>
                </>
              )}
              <Field label="PAN (optional)" error={po.formState.errors.pan?.message} hint={pd.pan ? `On file: ${pd.pan}` : 'Required for TDS above the threshold'}><Input className="uppercase" autoComplete="off" {...po.register('pan')} error={po.formState.errors.pan} /></Field>
              <div className="flex items-end justify-end sm:col-span-1"><Button type="submit" loading={po.formState.isSubmitting}>Save payout details</Button></div>
            </form>
            <p className="mt-4 text-xs text-slate-400">Account numbers and UPI IDs are encrypted and only visible to JenCorps finance administrators.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
