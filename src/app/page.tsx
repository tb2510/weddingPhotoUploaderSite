"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UploadButton from "@/components/UploadButton";
import UploadProgress from "@/components/UploadProgress";
import UploadStatus from "@/components/UploadStatus";
import { makeId } from "@/lib/id";
import { SITE_CONFIG } from "@/lib/site-config";
import { UPLOAD_CONCURRENCY, validateBatch } from "@/lib/upload-config";
import { uploadFileToR2 } from "@/lib/upload-client";
import { UploadItem } from "@/lib/types";

export default function Home() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const uploadOne = useCallback(async (id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "uploading", progress: 0, error: undefined } : i))
    );

    try {
      await uploadFileToR2(item.file, (percent) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, progress: percent } : i)));
      });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "done", progress: 100 } : i)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while uploading.";
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "error", error: message } : i)));
    }
  }, []);

  const runQueue = useCallback(
    async (ids: string[]) => {
      let cursor = 0;
      const workerCount = Math.min(UPLOAD_CONCURRENCY, ids.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (cursor < ids.length) {
            const id = ids[cursor++];
            await uploadOne(id);
          }
        })
      );
    },
    [uploadOne]
  );

  function handleFilesSelected(files: File[]) {
    const { accepted, rejected } = validateBatch(files);

    const newItems: UploadItem[] = [
      ...accepted.map((file): UploadItem => ({ id: makeId(), file, status: "waiting", progress: 0 })),
      ...rejected.map(
        ({ file, reason }): UploadItem => ({ id: makeId(), file, status: "rejected", progress: 0, error: reason })
      ),
    ];

    // Update the ref synchronously, not just via the useEffect below —
    // runQueue/uploadOne read from itemsRef immediately, before React
    // has had a chance to re-render and run that effect.
    itemsRef.current = newItems;
    setItems(newItems);

    const waitingIds = newItems.filter((i) => i.status === "waiting").map((i) => i.id);
    if (waitingIds.length > 0) {
      void runQueue(waitingIds);
    }
  }

  function handleRetry(id: string) {
    void uploadOne(id);
  }

  function handleReset() {
    setItems([]);
  }

  const hasItems = items.length > 0;
  const isUploading = items.some((i) => i.status === "waiting" || i.status === "uploading");
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const rejectedItems = items.filter((i) => i.status === "rejected");
  const attemptedTotal = items.filter((i) => i.status !== "rejected").length;
  const allSettled = hasItems && !isUploading;
  const success = allSettled && errorCount === 0 && doneCount > 0;
  const totalFailure = allSettled && doneCount === 0;

  return (
    <main className="min-h-[100dvh] bg-ivory">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 py-16">
        {!hasItems && (
          <div className="flex w-full flex-col items-center text-center">
            <HeartMark />
            <h1 className="mt-6 font-display text-4xl leading-tight text-ink sm:text-5xl">
              {SITE_CONFIG.coupleNames}
            </h1>
            <p className="mt-3 font-display text-xl text-wine">Help us capture the day!</p>
            <p className="mt-4 max-w-xs text-base text-stone">{SITE_CONFIG.welcomeMessage}</p>

            <div className="mt-10 w-full">
              <UploadButton onFilesSelected={handleFilesSelected} />
              <p className="mt-4 text-sm text-stone">No app required</p>
            </div>
          </div>
        )}

        {hasItems && isUploading && (
          <div className="w-full">
            <UploadStatus total={attemptedTotal} done={doneCount} errorCount={errorCount} />
            <UploadProgress items={items} onRetry={handleRetry} />
          </div>
        )}

        {hasItems && allSettled && success && (
          <div className="flex w-full flex-col items-center text-center">
            <HeartMark filled />
            <h1 className="mt-6 font-display text-3xl text-ink sm:text-4xl">Upload complete!</h1>
            <p className="mt-3 max-w-xs text-base text-stone">
              Thank you for helping us capture the day.
            </p>

            {(errorCount > 0 || rejectedItems.length > 0) && (
              <div className="mt-6 w-full text-left">
                <UploadProgress
                  items={items.filter((i) => i.status === "error" || i.status === "rejected")}
                  onRetry={handleRetry}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="mt-10 rounded-2xl border border-wine/30 px-8 py-3 text-base font-medium text-wine transition hover:bg-wine/5"
            >
              Upload more
            </button>
          </div>
        )}

        {hasItems && allSettled && totalFailure && (
          <div className="w-full">
            <div className="text-center">
              <h1 className="font-display text-3xl text-ink">
                {rejectedItems.length === items.length ? "None of those worked" : "That didn't go through"}
              </h1>
              <p className="mt-3 text-base text-stone">
                Take a look below, then try again when you&apos;re ready.
              </p>
            </div>
            <div className="mt-6">
              <UploadProgress items={items} onRetry={handleRetry} />
            </div>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-wine/30 px-8 py-3 text-base font-medium text-wine transition hover:bg-wine/5"
              >
                Choose different files
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function HeartMark({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="h-12 w-12 text-wine"
      aria-hidden="true"
    >
      <path
        d="M24 40C13 32.5 6 25.8 6 18.3 6 12.6 10.5 8 16 8c3.4 0 6.5 1.7 8 4.4C25.5 9.7 28.6 8 32 8c5.5 0 10 4.6 10 10.3C42 25.8 35 32.5 24 40Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.12 : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}