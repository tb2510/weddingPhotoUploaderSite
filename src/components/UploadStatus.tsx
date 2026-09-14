interface UploadStatusProps {
  total: number;
  done: number;
  errorCount: number;
}

export default function UploadStatus({ total, done, errorCount }: UploadStatusProps) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const stillGoing = done < total;

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg text-ink">
          {stillGoing ? "Uploading your memories…" : "All done"}
        </p>
        <p className="text-sm text-stone">
          {done} of {total} uploaded
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-wine transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      {errorCount > 0 && (
        <p className="mt-2 text-sm text-wine-light">
          {errorCount} {errorCount === 1 ? "file" : "files"} couldn&apos;t be uploaded — see below.
        </p>
      )}
    </div>
  );
}
