const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = getEnv("RESEND_API_KEY");
    const STUDIO_EMAIL = getEnv("STUDIO_EMAIL"); // e.g. snmmyldzz93@gmail.com
    const FROM_EMAIL = process.env.FROM_EMAIL || "PilatesEsra <onboarding@resend.dev>";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const note = String(body?.note || "").trim();
    const class_type = String(body?.class_type || "").trim();
    const date = String(body?.date || "").trim(); // YYYY-MM-DD
    const time = String(body?.time || "").trim();
    const lang = String(body?.lang || "tr").trim();

    if (!full_name || !date || !time || !class_type) {
      return json(res, 400, { ok: false, error: "Missing required fields" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(res, 400, { ok: false, error: "Invalid date format" });
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert([
        {
          full_name,
          email: email || null,
          phone: phone || null,
          note: note || null,
          class_type,
          date,
          time,
          status: "confirmed",
          lang: lang || "tr"
        }
      ])
      .select("id, created_at")
      .single();

    if (error) {
      return json(res, 500, { ok: false, error: "DB insert failed", details: error.message });
    }

    const prettyDateTr = date.split("-").reverse().join(".");
    const subjectTr = `Yeni rezervasyon: ${class_type} · ${prettyDateTr} · ${time}`;
    const subjectFr = `Nouvelle réservation : ${class_type} · ${date} · ${time}`;

    const studioHtml = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6">
        <h2 style="margin:0 0 12px">Yeni Rezervasyon</h2>
        <p style="margin:0 0 10px"><b>Ders</b>: ${escapeHtml(class_type)}<br/>
        <b>Tarih</b>: ${escapeHtml(prettyDateTr)}<br/>
        <b>Saat</b>: ${escapeHtml(time)}</p>
        <p style="margin:0 0 10px"><b>İsim</b>: ${escapeHtml(full_name)}<br/>
        <b>E-posta</b>: ${escapeHtml(email || "—")}<br/>
        <b>Telefon</b>: ${escapeHtml(phone || "—")}</p>
        <p style="margin:0"><b>Not</b>: ${escapeHtml(note || "—")}</p>
        <p style="margin:14px 0 0;color:#666;font-size:12px">Kayıt ID: ${data.id}</p>
      </div>
    `;

    const siteUrl = process.env.SITE_URL || "https://pilatesesra.com";
    const logoUrl = `${siteUrl}/assets/images/pilates-esra-font.png`;
    const cancelUrl = (id, l) => `${siteUrl}/cancel.html?id=${id}&lang=${l}`;

    const userHtmlTr = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6;max-width:520px;">
        <h2 style="margin:0 0 12px;color:#142826;">Rezervasyonunuz alındı</h2>
        <p style="margin:0 0 10px;">Merhaba ${escapeHtml(full_name)},</p>
        <p style="margin:0 0 16px;">Rezervasyonunuz başarıyla oluşturuldu. Aşağıda ders bilgilerinizi bulabilirsiniz:</p>
        <div style="background:#f5f0e8;border-left:3px solid #2E8B86;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0 0 6px;"><b>Ders</b>: ${escapeHtml(class_type)}</p>
          <p style="margin:0 0 6px;"><b>Tarih</b>: ${escapeHtml(prettyDateTr)}</p>
          <p style="margin:0;"><b>Saat</b>: ${escapeHtml(time)}</p>
        </div>
        <p style="margin:0 0 6px;">Herhangi bir sorunuz olursa bize ulaşmaktan çekinmeyin.</p>
        <p style="margin:0 0 6px;font-size:12px;color:#888;">Katılamayacağınız seansınızı en az 24 saat öncesine kadar <a href="${cancelUrl(data.id, 'tr')}" style="color:#2E8B86;">buradan iptal edebilirsiniz</a>.</p>
        <p style="margin:0 0 24px;">Görüşmek üzere,<br/><b>PilatesEsra</b></p>
        <img src="${logoUrl}" alt="PilatesEsra" style="max-width:180px;opacity:0.85;display:block;" />
      </div>
    `;

    const userHtmlFr = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6;max-width:520px;">
        <h2 style="margin:0 0 12px;color:#142826;">Votre réservation est confirmée</h2>
        <p style="margin:0 0 10px;">Bonjour ${escapeHtml(full_name)},</p>
        <p style="margin:0 0 16px;">Votre réservation a bien été enregistrée. Retrouvez ci-dessous le détail de votre cours :</p>
        <div style="background:#f5f0e8;border-left:3px solid #2E8B86;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0 0 6px;"><b>Cours</b> : ${escapeHtml(class_type)}</p>
          <p style="margin:0 0 6px;"><b>Date</b> : ${escapeHtml(date)}</p>
          <p style="margin:0;"><b>Heure</b> : ${escapeHtml(time)}</p>
        </div>
        <p style="margin:0 0 6px;">N'hésitez pas à nous contacter si vous avez la moindre question.</p>
        <p style="margin:0 0 6px;font-size:12px;color:#888;">Si vous ne pouvez pas venir, vous pouvez <a href="${cancelUrl(data.id, 'fr')}" style="color:#2E8B86;">annuler votre séance ici</a> jusqu'à 24h avant.</p>
        <p style="margin:0 0 24px;">À très bientôt,<br/><b>PilatesEsra</b></p>
        <img src="${logoUrl}" alt="PilatesEsra" style="max-width:180px;opacity:0.85;display:block;" />
      </div>
    `;

    // Mail to studio owner
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [STUDIO_EMAIL],
      subject: subjectTr,
      html: studioHtml
    });

    // Mail to user (if email provided)
    if (email) {
      const isFr = lang === "fr";
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: isFr ? subjectFr : subjectTr,
        html: isFr ? userHtmlFr : userHtmlTr
      });
    }

    return json(res, 200, { ok: true, id: data.id });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

