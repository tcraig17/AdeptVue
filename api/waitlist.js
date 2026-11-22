import { neon } from "@neondatabase/serverless";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

const FROM = "AdeptVue <hello@adeptvue.com>";
const REPLY_TO = "hello@adeptvue.com";
const SUBJECT = "You're on the AdeptVue waitlist";

const TEXT = `Hi there,

Thanks for joining the AdeptVue waitlist. You're on the list.

We'll email you when AdeptVue launches. Until then, we won't fill your inbox.

If you didn't sign up, or you'd like to be removed, just reply to this email and we'll take you off the list.

The AdeptVue team
https://adeptvue.com`;

const HTML = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0E1A2B;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="font-size:20px;font-weight:700;color:#0E1A2B;">Adept<span style="color:#0F766E;">Vue</span></div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px 32px;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 16px 0;">Hi there,</p>
                <p style="margin:0 0 16px 0;">Thanks for joining the AdeptVue waitlist. <strong>You're on the list.</strong></p>
                <p style="margin:0 0 16px 0;">We'll email you when AdeptVue launches. Until then, we won't fill your inbox.</p>
                <p style="margin:0 0 24px 0;color:#475569;">If you didn't sign up, or you'd like to be removed, just reply to this email and we'll take you off the list.</p>
                <p style="margin:0;">The AdeptVue team</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #E5E7EB;font-size:13px;color:#475569;">
                <a href="https://adeptvue.com" style="color:#0F766E;text-decoration:none;">adeptvue.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

async function sendConfirmation(email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: REPLY_TO,
        subject: SUBJECT,
        text: TEXT,
        html: HTML,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      console.error("waitlist confirmation email failed", resp.status);
    }
  } catch {
    console.error("waitlist confirmation email error");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch {
        return res.status(400).json({ error: "Invalid request" });
      }
    }
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (typeof body.company === "string" && body.company.trim() !== "") {
      return res.status(200).json({ ok: true });
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("waitlist missing database configuration");
      return res.status(500).json({ error: "Something went wrong" });
    }

    const sql = neon(databaseUrl);
    const inserted = await sql`
      INSERT INTO waitlist (email, source)
      VALUES (${email}, ${"website"})
      ON CONFLICT (lower(email)) DO NOTHING
      RETURNING email
    `;

    // Only brand-new signups get a confirmation email. The response is the
    // same either way, so the endpoint never reveals whether an email exists.
    if (Array.isArray(inserted) && inserted.length > 0) {
      await sendConfirmation(email);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("waitlist error");
    return res.status(500).json({ error: "Something went wrong" });
  }
}
