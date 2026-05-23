import { alertBanner } from '../constants/colours';

export default function AlertBanner({ level, message, className = '' }) {
  const cfg = alertBanner[level?.toUpperCase()] || alertBanner.AMBER;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-l-4 font-semibold ${className}`}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        borderColor: cfg.border,
      }}>
      <span className="text-xl" aria-hidden>
        {cfg.icon}
      </span>
      <span>{message}</span>
    </div>
  );
}
