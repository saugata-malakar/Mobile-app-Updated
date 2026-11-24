export const PHOTO_PROTOCOL_STEPS = [
  {
    number: 1,
    type: 'distant',
    title: '1. From a Distance',
    shortTitle: 'Distance View',
    instruction: 'Shows the whole body part (e.g. full foot/limb). Place a reference coin flat beside the affected area.',
    tip: 'Keep camera steady, good even light, no fingers covering lesion or coin.',
  },
  {
    number: 2,
    type: 'medium',
    title: '2. Closer',
    shortTitle: 'Closer View',
    instruction: 'Move closer so the affected area fills about half the frame, with the reference coin clearly visible beside it.',
    tip: 'Hold parallel to skin surface to minimize perspective distortion.',
  },
  {
    number: 3,
    type: 'close',
    title: '3. Even Closer',
    shortTitle: 'Even Closer',
    instruction: 'Close-up in sharp focus so wound margins, tissue color, and the adjacent reference coin fill the frame.',
    tip: 'Tap to focus. Avoid flash glare, filters, or cropping out the wound edge.',
  },
];

export const COMORBIDITY_OPTIONS = [
  'Type 2 Diabetes',
  'Type 1 Diabetes',
  'Hypertension',
  'Kidney Disease',
  'Heart Disease',
  'Neuropathy',
  'Peripheral Artery Disease',
  'None',
];

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export function normalizeArray(payload, keys = ['items', 'submissions', 'users', 'payments', 'queue']) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const k of keys) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

export function formatRupees(amount) {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
