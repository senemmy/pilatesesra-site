const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

module.exports = async (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <noreply@pilatesesra.com>";
    const siteUrl = process.env.SITE_URL || "https://pilatesesra.com";

    // Bu haftanın Salı tarihini hesapla
    const now = new Date();
    const day = now.getDay();
    const diff = day <= 2 ? 2 - day : 9 - day;
    const tuesday = new Date(now);
    tuesday.setDate(now.getDate() + diff);
    const weekDate = tuesday.toISOString().split("T")[0];

    // Zaten cevap verenleri bul
    const { data: responded } = await supabase
      .from("mobility_responses")
      .select("email")
      .eq("week_date", weekDate);

    const respondedEmails = new Set((responded || []).map(r => r.email));

    // Tüm alıcılardan cevap vermeyenleri filtrele
    const allRecipients = (process.env.MOBILITY_RECIPIENTS || "")
      .split(",")
      .map(e => {
        const [name, email] = e.trim().split(":");
        return { name: name?.trim(), email: email?.trim() };
      })
      .filter(r => r.email?.includes("@"));

    const pending = allRecipients.filter(r => !respondedEmails.has(r.email));

    if (!pending.length) {
      res.end(JSON.stringify({ ok: true, message: "Herkes cevap vermiş." }));
      return;
    }

    const logoImg = `<div style="margin-top:28px;text-align:center;">
      <img src="${siteUrl}/assets/images/pilates-esra-font.png" alt="PilatesEsra" style="height:80px;width:auto;opacity:0.85;"/>
    </div>`;

    await Promise.all(
      pending.map(({ name, email }) => {
        const enc = encodeURIComponent(email);
        const encName = encodeURIComponent(name);
        return resend.emails.send({
          from: fromEmail,
          to: [email],
          subject: "Hatırlatma: Mobility dersine katılacak mısın? 🌿",
          html: `
            <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.7;max-width:520px;margin:0 auto;">
              <h2 style="color:#142826;margin:0 0 18px;font-size:22px;">Henüz cevap vermemişsin! 🌿</h2>
              <p style="margin:0 0 24px;color:#2A3A39;font-size:15px;">
                Bu haftaki <b>Mobility</b> dersine katılıp katılmayacağını henüz öğrenemedik.<br/>
                Bir dakikan varsa bildirmen yeterli 😊
              </p>
              <div style="display:flex;gap:12px;margin-bottom:28px;">
                <a href="${siteUrl}/api/mobility-rsvp?email=${enc}&name=${encName}&r=yes"
                   style="display:inline-block;padding:13px 28px;background:#C09040;color:#142826;
                          text-decoration:none;font-family:ui-sans-serif,sans-serif;font-size:13px;
                          font-weight:600;letter-spacing:1px;border-radius:3px;">
                  ✓ Evet, geliyorum!
                </a>
                <a href="${siteUrl}/api/mobility-rsvp?email=${enc}&name=${encName}&r=no"
                   style="display:inline-block;padding:13px 28px;background:#f5f0e8;color:#2A3A39;
                          text-decoration:none;font-family:ui-sans-serif,sans-serif;font-size:13px;
                          font-weight:600;letter-spacing:1px;border-radius:3px;border:1px solid #d0bea0;">
                  Ne yazık ki yokum :(
                </a>
              </div>
              <p style="margin:0 0 4px;color:#2A3A39;font-size:14px;">Görüşmek üzere,</p>
              <p style="margin:0;font-weight:700;color:#142826;font-size:14px;">PilatesEsra</p>
              ${logoImg}
            </div>`
        });
      })
    );

    res.end(JSON.stringify({ ok: true, reminded: pending.length, emails: pending.map(p => p.email) }));
  } catch (e) {
    res.end(JSON.stringify({ ok: false, error: e?.message }));
  }
};
