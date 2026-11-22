import { neon } from "@neondatabase/serverless";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

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
    await sql`
      INSERT INTO waitlist (email, source)
      VALUES (${email}, ${"website"})
      ON CONFLICT (lower(email)) DO NOTHING
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("waitlist error");
    return res.status(500).json({ error: "Something went wrong" });
  }
}
