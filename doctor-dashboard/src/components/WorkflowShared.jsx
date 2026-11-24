import { Fragment, useState } from 'react';
import { resolveAssetUrl } from '../services/api';
import { PHOTO_PROTOCOL_STEPS } from '../utils/workflowUtils';

export function StatusBadge({ status }) {
  const s = String(status || 'draft').toLowerCase();
  const map = {
    draft: 'bg-slate-800 text-slate-300 border-slate-600/60',
    submitted: 'bg-sky-950/60 text-sky-300 border-sky-700/60',
    ai_reviewed: 'bg-amber-950/60 text-amber-300 border-amber-700/60',
    moderator_approved: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60',
    moderator_rejected: 'bg-rose-950/60 text-rose-300 border-rose-700/60',
    accepted: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    doctor_completed: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    paid: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    credited: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    pending: 'bg-amber-950/60 text-amber-300 border-amber-700/60',
    rejected: 'bg-red-950/60 text-red-300 border-red-700/60',
    active: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    suspended: 'bg-rose-950/60 text-rose-300 border-rose-700/60',
  };
  const labels = {
    ai_reviewed: 'AI Passed · Awaiting Moderator',
    moderator_approved: 'Moderator Approved · Awaiting Doctor',
    moderator_rejected: 'Moderator Rejected',
    doctor_completed: 'Doctor Completed',
    accepted: 'Accepted',
    rejected: 'Rejected',
    submitted: 'Submitted',
    draft: 'Draft',
    paid: 'Paid',
    credited: 'Credited',
    pending: 'Pending',
    active: 'Active',
    suspended: 'Suspended',
  };
  const cls = map[s] || 'bg-slate-800 text-slate-300 border-slate-600/60';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {labels[s] || s.replace(/_/g, ' ')}
    </span>
  );
}

export function RoleBadge({ role, workerType }) {
  const r = String(role || '').toLowerCase();
  const map = {
    doctor: { cls: 'bg-blue-950/70 text-blue-300 border-blue-700/60', text: 'Doctor' },
    field_worker: { cls: 'bg-teal-950/70 text-teal-300 border-teal-700/60', text: workerType || 'Field Worker' },
    moderator: { cls: 'bg-violet-950/70 text-violet-300 border-violet-700/60', text: 'Moderator' },
    admin: { cls: 'bg-amber-950/70 text-amber-300 border-amber-700/60', text: 'Admin' },
    hospital_admin: { cls: 'bg-amber-950/70 text-amber-300 border-amber-700/60', text: 'Admin' },
  };
  const cfg = map[r] || { cls: 'bg-slate-800 text-slate-300 border-slate-600', text: r || 'User' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cfg.cls}`}>
      {cfg.text}
    </span>
  );
}

export function CoinProtocolBanner() {
  return (
    <div className="p-4 rounded-xl bg-[#0E1835] border border-[#253966] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      <div className="space-y-1">
        <p className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">✓ Photo Protocol Do&apos;s (3-Shot Sequence)</p>
        <ul className="text-slate-300 space-y-0.5 list-disc list-inside text-[11px]">
          <li>Take all 3 photos in order: <strong>Distance → Closer → Even Closer</strong></li>
          <li>Place a <strong>₹1 / ₹5 / ₹10 coin</strong> flat beside the affected area for scale</li>
          <li>Use bright, even natural or room lighting with crisp focus</li>
        </ul>
      </div>
      <div className="space-y-1">
        <p className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">✕ Photo Protocol Don&apos;ts (AI Rejects Automatically)</p>
        <ul className="text-slate-300 space-y-0.5 list-disc list-inside text-[11px]">
          <li>No blurry, dark, or over-exposed flash glare images</li>
          <li>No beauty filters, cropping out wound margins, or covering lesion</li>
          <li>Do not omit the reference coin or hide it behind gauze/fingers</li>
        </ul>
      </div>
    </div>
  );
}

export function PhotoUploadProtocolGrid({ photosByNumber, uploadingMap, onSelectFile }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {PHOTO_PROTOCOL_STEPS.map((step) => {
        const uploaded = photosByNumber[step.number];
        const isUploading = Boolean(uploadingMap[step.number]);
        const previewSrc = uploaded?.localPreview || resolveAssetUrl(uploaded?.annotated_url || uploaded?.file_url);

        return (
          <div
            key={step.number}
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              uploaded
                ? uploaded.quality_passed === false
                  ? 'bg-rose-950/20 border-rose-700/60'
                  : 'bg-[#101E42] border-emerald-600/60'
                : 'bg-[#0C152E] border-[#23355E]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-white">{step.title}</span>
                {uploaded ? (
                  uploaded.quality_passed === false ? (
                    <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 text-[10px] font-bold">Quality Warning</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold">✓ Uploaded</span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">Required</span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">{step.instruction}</p>
              <p className="text-[10px] text-slate-400 mt-1 italic">{step.tip}</p>

              <div className="mt-3 h-44 rounded-lg bg-[#080F24] border border-[#1E2E54] overflow-hidden flex items-center justify-center relative">
                {isUploading ? (
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] text-blue-300 font-semibold">Running AI Quality Check…</p>
                  </div>
                ) : previewSrc ? (
                  <img
                    src={previewSrc}
                    alt={step.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center px-4 text-slate-500">
                    <div className="text-2xl mb-1">📷</div>
                    <p className="text-[11px]">No image selected yet</p>
                    <p className="text-[10px] text-slate-500">Upload JPG/PNG from your PC or Camera</p>
                  </div>
                )}
              </div>

              {uploaded && (
                <div className="mt-2.5 p-2 rounded-lg bg-[#091128] border border-[#1D2B52] text-[10px] space-y-0.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>AI Quality:</span>
                    <span className={uploaded.quality_passed === false ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {uploaded.quality_passed === false ? 'Needs Retake' : 'Passed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Coin Scale Marker:</span>
                    <span className={uploaded.coin_detected ? 'text-emerald-400 font-semibold' : 'text-amber-300 font-semibold'}>
                      {uploaded.coin_detected ? 'Detected ✓' : 'Not Detected / Optional'}
                    </span>
                  </div>
                  {uploaded.blur_score !== undefined && uploaded.blur_score !== null && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Sharpness (Blur Score):</span>
                      <span className="font-mono text-slate-200">{Number(uploaded.blur_score).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block w-full cursor-pointer text-center py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow">
                {uploaded ? '↻ Replace Image from System' : '📁 Choose Image from System'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onSelectFile(step, file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ThreePhotoInspector({ photos = [] }) {
  const [showAnnotated, setShowAnnotated] = useState(true);
  const [zoomPhoto, setZoomPhoto] = useState(null);

  const byNumber = {};
  photos.forEach((p, idx) => {
    const num = Number(p.photo_number || idx + 1);
    byNumber[num] = p;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Standardized 3-Photo Sequence ({photos.length}/3 Uploaded)
        </h4>
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer bg-[#0C152E] px-2.5 py-1 rounded border border-[#23355E]">
          <input
            type="checkbox"
            checked={showAnnotated}
            onChange={(e) => setShowAnnotated(e.target.checked)}
            className="rounded text-blue-600 bg-[#091024] border-[#253966]"
          />
          <span>Show AI Annotated Overlays (when available)</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PHOTO_PROTOCOL_STEPS.map((step) => {
          const photo = byNumber[step.number];
          const rawUrl = resolveAssetUrl(photo?.file_url || photo?.photo_url || photo?.image_url);
          const annUrl = resolveAssetUrl(photo?.annotated_url);
          const displayUrl = (showAnnotated && annUrl) ? annUrl : rawUrl;

          return (
            <div key={step.number} className="rounded-xl bg-[#0C152E] border border-[#23355E] p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white">{step.title}</span>
                {photo ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    photo.quality_passed === false
                      ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  }`}>
                    {photo.quality_passed === false ? 'Low Quality' : 'AI OK'}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Missing</span>
                )}
              </div>

              {displayUrl ? (
                <button
                  type="button"
                  onClick={() => setZoomPhoto({ url: displayUrl, rawUrl, annUrl, title: step.title, photo })}
                  className="group relative h-48 rounded-lg bg-[#070D1E] border border-[#1E2E54] overflow-hidden cursor-zoom-in"
                >
                  <img src={displayUrl} alt={step.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-semibold">
                    🔍 Zoom
                  </span>
                </button>
              ) : (
                <div className="h-48 rounded-lg bg-[#070D1E] border border-dashed border-[#23355E] flex items-center justify-center text-xs text-slate-500">
                  No photo
                </div>
              )}

              {photo && (
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Coin: <strong className={photo.coin_detected ? 'text-emerald-400' : 'text-amber-300'}>{photo.coin_detected ? 'Yes' : 'No'}</strong></span>
                  {photo.blur_score !== undefined && photo.blur_score !== null && (
                    <span>Blur: <strong className="text-slate-200 font-mono">{Number(photo.blur_score).toFixed(1)}</strong></span>
                  )}
                  {photo.brightness_mean !== undefined && photo.brightness_mean !== null && (
                    <span>Light: <strong className="text-slate-200 font-mono">{Number(photo.brightness_mean).toFixed(0)}</strong></span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="bg-[#111C38] border border-[#253966] rounded-2xl max-w-4xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{zoomPhoto.title}</h3>
                <p className="text-[11px] text-slate-400">Click outside or press Close to return</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="px-3 py-1 rounded-lg bg-[#1D2B52] hover:bg-[#253966] text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-[#070D1E] rounded-xl border border-[#1D2B52] max-h-[75vh] overflow-auto flex items-center justify-center p-2">
              <img src={zoomPhoto.url} alt={zoomPhoto.title} className="max-h-[70vh] w-auto object-contain" />
            </div>
            {zoomPhoto.annUrl && zoomPhoto.rawUrl && zoomPhoto.annUrl !== zoomPhoto.rawUrl && (
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setZoomPhoto((z) => ({ ...z, url: z.rawUrl }))}
                  className={`px-3 py-1 rounded text-xs font-semibold border ${zoomPhoto.url === zoomPhoto.rawUrl ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#0C152E] text-slate-300 border-[#23355E]'}`}
                >
                  Original Photo
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPhoto((z) => ({ ...z, url: z.annUrl }))}
                  className={`px-3 py-1 rounded text-xs font-semibold border ${zoomPhoto.url === zoomPhoto.annUrl ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#0C152E] text-slate-300 border-[#23355E]'}`}
                >
                  AI Annotated Overlay
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineTracker({ submission }) {
  const s = String(submission?.status || 'draft').toLowerCase();
  const isDoctorSubmit = String(submission?.submitter_role || '').toLowerCase() === 'doctor';
  const rejected = s === 'rejected' || s === 'moderator_rejected';

  const steps = isDoctorSubmit
    ? [
        { key: 'submitted', label: 'Submitted + Note' },
        { key: 'ai', label: 'AI Quality Check' },
        { key: 'done', label: rejected ? 'Rejected (₹0)' : 'Accepted (₹80 + ₹20)' },
      ]
    : [
        { key: 'submitted', label: 'Field Submitted' },
        { key: 'ai_reviewed', label: 'AI Quality Pass' },
        { key: 'moderator_approved', label: 'Moderator (₹20)' },
        { key: 'accepted', label: rejected ? 'Rejected (₹0)' : 'Doctor Note (₹50 + ₹30)' },
      ];

  let activeIdx = 0;
  if (isDoctorSubmit) {
    if (s === 'accepted' || s === 'paid' || s === 'doctor_completed' || rejected) activeIdx = 2;
    else if (s === 'submitted') activeIdx = 1;
  } else {
    if (s === 'accepted' || s === 'paid' || s === 'doctor_completed') activeIdx = 3;
    else if (s === 'moderator_approved') activeIdx = 2;
    else if (s === 'moderator_rejected') activeIdx = 2;
    else if (s === 'ai_reviewed') activeIdx = 1;
    else if (s === 'rejected') activeIdx = 1;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((st, idx) => {
        const isLastAndRejected = rejected && idx === activeIdx;
        const done = !rejected && idx <= activeIdx;
        return (
          <Fragment key={st.key}>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isLastAndRejected
                  ? 'bg-rose-950/70 text-rose-300 border-rose-700/60'
                  : done
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                  : 'bg-[#0C152E] text-slate-400 border-[#23355E]'
              }`}
            >
              {isLastAndRejected ? '✕ ' : done ? '✓ ' : `${idx + 1}. `}
              {st.label}
            </span>
            {idx < steps.length - 1 && <span className="text-slate-600 text-[10px]">→</span>}
          </Fragment>
        );
      })}
    </div>
  );
}
