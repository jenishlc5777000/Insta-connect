import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { patch, post, upload, errorMessage, applyFieldErrors } from '../../services/api';
import { fromLocalInput, paiseToRupees, rupeesToPaise, toLocalInput } from '../../utils/format';

const money = z.union([z.literal(''), z.coerce.number().min(0, 'Must be 0 or more')]);
const schema = z
  .object({
    title: z.string().trim().min(3, 'Enter a title'),
    slug: z.string().trim().regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Lowercase letters, numbers and hyphens').optional(),
    tagline: z.string().max(240).optional(),
    description: z.string().max(5000).optional(),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().min(1, 'Required'),
    registrationDeadline: z.string().optional(),
    mode: z.enum(['online', 'offline', 'hybrid']),
    location: z.string().max(300).optional(),
    meetingLink: z.union([z.literal(''), z.string().url('Enter a valid URL')]).optional(),
    price: z.coerce.number({ invalid_type_error: 'Enter a price' }).min(0),
    discountPrice: money.optional(),
    commissionRate: z.union([z.literal(''), z.coerce.number().min(0).max(100)]).optional(),
    capacity: z.coerce.number().int().min(0).optional(),
    status: z.enum(['draft', 'published', 'completed', 'cancelled']),
    featured: z.boolean().optional(),
    bannerImage: z.union([z.literal(''), z.string().url()]).optional(),
    learnings: z.array(z.object({ value: z.string() })),
    benefits: z.array(z.object({ value: z.string() })),
    curriculum: z.array(z.object({ title: z.string(), description: z.string().optional(), duration: z.string().optional() })),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
    trainer: z.object({ name: z.string().optional(), title: z.string().optional(), bio: z.string().optional(), photo: z.union([z.literal(''), z.string().url()]).optional() }),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'End must be after start' })
  .refine((v) => v.discountPrice === '' || v.discountPrice === undefined || Number(v.discountPrice) <= Number(v.price), { path: ['discountPrice'], message: 'Cannot exceed the ticket price' });

const blank = {
  title: '', slug: '', tagline: '', description: '', startDate: '', endDate: '', registrationDeadline: '', mode: 'online', location: '', meetingLink: '',
  price: '', discountPrice: '', commissionRate: '', capacity: 0, status: 'draft', featured: false, bannerImage: '',
  learnings: [{ value: '' }], benefits: [{ value: '' }], curriculum: [{ title: '', description: '', duration: '' }], faqs: [{ question: '', answer: '' }],
  trainer: { name: '', title: '', bio: '', photo: '' },
};

function toForm(w) {
  return {
    ...blank,
    ...w,
    slug: w.slug,
    tagline: w.tagline || '',
    description: w.description || '',
    location: w.location || '',
    meetingLink: w.meetingLink || '',
    bannerImage: w.bannerImage || '',
    startDate: toLocalInput(w.startDate),
    endDate: toLocalInput(w.endDate),
    registrationDeadline: toLocalInput(w.registrationDeadline),
    price: paiseToRupees(w.price),
    discountPrice: paiseToRupees(w.discountPrice),
    commissionRate: w.commissionRate ?? '',
    learnings: (w.learnings?.length ? w.learnings : ['']).map((value) => ({ value })),
    benefits: (w.benefits?.length ? w.benefits : ['']).map((value) => ({ value })),
    curriculum: w.curriculum?.length ? w.curriculum.map((c) => ({ title: c.title || '', description: c.description || '', duration: c.duration || '' })) : blank.curriculum,
    faqs: w.faqs?.length ? w.faqs : blank.faqs,
    trainer: { name: w.trainer?.name || '', title: w.trainer?.title || '', bio: w.trainer?.bio || '', photo: w.trainer?.photo || '' },
  };
}

function toPayload(v) {
  const str = (s) => (s && s.trim() ? s.trim() : undefined);
  return {
    title: v.title.trim(),
    slug: str(v.slug),
    tagline: str(v.tagline) ?? '',
    description: str(v.description) ?? '',
    startDate: fromLocalInput(v.startDate),
    endDate: fromLocalInput(v.endDate),
    registrationDeadline: v.registrationDeadline ? fromLocalInput(v.registrationDeadline) : null,
    mode: v.mode,
    location: str(v.location) ?? '',
    meetingLink: str(v.meetingLink) ?? '',
    price: rupeesToPaise(v.price),
    discountPrice: v.discountPrice === '' || v.discountPrice === undefined ? null : rupeesToPaise(v.discountPrice),
    commissionRate: v.commissionRate === '' || v.commissionRate === undefined ? null : Number(v.commissionRate),
    capacity: Number(v.capacity || 0),
    status: v.status,
    featured: Boolean(v.featured),
    bannerImage: str(v.bannerImage) ?? '',
    learnings: v.learnings.map((x) => x.value.trim()).filter(Boolean),
    benefits: v.benefits.map((x) => x.value.trim()).filter(Boolean),
    curriculum: v.curriculum.filter((c) => c.title.trim()).map((c) => ({ title: c.title.trim(), description: str(c.description), duration: str(c.duration) })),
    faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()).map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
    trainer: { name: str(v.trainer.name), title: str(v.trainer.title), bio: str(v.trainer.bio), photo: str(v.trainer.photo) },
  };
}

function ListEditor({ fields, append, remove, render, addLabel, empty }) {
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="flex items-start gap-2">
          <div className="flex-1">{render(i)}</div>
          <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={() => remove(i)} aria-label="Remove" />
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => append(empty)}>{addLabel}</Button>
    </div>
  );
}

function ImageField({ label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await upload('/workshops/upload-image', file);
      onChange(res.data.url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="size-14 rounded-xl object-cover" /> : <span className="size-14 rounded-xl bg-slate-100" />}
        <label className="btn-secondary btn-sm cursor-pointer">
          <Upload className="size-4" /> {busy ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>Remove</Button>}
      </div>
    </Field>
  );
}

export default function WorkshopForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useFetch(editing ? `/workshops/id/${id}` : null);
  useDocumentTitle(editing ? 'Edit workshop' : 'New workshop');

  const form = useForm({ resolver: zodResolver(schema), defaultValues: blank });
  const { register, control, handleSubmit, reset, setValue, watch, setError, formState: { errors, isSubmitting } } = form;
  const learnings = useFieldArray({ control, name: 'learnings' });
  const benefits = useFieldArray({ control, name: 'benefits' });
  const curriculum = useFieldArray({ control, name: 'curriculum' });
  const faqs = useFieldArray({ control, name: 'faqs' });

  useEffect(() => {
    if (existing.data) reset(toForm(existing.data));
  }, [existing.data, reset]);

  const onSubmit = async (values) => {
    try {
      const body = toPayload(values);
      if (editing) {
        await patch(`/workshops/${id}`, body);
        toast.success('Workshop saved');
      } else {
        await post('/workshops', body);
        toast.success('Workshop created');
      }
      navigate('/admin/workshops');
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };

  if (editing && existing.error) return <div className="card"><ErrorState message={existing.error} /></div>;
  if (editing && !existing.data) return <Skeleton className="h-96 rounded-2xl" />;

  const e = errors;
  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the highlighted fields'))} noValidate>
      <Link to="/admin/workshops" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy"><ArrowLeft className="size-4" /> Workshops</Link>
      <PageHeader title={editing ? 'Edit workshop' : 'New workshop'} actions={<Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Create workshop'}</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required error={e.title?.message} className="sm:col-span-2"><Input {...register('title')} error={e.title} /></Field>
              <Field label="URL slug" error={e.slug?.message} hint="Auto-generated from the title when empty"><Input {...register('slug')} error={e.slug} /></Field>
              <Field label="Tagline"><Input {...register('tagline')} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea rows={5} {...register('description')} /></Field>
            </div>
          </Card>

          <Card title="Schedule & location">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts (IST)" required error={e.startDate?.message}><Input type="datetime-local" {...register('startDate')} error={e.startDate} /></Field>
              <Field label="Ends (IST)" required error={e.endDate?.message}><Input type="datetime-local" {...register('endDate')} error={e.endDate} /></Field>
              <Field label="Registration deadline"><Input type="datetime-local" {...register('registrationDeadline')} /></Field>
              <Field label="Mode" required><Select {...register('mode')} options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }, { value: 'hybrid', label: 'Hybrid (online + offline)' }]} /></Field>
              <Field label="Location / venue" className="sm:col-span-2"><Input {...register('location')} placeholder="Venue address, or 'Zoom'" /></Field>
              <Field label="Meeting link" error={e.meetingLink?.message} hint="Only shown to confirmed participants" className="sm:col-span-2"><Input {...register('meetingLink')} error={e.meetingLink} placeholder="https://" /></Field>
            </div>
          </Card>

          <Card title="What participants learn">
            <ListEditor fields={learnings.fields} append={learnings.append} remove={learnings.remove} addLabel="Add learning outcome" empty={{ value: '' }} render={(i) => <Input {...register(`learnings.${i}.value`)} placeholder="e.g. Build your first AI agent" />} />
          </Card>

          <Card title="Benefits">
            <ListEditor fields={benefits.fields} append={benefits.append} remove={benefits.remove} addLabel="Add benefit" empty={{ value: '' }} render={(i) => <Input {...register(`benefits.${i}.value`)} placeholder="e.g. Certificate of completion" />} />
          </Card>

          <Card title="Curriculum">
            <ListEditor
              fields={curriculum.fields}
              append={curriculum.append}
              remove={curriculum.remove}
              addLabel="Add module"
              empty={{ title: '', description: '', duration: '' }}
              render={(i) => (
                <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
                  <Input className="sm:col-span-3" {...register(`curriculum.${i}.title`)} placeholder="Module title" />
                  <Input {...register(`curriculum.${i}.duration`)} placeholder="60 min" />
                  <Textarea rows={2} className="sm:col-span-4" {...register(`curriculum.${i}.description`)} placeholder="Short description" />
                </div>
              )}
            />
          </Card>

          <Card title="FAQs">
            <ListEditor
              fields={faqs.fields}
              append={faqs.append}
              remove={faqs.remove}
              addLabel="Add FAQ"
              empty={{ question: '', answer: '' }}
              render={(i) => (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <Input {...register(`faqs.${i}.question`)} placeholder="Question" />
                  <Textarea rows={2} {...register(`faqs.${i}.answer`)} placeholder="Answer" />
                </div>
              )}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status"><Select {...register('status')} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-brand" {...register('featured')} /> Feature on the home page</label>
              <ImageField label="Banner image" value={watch('bannerImage')} onChange={(v) => setValue('bannerImage', v, { shouldDirty: true })} />
            </div>
          </Card>

          <Card title="Pricing & commission">
            <div className="space-y-4">
              <Field label="Ticket price (₹)" required error={e.price?.message}><Input type="number" min="0" step="1" {...register('price')} error={e.price} /></Field>
              <Field label="Discount price (₹)" error={e.discountPrice?.message} hint="Leave blank for no discount"><Input type="number" min="0" step="1" {...register('discountPrice')} error={e.discountPrice} /></Field>
              <Field label="Commission % for this campaign" error={e.commissionRate?.message} hint="Blank = platform default. Influencer-specific rates take precedence."><Input type="number" min="0" max="100" step="0.5" {...register('commissionRate')} error={e.commissionRate} /></Field>
              <Field label="Maximum seats" error={e.capacity?.message} hint="0 = unlimited"><Input type="number" min="0" step="1" {...register('capacity')} error={e.capacity} /></Field>
            </div>
          </Card>

          <Card title="Trainer">
            <div className="space-y-4">
              <Field label="Name"><Input {...register('trainer.name')} /></Field>
              <Field label="Title"><Input {...register('trainer.title')} /></Field>
              <Field label="Bio"><Textarea rows={4} {...register('trainer.bio')} /></Field>
              <ImageField label="Photo" value={watch('trainer.photo')} onChange={(v) => setValue('trainer.photo', v, { shouldDirty: true })} />
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
