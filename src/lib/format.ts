export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function nextPriceCents(currentCents: number, pct: number): number {
  // Listings store percentage to two decimal places. Converting it to integer
  // basis points avoids IEEE-754 drift (for example $8,200 + 10% becoming $9,021).
  const percentageBasisPoints = Math.round(pct * 100);
  return Math.ceil((currentCents * (10_000 + percentageBasisPoints)) / 1_000_000) * 100;
}

export function duration(from: string, to?: string | null): string {
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
