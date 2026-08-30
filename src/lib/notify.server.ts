import { admin } from "./db.server";
import { isDeliverableEmail } from "./validate";

/** Notification email is explicit creator contact data, never the synthetic X identity user. */
export async function creatorEmail(creatorId: string): Promise<string | null> {
  try {
    const db = admin();
    const { data: notification } = await db
      .from("creator_notification_emails")
      .select("notification_email")
      .eq("creator_id", creatorId)
      .maybeSingle();
    const email = (notification?.notification_email as string | null) ?? null;
    if (!isDeliverableEmail(email)) {
      console.warn("creator notification email unavailable", {
        creatorId,
        reason: email ? "invalid" : "missing",
      });
      return null;
    }
    return email.trim().toLowerCase();
  } catch (e) {
    console.error("creatorEmail lookup failed", e);
    return null;
  }
}
