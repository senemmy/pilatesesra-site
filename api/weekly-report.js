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

    // Bu haftanın Pazartesi–Pazar aralığını hesapla (TR UTC+3)
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
    const dayOfWeek = now.getUTCDay(); // 0=Paz, 1=Pzt...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const fmt = d => d.toISOString().split("T")[0];
    const weekStart = fmt(monday);
    const weekEnd   = fmt(sunday);

    const { data, error } = await supabase
      .from("reservations")
      .select("full_name, email, phone, class_type, date, time, note, status, created_at")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) throw new Error("DB query failed: " + error.message);

    const prettyRange = `${weekStart} – ${weekEnd}`;

    const statusLabel = s => s === "cancelled"
      ? '<span style="color:#C04040;font-weight:500;">İptal</span>'
      : '<span style="color:#1d8784;font-weight:500;">Onaylı</span>';

    const rows = (data || []).map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f7f4" : "#ffffff"}">
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${i + 1}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.date}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.time}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.full_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.class_type}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.email || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.phone || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${r.note || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e0d4;">${statusLabel(r.status)}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:960px;margin:0 auto;">
        <h2 style="color:#142826;margin-bottom:4px;">Haftalık Rezervasyon Raporu</h2>
        <p style="color:#666;font-size:13px;margin-bottom:24px;">
          Hafta: <b>${prettyRange}</b> · Toplam: <b>${(data || []).length}</b> rezervasyon
        </p>
        ${!(data || []).length ? '<p style="color:#888;">Bu hafta için rezervasyon bulunmuyor.</p>' : `
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
        </table>`}
      </div>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [studioEmail],
      subject: `PilatesEsra · Haftalık Rapor · ${prettyRange}`,
      html
    });

    return json(res, 200, { ok: true, week: prettyRange, count: (data || []).length });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
