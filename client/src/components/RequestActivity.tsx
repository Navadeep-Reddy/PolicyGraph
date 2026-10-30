import { useEffect, useState, useSyncExternalStore } from "react";
import { getActivity, subscribeToActivity } from "../api/activity.ts";

export default function RequestActivity() {
  const message = useSyncExternalStore(subscribeToActivity, getActivity, () => null);
  const active = message !== null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => { window.clearTimeout(timer); setVisible(false); };
  }, [active]);

  if (!active || !visible) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-5">
      <div role="status" aria-live="polite" aria-atomic="true" className="flex max-w-sm items-center gap-4 rounded-card border border-border-strong bg-surface-white px-6 py-5 text-ink shadow-lg">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7 shrink-0 motion-safe:animate-spin text-accent">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="type-body-md">{message}</p>
      </div>
    </div>
  );
}
