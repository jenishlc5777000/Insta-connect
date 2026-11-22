import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Link2, CreditCard, BadgePercent, History, User, MousePointerClick } from 'lucide-react';
import { CopyButton, ErrorState, Modal, Skeleton, StatusBadge } from '../../components/ui';
import { useFetch } from '../../hooks';
import { formatDateTime, formatINR, titleCase } from '../../utils/format';

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="size-4" /> {title}
      </h4>
      {children}
    </section>
  );
}

function Grid({ rows }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[11px] text-slate-500">{k}</dt>
          <dd className="break-words text-sm font-medium text-navy">{v === undefined || v === null || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Admin: everything recorded about one lead */
export default function LeadDetail({ leadId, onClose }) {
  const { data: l, loading, error } = useFetch(leadId ? `/leads/${leadId}` : null);

  return (
    <Modal open={Boolean(leadId)} onClose={onClose} title={l ? l.name : 'Lead details'} size="xl">
      {error && <ErrorState message={error} />}
      {loading && !l && <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {l && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={l.registrationStatus} label={`Registration: ${titleCase(l.registrationStatus)}`} />
            <StatusBadge status={l.paymentStatus} label={`Payment: ${titleCase(l.paymentStatus)}`} />
            <StatusBadge status={l.attendanceStatus} label={`Attendance: ${titleCase(l.attendanceStatus)}`} />
            {l.commission && <StatusBadge status={l.commission.status} label={`Commission: ${titleCase(l.commission.status)}`} />}
          </div>

          <Section icon={User} title="Contact">
            <div className="grid gap-2 sm:grid-cols-3">
              <a href={`mailto:${l.email}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-navy hover:bg-brand-50"><Mail className="size-4 text-brand" /><span className="truncate">{l.email}</span></a>
              <a href={`tel:${l.phone}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-navy hover:bg-brand-50"><Phone className="size-4 text-brand" />{l.phone}</a>
              <a href={`https://wa.me/${String(l.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">WhatsApp</a>
            </div>
            <div className="mt-2">
              <Grid rows={[
                ['City', l.city && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{l.city}</span>],
                ['Workshop', l.workshop?.title],
                ['Mode', titleCase(l.mode || '')],
                ['Registered', formatDateTime(l.createdAt)],
                ['Consent given', formatDateTime(l.consentAt)],
                ['Customer account', l.account ? `${l.account.email}${l.account.emailVerified ? ' (verified)' : ''}` : 'No account'],
              ]} />
            </div>
          </Section>

          <Section icon={Link2} title="Referral attribution">
            <Grid rows={[
              ['Influencer', l.influencer ? <Link to={`/admin/influencers/${l.influencer._id}`} onClick={onClose} className="text-brand hover:underline">{l.influencer.name} ({l.influencer.influencerCode})</Link> : 'Direct — no influencer'],
              ['Attribution method', titleCase(l.attributionMethod || 'none')],
              ['Referral subdomain', l.referralSubdomain],
              ['Campaign', l.campaignId],
              ['Attributed at', formatDateTime(l.attributedAt)],
              ['"How did you hear about us?"', l.referralSource],
              ['UTM source', l.utmSource],
              ['UTM medium', l.utmMedium],
              ['UTM campaign', l.utmCampaign],
              ['UTM content', l.utmContent],
            ]} />
            {l.firstClick && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 rounded-xl bg-brand-50/60 px-3 py-2 text-xs text-slate-600">
                <MousePointerClick className="size-3.5 text-brand" /> First referral click {formatDateTime(l.firstClick.createdAt)} on <b>{l.firstClick.landingPath || '/'}</b>
                {l.firstClick.referrer && <>from <span className="truncate">{l.firstClick.referrer}</span></>}
              </p>
            )}
          </Section>

          <Section icon={CreditCard} title={`Payments (${l.payments.length})`}>
            {!l.payments.length ? (
              <p className="text-sm text-slate-500">No payment attempts yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Method</th><th className="px-3 py-2 font-medium">Gateway IDs</th><th className="px-3 py-2 font-medium">Refund</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {l.payments.map((p) => (
                      <tr key={p._id}>
                        <td className="whitespace-nowrap px-3 py-2">{formatDateTime(p.capturedAt || p.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{formatINR(p.amount)}</td>
                        <td className="px-3 py-2"><StatusBadge status={p.status} />{p.failureReason && <p className="text-xs text-rose-600">{p.failureReason}</p>}</td>
                        <td className="px-3 py-2">{p.method || '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500"><p>{p.gatewayOrderId}</p>{p.gatewayPaymentId && <p className="flex items-center gap-1">{p.gatewayPaymentId}<CopyButton text={p.gatewayPaymentId} label="" /></p>}</td>
                        <td className="px-3 py-2">{p.refundStatus === 'none' ? '—' : <><StatusBadge status={p.refundStatus} /> <span className="text-xs">{formatINR(p.refundedAmount)}</span></>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section icon={BadgePercent} title="Commission">
            {!l.commission ? (
              <p className="text-sm text-slate-500">{l.influencer ? 'Created automatically after a verified payment.' : 'No influencer, so no commission.'}</p>
            ) : (
              <Grid rows={[
                ['Ticket (gross)', formatINR(l.commission.grossAmount)],
                ['Deductions', `Tax ${formatINR(l.commission.deductions?.tax)} · Fees ${formatINR(l.commission.deductions?.gatewayFee)} · Refunds ${formatINR(l.commission.deductions?.refunds)}`],
                ['Eligible net revenue', formatINR(l.commission.eligibleNetRevenue)],
                ['Rate → commission', `${l.commission.commissionRate}% → ${formatINR(l.commission.commissionAmount)}`],
                ['Status', <StatusBadge key="s" status={l.commission.status} />],
                ['Payout', l.commission.payoutId ? `${titleCase(l.commission.payoutId.status)}${l.commission.payoutId.transactionId ? ` · Txn ${l.commission.payoutId.transactionId}` : ''}` : 'Not paid out yet'],
                ...(l.commission.clawbackAmount ? [['Clawback', formatINR(l.commission.clawbackAmount)]] : []),
                ...(l.commission.rejectionReason || l.commission.reversalReason ? [['Reason', l.commission.rejectionReason || l.commission.reversalReason]] : []),
              ]} />
            )}
          </Section>

          {(l.notes || l.history.length > 0 || l.commission?.history?.length > 0) && (
            <Section icon={History} title="Notes & history">
              {l.notes && <p className="mb-2 whitespace-pre-line rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{l.notes}</p>}
              <ul className="space-y-1.5 text-xs text-slate-600">
                {[
                  ...l.history.map((h) => ({ at: h.createdAt, text: `${h.adminId?.name || 'Admin'}: ${h.action.replace('lead.', '').replace(/_/g, ' ')}${h.reason ? ` — ${h.reason}` : ''}` })),
                  ...(l.commission?.history || []).map((h) => ({ at: h.at, text: `Commission ${h.status}${h.note ? ` — ${h.note}` : ''}` })),
                ]
                  .sort((a, b) => new Date(b.at) - new Date(a.at))
                  .map((h, i) => (
                    <li key={i} className="flex gap-3"><span className="w-36 shrink-0 text-slate-400">{formatDateTime(h.at)}</span><span>{h.text}</span></li>
                  ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
