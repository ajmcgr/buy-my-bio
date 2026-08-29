import { admin } from "./db.server";

/** Creators have no email column — their address lives on the auth user. */
export async function creatorEmail(creatorId: string): Promise<string | null> {
  try {
    const db = admin();
    const { data: creator } = await db
      .from("creators")
      .select("user_id")
      .eq("id", creatorId)
      .maybeSingle();
    const userId = (creator?.user_id as string | null) ?? null;
    if (!userId) return null;
    const { data } = await db.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch (e) {
    console.error("creatorEmail lookup failed", e);
    return null;
  }
}
