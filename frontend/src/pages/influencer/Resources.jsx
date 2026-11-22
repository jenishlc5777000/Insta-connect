import { useSearchParams } from 'react-router-dom';
import { Download, Image, Film, FileText, Hash, ScrollText, FolderDown, File } from 'lucide-react';
import { Card, CopyButton, EmptyState, ErrorState, PageHeader, Select, Skeleton, Tabs } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';
import { titleCase } from '../../utils/format';

const TYPES = [
  { value: '', label: 'All' },
  { value: 'poster', label: 'Posters' },
  { value: 'story', label: 'Story images' },
  { value: 'reel', label: 'Reels' },
  { value: 'caption', label: 'Captions' },
  { value: 'hashtags', label: 'Hashtags' },
  { value: 'script', label: 'Scripts' },
];
const ICONS = { poster: Image, story: Image, reel: Film, caption: FileText, hashtags: Hash, script: ScrollText, other: File };

export default function Resources() {
  useDocumentTitle('Marketing resources');
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const workshopId = params.get('workshopId') || '';
  const { data, loading, error, reload } = useFetch('/influencers/me/resources', { type: type || undefined, workshopId: workshopId || undefined });
  const workshops = useFetch('/influencers/me/workshops');

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Marketing resources" description="Ready-to-post creatives, captions and scripts for your audience." />
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Tabs value={type} onChange={(v) => set('type', v)} tabs={TYPES} />
        <Select className="sm:w-64" value={workshopId} onChange={(e) => set('workshopId', e.target.value)} placeholder="All workshops" options={(workshops.data || []).map((w) => ({ value: w._id, label: w.title }))} />
      </div>
      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>}
      {!loading && !error && !data?.length && <div className="card"><EmptyState icon={FolderDown} title="No resources yet" description="The JenCorps team will upload posters, reels and captions here." /></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((r) => {
          const Icon = ICONS[r.type] || File;
          const isImage = r.mimeType?.startsWith('image/');
          const isVideo = r.mimeType?.startsWith('video/');
          return (
            <Card key={r._id} bodyClassName="p-0" className="flex flex-col overflow-hidden">
              {r.fileUrl && (
                <div className="grid aspect-video place-items-center overflow-hidden bg-slate-100">
                  {isImage ? <img src={r.fileUrl} alt={r.title} className="h-full w-full object-cover" loading="lazy" /> : isVideo ? <video src={r.fileUrl} className="h-full w-full object-cover" controls preload="metadata" /> : <Icon className="size-10 text-slate-400" />}
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand"><Icon className="size-3.5" /> {titleCase(r.type)}</p>
                <h3 className="mt-1 font-semibold">{r.title}</h3>
                {r.workshopId?.title && <p className="text-xs text-slate-500">{r.workshopId.title}</p>}
                {r.textContent && <p className="mt-3 line-clamp-6 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{r.textContent}</p>}
                <div className="mt-auto flex gap-2 pt-4">
                  {r.textContent && <CopyButton text={r.textContent} label="Copy text" />}
                  {r.fileUrl && <a href={r.fileUrl} download target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm"><Download className="size-4" /> Download</a>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
