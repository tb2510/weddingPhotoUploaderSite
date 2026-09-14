export type UploadItemStatus = "waiting" | "uploading" | "done" | "error" | "rejected";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number; // 0-100
  error?: string;
}
