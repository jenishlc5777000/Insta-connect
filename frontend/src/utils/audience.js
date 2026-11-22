// Average-views ranges offered to creators. The stored value is the lower bound of the range.
export const VIEW_RANGES = [
  { value: '0', label: 'Under 1K views' },
  { value: '1000', label: '1K – 5K views' },
  { value: '5000', label: '5K – 10K views' },
  { value: '10000', label: '10K – 50K views' },
  { value: '50000', label: '50K – 100K views' },
  { value: '100000', label: '100K – 500K views' },
  { value: '500000', label: '500K – 1M views' },
  { value: '1000000', label: '1M+ views' },
];

const BOUNDS = VIEW_RANGES.map((r) => Number(r.value));

/** 10000 -> "10K–50K", 1000000 -> "1M+" */
export function viewRangeLabel(n) {
  if (n === null || n === undefined) return null;
  const short = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : `${v}`);
  const i = BOUNDS.indexOf(Number(n));
  if (i === -1) return `${short(Number(n))}+`;
  if (i === BOUNDS.length - 1) return `${short(BOUNDS[i])}+`;
  if (i === 0) return 'Under 1K';
  return `${short(BOUNDS[i])}–${short(BOUNDS[i + 1])}`;
}

export const CHANNELS = [
  { key: 'instagram', label: 'Instagram Reels', required: true },
  { key: 'youtube', label: 'YouTube videos / Shorts', link: 'youtubeChannel', linkLabel: 'YouTube channel link', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'facebook', label: 'Facebook videos', link: 'facebookPage', linkLabel: 'Facebook page link', placeholder: 'https://facebook.com/yourpage' },
];
