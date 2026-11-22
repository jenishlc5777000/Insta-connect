import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, FolderDown, Download } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea, useConfirm } from '../../components/ui';
import { FilterSelect, statusOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch } from '../../hooks';
import { del, upload, errorMessage } from '../../services/api';
import { formatDate, titleCase } from '../../utils/format';

const TYPES = ['poster', 'story', 'reel', 'caption', 'hashtags', 'script', 'other'];

function UploadModal({ open, onClose, onDone, workshops }) {
  const [form, setForm] = useState({ title: '', type: 'poster', workshopId: '', textContent: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const textOnly = ['caption', 'hashtags', 'script'].includes(form.type);
  const submit = async () => {
    if (form.title.trim().length < 2) return toast.error('Enter a title');
    if (!file && !form.textContent.trim()) return toast.error('Upload a file or enter text');
    setBusy(true);
    try {
      await upload('/admin/resources', file, { ...form, workshopId: form.workshopId || undefined, textContent: form.textContent || undefined });
      toast.success('Resource added');
      setForm({ title: '', type: 'poster', workshopId: '', textContent: '' });
      setFile(null);
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add marketing resource" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={statusOptions(TYPES)} /></Field>
          <Field label="Workshop"><Select value={form.workshopId} onChange={(e) => setForm({ ...form, workshopId: e.target.value })} placeholder="All workshops (general)" options={workshops} /></Field>
        </div>
        {!textOnly && (
          <Field label="File" hint="Images up to 100 MB, MP4/MOV/WebM videos, or PDF">
            <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand" />
          </Field>
        )}
        <Field label={textOnly ? 'Text' : 'Caption / notes (optional)'}><Textarea rows={5} value={form.textContent} onChange={(e) => setForm({ ...form, textContent: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function AdminResources() {
  useDocumentTitle('Marketing resources');
  const [filters, setFilters] = useState({ type: '', workshopId: '' });
  const { data, loading, error, reload } = useFetch('/admin/resources', { type: filters.type || undefined, workshopId: filters.workshopId || undefined });
  const workshops = useWorkshopOptions();
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();

  const remove = (r) =>
    ask({
      title: `Delete "${r.title}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await del(`/admin/resources/${r._id}`);
          toast.success('Deleted');
          reload();
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });

  return (
    <>
      <PageHeader title="Marketing resources" description="Posters, story images, reels, captions and scripts for influencers." actions={<Button icon={Plus} onClick={() => setOpen(true)}>Add resource</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <FilterSelect value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} placeholder="All types" options={statusOptions(TYPES)} />
        <FilterSelect value={filters.workshopId} onChange={(v) => setFilters({ ...filters, workshopId: v })} placeholder="All workshops" options={workshops} />
      </div>
      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {loading && <Skeleton className="h-48 rounded-2xl" />}
      {!loading && !error && !data?.length && <div className="card"><EmptyState icon={FolderDown} title="No resources yet" action={<Button icon={Plus} onClick={() => setOpen(true)}>Add the first one</Button>} /></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((r) => (
          <Card key={r._id} bodyClassName="p-0" className="overflow-hidden">
            {r.fileUrl && r.mimeType?.startsWith('image/') && <img src={r.fileUrl} alt="" className="aspect-video w-full object-cover" />}
            {r.fileUrl && r.mimeType?.startsWith('video/') && <video src={r.fileUrl} className="aspect-video w-full object-cover" controls preload="metadata" />}
            <div className="p-4">
              <p className="text-xs font-medium uppercase text-brand">{titleCase(r.type)}</p>
              <h3 className="font-semibold">{r.title}</h3>
              <p className="text-xs text-slate-500">{r.workshopId?.title || 'All workshops'} · {formatDate(r.createdAt)}</p>
              {r.textContent && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-slate-600">{r.textContent}</p>}
              <div className="mt-3 flex gap-2">
                {r.fileUrl && <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><Download className="size-4" /> Open</a>}
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(r)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <UploadModal open={open} onClose={() => setOpen(false)} onDone={reload} workshops={workshops} />
      {dialog}
    </>
  );
}
