import { Download } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Select } from '../../components/ui';
import { useFetch } from '../../hooks';
import { download, errorMessage } from '../../services/api';
import { titleCase } from '../../utils/format';

/** Option lists for filters (cached per mount) */
export function useInfluencerOptions() {
  const { data } = useFetch('/influencers', { limit: 100, sort: 'influencerCode' });
  return (data || []).map((i) => ({ value: i._id, label: `${i.user?.name || 'Unknown'} (${i.influencerCode})` }));
}

export function useWorkshopOptions() {
  const { data } = useFetch('/workshops', { scope: 'admin', limit: 100 });
  return (data || []).map((w) => ({ value: w._id, label: w.title }));
}

export const statusOptions = (list) => list.map((v) => ({ value: v, label: titleCase(v) }));

export function FilterSelect({ value, onChange, placeholder, options, className = '' }) {
  return <Select className={className} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} options={options} />;
}

export function ExportButtons({ url, params, name }) {
  const [busy, setBusy] = useState(null);
  const run = async (format) => {
    setBusy(format);
    try {
      const clean = Object.fromEntries(Object.entries({ ...params, format, page: undefined, limit: undefined }).filter(([, v]) => v !== '' && v !== undefined));
      await download(url, clean, `${name}.${format}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button variant="secondary" icon={Download} loading={busy === 'csv'} onClick={() => run('csv')}>CSV</Button>
      <Button variant="secondary" icon={Download} loading={busy === 'xlsx'} onClick={() => run('xlsx')}>Excel</Button>
    </>
  );
}
