import { NextRequest, NextResponse } from "next/server";
import { buildObjectKey, createPresignedUploadUrl, generateObjectId } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";
import { getExtension, validateFile } from "@/lib/upload-config";

// This route uses the AWS SDK, which needs the Node.js runtime rather
// than the Edge runtime.
export const runtime = "nodejs";

interface UploadRequestBody {
  filename?: string;
  contentType?: string;
  size?: number;
}

function clientIdentifier(req: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to a constant so local dev
  // (where it's absent) still works, just without per-IP separation.
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "local-dev";
}

export async function POST(req: NextRequest) {
  // The event can be switched off (e.g. after the wedding) by setting
  // UPLOADS_ENABLED=false without redeploying code.
  if (process.env.UPLOADS_ENABLED === "false") {
    return NextResponse.json(
      { error: "Uploads for this event are currently closed." },
      { status: 403 }
    );
  }

  const identifier = clientIdentifier(req);
  const rateLimit = checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: UploadRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { filename, contentType, size } = body;
  if (!filename || typeof filename !== "string" || typeof size !== "number") {
    return NextResponse.json({ error: "Missing filename or size." }, { status: 400 });
  }

  const validation = validateFile({ name: filename, type: contentType ?? "", size });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason ?? "This file can't be uploaded." }, { status: 400 });
  }

  try {
    const objectId = generateObjectId();
    const objectKey = buildObjectKey(objectId, getExtension(filename));
    const uploadUrl = await createPresignedUploadUrl({
      objectKey,
      contentType: contentType || "application/octet-stream",
      originalFilename: filename,
    });

    return NextResponse.json({ uploadUrl, objectKey });
  } catch (err) {
    console.error("Failed to create presigned upload URL", err);
    return NextResponse.json(
      { error: "Something went wrong preparing your upload. Please try again." },
      { status: 500 }
    );
  }
}
