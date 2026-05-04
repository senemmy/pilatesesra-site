const { Resend } = require("resend");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <noreply@pilatesesra.com>";
    const siteUrl = process.env.SITE_URL || "https://pilatesesra.com";

    const recipients = (process.env.MOBILITY_RECIPIENTS || "snmmyldzz93@gmail.com")
      .split(",")
      .map(e => e.trim())
      .filter(Boolean);

    const logoImg = `<div style="margin-top:28px;text-align:center;">
      <img src="${siteUrl}/assets/images/pilates-esra-font.png" alt="PilatesEsra" style="height:80px;width:auto;opacity:0.85;"/>
    </div>`;

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.7;max-width:520px;margin:0 auto;">
        <h2 style="color:#142826;margin:0 0 18px;font-size:22px;">PilatesEsra ile Mobility dersine var mısın? 🌿</h2>
        <p style="margin:0 0 24px;color:#2A3A39;font-size:15px;">
          Bu haftaki <b>Mobility</b> dersinde seni görmek çok güzel olur!<br/>
          Katılımını bize bildirmen yeterli.
        </p>
        <div style="display:flex;gap:12px;margin-bottom:28px;">
          <a href="${siteUrl}/mobility-response.html?r=yes"
             style="display:inline-block;padding:13px 28px;background:#C09040;color:#142826;
                    text-decoration:none;font-family:ui-sans-serif,sans-serif;font-size:13px;
                    font-weight:600;letter-spacing:1px;border-radius:3px;">
            ✓ Evet, geliyorum!
          </a>
          <a href="${siteUrl}/mobility-response.html?r=no"
             style="display:inline-block;padding:13px 28px;background:#f5f0e8;color:#2A3A39;
                    text-decoration:none;font-family:ui-sans-serif,sans-serif;font-size:13px;
                    font-weight:600;letter-spacing:1px;border-radius:3px;border:1px solid #d0bea0;">
            Ne yazık ki yokum :(
          </a>
        </div>
        <p style="margin:0 0 4px;color:#2A3A39;font-size:14px;">Görüşmek üzere,</p>
        <p style="margin:0;font-weight:700;color:#142826;font-size:14px;">PilatesEsra</p>
        ${logoImg}
      </div>
    `;

    const results = await Promise.all(
      recipients.map(to =>
        resend.emails.send({
          from: fromEmail,
          to: [to],
          subject: "PilatesEsra ile Mobility dersine var mısın? 🌿",
          html
        })
      )
    );

    return json(res, 200, { ok: true, sent: recipients.length, recipients });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
