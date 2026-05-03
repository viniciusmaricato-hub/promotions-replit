import { Resend } from "resend";
import type { RunStats } from "./pipeline.js";

interface ResendCredentials {
  apiKey: string;
  fromEmail: string | null;
}

async function getResendCredentials(): Promise<ResendCredentials> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }
  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME not set");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const data = (await response.json()) as { items?: Array<{ settings: { api_key?: string; from_email?: string } }> };
  const item = data.items?.[0];
  if (!item || !item.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return {
    apiKey: item.settings.api_key,
    fromEmail: item.settings.from_email ?? null,
  };
}

// Per integrations skill: never cache the client; tokens may expire.
async function getUncachableResendClient(): Promise<{ client: Resend; fromEmail: string | null }> {
  const { apiKey, fromEmail } = await getResendCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export interface RunSummary {
  startedAt: Date;
  finishedAt: Date;
  results: RunStats[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTimestampUtc(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function jobStatus(r: RunStats): "success" | "error" | "partial" {
  if (r.error && r.recordsInserted === 0) return "error";
  if (r.error) return "partial";
  return "success";
}

function renderHtml(summary: RunSummary): string {
  const totalFetched = summary.results.reduce((s, r) => s + r.recordsFetched, 0);
  const totalInserted = summary.results.reduce((s, r) => s + r.recordsInserted, 0);
  const errorCount = summary.results.filter((r) => r.error !== null).length;
  const duration = formatDuration(summary.finishedAt.getTime() - summary.startedAt.getTime());

  const rows = summary.results
    .map((r) => {
      const status = jobStatus(r);
      const color =
        status === "success" ? "#16a34a" : status === "partial" ? "#d97706" : "#dc2626";
      const errCell = r.error ? escapeHtml(r.error) : "—";
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.source)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.platform)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${color};font-weight:600;">${status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.recordsFetched}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.recordsInserted}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${errCell}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:720px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 4px;">Promotions Monitor — Daily run summary</h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
    ${escapeHtml(formatTimestampUtc(summary.startedAt))} → ${escapeHtml(formatTimestampUtc(summary.finishedAt))}
    &nbsp;·&nbsp; Duration: ${escapeHtml(duration)}
  </p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:14px;">
    <tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;">Jobs processed</td>
      <td style="padding:4px 0;font-weight:600;">${summary.results.length}</td>
    </tr>
    <tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;">Posts fetched</td>
      <td style="padding:4px 0;font-weight:600;">${totalFetched}</td>
    </tr>
    <tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;">Promotions inserted</td>
      <td style="padding:4px 0;font-weight:600;">${totalInserted}</td>
    </tr>
    <tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;">Jobs with errors</td>
      <td style="padding:4px 0;font-weight:600;color:${errorCount > 0 ? "#dc2626" : "#111827"};">${errorCount}</td>
    </tr>
  </table>
  <h3 style="margin:0 0 8px;font-size:16px;">Per-source results</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px;border-top:1px solid #e5e7eb;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Operator</th>
        <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Platform</th>
        <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Status</th>
        <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">Fetched</th>
        <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">Inserted</th>
        <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Error</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6" style="padding:12px;color:#6b7280;">No jobs were executed.</td></tr>`}</tbody>
  </table>
  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
    Sent automatically by the Promotions Monitor pipeline. To change the recipient, set the <code>PIPELINE_NOTIFY_EMAIL</code> environment variable.
  </p>
</body></html>`;
}

function renderText(summary: RunSummary): string {
  const totalFetched = summary.results.reduce((s, r) => s + r.recordsFetched, 0);
  const totalInserted = summary.results.reduce((s, r) => s + r.recordsInserted, 0);
  const errorCount = summary.results.filter((r) => r.error !== null).length;
  const duration = formatDuration(summary.finishedAt.getTime() - summary.startedAt.getTime());

  const lines: string[] = [];
  lines.push(`Promotions Monitor — Daily run summary`);
  lines.push(
    `${formatTimestampUtc(summary.startedAt)} -> ${formatTimestampUtc(summary.finishedAt)} (duration: ${duration})`,
  );
  lines.push("");
  lines.push(`Jobs processed:      ${summary.results.length}`);
  lines.push(`Posts fetched:       ${totalFetched}`);
  lines.push(`Promotions inserted: ${totalInserted}`);
  lines.push(`Jobs with errors:    ${errorCount}`);
  lines.push("");
  lines.push("Per-source results:");
  for (const r of summary.results) {
    const status = jobStatus(r);
    lines.push(
      `  - ${r.source} / ${r.platform}: ${status} · fetched=${r.recordsFetched} · inserted=${r.recordsInserted}${r.error ? ` · error=${r.error}` : ""}`,
    );
  }
  return lines.join("\n");
}

export async function sendRunSummaryEmail(summary: RunSummary): Promise<void> {
  const recipient = process.env["PIPELINE_NOTIFY_EMAIL"] ?? "viniciussmaricato@gmail.com";
  const errorCount = summary.results.filter((r) => r.error !== null).length;
  const totalInserted = summary.results.reduce((s, r) => s + r.recordsInserted, 0);

  const subjectBase = `[Promotions Monitor] Daily run summary — ${formatTimestampUtc(summary.startedAt)}`;
  const subject = errorCount > 0 ? `${subjectBase} (with errors)` : subjectBase;

  const { client, fromEmail: connectionFromEmail } = await getUncachableResendClient();
  // Sender selection (in order):
  //   1. PIPELINE_NOTIFY_FROM env var (explicit override)
  //   2. The Resend connection's configured from_email
  //   3. onboarding@resend.dev (Resend's always-allowed sandbox sender,
  //      delivers to the account owner's verified email)
  // If the primary sender is rejected (e.g. unverified domain), we retry
  // once against onboarding@resend.dev so the digest still goes out.
  const primaryFrom =
    process.env["PIPELINE_NOTIFY_FROM"] ??
    connectionFromEmail ??
    "onboarding@resend.dev";
  const fromCandidates = Array.from(
    new Set([primaryFrom, "onboarding@resend.dev"].filter(Boolean) as string[]),
  );

  let lastError: unknown = null;
  for (const from of fromCandidates) {
    const result = await client.emails.send({
      from,
      to: recipient,
      subject,
      html: renderHtml(summary),
      text: renderText(summary),
    });
    if (!result.error) {
      console.log(
        `[pipeline] Run summary email sent from ${from} to ${recipient} (jobs=${summary.results.length}, inserted=${totalInserted}, errors=${errorCount}, id=${result.data?.id ?? "?"})`,
      );
      return;
    }
    lastError = result.error;
    console.warn(
      `[pipeline] Resend rejected sender ${from}: ${JSON.stringify(result.error)}`,
    );
  }
  throw new Error(`Resend API returned error: ${JSON.stringify(lastError)}`);
}
