const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

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
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const studioEmail = process.env.STUDIO_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <onboarding@resend.dev>";

    // Bugünün tarihini al
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("reservations")
      .select("full_name, email, phone, class_type, date, time, note, status, created_at")
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) throw new Error("DB query failed: " + error.message);

    if (!data || data.length === 0) {
      return json(res, 200, { ok: true, message: "No reservations found, no email sent." });
    }

    // Tabloyu HTML olarak oluştur
    const rows = data.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f7f4" : "#ffffff"}">
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${i + 1}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.date}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.time}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.full_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.class_type}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.email || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.phone || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.note || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">
          ${r.status === "cancelled"
            ? '<span style="color:#C04040;font-weight:500;">İptal</span>'
            : '<span style="color:#1d8784;font-weight:500;">Onaylı</span>'}
        </td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:0 auto;">
        <h2 style="color:#142826;margin-bottom:6px;">Günlük Rezervasyon Raporu</h2>
        <p style="color:#666;font-size:13px;margin-bottom:24px;">Oluşturulma: ${today} · Toplam: <b>${data.length}</b> rezervasyon</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#1d8784;color:#ffffff;">
              <th style="padding:10px 14px;text-align:left;">#</th>
              <th style="padding:10px 14px;text-align:left;">Tarih</th>
              <th style="padding:10px 14px;text-align:left;">Saat</th>
              <th style="padding:10px 14px;text-align:left;">İsim</th>
              <th style="padding:10px 14px;text-align:left;">Ders</th>
              <th style="padding:10px 14px;text-align:left;">E-posta</th>
              <th style="padding:10px 14px;text-align:left;">Telefon</th>
              <th style="padding:10px 14px;text-align:left;">Not</th>
              <th style="padding:10px 14px;text-align:left;">Durum</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [studioEmail],
      subject: `PilatesEsra · Rezervasyon Listesi · ${today}`,
      html
    });

    return json(res, 200, { ok: true, sent: data.length });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
