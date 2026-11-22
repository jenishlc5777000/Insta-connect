import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, X, Instagram, UserPlus, KeyRound, Trash2 } from 'lucide-react';
import { Button, Card, CopyButton, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, SearchInput, StatusBadge, Textarea, Badge, useConfirm } from '../../components/ui';
import { FilterSelect, statusOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { get, post, del, errorMessage } from '../../services/api';
import { formatDate, formatNumber } from '../../utils/format';
import { viewRangeLabel } from '../../utils/audience';

const fmtFollowers = (n) => (n >= 100000 ? `${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L+` : n >= 1000 ? `${Math.round(n / 1000)}K+` : `${n}`);

function ApproveModal({ app, onClose, onDone }) {
  const [subdomain, setSubdomain] = useState(app.preferredSubdomain || '');
  const [rate, setRate] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!app.preferredSubdomain) get(`/influencer-applications/${app._id}/suggest-subdomain`).then((r) => setSubdomain(r.data.subdomain || '')).catch(() => {});
  }, [app]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await post(`/influencer-applications/${app._id}/approve`, { subdomain: subdomain || undefined, commissionRate: rate === '' ? null : Number(rate), sendWelcomeEmail: sendEmail });
      setResult(res.data);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Modal open onClose={onClose} title="Influencer approved 🎉" footer={<><Link to={`/admin/influencers/${result.influencer._id}`} className="btn-secondary">View profile</Link><Button onClick={onClose}>Done</Button></>}>
        <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Referral ID</dt><dd className="font-semibold">{result.influencer.influencerCode}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt className="text-slate-500">Referral link</dt><dd className="flex items-center gap-1 truncate font-semibold">{result.influencer.referralUrl}<CopyButton text={result.influencer.referralUrl} label="" /></dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Login email</dt><dd className="font-semibold">{result.influencer.user?.email}</dd></div>
          {result.tempPassword && <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1 text-slate-500"><KeyRound className="size-4" /> Temp password</dt><dd className="flex items-center gap-1 font-mono font-semibold">{result.tempPassword}<CopyButton text={result.tempPassword} label="" /></dd></div>}
        </dl>
        <p className="mt-3 text-xs text-slate-500">{sendEmail ? 'Login details were emailed to the influencer.' : 'Share these details with the influencer.'} The temporary password is shown only once.</p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Approve ${app.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Check} loading={busy} onClick={submit}>Approve & create account</Button></>}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">This creates an influencer account for <b>{app.email}</b> with a referral ID, subdomain and temporary password.</p>
        <Field label="Subdomain" hint={subdomain ? `${subdomain}.jencorps.com` : undefined}><Input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase())} /></Field>
        <Field label="Commission %" hint="Leave blank for the workshop / platform default"><Input type="number" min="0" max="100" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Email login details to the influencer</label>
      </div>
    </Modal>
  );
}

function RejectModal({ app, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await post(`/influencer-applications/${app._id}/reject`, { reason, notify });
      toast.success('Application rejected');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Reject ${app.name}?`} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={submit}>Reject</Button></>}>
      <div className="space-y-4 text-sm">
        <Field label="Note to the applicant (optional)"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Send a polite email to the applicant</label>
      </div>
    </Modal>
  );
}

export default function Applications() {
  useDocumentTitle('Influencer applications');
  const q = useListQuery({ filters: { status: 'pending' } });
  const { data, meta, loading, error, reload } = useFetch('/influencer-applications', q.params);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const { ask, dialog } = useConfirm();

  const removeApplication = (app) =>
    ask({
      title: `Delete ${app.name}'s application?`,
      message: app.influencerId
        ? 'Only the application record is deleted. Their influencer account stays active (delete it from Influencers if needed).'
        : 'This permanently removes the application. They can apply again later.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await del(`/influencer-applications/${app._id}`);
          toast.success('Application deleted');
          reload();
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });

  const columns = [
    { key: 'name', header: 'Applicant', sortable: true, render: (r) => <button type="button" onClick={() => setViewing(r)} className="text-left"><p className="font-medium text-navy hover:text-brand">{r.name}</p><p className="text-xs text-slate-400">{r.email} · {r.phone}</p></button> },
    { key: 'instagram', header: 'Instagram', render: (r) => <a href={`https://instagram.com/${r.instagramUsername}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Instagram className="size-3.5" />@{r.instagramUsername}</a> },
    { key: 'followers', header: 'Followers', sortable: true, render: (r) => <Badge tone="purple">{fmtFollowers(r.followers)}</Badge> },
    { key: 'views', header: 'Avg views', render: (r) => (
      <div className="space-y-0.5 text-xs">
        <p className="font-semibold text-navy" title="Average Instagram Reel views">IG {viewRangeLabel(r.avgViews?.instagram) || '—'}</p>
        {r.avgViews?.youtube !== null && r.avgViews?.youtube !== undefined && <p className="text-slate-500">YT {viewRangeLabel(r.avgViews.youtube)}</p>}
        {r.avgViews?.facebook !== null && r.avgViews?.facebook !== undefined && <p className="text-slate-500">FB {viewRangeLabel(r.avgViews.facebook)}</p>}
      </div>
    ) },
    { key: 'niche', header: 'Niche / City', render: (r) => <span className="text-slate-600">{[r.niche, r.city].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'sub', header: 'Wants', render: (r) => (r.preferredSubdomain ? <span className="font-mono text-xs">{r.preferredSubdomain}</span> : <span className="text-slate-400">—</span>) },
    { key: 'createdAt', header: 'Applied', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {r.status === 'pending' ? (
          <>
            <Button size="sm" icon={Check} onClick={() => setApproving(r)}>Approve</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setRejecting(r)} aria-label="Reject" title="Reject" />
          </>
        ) : r.influencerId ? (
          <Link to={`/admin/influencers/${r.influencerId}`} className="mr-1 text-sm font-medium text-brand">View influencer</Link>
        ) : null}
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeApplication(r)} aria-label="Delete" title="Delete application" className="hover:!text-rose-600" />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Influencer applications" description={`Instagram creators who applied through the "Join as Influencer" page.${meta?.pending ? ` ${meta.pending} waiting for review.` : ''}`} actions={<a href="/become-influencer" target="_blank" rel="noreferrer" className="btn-secondary"><UserPlus className="size-4" /> View apply page</a>} />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <SearchInput value={q.search} onChange={q.setSearch} placeholder="Name, email, Instagram, city" className="sm:col-span-2" />
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="All statuses" options={statusOptions(['pending', 'approved', 'rejected'])} />
        </div>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={q.sort}
          onSort={q.toggleSort}
          empty={<EmptyState icon={Instagram} title="No applications here" description="Share the apply page link with creators you'd like to work with." />}
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setViewing(r)} className="text-left"><p className="font-medium text-navy">{r.name}</p><p className="text-xs text-slate-500">@{r.instagramUsername} · {fmtFollowers(r.followers)} followers</p></button>
                <StatusBadge status={r.status === 'pending' ? 'pending' : r.status} />
              </div>
              {r.status === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" icon={Check} onClick={() => setApproving(r)}>Approve</Button><Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(r)}>Reject</Button></div>}
            </div>
          )}
        />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.name} footer={viewing.status === 'pending' ? <><Button variant="secondary" icon={X} onClick={() => { setRejecting(viewing); setViewing(null); }}>Reject</Button><Button icon={Check} onClick={() => { setApproving(viewing); setViewing(null); }}>Approve</Button></> : null}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[['Email', viewing.email], ['Phone', viewing.phone], ['Instagram', `@${viewing.instagramUsername}`], ['Followers', formatNumber(viewing.followers)], ['Avg Instagram Reel views', viewRangeLabel(viewing.avgViews?.instagram)], ['Avg YouTube views', viewRangeLabel(viewing.avgViews?.youtube) || 'Not on YouTube'], ['Avg Facebook views', viewRangeLabel(viewing.avgViews?.facebook) || 'Not on Facebook'], ['YouTube channel', viewing.youtubeChannel && <a href={viewing.youtubeChannel} target="_blank" rel="noreferrer" className="text-brand hover:underline">{viewing.youtubeChannel}</a>], ['Facebook page', viewing.facebookPage && <a href={viewing.facebookPage} target="_blank" rel="noreferrer" className="text-brand hover:underline">{viewing.facebookPage}</a>], ['Niche', viewing.niche], ['City', viewing.city], ['Preferred link', viewing.preferredSubdomain], ['Applied', formatDate(viewing.createdAt)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="break-words font-medium text-navy">{v || '—'}</dd></div>
            ))}
          </dl>
          {viewing.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{viewing.message}</p>}
          {viewing.rejectionReason && <p className="mt-3 text-sm text-rose-600">Rejected: {viewing.rejectionReason}</p>}
        </Modal>
      )}
      {approving && <ApproveModal key={approving._id} app={approving} onClose={() => setApproving(null)} onDone={reload} />}
      {rejecting && <RejectModal key={rejecting._id} app={rejecting} onClose={() => setRejecting(null)} onDone={reload} />}
      {dialog}
    </>
  );
}
