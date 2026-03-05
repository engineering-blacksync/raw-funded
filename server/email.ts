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

export async function sendWelcomeEmail(to: string, username: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[email] Sending welcome to ${to}, from: ${fromEmail}`);
    const result = await client.emails.send({
      from: fromEmail || 'Raw Funded <noreply@rawfunded.com>',
      to,
      subject: 'Welcome to Raw Funded',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 40px; border: 1px solid #222228;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff;">RAW </span>
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #E8C547;">FUNDED</span>
          </div>
          <div style="background: #0F0F12; border: 1px solid #222228; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #E8C547; font-size: 20px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Welcome Aboard</h2>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi <strong style="color: #fff;">${username}</strong>, your account has been created successfully.
            </p>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Your account is currently pending verification. Submit your trading proof through the dashboard, and our team will review it shortly.
            </p>
            <div style="background: #141418; border: 1px solid #222228; padding: 16px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Status</td>
                  <td style="color: #E8C547; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">PENDING VERIFICATION</td>
                </tr>
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Next Step</td>
                  <td style="color: #fff; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">Submit Proof</td>
                </tr>
              </table>
            </div>
            <p style="color: #A1A1AA; font-size: 13px; line-height: 1.6; margin: 0;">
              No rules, no challenges — just trade your edge and withdraw same day once approved.
            </p>
          </div>
          <div style="text-align: center; color: #71717A; font-size: 11px;">
            <p style="margin: 0;">&copy; 2026 Raw Funded. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[email] Welcome email result:`, JSON.stringify(result));
  } catch (err: any) {
    console.error(`[email] Failed to send welcome email to ${to}:`, err.message, err);
  }
}

export async function sendPayoutUpdateEmail(to: string, username: string, amount: number, stage: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[email] Sending payout update to ${to}, stage: ${stage}, from: ${fromEmail}`);

    const stageLabels: Record<string, string> = {
      payout_accepted: 'Payout Accepted',
      risk_approved: 'Risk Approved',
      funds_sent: 'Funds Sent',
      rejected: 'Payout Rejected',
    };
    const stageColors: Record<string, string> = {
      payout_accepted: '#E8C547',
      risk_approved: '#3B82F6',
      funds_sent: '#22C55E',
      rejected: '#EF4444',
    };
    const stageMessages: Record<string, string> = {
      payout_accepted: 'Your payout request has been accepted and is now being processed.',
      risk_approved: 'Your payout has passed risk review and is being prepared for transfer.',
      funds_sent: 'Your funds have been sent! Please check your payment method for the transfer.',
      rejected: 'Unfortunately, your payout request has been declined. Your balance has been restored. Please contact support if you have questions.',
    };

    const label = stageLabels[stage] || stage;
    const color = stageColors[stage] || '#A1A1AA';
    const message = stageMessages[stage] || 'Your payout status has been updated.';
    const subject = stage === 'funds_sent' ? 'Raw Funded — Your Payout Has Been Sent!' : stage === 'rejected' ? 'Raw Funded — Payout Update' : `Raw Funded — Payout ${label}`;

    const result = await client.emails.send({
      from: fromEmail || 'Raw Funded <noreply@rawfunded.com>',
      to,
      subject,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 40px; border: 1px solid #222228;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff;">RAW </span>
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #E8C547;">FUNDED</span>
          </div>
          <div style="background: #0F0F12; border: 1px solid #222228; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: ${color}; font-size: 20px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">${label}</h2>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi <strong style="color: #fff;">${username}</strong>, ${message}
            </p>
            <div style="background: #141418; border: 1px solid #222228; padding: 16px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Amount</td>
                  <td style="color: #fff; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Status</td>
                  <td style="color: ${color}; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0; text-transform: uppercase;">${label}</td>
                </tr>
              </table>
            </div>
          </div>
          <div style="text-align: center; color: #71717A; font-size: 11px;">
            <p style="margin: 0;">&copy; 2026 Raw Funded. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[email] Payout update email result:`, JSON.stringify(result));
  } catch (err: any) {
    console.error(`[email] Failed to send payout update email to ${to}:`, err.message, err);
  }
}

export async function sendLiquidationEmail(to: string, username: string, balance: number) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[email] Sending liquidation notice to ${to}, from: ${fromEmail}`);
    const result = await client.emails.send({
      from: fromEmail || 'Raw Funded <noreply@rawfunded.com>',
      to,
      subject: 'Raw Funded — Account Liquidated',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 40px; border: 1px solid #222228;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff;">RAW </span>
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #E8C547;">FUNDED</span>
          </div>
          <div style="background: #0F0F12; border: 1px solid #222228; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #EF4444; font-size: 20px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Account Liquidated</h2>
            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi <strong style="color: #fff;">${username}</strong>, your account equity dropped to zero and all open positions have been automatically closed.
            </p>
            <div style="background: #141418; border: 1px solid #EF444430; padding: 16px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Account Balance</td>
                  <td style="color: #EF4444; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="color: #A1A1AA; font-size: 12px; text-transform: uppercase; padding: 6px 0;">Positions</td>
                  <td style="color: #fff; font-size: 14px; font-weight: 700; text-align: right; padding: 6px 0;">All Closed</td>
                </tr>
              </table>
            </div>
            <p style="color: #A1A1AA; font-size: 13px; line-height: 1.6; margin: 0;">
              Contact your administrator if you have any questions about your account.
            </p>
          </div>
          <div style="text-align: center; color: #71717A; font-size: 11px;">
            <p style="margin: 0;">&copy; 2026 Raw Funded. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[email] Liquidation email result:`, JSON.stringify(result));
  } catch (err: any) {
    console.error(`[email] Failed to send liquidation email to ${to}:`, err.message, err);
  }
}
