import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { PRESIGNED_URL_EXPIRY_SECONDS } from "./upload-config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazily constructed so a missing env var only breaks the upload route,
// not the entire server at boot.
let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cachedClient;
}

/**
 * Generates a short, random, URL-safe object id. Not a real ULID, just a
 * timestamp-free random token — we don't need sortable ids for this
 * project, only ids that can't be guessed and never collide with the
 * original filename.
 */
export function generateObjectId(): string {
  return randomBytes(10).toString("base64url");
}

export function buildObjectKey(objectId: string, extension: string): string {
  const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `wedding/${objectId}${cleanExt ? `.${cleanExt}` : ""}`;
}

/**
 * Returns a presigned PUT URL good for PRESIGNED_URL_EXPIRY_SECONDS.
 * The original filename is stored as object metadata only — it is never
 * used as the object key.
 */
export async function createPresignedUploadUrl(params: {
  objectKey: string;
  contentType: string;
  originalFilename: string;
}): Promise<string> {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ContentType: params.contentType,
    Metadata: {
      "original-filename": encodeURIComponent(params.originalFilename),
    },
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS });
}
