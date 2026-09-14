import { UploadItem } from "@/lib/types";

interface UploadProgressProps {
  items: UploadItem[];
  onRetry: (id: string) => void;
}

function StatusIcon({ status }: { status: UploadItem["status"] }) {
  if (status === "done") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-sage" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 10.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "error" || status === "rejected") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-wine-light" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "uploading") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 animate-spin text-wine" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border border-stone/40" aria-hidden="true" />;
}

export default function UploadProgress({ items, onRetry }: UploadProgressProps) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-ink/10 bg-white/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <StatusIcon status={item.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.file.name}</p>
              {item.status === "uploading" && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-wine transition-[width] duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {(item.status === "error" || item.status === "rejected") && item.error && (
                <p className="mt-1 text-sm text-wine-light">{item.error}</p>
              )}
              {item.status === "waiting" && <p className="mt-0.5 text-sm text-stone">Waiting…</p>}
              {item.status === "done" && <p className="mt-0.5 text-sm text-sage">Uploaded</p>}
            </div>
            {item.status === "error" && (
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                className="shrink-0 rounded-lg border border-wine/30 px-3 py-1.5 text-sm font-medium text-wine transition hover:bg-wine/5"
              >
                Try again
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
