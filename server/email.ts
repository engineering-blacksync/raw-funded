import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendApprovalEmail(to: string, username: string, tier: string, balance: number) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[email] Sending approval to ${to}, from: ${fromEmail}`);
    const result = await client.emails.send({
      from: fromEmail || 'Raw Funded <noreply@rawfunded.com>',
      to,
      subject: 'Your Raw Funded Account Has Been Approved',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 40px; border: 1px solid #222228;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff;">RAW </span>
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #E8C547;">FUNDED</span>
          </div>
          <div style="background: #0F0F12; border: 1px solid #222228; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #22C55E; font-size: 20px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Account Approved</h2>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Welcome, <strong style="color: #fff;">${username}</strong>. Your verification has been reviewed and approved. Your funded account is now active.
            </p>
            <div style="background: #141418; border: 1px solid #222228; padding: 16px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Tier</td>
                  <td style="color: #E8C547; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0; text-transform: uppercase;">${tier}</td>
                </tr>
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Starting Balance</td>
                  <td style="color: #fff; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>
            <p style="color: #A1A1AA; font-size: 13px; line-height: 1.6; margin: 0;">
              Log in to your dashboard to start trading. No rules, no challenges — just trade your edge and withdraw same day.
            </p>
          </div>
          <div style="text-align: center; color: #71717A; font-size: 11px;">
            <p style="margin: 0;">© 2026 Raw Funded. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[email] Approval email result:`, JSON.stringify(result));
  } catch (err: any) {
    console.error(`[email] Failed to send approval email to ${to}:`, err.message, err);
  }
}

export async function sendRejectionEmail(to: string, username: string, reason?: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[email] Sending rejection to ${to}, from: ${fromEmail}`);
    const result = await client.emails.send({
      from: fromEmail || 'Raw Funded <noreply@rawfunded.com>',
      to,
      subject: 'Raw Funded — Verification Update',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 40px; border: 1px solid #222228;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff;">RAW </span>
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #E8C547;">FUNDED</span>
          </div>
          <div style="background: #0F0F12; border: 1px solid #222228; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #EF4444; font-size: 20px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Verification Not Approved</h2>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi <strong style="color: #fff;">${username}</strong>, we've reviewed your verification submission and were unable to approve it at this time.
            </p>
            ${reason ? `
            <div style="background: #141418; border: 1px solid #EF444430; padding: 16px; margin-bottom: 16px;">
              <div style="color: #EF4444; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Reason</div>
              <p style="color: #fff; font-size: 14px; margin: 0;">${reason}</p>
            </div>
            ` : ''}
            <p style="color: #A1A1AA; font-size: 13px; line-height: 1.6; margin: 0;">
              You can resubmit your verification with additional proof. Log in to your account to try again.
            </p>
          </div>
          <div style="text-align: center; color: #71717A; font-size: 11px;">
            <p style="margin: 0;">© 2026 Raw Funded. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[email] Rejection email result:`, JSON.stringify(result));
  } catch (err: any) {
    console.error(`[email] Failed to send rejection email to ${to}:`, err.message, err);
  }
}
