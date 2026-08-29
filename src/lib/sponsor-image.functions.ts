import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const imageIn = z.object({
  data: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1024),
  type: z.string(),
});

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Uploads a sponsor-owned square icon. Storage writes remain server-only. */
export const uploadSponsorImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => imageIn.parse(input))
  .handler(async ({ data }) => {
    if (!allowedTypes.has(data.type)) return { error: "Use a PNG, JPG, or WebP image." } as const;

    const bytes = decodeBase64(data.data);
    if (!bytes || bytes.byteLength > MAX_IMAGE_BYTES)
      return { error: "Your image must be 2 MB or smaller." } as const;

    const { admin } = await import("./db.server");
    const db = admin();
    const bucket = "sponsor-images";
    const { data: buckets, error: bucketsError } = await db.storage.listBuckets();
    if (bucketsError) return { error: "Image uploads are unavailable right now." } as const;

    if (!buckets?.some((item) => item.name === bucket)) {
      const { error } = await db.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: String(MAX_IMAGE_BYTES),
        allowedMimeTypes: [...allowedTypes],
      });
      if (error && !/already exists/i.test(error.message))
        return { error: "Image uploads are unavailable right now." } as const;
    }

    const extension = data.type === "image/jpeg" ? "jpg" : data.type.split("/")[1];
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from(bucket).upload(path, bytes, {
      contentType: data.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) return { error: "We couldn't upload that image. Please try again." } as const;

    const { data: publicUrl } = db.storage.from(bucket).getPublicUrl(path);
    return { url: publicUrl.publicUrl } as const;
  });
