import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Enter a message.").max(5_000),
});

async function messageKey(input: z.infer<typeof contactInput>) {
  const payload = JSON.stringify(input);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactInput.parse(input))
  .handler(async ({ data }) => {
    const { sendContactEmail } = await import("./email.server");
    try {
      const result = await sendContactEmail({
        ...data,
        subject: data.subject || null,
        idempotencyKey: `socialbid:contact:${await messageKey(data)}`,
      });
      if (!result.sent) return { ok: false as const };
      return { ok: true as const };
    } catch (error) {
      console.error("contact form delivery failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return { ok: false as const };
    }
  });
