const { Resend } = require("resend");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const studioEmail = process.env.STUDIO_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <onboarding@resend.dev>";

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const ad    = String(body?.ad    || "").trim();
    const soyad = String(body?.soyad || "").trim();
    const email = String(body?.email || "").trim();
    const konu  = String(body?.konu  || "").trim();
    const mesaj = String(body?.mesaj || "").trim();

    if (!ad || !soyad || !email || !konu || !mesaj) {
      return json(res, 400, { ok: false, error: "Missing required fields" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { ok: false, error: "Invalid email" });
    }

    const fullName = `${ad} ${soyad}`;

    await resend.emails.send({
      from: fromEmail,
      to: [studioEmail],
      reply_to: email,
      subject: `İletişim Formu: ${konu}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;max-width:600px;">
          <h2 style="color:#142826;margin:0 0 16px;">Yeni İletişim Mesajı</h2>
          <div style="background:#f5f0e8;border-left:3px solid #2E8B86;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
            <p style="margin:0 0 6px;"><b>İsim</b>: ${escapeHtml(fullName)}</p>
            <p style="margin:0 0 6px;"><b>E-posta</b>: <a href="mailto:${escapeHtml(email)}" style="color:#2E8B86;">${escapeHtml(email)}</a></p>
            <p style="margin:0;"><b>Konu</b>: ${escapeHtml(konu)}</p>
          </div>
          <p style="margin:0 0 8px;"><b>Mesaj:</b></p>
          <p style="margin:0;white-space:pre-line;background:#fff;border:1px solid rgba(46,139,134,0.15);padding:14px 18px;border-radius:4px;">${escapeHtml(mesaj)}</p>
        </div>
      `
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
