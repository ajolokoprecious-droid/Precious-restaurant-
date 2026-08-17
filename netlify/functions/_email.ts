// Shared helper: sends real email notifications via Resend (https://resend.com).
// Requires RESEND_API_KEY to be set as an environment variable in Netlify.
// Free Resend accounts can send from "onboarding@resend.dev" to the email
// address you signed up with, with no domain setup needed.

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error(
      '[EMAIL ERROR] RESEND_API_KEY is not set in Netlify environment variables. Email was NOT sent. Subject: ' +
        subject
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Precious Restaurant <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[EMAIL ERROR] Resend API rejected the request:', res.status, body);
  } else {
    console.log(`[EMAIL SENT] To ${to}: "${subject}"`);
  }
}

export function generateUniqueCode(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSegment = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}-${year}${month}${day}-${randomSegment}`;
}
