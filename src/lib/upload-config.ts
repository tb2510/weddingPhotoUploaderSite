/**
 * All tunable limits and allow-lists live here so they aren't scattered
 * around the codebase. Change a number here, not in five different files.
 */

// ---- Batch limits -----------------------------------------------------

export const MAX_FILES_PER_BATCH = 50;
export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_TOTAL_BATCH_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// ---- Presigned URL ------------------------------------------------------

export const PRESIGNED_URL_EXPIRY_SECONDS = 10 * 60; // 10 minutes

// ---- Client upload behaviour ---------------------------------------------

/** How many files upload at the same time. Kept low so one big video
 * doesn't starve everything else on a slow connection, and so a batch
 * of 50 files doesn't open 50 simultaneous connections on mobile data. */
export const UPLOAD_CONCURRENCY = 3;

// ---- Rate limiting (see src/app/api/upload/route.ts for the tradeoffs) --

export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 120; // per IP, per window

// ---- Allowed file types -------------------------------------------------

type FileKind = "image" | "video";

interface AllowedType {
  kind: FileKind;
  extensions: string[];
}

/** MIME type -> allowed kind + extensions. Source of truth for validation. */
export const ALLOWED_MIME_TYPES: Record<string, AllowedType> = {
  "image/jpeg": { kind: "image", extensions: ["jpg", "jpeg"] },
  "image/png": { kind: "image", extensions: ["png"] },
  "image/heic": { kind: "image", extensions: ["heic"] },
  "image/heif": { kind: "image", extensions: ["heif"] },
  "image/webp": { kind: "image", extensions: ["webp"] },
  "video/mp4": { kind: "video", extensions: ["mp4"] },
  "video/quicktime": { kind: "video", extensions: ["mov"] },
};

/**
 * iOS sometimes reports HEIC files with an empty or generic MIME type
 * (e.g. "" or "application/octet-stream") depending on the browser and
 * OS version. We fall back to the file extension in that case so real
 * guest phones aren't rejected. This map is the extension -> kind lookup
 * used only as that fallback, never as the primary check.
 */
export const EXTENSION_FALLBACK: Record<string, { mime: string; kind: FileKind }> = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  heic: { mime: "image/heic", kind: "image" },
  heif: { mime: "image/heif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
};

export function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export interface ResolvedFileType {
  ok: boolean;
  kind?: FileKind;
  mime?: string;
  reason?: string;
}

/**
 * Resolves the effective MIME type/kind for a file, trusting the browser's
 * reported contentType first and falling back to the extension for the
 * known iOS HEIC edge case. Rejects anything that doesn't match a known
 * image/video type via either path.
 */
export function resolveFileType(filename: string, contentType: string): ResolvedFileType {
  const ext = getExtension(filename);

  if (contentType && ALLOWED_MIME_TYPES[contentType]) {
    const allowed = ALLOWED_MIME_TYPES[contentType];
    if (!allowed.extensions.includes(ext)) {
      return {
        ok: false,
        reason: `"${filename}" has a .${ext || "unknown"} extension, which doesn't match its file type.`,
      };
    }
    return { ok: true, kind: allowed.kind, mime: contentType };
  }

  const fallback = EXTENSION_FALLBACK[ext];
  if (fallback) {
    return { ok: true, kind: fallback.kind, mime: fallback.mime };
  }

  return {
    ok: false,
    reason: `"${filename}" isn't a supported photo or video type.`,
  };
}

export function maxSizeForKind(kind: FileKind): number {
  return kind === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

/** Full validation for a single file: type, extension, and size. */
export function validateFile(file: { name: string; type: string; size: number }): FileValidationResult {
  const resolved = resolveFileType(file.name, file.type);
  if (!resolved.ok || !resolved.kind) {
    return { ok: false, reason: resolved.reason ?? `"${file.name}" isn't a supported file type.` };
  }

  const limit = maxSizeForKind(resolved.kind);
  if (file.size > limit) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatBytes(file.size)}, which is over the ${formatBytes(limit)} limit for ${
        resolved.kind === "image" ? "photos" : "videos"
      }.`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, reason: `"${file.name}" appears to be empty.` };
  }

  return { ok: true };
}

/**
 * Validates an entire batch: per-file rules plus batch-wide limits.
 * Generic so the caller can pass real File objects (or plain metadata)
 * and get the same references back rather than reconstructed copies.
 */
export function validateBatch<T extends { name: string; type: string; size: number }>(
  files: T[]
): {
  accepted: T[];
  rejected: { file: T; reason: string }[];
} {
  const accepted: T[] = [];
  const rejected: { file: T; reason: string }[] = [];

  const pool = files.slice(0, MAX_FILES_PER_BATCH);
  const overflow = files.slice(MAX_FILES_PER_BATCH);
  for (const file of overflow) {
    rejected.push({ file, reason: `Only ${MAX_FILES_PER_BATCH} files can be uploaded at once.` });
  }

  let runningTotal = 0;
  for (const file of pool) {
    const result = validateFile(file);
    if (!result.ok) {
      rejected.push({ file, reason: result.reason ?? "This file can't be uploaded." });
      continue;
    }
    if (runningTotal + file.size > MAX_TOTAL_BATCH_SIZE_BYTES) {
      rejected.push({
        file,
        reason: `Adding "${file.name}" would put this batch over the ${formatBytes(
          MAX_TOTAL_BATCH_SIZE_BYTES
        )} total limit. Try uploading in smaller groups.`,
      });
      continue;
    }
    runningTotal += file.size;
    accepted.push(file);
  }

  return { accepted, rejected };
}
