import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Globe, Instagram, MessageCircle, Facebook, Twitter, Linkedin, Send, Share2, Link2 } from 'lucide-react';
import { Button, Card, CopyButton, EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { useCopy, useDocumentTitle, useFetch } from '../../hooks';
import { formatDate, formatNumber } from '../../utils/format';
import toast from 'react-hot-toast';

function shareTargets(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { name: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${t}%20${u}`, cls: 'bg-[#25D366] text-white' },
    { name: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, cls: 'bg-[#1877F2] text-white' },
    { name: 'X', icon: Twitter, href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, cls: 'bg-black text-white' },
    { name: 'LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, cls: 'bg-[#0A66C2] text-white' },
    { name: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${u}&text=${t}`, cls: 'bg-[#229ED9] text-white' },
  ];
}

export default function ReferralLinks() {
  useDocumentTitle('Referral links');
  const { data, loading, error, reload } = useFetch('/influencers/me/referral-links');
  const qrRef = useRef(null);
  const { copy } = useCopy();

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const shareText = 'Join me at the JenCorps AI Video Creation Workshop! 🎬 Learn to create viral Reels & YouTube videos with AI.';

  // Instagram has no web share URL: use the native share sheet on mobile, else copy + open Instagram
  const shareInstagram = async (url) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JenCorps AI Video Creation Workshop', text: shareText, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy(url);
    toast.success('Link copied — paste it in your Instagram bio, story link sticker or DM');
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `jencorps-${data.subdomain}-qr.png`;
    a.click();
  };

  return (
    <>
      <PageHeader title="Referral links" description="Every visit and registration from these links is credited to you automatically." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Your personal link" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Subdomain</p><p className="flex items-center gap-1.5 font-semibold text-navy"><Globe className="size-4 text-brand" />{data.subdomain}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Referral ID</p><p className="font-semibold text-navy">{data.referralCode}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total clicks</p><p className="font-semibold text-navy">{formatNumber(data.totalClicks)}</p></div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-50/50 p-3 sm:flex-row sm:items-center">
              <Link2 className="hidden size-5 shrink-0 text-brand sm:block" />
              <p className="flex-1 truncate font-mono text-sm font-medium text-navy">{data.referralUrl}</p>
              <CopyButton text={data.referralUrl} label="Copy link" variant="primary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Share on</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => shareInstagram(data.referralUrl)} className="btn btn-sm bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
                  <Instagram className="size-4" /> Instagram
                </button>
                {shareTargets(data.referralUrl, shareText).map(({ name, icon: Icon, href, cls }) => (
                  <a key={name} href={href} target="_blank" rel="noopener noreferrer" className={`btn btn-sm ${cls}`}>
                    <Icon className="size-4" /> {name}
                  </a>
                ))}
                {typeof navigator !== 'undefined' && navigator.share && (
                  <Button size="sm" variant="secondary" icon={Share2} onClick={() => navigator.share({ title: 'JenCorps AI Video Creation Workshop', text: shareText, url: data.referralUrl }).catch(() => {})}>More</Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card title="QR code">
          <div className="flex flex-col items-center gap-4">
            <div ref={qrRef} className="rounded-2xl border border-slate-100 bg-white p-3">
              <QRCodeCanvas value={data.referralUrl} size={180} fgColor="#0B1F3A" level="M" marginSize={1} />
            </div>
            <p className="text-center text-xs text-slate-500">Add it to posters, stories or event banners.</p>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadQr}>Download PNG</Button>
          </div>
        </Card>
      </div>

      <Card title="Campaign links" className="mt-6" bodyClassName="p-0">
        {!data.campaigns.length ? (
          <EmptyState title="No live campaigns" description="Campaign links appear here when a workshop is published." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.campaigns.map((c) => (
              <li key={c.workshopId} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-navy">{c.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(c.startDate)} · Campaign {c.campaignCode}</p>
                  </div>
                  <div className="flex gap-4 text-center text-xs text-slate-500">
                    <div><p className="text-lg font-bold text-navy">{formatNumber(c.clicks)}</p>Clicks</div>
                    <div><p className="text-lg font-bold text-navy">{formatNumber(c.leads)}</p>Leads</div>
                    <div><p className="text-lg font-bold text-navy">{formatNumber(c.paid)}</p>Paid</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[['Instagram', c.links.instagram], ['WhatsApp', c.links.whatsapp], ['YouTube', c.links.youtube], ['Facebook', c.links.facebook]].map(([label, url]) => (
                    <div key={label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-600">{label}</span>
                      <span className="flex-1 truncate font-mono text-xs text-slate-500">{url}</span>
                      <CopyButton text={url} label="Copy" />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
