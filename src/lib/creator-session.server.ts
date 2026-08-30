import { getRequest } from "@tanstack/react-start/server";

const CREATOR_SESSION_COOKIE = "bmb_creator_session";

/**
 * Resolves the first-party creator session set by the trusted X OAuth callback.
 * The HttpOnly cookie is the sole credential for creator dashboard actions.
 */
export function creatorSessionToken(): string | null {
  const cookie = getRequest().headers.get("cookie");
  const match = cookie?.match(new RegExp(`(?:^|;\\s*)${CREATOR_SESSION_COOKIE}=([^;]+)`));
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}
