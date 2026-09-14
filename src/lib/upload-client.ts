/**
 * Everything needed to take one File and get it into R2, reporting
 * progress along the way. No file contents ever touch our own server —
 * only this metadata request does.
 */

interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
}

async function requestPresignedUrl(file: File): Promise<PresignResponse> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!res.ok) {
    let message = "Something went wrong while uploading.";
    try {
      const data = await res.json();
      if (typeof data.error === "string") message = data.error;
    } catch {
      // ignore parse failure, use default message
    }
    throw new Error(message);
  }

  return res.json();
}

function putFileToR2(uploadUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("The upload didn't complete. Please check your connection and try again."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("The upload didn't complete. Please check your connection and try again."));
    };

    xhr.onabort = () => {
      reject(new Error("Upload cancelled."));
    };

    xhr.send(file);
  });
}

/** Requests a presigned URL, then uploads the file directly to R2. */
export async function uploadFileToR2(file: File, onProgress: (percent: number) => void): Promise<void> {
  const { uploadUrl } = await requestPresignedUrl(file);
  await putFileToR2(uploadUrl, file, onProgress);
}
