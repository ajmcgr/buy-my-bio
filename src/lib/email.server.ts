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

const LOGO =
  "https://buymybio.com/__l5e/assets-v1/e89eede8-c031-4ffa-987e-8e62a2749c4d/email-logo.png";

function shell(
  body: string,
  footNote = "You received this because you bid on a bio at Buy My Bio.",
) {
  return `<div style="background:#f6f7f9;padding:40px 16px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6e8eb;border-radius:4px">
    <tr><td align="center" style="padding:36px 32px;border-bottom:1px solid #e6e8eb">
      <img src="${LOGO}" alt="Buy My Bio" width="180" style="display:block;width:180px;max-width:60%;height:auto" />
    </td></tr>
    <tr><td style="padding:40px 40px 44px;color:#1c1f23;font-size:17px;line-height:1.6">
      ${body}
    </td></tr>
    <tr><td align="center" style="padding:24px 32px;border-top:1px solid #e6e8eb;color:#8b9096;font-size:14px">
      ${footNote}
    </td></tr>
  </table>
</div>`;
}

function h1(text: string) {
  return `<h1 style="font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;margin:0 0 20px;color:#111418">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 20px;color:#3c4149;font-size:17px;line-height:1.6">${text}</p>`;
}

function facts(rows: Array<[string, string]>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e6e8eb;border-radius:6px;padding:0;margin:0 0 28px;width:100%">
    <tr><td style="padding:20px 22px">
      ${rows
        .map(
          ([k, v]) =>
            `<div style="font-size:16px;line-height:2;color:#3c4149"><span style="color:#8b9096">${k}</span> &nbsp;<b style="color:#111418">${v}</b></div>`,
        )
        .join("")}
    </td></tr>
  </table>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#206dcb;color:#ffffff;text-decoration:none;padding:14px 26px;font-weight:600;font-size:16px;border-radius:6px">${label}</a>`;
}

function textLink(href: string, label: string) {
  return `<div style="margin-top:20px"><a href="${href}" style="color:#206dcb;text-decoration:none;font-size:16px">${label}</a></div>`;
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
  globalRank?: number | null;
}) {
  const link = `${baseUrl()}/u/${o.username}`;
  const share = `${baseUrl()}/own/${o.ownershipId}`;
  const tweet = `https://x.com/intent/post?text=${encodeURIComponent(
    `I just bought @${o.handle}'s bio for ${money(o.amountCents)}.`,
  )}&url=${encodeURIComponent(share)}`;
  await send(
    o.to,
    o.globalRank === 1 ? `You own the #1 bio on X.` : `You own @${o.handle}'s bio.`,
    shell(`
      ${h1(o.globalRank === 1 ? "You own the #1 bio." : "You own it \u{1F389}")}
      ${p(`Your bid went through — <b>@${o.handle}</b>'s bio now points to <b>${o.company}</b>, and it stays yours until somebody pays more.`)}
      ${facts([
        ["You paid", money(o.amountCents)],
        ...(o.globalRank
          ? ([["Global rank", `#${o.globalRank} most valuable`]] as Array<[string, string]>)
          : []),
        ["Your startup", o.company],
        ["Destination", o.destination],
        ["Status", "Current owner"],
      ])}
      ${button(link, "See your listing \u2192")}
      ${textLink(tweet, "Share it on X \u2192")}
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
  lostNumberOne?: boolean;
  newOwner?: string;
  takeoverAmountCents?: number;
}) {
  const link = `${baseUrl()}/u/${o.username}`;
  await send(
    o.to,
    o.lostNumberOne ? "You lost the #1 bio." : "You've been outbid.",
    shell(`
      ${h1(o.lostNumberOne ? "You lost the #1 bio." : "Someone paid more")}
      ${p(
        o.lostNumberOne
          ? `<b>${o.newOwner ?? "Someone"}</b> just stole @${o.handle} for ${money(o.takeoverAmountCents ?? 0)}. You can take #1 back at any time.`
          : `Your spot in <b>@${o.handle}</b>'s bio was just taken. You can take it back at the new price at any time.`,
      )}
      ${facts([
        ["You paid", money(o.paidCents)],
        ["New price", money(o.newPriceCents)],
        ["You owned it for", o.duration],
        ["Clicks received", o.clicks.toLocaleString()],
      ])}
      ${button(link, `Take it back \u2014 ${money(o.newPriceCents)}`)}
    `),
  );
}
