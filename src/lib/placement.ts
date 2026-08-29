/**
 * Canonical sponsored placement.
 *
 * Buy My Bio sells the SPONSOR SPOT on a creator's Buy My Bio profile. The
 * sponsorship is displayed on buymybio.com only — creators are never asked to
 * edit their X bio or take any action on X. X is used for authentication and
 * identity/profile data only.
 *
 * Legacy X-bio placement helpers below are retained for historical records.
 *
 * Pure module — safe to import from client and server code.
 */

/**
 * Website-only sponsorship mode. When true, no paid transaction depends on any
 * X action: no activation window, no bio verification, no bio-length limits.
 */
export const WEBSITE_ONLY_SPONSORSHIP = true;

export const SPONSOR_PREFIX = "Sponsored:";
/** Buyer message allowance. */
export const MESSAGE_MAX_CHARS = 100;
/** Legacy X bio limit (historical placements only). */
export const X_BIO_MAX_CHARS = 160;

/** Placement format versions. v1 = legacy (no automatic disclosure). */
export type PlacementFormat = "v1" | "v2";
export const CURRENT_PLACEMENT_FORMAT: PlacementFormat = "v2";

export function normalizeFormat(value: string | null | undefined): PlacementFormat {
  return value === "v2" ? "v2" : "v1";
}

/** The exact text that must be live in the X bio. */
export function buildPlacementText(
  message: string | null | undefined,
  url: string | null | undefined,
  format: PlacementFormat = CURRENT_PLACEMENT_FORMAT,
): string {
  const msg = (message ?? "").trim();
  const link = (url ?? "").trim();
  const body = [msg, link].filter(Boolean).join(" ");
  if (!body) return "";
  return format === "v2" ? `${SPONSOR_PREFIX} ${body}` : body;
}

/** Characters the placement costs on top of the buyer's message. */
export function placementOverheadChars(url: string | null | undefined): number {
  const link = (url ?? "").trim();
  // "Sponsored:" + space + message + space + url
  return SPONSOR_PREFIX.length + 1 + (link ? link.length + 1 : 0);
}

/**
 * The creator's own bio text, with the current sponsored placement removed.
 * Used to work out how much room a new sponsor actually has.
 */
export function retainedBioText(
  snapshot: string | null | undefined,
  currentPlacements: Array<string | null | undefined> = [],
): string {
  let text = (snapshot ?? "").trim();
  if (!text) return "";
  for (const raw of currentPlacements) {
    const needle = (raw ?? "").trim();
    if (!needle) continue;
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx >= 0) text = `${text.slice(0, idx)}${text.slice(idx + needle.length)}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * How many characters the buyer's message may use for this specific creator.
 * Never more than MESSAGE_MAX_CHARS, and less when the creator's own bio text
 * already takes up space.
 */
export function messageCharLimit(retainedChars: number, url: string | null | undefined): number {
  // Website-only sponsorships live on buymybio.com, so the creator's X bio
  // length is irrelevant: every buyer gets the full message allowance.
  if (WEBSITE_ONLY_SPONSORSHIP) return MESSAGE_MAX_CHARS;
  const retained = Math.max(0, retainedChars);
  const spacer = retained > 0 ? 1 : 0;
  const room = X_BIO_MAX_CHARS - retained - spacer - placementOverheadChars(url);
  return Math.max(0, Math.min(MESSAGE_MAX_CHARS, room));
}

export type PlacementValidation =
  { ok: true; placement: string; limit: number } | { ok: false; error: string; limit: number };

/**
 * Single source of truth for "does this sponsored placement fit and is it
 * allowed". Runs on both the client (live feedback) and the server (authority).
 */
export function validatePlacement(input: {
  message: string;
  url: string;
  retainedChars: number;
}): PlacementValidation {
  const message = input.message.trim();
  const url = input.url.trim();
  const limit = messageCharLimit(input.retainedChars, url);

  if (message.length < 3)
    return { ok: false, error: "Your message must be at least 3 characters.", limit };
  if (!url) return { ok: false, error: "Add the link your sponsorship should point to.", limit };

  if (limit <= 0) {
    return {
      ok: false,
      error: "This link is too long for the sponsor spot. Use a shorter link.",
      limit: 0,
    };
  }
  if (message.length > limit) {
    return {
      ok: false,
      error:
        limit < MESSAGE_MAX_CHARS
          ? `This creator has ${limit} characters of bio space available. Shorten your message to ${limit} characters.`
          : `Your message must be ${MESSAGE_MAX_CHARS} characters or fewer.`,
      limit,
    };
  }

  return { ok: true, placement: buildPlacementText(message, url), limit };
}
