import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Button, Card, DataTable, ErrorState, Field, Input, PageHeader, Pagination, Select, Skeleton, Tabs, Textarea, Toggle } from '../../components/ui';
import { useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { patch, errorMessage, applyFieldErrors } from '../../services/api';
import { formatDateTime, paiseToRupees, rupeesToPaise } from '../../utils/format';

const SOCIAL = ['instagram', 'youtube', 'linkedin', 'facebook', 'x', 'whatsapp'];

function SettingsForm() {
  const { data, loading, error, reload } = useFetch('/admin/settings');
  const workshops = useWorkshopOptions();
  const { register, handleSubmit, reset, control, watch, setError, formState: { isSubmitting, errors } } = useForm();

  useEffect(() => {
    if (!data) return;
    reset({
      ...data,
      featuredWorkshopId: data.featuredWorkshopId || '',
      minimumPayoutAmount: paiseToRupees(data.minimumPayoutAmount),
      reservedSubdomains: (data.reservedSubdomains || []).join(', '),
      socialLinks: Object.fromEntries(SOCIAL.map((k) => [k, data.socialLinks?.[k] || ''])),
    });
  }, [data, reset]);

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;

  const onSubmit = async (v) => {
    try {
      await patch('/admin/settings', {
        siteName: v.siteName,
        supportEmail: v.supportEmail,
        supportPhone: v.supportPhone || undefined,
        socialLinks: v.socialLinks,
        defaultCommissionRate: Number(v.defaultCommissionRate),
        attributionWindowDays: Number(v.attributionWindowDays),
        attributionModel: v.attributionModel,
        taxRatePercent: Number(v.taxRatePercent),
        excludeTaxFromCommission: Boolean(v.excludeTaxFromCommission),
        deductGatewayFees: Boolean(v.deductGatewayFees),
        gatewayFeePercent: Number(v.gatewayFeePercent),
        autoApproveCommissions: Boolean(v.autoApproveCommissions),
        minimumPayoutAmount: rupeesToPaise(v.minimumPayoutAmount || 0),
        featuredWorkshopId: v.featuredWorkshopId || null,
        reservedSubdomains: String(v.reservedSubdomains || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      });
      toast.success('Settings saved');
      reload();
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  const tax = watch('taxRatePercent');
  const rate = watch('defaultCommissionRate');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2" noValidate>
      <Card title="Commission rules">
        <div className="space-y-4">
          <Field label="Default commission rate (%)" error={errors.defaultCommissionRate?.message} hint="Used when neither the influencer nor the workshop has its own rate">
            <Input type="number" min="0" max="100" step="0.5" {...register('defaultCommissionRate')} />
          </Field>
          <Controller control={control} name="excludeTaxFromCommission" render={({ field }) => <Toggle checked={Boolean(field.value)} onChange={field.onChange} label="Exclude GST from eligible revenue" description={`Ticket prices are treated as tax-inclusive at ${tax || 0}%`} />} />
          <Field label="GST rate (%)"><Input type="number" min="0" max="50" step="0.5" {...register('taxRatePercent')} /></Field>
          <Controller control={control} name="deductGatewayFees" render={({ field }) => <Toggle checked={Boolean(field.value)} onChange={field.onChange} label="Deduct payment gateway fees" description="Uses the actual Razorpay fee, or the % below when unknown" />} />
          <Field label="Fallback gateway fee (%)"><Input type="number" min="0" max="10" step="0.1" {...register('gatewayFeePercent')} /></Field>
          <Controller control={control} name="autoApproveCommissions" render={({ field }) => <Toggle checked={Boolean(field.value)} onChange={field.onChange} label="Auto-approve new commissions" description="Skip manual approval after verified payments" />} />
          <Field label="Minimum payout (₹)"><Input type="number" min="0" step="1" {...register('minimumPayoutAmount')} /></Field>
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Example: a ₹2,000 ticket at {rate || 0}% pays the influencer ₹{((2000 * (rate || 0)) / 100).toLocaleString('en-IN')} before deductions. Refunds automatically reverse or reduce commission.</p>
        </div>
      </Card>

      <Card title="Referral attribution">
        <div className="space-y-4">
          <Field label="Attribution window (days)" hint="How long a referral cookie stays valid"><Input type="number" min="1" max="365" {...register('attributionWindowDays')} /></Field>
          <Field label="Attribution model">
            <Select {...register('attributionModel')} options={[{ value: 'first', label: 'First valid referral wins (recommended)' }, { value: 'last', label: 'Last referral wins' }]} />
          </Field>
          <Field label="Reserved subdomains" hint="Comma separated — never assignable to influencers"><Textarea rows={3} {...register('reservedSubdomains')} /></Field>
          <Field label="Featured workshop on home page"><Select {...register('featuredWorkshopId')} placeholder="Automatic (next upcoming)" options={workshops} /></Field>
        </div>
      </Card>

      <Card title="Brand & contact">
        <div className="space-y-4">
          <Field label="Site name"><Input {...register('siteName')} /></Field>
          <Field label="Support email" error={errors.supportEmail?.message}><Input type="email" {...register('supportEmail')} /></Field>
          <Field label="Support phone"><Input {...register('supportPhone')} /></Field>
        </div>
      </Card>

      <Card title="Social media links">
        <div className="space-y-4">
          {SOCIAL.map((k) => (
            <Field key={k} label={k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)} error={errors.socialLinks?.[k]?.message}>
              <Input placeholder="https://" {...register(`socialLinks.${k}`)} />
            </Field>
          ))}
        </div>
      </Card>

      <div className="flex justify-end lg:col-span-2"><Button type="submit" loading={isSubmitting}>Save settings</Button></div>
    </form>
  );
}

function AuditLog() {
  const q = useListQuery({ filters: { entityType: '' } });
  const { data, meta, loading, error, reload } = useFetch('/admin/audit-logs', q.params);
  const [open, setOpen] = useState(null);
  return (
    <Card bodyClassName="p-0">
      <div className="border-b border-slate-100 p-4 sm:w-64">
        <Select value={q.filters.entityType} onChange={(e) => q.setFilter('entityType', e.target.value)} placeholder="All entities" options={['Influencer', 'Workshop', 'Lead', 'Payment', 'Commission', 'Payout', 'Setting', 'Resource', 'User'].map((v) => ({ value: v, label: v }))} />
      </div>
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        onRetry={reload}
        columns={[
          { key: 'createdAt', header: 'When', render: (r) => formatDateTime(r.createdAt) },
          { key: 'admin', header: 'Admin', render: (r) => r.adminId?.name || '—' },
          { key: 'action', header: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
          { key: 'entity', header: 'Entity', render: (r) => <span className="text-xs">{r.entityType} <span className="font-mono text-slate-400">{String(r.entityId).slice(-6)}</span></span> },
          { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-[220px] truncate">{r.reason || '—'}</span> },
          { key: 'diff', header: '', render: (r) => (r.previousValue || r.newValue ? <Button size="sm" variant="ghost" onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? 'Hide' : 'Changes'}</Button> : null) },
        ]}
      />
      {open && (() => {
        const r = data.find((x) => x._id === open);
        return (
          <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
            <div><p className="mb-1 text-xs font-semibold text-slate-500">Before</p><pre className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(r?.previousValue, null, 2)}</pre></div>
            <div><p className="mb-1 text-xs font-semibold text-slate-500">After</p><pre className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(r?.newValue, null, 2)}</pre></div>
          </div>
        );
      })()}
      <Pagination meta={meta} onPage={q.setPage} />
    </Card>
  );
}

export default function AdminSettings() {
  useDocumentTitle('Settings');
  const [tab, setTab] = useState('settings');
  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration. Every change is audit-logged." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'settings', label: 'Configuration' }, { value: 'audit', label: 'Audit log' }]} />
      {tab === 'settings' ? <SettingsForm /> : <AuditLog />}
    </>
  );
}
