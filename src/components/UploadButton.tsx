"use client";

import { ChangeEvent, useRef } from "react";

interface UploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}

export default function UploadButton({ onFilesSelected, disabled, label }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset so selecting the exact same file(s) again still fires onChange.
    event.target.value = "";
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-wine px-8 py-6 text-lg font-medium text-ivory shadow-lg shadow-wine/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-7 w-7 shrink-0 text-ivory"
        >
          <path
            d="M4 7.5C4 6.67 4.67 6 5.5 6h2.19a1 1 0 0 0 .83-.45l.96-1.44A1 1 0 0 1 10.31 3h3.38a1 1 0 0 1 .83.55l.96 1.44a1 1 0 0 0 .83.45h2.19c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-10Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>{label ?? "Upload photos & videos"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
