import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Percent } from 'lucide-react';
import { Button, Field, Input, Modal, cx } from '../../components/ui';
import { patch, errorMessage } from '../../services/api';
import { useSite } from '../../context/SiteContext';
import { formatINR } from '../../utils/format';

const isDefault = (r) => r === null || r === undefined;

/**
 * Shows an influencer's commission % and lets an admin change it in place.
 * Blank = use the workshop / platform default.
 */
export default function CommissionRateEditor({ influencer, onSaved, size = 'md' }) {
  const site = useSite();
  const defaultRate = site.defaultCommissionRate ?? 50;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [applyPending, setApplyPending] = useState(true);
  const [busy, setBusy] = useState(false);
  const current = influencer.commissionRate;
  const pendingAmount = influencer.stats?.commissionPending;

  const start = () => {
    setValue(isDefault(current) ? '' : String(current));
    setApplyPending(true);
    setOpen(true);
  };

  const parsed = value === '' ? null : Number(value);
  const invalid = parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 100);
  const effective = parsed === null ? defaultRate : parsed;

  const save = async () => {
    if (invalid) return;
    setBusy(true);
    try {
      const res = await patch(`/influencers/${influencer._id}`, { commissionRate: parsed, applyToPendingCommissions: applyPending });
      const n = res.data.pendingRecalculated || 0;
      toast.success(`Commission set to ${parsed === null ? `default (${defaultRate}%)` : `${parsed}%`}${n ? ` · ${n} pending commission${n > 1 ? 's' : ''} updated` : ''}`);
      setOpen(false);
      onSaved?.(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        title="Change commission rate"
        className={cx(
          'group inline-flex items-center gap-1.5 rounded-lg font-semibold transition hover:bg-brand-50',
          size === 'lg' ? 'px-2.5 py-1.5 text-lg text-navy' : 'px-2 py-1 text-sm',
          isDefault(current) ? 'text-slate-500' : 'text-navy'
        )}
      >
        {isDefault(current) ? (
          <span>{defaultRate}% <span className="text-xs font-normal text-slate-400">default</span></span>
        ) : (
          <span>{current}%</span>
        )}
        <Pencil className="size-3.5 text-slate-300 group-hover:text-brand" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Commission for ${influencer.user?.name || 'influencer'}`}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} disabled={invalid} onClick={save}>Save rate</Button></>}
      >
        <div className="space-y-4 text-sm">
          <Field label="Commission percentage" error={invalid ? 'Enter a value between 0 and 100' : undefined} hint={`Leave blank to use the default (${defaultRate}%, or the workshop's own rate).`}>
            <div className="relative">
              <Input type="number" min="0" max="100" step="0.5" autoFocus value={value} placeholder={`${defaultRate} (default)`} onChange={(e) => setValue(e.target.value)} className="pr-9" error={invalid} />
              <Percent className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[30, 40, 50, 60].map((r) => (
              <button key={r} type="button" onClick={() => setValue(String(r))} className={cx('rounded-lg px-3 py-1 text-xs font-semibold ring-1 transition', parsed === r ? 'bg-brand text-white ring-brand' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/40')}>{r}%</button>
            ))}
            <button type="button" onClick={() => setValue('')} className={cx('rounded-lg px-3 py-1 text-xs font-semibold ring-1 transition', parsed === null ? 'bg-brand text-white ring-brand' : 'bg-white text-slate-600 ring-slate-200')}>Default</button>
          </div>
          {!invalid && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              On a ₹2,000 ticket they will earn <b className="text-navy">{formatINR(Math.round(200000 * effective) / 100)}</b> and JenCorps keeps <b className="text-navy">{formatINR(Math.round(200000 * (100 - effective)) / 100)}</b>.
            </p>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={applyPending} onChange={(e) => setApplyPending(e.target.checked)} />
            <span>
              Also apply to their <b>pending</b> commissions{pendingAmount ? <> (currently {formatINR(pendingAmount)} pending)</> : ''}.
              <span className="block text-xs text-slate-500">Approved and paid commissions are never changed. New sales always use the new rate.</span>
            </span>
          </label>
        </div>
      </Modal>
    </>
  );
}
