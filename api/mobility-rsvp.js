const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

module.exports = async (req, res) => {
  try {
    const params = new URL(req.url, "http://localhost").searchParams;
    const email = params.get("email") || "";
    const name  = params.get("name") || email;
    const r     = params.get("r") === "yes" ? "yes" : "no";

    const siteUrl = process.env.SITE_URL || "https://pilatesesra.com";

    if (email) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <noreply@pilatesesra.com>";
      const studioEmail = process.env.STUDIO_EMAIL;

      // Haftanın Salı tarihini hesapla
      const now = new Date();
      const day = now.getDay();
      const diff = day <= 2 ? 2 - day : 9 - day;
      const tuesday = new Date(now);
      tuesday.setDate(now.getDate() + diff);
      const weekDate = tuesday.toISOString().split("T")[0];

      // Upsert: aynı kişi aynı hafta tekrar yanıt verirse güncelle
      await supabase.from("mobility_responses").upsert(
        { week_date: weekDate, email, name, response: r },
        { onConflict: "week_date,email" }
      );

      // Güncel listeyi çek
      const { data } = await supabase
        .from("mobility_responses")
        .select("name, response")
        .eq("week_date", weekDate)
        .order("responded_at", { ascending: true });

      const yes = (data || []).filter(x => x.response === "yes").map(x => x.name);
      const no  = (data || []).filter(x => x.response === "no").map(x => x.name);

      await resend.emails.send({
        from: fromEmail,
        to: [studioEmail],
        subject: `Mobility Dersi RSVP · ${weekDate}`,
        html: `
          <div style="font-family:ui-sans-serif,sans-serif;max-width:480px;line-height:1.7;">
            <h2 style="color:#142826;margin-bottom:16px;">Mobility Dersi Katılım Listesi</h2>
            <p style="color:#666;font-size:13px;margin-bottom:20px;">Tarih: <b>${weekDate}</b></p>
            <p><b style="color:#1d8784;">✓ Katılıyor (${yes.length}):</b><br/>
              ${yes.length ? yes.map(n => `• ${n}`).join("<br/>") : "<i style='color:#999;'>Henüz yok</i>"}
            </p>
            <br/>
            <p><b style="color:#C04040;">✗ Katılamıyor (${no.length}):</b><br/>
              ${no.length ? no.map(n => `• ${n}`).join("<br/>") : "<i style='color:#999;'>Henüz yok</i>"}
            </p>
          </div>`
      });
    }

    res.writeHead(302, { Location: `${siteUrl}/mobility-response.html?r=${r}` });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: `${process.env.SITE_URL || "https://pilatesesra.com"}/mobility-response.html?r=yes` });
    res.end();
  }
};
