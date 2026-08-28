import { baseUrl } from "./db.server";

const FROM = "Buy My Bio <noreply@buymybio.com>";

async function send(to: string, subject: string, html: string) {
  const key = process.env["RESEND_API_KEY"];
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
  } catch (e) {
    console.error("resend failed", e);
  }
}

const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

function shell(body: string) {
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial;max-width:520px;margin:0 auto;padding:32px;color:#111">
  <div style="font-weight:800;letter-spacing:-0.03em;font-size:20px;margin-bottom:24px">BUY MY BIO</div>
  ${body}
  <div style="margin-top:40px;font-size:12px;color:#777">buymybio.com — highest bidder owns it until they're outbid.</div>
</div>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700;border-radius:6px">${label}</a>`;
}

export function humanDuration(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function sendWinnerEmail(o: {
  to: string;
  handle: string;
  username: string;
  amountCents: number;
  destination: string;
  company: string;
  ownershipId: string;
}) {
  const link = `${baseUrl()}/u/${o.username}`;
  const share = `${baseUrl()}/own/${o.ownershipId}`;
  const tweet = `https://x.com/intent/post?text=${encodeURIComponent(
    `I just bought @${o.handle}'s bio for ${money(o.amountCents)}.`,
  )}&url=${encodeURIComponent(share)}`;
  await send(
    o.to,
    `You own @${o.handle}'s bio.`,
    shell(`
      <h1 style="font-size:32px;margin:0 0 8px;letter-spacing:-0.03em">YOU OWN IT.</h1>
      <p style="margin:0 0 24px;color:#555">Until somebody pays more.</p>
      <table style="font-size:15px;line-height:2;margin-bottom:24px">
        <tr><td style="color:#777;padding-right:16px">You paid</td><td><b>${money(o.amountCents)}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">Your startup</td><td><b>${o.company}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">Destination</td><td><b>${o.destination}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">Status</td><td><b>Current owner</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">Listing</td><td><a href="${link}">${link.replace("https://", "")}</a></td></tr>
      </table>
      ${button(tweet, "SHARE ON X")}
    `),
  );
}

export async function sendOutbidEmail(o: {
  to: string;
  handle: string;
  username: string;
  paidCents: number;
  newPriceCents: number;
  duration: string;
  clicks: number;
}) {
  const link = `${baseUrl()}/u/${o.username}`;
  await send(
    o.to,
    "You've been outbid.",
    shell(`
      <h1 style="font-size:32px;margin:0 0 8px;letter-spacing:-0.03em">SOMEONE PAID MORE.</h1>
      <p style="margin:0 0 24px;color:#555">Someone just bought @${o.handle}'s bio from you.</p>
      <table style="font-size:15px;line-height:2;margin-bottom:24px">
        <tr><td style="color:#777;padding-right:16px">You paid</td><td><b>${money(o.paidCents)}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">New price</td><td><b>${money(o.newPriceCents)}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">You owned it for</td><td><b>${o.duration}</b></td></tr>
        <tr><td style="color:#777;padding-right:16px">Clicks received</td><td><b>${o.clicks.toLocaleString()}</b></td></tr>
      </table>
      ${button(link, `TAKE IT BACK — ${money(o.newPriceCents)}`)}
    `),
  );
}
